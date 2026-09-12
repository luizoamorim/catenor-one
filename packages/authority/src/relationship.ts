import {
  createCredential,
  prepareCredentialProof,
  verifyProof,
  type Credential,
  type ProofOptions,
  type VerifiableCredential,
} from '@catenor-one/credentials';
import {
  authorizesAssertion,
  decodeEd25519Multikey,
  findVerificationMethod,
  type DidDocument,
} from '@catenor-one/identity';

/**
 * Relationship Credential (Catenor Protocol working shape, DATA-MODEL-BASELINE §14): `credentialSubject.id` is the
 * subject, `relationship.type` the predicate, `relationship.object` the object. A Relationship describes a connection
 * and NEVER grants permission (Relationship ≠ Capability); authority comes only from explicit Capability grants.
 */
export const RELATIONSHIP_CREDENTIAL = 'CatenorRelationshipCredential';

/**
 * Catenor One [REF-IMPL] predicates. The canonical predicate vocabulary is an OPEN DESIGN ITEM
 * (authority/01-RELATIONSHIPS.md §5); the protocol's only example, OFFICER_OF, relates a Human to an Organization and
 * is therefore not used for an Organization or an Agent here.
 */
export const RELATIONSHIP_PREDICATES = {
  /** Sponsor → Trust Domain (issued by the Trust Anchor): the Sponsor participates as a sponsor in the domain. */
  AUTHORIZED_SPONSOR_IN: 'AUTHORIZED_SPONSOR_IN',
  /** SPV → Sponsor (issued by the Sponsor): the SPV is sponsored/controlled by the Sponsor. */
  SPONSORED_BY: 'SPONSORED_BY',
  /** Agent → Sponsor (issued by the Sponsor): the Agent acts for the Sponsor. */
  AGENT_OF: 'AGENT_OF',
} as const;
export type RelationshipPredicate =
  (typeof RELATIONSHIP_PREDICATES)[keyof typeof RELATIONSHIP_PREDICATES];

export function createRelationshipCredential(input: {
  readonly id: string;
  readonly issuer: string;
  readonly subject: string;
  readonly predicate: RelationshipPredicate;
  readonly object: string;
  readonly validFrom: string;
  readonly validUntil: string;
  readonly statusId: string;
}): Credential {
  if (!Object.values(RELATIONSHIP_PREDICATES).includes(input.predicate)) {
    throw new TypeError(`unknown relationship predicate ${String(input.predicate)}`);
  }
  return createCredential({
    id: input.id,
    type: RELATIONSHIP_CREDENTIAL,
    issuer: input.issuer,
    validFrom: input.validFrom,
    validUntil: input.validUntil,
    credentialSubject: {
      id: input.subject,
      relationship: { type: input.predicate, object: input.object },
    },
    statusId: input.statusId,
  });
}

export function prepareRelationshipProof(
  credential: Credential,
  verificationMethod: string,
  created: string,
): { proofOptions: ProofOptions; hashData: Uint8Array } {
  return prepareCredentialProof(credential, verificationMethod, created);
}

export interface RelationshipVerification {
  readonly valid: boolean;
  readonly reasons: readonly (
    | 'MALFORMED'
    | 'ISSUER_KEY_NOT_ASSERTION_METHOD'
    | 'SIGNATURE_INVALID'
    | 'OUTSIDE_VALIDITY_WINDOW'
    | 'UNEXPECTED_RELATIONSHIP'
  )[];
}

/** Verifies a Relationship Credential against the issuer's resolved DID Document and an expected triple. */
export function verifyRelationshipCredential(input: {
  readonly credential: VerifiableCredential | undefined;
  readonly issuerDocument: DidDocument | undefined;
  readonly expected: {
    readonly subject: string;
    readonly predicate: string;
    readonly object: string;
  };
  readonly now: Date;
}): RelationshipVerification {
  const vc = input.credential;
  const relationship = vc?.credentialSubject?.relationship as
    { type?: unknown; object?: unknown } | undefined;
  if (!vc?.proof || !vc.type?.includes(RELATIONSHIP_CREDENTIAL) || !relationship) {
    return { valid: false, reasons: ['MALFORMED'] };
  }
  const reasons: RelationshipVerification['reasons'][number][] = [];
  const vmId = vc.proof.verificationMethod;
  const vm = input.issuerDocument && findVerificationMethod(input.issuerDocument, vmId);
  if (
    vm === undefined ||
    input.issuerDocument?.id !== vc.issuer ||
    !authorizesAssertion(input.issuerDocument, vmId) ||
    vc.proof.proofPurpose !== 'assertionMethod'
  ) {
    reasons.push('ISSUER_KEY_NOT_ASSERTION_METHOD');
  } else {
    const { proof, ...unsecured } = vc;
    let valid: boolean;
    try {
      valid = verifyProof(unsecured, proof, decodeEd25519Multikey(vm.publicKeyMultibase));
    } catch {
      valid = false;
    }
    if (!valid) reasons.push('SIGNATURE_INVALID');
  }
  const now = input.now.getTime();
  if (!(Date.parse(vc.validFrom) <= now && now <= Date.parse(vc.validUntil))) {
    reasons.push('OUTSIDE_VALIDITY_WINDOW');
  }
  if (
    vc.credentialSubject.id !== input.expected.subject ||
    relationship.type !== input.expected.predicate ||
    relationship.object !== input.expected.object
  ) {
    reasons.push('UNEXPECTED_RELATIONSHIP');
  }
  return { valid: reasons.length === 0, reasons };
}
