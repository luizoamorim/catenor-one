import { verifyProof, type DataIntegrityProof, type ProofOptions } from '@catenor-one/credentials';
import { prepareProof } from '@catenor-one/credentials';
import {
  authorizesAssertion,
  decodeEd25519Multikey,
  findVerificationMethod,
  type DidDocument,
} from '@catenor-one/identity';

/**
 * Catenor One [REF-IMPL] hackathon demo vocabulary — NOT frozen Catenor Protocol vocabulary (the protocol's Action
 * vocabulary and Constraint grammar are open in Draft v0.1, specification/authority/02-CAPABILITIES.md §6).
 */
export const TOKENIZE_ASSET = 'TOKENIZE_ASSET';

/** Protocol Capability working shape exactly (`capability.schema.json`: these four fields, nothing else). */
export interface Capability {
  readonly subject: string;
  readonly action: string;
  readonly resource: string;
  readonly constraints: { readonly validUntil: string };
}

/**
 * [REF-IMPL] envelope: an issuer grants one protocol-shaped Capability. Relationship ≠ Capability — nothing here is
 * inferred from a relationship; the grant is explicit and signed by the issuer's Credential Assertion Key.
 */
export interface CapabilityGrantPayload {
  readonly type: 'CatenorOneCapabilityGrant';
  readonly id: string;
  readonly issuer: string;
  readonly issuedAt: string;
  readonly capability: Capability;
}

export interface CapabilityGrant extends CapabilityGrantPayload {
  readonly proof: DataIntegrityProof;
}

const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

export function createCapabilityGrant(input: {
  id: string;
  issuer: string;
  subject: string;
  action: string;
  resource: string;
  validUntil: string;
  issuedAt: string;
}): CapabilityGrantPayload {
  if (!RFC3339.test(input.validUntil) || !RFC3339.test(input.issuedAt)) {
    throw new TypeError('validUntil and issuedAt must be RFC 3339 date-times');
  }
  if (Date.parse(input.validUntil) <= Date.parse(input.issuedAt)) {
    throw new TypeError('validUntil must be after issuedAt');
  }
  if (input.issuer === input.subject) throw new TypeError('a grant needs a distinct subject');
  return {
    type: 'CatenorOneCapabilityGrant',
    id: input.id,
    issuer: input.issuer,
    issuedAt: input.issuedAt,
    capability: {
      subject: input.subject,
      action: input.action,
      resource: input.resource,
      constraints: { validUntil: input.validUntil },
    },
  };
}

/** eddsa-jcs-2022 proof options for the grant; the signer boundary signs the returned hashData. */
export function prepareCapabilityGrantProof(
  payload: CapabilityGrantPayload,
  verificationMethod: string,
  created: string,
): { proofOptions: ProofOptions; hashData: Uint8Array } {
  return prepareProof(
    { ...payload },
    {
      type: 'DataIntegrityProof',
      cryptosuite: 'eddsa-jcs-2022',
      verificationMethod,
      proofPurpose: 'assertionMethod',
      created,
    },
  );
}

export type CapabilityDenialReason =
  | 'CAPABILITY_MISSING'
  | 'CAPABILITY_MALFORMED'
  | 'ISSUER_NOT_ACTIVE_TRUST_ANCHOR'
  | 'ISSUER_KEY_NOT_ASSERTION_METHOD'
  | 'SIGNATURE_INVALID'
  | 'SUBJECT_MISMATCH'
  | 'ACTION_MISMATCH'
  | 'RESOURCE_MISMATCH'
  | 'EXPIRED';

export interface CapabilityAuthorization {
  readonly decision: 'ALLOW' | 'DENY';
  readonly reasons: readonly CapabilityDenialReason[];
}

/**
 * Authorizes one requested action against a capability grant (fail closed; every failing check is reported):
 * signature by the issuer's assertion key, issuer currently an ACTIVE Trust Anchor, subject = requester, action,
 * resource, not expired.
 */
export function authorizeWithCapability(input: {
  readonly grant: CapabilityGrant | undefined;
  /** Resolved public DID Document of the grant issuer. */
  readonly issuerDocument: DidDocument | undefined;
  /** Result of Trust Anchor verification of the issuer at request time (S001 verifier). */
  readonly issuerIsActiveTrustAnchor: boolean;
  readonly request: {
    readonly requester: string;
    readonly action: string;
    readonly resource: string;
  };
  readonly now: Date;
}): CapabilityAuthorization {
  const { grant, request } = input;
  if (grant === undefined) return { decision: 'DENY', reasons: ['CAPABILITY_MISSING'] };
  const c = grant.capability;
  if (
    grant.type !== 'CatenorOneCapabilityGrant' ||
    typeof c?.subject !== 'string' ||
    typeof c.constraints?.validUntil !== 'string' ||
    !grant.proof
  ) {
    return { decision: 'DENY', reasons: ['CAPABILITY_MALFORMED'] };
  }
  const reasons: CapabilityDenialReason[] = [];
  if (!input.issuerIsActiveTrustAnchor) reasons.push('ISSUER_NOT_ACTIVE_TRUST_ANCHOR');

  const vmId = grant.proof.verificationMethod;
  const vm = input.issuerDocument && findVerificationMethod(input.issuerDocument, vmId);
  if (
    vm === undefined ||
    input.issuerDocument?.id !== grant.issuer ||
    !authorizesAssertion(input.issuerDocument, vmId)
  ) {
    reasons.push('ISSUER_KEY_NOT_ASSERTION_METHOD');
  } else {
    const { proof, ...payload } = grant;
    let valid: boolean;
    try {
      valid = verifyProof({ ...payload }, proof, decodeEd25519Multikey(vm.publicKeyMultibase));
    } catch {
      valid = false;
    }
    if (!valid) reasons.push('SIGNATURE_INVALID');
  }
  if (c.subject !== request.requester) reasons.push('SUBJECT_MISMATCH');
  if (c.action !== request.action) reasons.push('ACTION_MISMATCH');
  if (c.resource !== request.resource) reasons.push('RESOURCE_MISMATCH');
  const until = Date.parse(c.constraints.validUntil);
  if (Number.isNaN(until) || input.now.getTime() > until) reasons.push('EXPIRED');
  return { decision: reasons.length === 0 ? 'ALLOW' : 'DENY', reasons };
}
