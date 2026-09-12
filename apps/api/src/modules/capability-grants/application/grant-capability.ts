// Scoped Capability grant (Catenor One [REF-IMPL] hackathon vocabulary): an ACTIVE Trust Anchor grants one
// protocol-shaped Capability {subject, action, resource, constraints.validUntil}, signed with its Credential
// Assertion Key (eddsa-jcs-2022). Used for TOKENIZE_ASSET (Part B) and EXECUTE_DISTRIBUTION (final demo).
// Relationship ≠ Capability: authority comes only from this explicit, signed grant.
import { commit } from '@catenor-one/audit';
import {
  CREATE_AGENT,
  CREATE_DISTRIBUTION,
  DEFINE_OFFERING_POLICY,
  DELEGATE_DISTRIBUTION_AUTHORITY,
  EXECUTE_DISTRIBUTION,
  TOKENIZE_ASSET,
  createCapabilityGrant,
  type CapabilityGrant,
  type TrustAnchorVerificationResult,
} from '@catenor-one/authority';
import type {
  AssertionSigner,
  Clock,
  IdGenerator,
} from '../../trust-anchor-admission/application/admission.ports.js';
import type { UnitOfWork } from '../../trust-anchor-admission/application/persistence.ports.js';

/** The only actions this reference implementation grants (all [REF-IMPL] vocabulary). */
export const GRANTABLE_ACTIONS = [
  TOKENIZE_ASSET,
  EXECUTE_DISTRIBUTION,
  DEFINE_OFFERING_POLICY,
  CREATE_AGENT,
  CREATE_DISTRIBUTION,
  DELEGATE_DISTRIBUTION_AUTHORITY,
] as const;
export type GrantableAction = (typeof GRANTABLE_ACTIONS)[number];

export interface CapabilityGrantDeps {
  readonly uow: UnitOfWork;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  /** Trust Domain whose audit chain records the grant. */
  readonly trustDomain: string;
  readonly assertionSigner: AssertionSigner;
  /** S001 Trust Anchor verification (12 checks) of the grant issuer. */
  readonly verifyTrustAnchor: (did: string) => Promise<TrustAnchorVerificationResult>;
}

export class CapabilityGrantRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CapabilityGrantRefused';
  }
}

const rfc3339 = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

/** The issuer must verify as an ACTIVE Trust Anchor; it signs with its Credential Assertion Key. */
export async function grantCapability(
  deps: CapabilityGrantDeps,
  input: {
    readonly issuer: string;
    readonly subject: string;
    readonly action: GrantableAction;
    readonly resource: string;
    readonly validUntil: string;
  },
): Promise<CapabilityGrant> {
  if (!(GRANTABLE_ACTIONS as readonly string[]).includes(input.action)) {
    throw new CapabilityGrantRefused(`action ${String(input.action)} is not grantable`);
  }
  const verification = await deps.verifyTrustAnchor(input.issuer);
  if (!verification.TRUST_ANCHOR_VALID) {
    throw new CapabilityGrantRefused('the issuer is not an ACTIVE Trust Anchor');
  }
  return signGrant(deps, input);
}

/**
 * Signs and records one grant with the issuer's ACTIVE Credential Assertion Key. The CALLER establishes the issuer's
 * authority first: an ACTIVE Trust Anchor (grantCapability) or a verified delegator (clean-room delegation).
 */
export async function signGrant(
  deps: CapabilityGrantDeps,
  input: {
    readonly issuer: string;
    readonly subject: string;
    readonly action: GrantableAction;
    readonly resource: string;
    readonly validUntil: string;
  },
): Promise<CapabilityGrant> {
  const key = await deps.uow.run(async (p) => {
    const resolved = await p.didState.resolve(input.issuer);
    const vmId = resolved?.document.assertionMethod[0];
    const keyRef = vmId ? await p.didState.findKeyReference(vmId) : undefined;
    if (!vmId || keyRef?.purpose !== 'CREDENTIAL_ASSERTION' || keyRef.status !== 'ACTIVE') {
      throw new CapabilityGrantRefused('the issuer has no ACTIVE Credential Assertion Key');
    }
    const subject = await p.subjects.findSubjectByDid(input.subject);
    if (subject === undefined) throw new CapabilityGrantRefused('unknown capability subject');
    return { vmId, signerRef: keyRef.signerRef };
  });
  const now = rfc3339(deps.clock.now());
  const payload = createCapabilityGrant({
    id: deps.ids.id('capability-grant'),
    issuer: input.issuer,
    subject: input.subject,
    action: input.action,
    resource: input.resource,
    validUntil: input.validUntil,
    issuedAt: now,
  });
  const grant = await deps.assertionSigner.signCapabilityGrant(key.signerRef, {
    grant: payload,
    verificationMethod: key.vmId,
    created: now,
  });
  await deps.uow.run((p) =>
    p.audit.append(deps.trustDomain, {
      type: 'CAPABILITY_GRANTED',
      subject: input.subject,
      timestamp: rfc3339(deps.clock.now()),
      details: {
        grantId: grant.id,
        issuer: grant.issuer,
        action: input.action,
        resource: input.resource,
        validUntil: input.validUntil,
        grantCommitment: commit(grant),
      },
    }),
  );
  return grant;
}
