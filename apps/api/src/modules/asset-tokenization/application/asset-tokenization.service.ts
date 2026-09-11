// Part B (hackathon, Catenor One [REF-IMPL]) — an ACTIVE Trust Anchor grants Org B one scoped capability
// (TOKENIZE_ASSET on asset:catenor-one-demo:001); Org B's tokenization request is authorized against it, and ONLY an
// ALLOW reaches the asset executor (Hedera ATS testnet). Policy Decision ≠ Execution Authorization: Catenor decides;
// the executor adapter executes. Relationship ≠ Capability: authority comes only from the explicit, signed grant.
import { commit } from '@catenor-one/audit';
import {
  TOKENIZE_ASSET,
  authorizeWithCapability,
  createCapabilityGrant,
  type CapabilityDenialReason,
  type CapabilityGrant,
  type TrustAnchorVerificationResult,
} from '@catenor-one/authority';
import { generateCatenorDid, type CatenorDid } from '@catenor-one/identity';
import type {
  AssertionSigner,
  Clock,
  IdGenerator,
} from '../../trust-anchor-admission/application/admission.ports.js';
import type {
  PersistencePorts,
  UnitOfWork,
} from '../../trust-anchor-admission/application/persistence.ports.js';

/** The real asset-action side (Hedera ATS testnet). Invoked only after a Catenor ALLOW. */
export interface AssetTokenizationExecutor {
  readonly network: string;
  tokenize(input: {
    readonly resource: string;
    readonly requester: string;
    readonly grantId: string;
  }): Promise<{ readonly transactionId: string; readonly explorerUrl?: string }>;
}

export interface AssetTokenizationDeps {
  readonly uow: UnitOfWork;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  /** Trust Domain whose audit chain records Part B. */
  readonly trustDomain: string;
  readonly assertionSigner: AssertionSigner;
  /** S001 Trust Anchor verification (12 checks) of the grant issuer, at grant and at request time. */
  readonly verifyTrustAnchor: (did: string) => Promise<TrustAnchorVerificationResult>;
  readonly executor: AssetTokenizationExecutor;
}

export type TokenizationOutcome =
  | {
      readonly decision: 'ALLOW';
      readonly transactionId: string;
      readonly network: string;
      readonly explorerUrl?: string;
    }
  | { readonly decision: 'DENY'; readonly reasons: readonly CapabilityDenialReason[] };

export class CapabilityGrantRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CapabilityGrantRefused';
  }
}

const rfc3339 = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

export class AssetTokenizationService {
  constructor(private readonly deps: AssetTokenizationDeps) {}

  /** Creates Org B as a canonical ORGANIZATION Subject with a random did:catenor (not a Trust Anchor). */
  async registerOrganization(): Promise<{ did: CatenorDid }> {
    const did = generateCatenorDid(this.deps.ids.randomBytes(16));
    await this.deps.uow.run(async (p) => {
      await p.subjects.createSubject({
        id: this.deps.ids.id('subject'),
        did,
        type: 'ORGANIZATION',
        lifecycle: 'ACTIVE',
      });
      await this.audit(p, 'SUBJECT_CREATED', did);
    });
    return { did };
  }

  /** The issuer must verify as an ACTIVE Trust Anchor; it signs with its Credential Assertion Key. */
  async grantTokenizationCapability(input: {
    readonly issuer: string;
    readonly subject: string;
    readonly resource: string;
    readonly validUntil: string;
  }): Promise<CapabilityGrant> {
    const verification = await this.deps.verifyTrustAnchor(input.issuer);
    if (!verification.TRUST_ANCHOR_VALID) {
      throw new CapabilityGrantRefused('the issuer is not an ACTIVE Trust Anchor');
    }
    const key = await this.deps.uow.run(async (p) => {
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
    const now = rfc3339(this.deps.clock.now());
    const payload = createCapabilityGrant({
      id: this.deps.ids.id('capability-grant'),
      issuer: input.issuer,
      subject: input.subject,
      action: TOKENIZE_ASSET,
      resource: input.resource,
      validUntil: input.validUntil,
      issuedAt: now,
    });
    const grant = await this.deps.assertionSigner.signCapabilityGrant(key.signerRef, {
      grant: payload,
      verificationMethod: key.vmId,
      created: now,
    });
    await this.deps.uow.run((p) =>
      this.audit(p, 'CAPABILITY_GRANTED', input.subject, {
        grantId: grant.id,
        issuer: grant.issuer,
        action: TOKENIZE_ASSET,
        resource: input.resource,
        validUntil: input.validUntil,
        grantCommitment: commit(grant),
      }),
    );
    return grant;
  }

  /** Authorizes Org B's request against the grant; only ALLOW invokes the executor. */
  async requestTokenization(input: {
    readonly requester: string;
    readonly resource: string;
    readonly grant: CapabilityGrant | undefined;
  }): Promise<TokenizationOutcome> {
    const issuer = input.grant?.issuer;
    const issuerDocument = issuer
      ? (await this.deps.uow.run((p) => p.didState.resolve(issuer)))?.document
      : undefined;
    const issuerIsActiveTrustAnchor = issuer
      ? (await this.deps.verifyTrustAnchor(issuer)).TRUST_ANCHOR_VALID
      : false;
    const authorization = authorizeWithCapability({
      grant: input.grant,
      issuerDocument,
      issuerIsActiveTrustAnchor,
      request: { requester: input.requester, action: TOKENIZE_ASSET, resource: input.resource },
      now: this.deps.clock.now(),
    });
    const details = {
      grantId: input.grant?.id ?? null,
      action: TOKENIZE_ASSET,
      resource: input.resource,
    };
    if (authorization.decision === 'DENY') {
      await this.deps.uow.run((p) =>
        this.audit(p, 'ASSET_ACTION_DENIED', input.requester, {
          ...details,
          reasons: [...authorization.reasons],
        }),
      );
      return { decision: 'DENY', reasons: authorization.reasons };
    }
    await this.deps.uow.run((p) =>
      this.audit(p, 'ASSET_ACTION_AUTHORIZED', input.requester, details),
    );
    const executed = await this.deps.executor.tokenize({
      resource: input.resource,
      requester: input.requester,
      grantId: input.grant!.id,
    });
    await this.deps.uow.run((p) =>
      this.audit(p, 'ASSET_ACTION_EXECUTED', input.requester, {
        ...details,
        network: this.deps.executor.network,
        transactionId: executed.transactionId,
      }),
    );
    return { decision: 'ALLOW', network: this.deps.executor.network, ...executed };
  }

  private audit(
    p: PersistencePorts,
    type: Parameters<PersistencePorts['audit']['append']>[1]['type'],
    subject: string,
    details?: Record<string, string | number | boolean | null | readonly string[]>,
  ) {
    return p.audit.append(this.deps.trustDomain, {
      type,
      subject,
      timestamp: rfc3339(this.deps.clock.now()),
      ...(details ? { details } : {}),
    });
  }
}
