import {
  prepareProof,
  verifyProof,
  type DataIntegrityProof,
  type ProofOptions,
} from '@catenor-one/credentials';
import {
  authorizesAssertion,
  decodeEd25519Multikey,
  findVerificationMethod,
  type DidDocument,
} from '@catenor-one/identity';
import {
  DEFINE_OFFERING_POLICY,
  authorizeWithCapability,
  type CapabilityDenialReason,
  type CapabilityGrant,
} from './capability.js';

/**
 * Catenor One [REF-IMPL] offering definition: the Sponsor, under its DEFINE_OFFERING_POLICY capability, states which
 * policy decides who may invest in an SPV resource, which credential it accepts and how many units exist. Signed by
 * the Sponsor's Credential Assertion Key (eddsa-jcs-2022). The policy itself is a Catenor policy document pinned by
 * hash — not a new policy framework.
 */
export interface OfferingDefinitionPayload {
  readonly type: 'CatenorOneOfferingDefinition';
  readonly id: string;
  readonly issuer: string;
  readonly issuedAt: string;
  readonly resource: string;
  readonly asset: {
    readonly name: string;
    readonly description: string;
    readonly totalUnits: number;
  };
  readonly eligibility: {
    readonly policy: string;
    readonly policyHash: string;
    readonly credentialType: string;
  };
  readonly validUntil: string;
}

export interface OfferingDefinition extends OfferingDefinitionPayload {
  readonly proof: DataIntegrityProof;
}

const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

export function createOfferingDefinition(
  input: Omit<OfferingDefinitionPayload, 'type'>,
): OfferingDefinitionPayload {
  if (!RFC3339.test(input.issuedAt) || !RFC3339.test(input.validUntil)) {
    throw new TypeError('issuedAt and validUntil must be RFC 3339 date-times');
  }
  if (Date.parse(input.validUntil) <= Date.parse(input.issuedAt)) {
    throw new TypeError('validUntil must be after issuedAt');
  }
  if (!Number.isInteger(input.asset.totalUnits) || input.asset.totalUnits <= 0) {
    throw new TypeError('totalUnits must be a positive integer');
  }
  if (!/^0x[0-9a-f]{64}$/.test(input.eligibility.policyHash)) {
    throw new TypeError('policyHash must be a 0x-hex SHA-256');
  }
  return { type: 'CatenorOneOfferingDefinition', ...input };
}

export function prepareOfferingProof(
  payload: OfferingDefinitionPayload,
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

export type OfferingDenialReason =
  'OFFERING_MALFORMED' | 'OFFERING_SIGNATURE_INVALID' | 'OFFERING_EXPIRED' | CapabilityDenialReason;

/**
 * An offering is authoritative only if its Sponsor signed it AND held DEFINE_OFFERING_POLICY on the resource from
 * the ACTIVE Trust Anchor (fail closed; every failing check reported).
 */
export function authorizeOfferingDefinition(input: {
  readonly offering: OfferingDefinition | undefined;
  readonly sponsorDocument: DidDocument | undefined;
  readonly sponsorGrant: CapabilityGrant | undefined;
  readonly rootDocument: DidDocument | undefined;
  readonly rootIsActiveTrustAnchor: boolean;
  readonly now: Date;
}): { readonly decision: 'ALLOW' | 'DENY'; readonly reasons: readonly OfferingDenialReason[] } {
  const o = input.offering;
  if (o?.type !== 'CatenorOneOfferingDefinition' || !o.proof) {
    return { decision: 'DENY', reasons: ['OFFERING_MALFORMED'] };
  }
  const reasons: OfferingDenialReason[] = [];
  const vm =
    input.sponsorDocument &&
    findVerificationMethod(input.sponsorDocument, o.proof.verificationMethod);
  let signed = false;
  if (
    vm !== undefined &&
    input.sponsorDocument?.id === o.issuer &&
    authorizesAssertion(input.sponsorDocument, o.proof.verificationMethod)
  ) {
    const { proof, ...payload } = o;
    try {
      signed = verifyProof({ ...payload }, proof, decodeEd25519Multikey(vm.publicKeyMultibase));
    } catch {
      signed = false;
    }
  }
  if (!signed) reasons.push('OFFERING_SIGNATURE_INVALID');
  if (input.now.getTime() > Date.parse(o.validUntil)) reasons.push('OFFERING_EXPIRED');
  const authority = authorizeWithCapability({
    grant: input.sponsorGrant,
    issuerDocument: input.rootDocument,
    issuerIsActiveTrustAnchor: input.rootIsActiveTrustAnchor,
    request: { requester: o.issuer, action: DEFINE_OFFERING_POLICY, resource: o.resource },
    now: input.now,
  });
  reasons.push(...authority.reasons);
  return { decision: reasons.length === 0 ? 'ALLOW' : 'DENY', reasons };
}
