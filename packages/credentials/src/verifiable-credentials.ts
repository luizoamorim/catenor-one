import { controllerOf, decodeEd25519Multikey } from '@catenor-one/identity';
import {
  DATA_INTEGRITY_PROOF,
  EDDSA_JCS_2022,
  prepareProof,
  verifyProof,
  type DataIntegrityProof,
  type ProofOptions,
} from './eddsa-jcs-2022.js';

/**
 * W3C Verifiable Credentials 2.0 / Verifiable Presentations with `DataIntegrityProof` / `eddsa-jcs-2022` (the approved
 * Catenor One crypto profile). Shapes follow the Catenor Protocol working envelopes (specification/credentials/01, 02).
 * Open in Draft v0.1 and chosen here as Catenor One [REF-IMPL]: the Catenor context URI, the credential id convention,
 * the status mechanism (an issuer-signed status statement) and the holder-binding rules (holder proof under
 * `authentication` with the verifier's `challenge` and `domain`).
 *
 * A valid signature proves authorship and integrity only — not claim truth, issuer authority or current status. Those
 * are separate checks below, each reported by name (never a single "verified" label).
 */
export const W3C_VC_V2_CONTEXT = 'https://www.w3.org/ns/credentials/v2';
/** [REF-IMPL] placeholder for the Catenor context (OPEN DESIGN ITEM). Never dereferenced: JCS signs the literal. */
export const CATENOR_ONE_CONTEXT = 'https://catenor.xyz/ns/catenor-one/v0';
export const CATENOR_ONE_STATUS_TYPE = 'CatenorOneCredentialStatus';
export const CATENOR_ONE_STATUS_STATEMENT = 'CatenorOneCredentialStatusStatement';

/** Protocol lifecycle states that a status statement may carry (credentials/04 §1). UNKNOWN is never ACTIVE. */
export const CREDENTIAL_STATUSES = ['ACTIVE', 'SUSPENDED', 'REVOKED'] as const;
export type CredentialStatus = (typeof CREDENTIAL_STATUSES)[number];

export interface CredentialSubject {
  readonly id: string;
  readonly [claim: string]: unknown;
}

export interface Credential {
  readonly '@context': readonly string[];
  readonly id: string;
  readonly type: readonly string[];
  readonly issuer: string;
  readonly validFrom: string;
  readonly validUntil: string;
  readonly credentialSubject: CredentialSubject;
  readonly credentialStatus: { readonly id: string; readonly type: typeof CATENOR_ONE_STATUS_TYPE };
}

export interface VerifiableCredential extends Credential {
  readonly proof: DataIntegrityProof;
}

export interface Presentation {
  readonly '@context': readonly string[];
  readonly type: readonly string[];
  readonly holder: string;
  readonly verifiableCredential: readonly VerifiableCredential[];
}

export interface VerifiablePresentation extends Presentation {
  readonly proof: DataIntegrityProof;
}

/** [REF-IMPL] issuer-signed statement of a credential's current status at `checkedAt`. */
export interface CredentialStatusStatement {
  readonly type: typeof CATENOR_ONE_STATUS_STATEMENT;
  readonly statusId: string;
  readonly credentialId: string;
  readonly issuer: string;
  readonly status: CredentialStatus;
  readonly checkedAt: string;
}

export interface SignedCredentialStatusStatement extends CredentialStatusStatement {
  readonly proof: DataIntegrityProof;
}

const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;
const isString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

function assertTime(name: string, value: string) {
  if (!RFC3339.test(value)) throw new TypeError(`${name} must be an RFC 3339 date-time`);
}

export function createCredential(input: {
  readonly id: string;
  /** Catenor credential subtype, e.g. CatenorInvestorEligibilityCredential. */
  readonly type: string;
  readonly issuer: string;
  readonly validFrom: string;
  readonly validUntil: string;
  readonly credentialSubject: CredentialSubject;
  readonly statusId: string;
}): Credential {
  assertTime('validFrom', input.validFrom);
  assertTime('validUntil', input.validUntil);
  if (Date.parse(input.validUntil) <= Date.parse(input.validFrom)) {
    throw new TypeError('validUntil must be after validFrom');
  }
  if (!isString(input.credentialSubject.id)) {
    throw new TypeError('credentialSubject.id is required');
  }
  if (input.issuer === input.credentialSubject.id) {
    throw new TypeError('a credential needs a subject distinct from its issuer');
  }
  return {
    '@context': [W3C_VC_V2_CONTEXT, CATENOR_ONE_CONTEXT],
    id: input.id,
    type: ['VerifiableCredential', input.type],
    issuer: input.issuer,
    validFrom: input.validFrom,
    validUntil: input.validUntil,
    credentialSubject: { ...input.credentialSubject },
    credentialStatus: { id: input.statusId, type: CATENOR_ONE_STATUS_TYPE },
  };
}

const proofOptions = (
  verificationMethod: string,
  proofPurpose: 'assertionMethod' | 'authentication',
  created: string,
  extra: { challenge?: string; domain?: string } = {},
): ProofOptions => ({
  type: DATA_INTEGRITY_PROOF,
  cryptosuite: EDDSA_JCS_2022,
  verificationMethod,
  proofPurpose,
  created,
  ...extra,
});

/** Issuer proof (`assertionMethod`); the signer boundary signs the returned hashData. */
export function prepareCredentialProof(
  credential: Credential,
  verificationMethod: string,
  created: string,
): { proofOptions: ProofOptions; hashData: Uint8Array } {
  if (controllerOf(verificationMethod) !== credential.issuer) {
    throw new TypeError('the issuer proof must use a verification method of the issuer');
  }
  return prepareProof(
    { ...credential },
    proofOptions(verificationMethod, 'assertionMethod', created),
  );
}

export function createPresentation(input: {
  readonly holder: string;
  readonly credentials: readonly VerifiableCredential[];
}): Presentation {
  if (input.credentials.length === 0) throw new TypeError('a presentation needs a credential');
  return {
    '@context': [W3C_VC_V2_CONTEXT, CATENOR_ONE_CONTEXT],
    type: ['VerifiablePresentation'],
    holder: input.holder,
    verifiableCredential: [...input.credentials],
  };
}

/** Holder proof (`authentication`), bound to the verifier's `challenge` and `domain`. */
export function preparePresentationProof(
  presentation: Presentation,
  input: {
    readonly verificationMethod: string;
    readonly created: string;
    readonly challenge: string;
    readonly domain: string;
  },
): { proofOptions: ProofOptions; hashData: Uint8Array } {
  if (controllerOf(input.verificationMethod) !== presentation.holder) {
    throw new TypeError('the holder proof must use a verification method of the holder');
  }
  if (!isString(input.challenge) || !isString(input.domain)) {
    throw new TypeError('a holder proof needs a challenge and a domain');
  }
  return prepareProof(
    { ...presentation },
    proofOptions(input.verificationMethod, 'authentication', input.created, {
      challenge: input.challenge,
      domain: input.domain,
    }),
  );
}

export function createStatusStatement(input: {
  readonly credential: Credential;
  readonly status: CredentialStatus;
  readonly checkedAt: string;
}): CredentialStatusStatement {
  assertTime('checkedAt', input.checkedAt);
  return {
    type: CATENOR_ONE_STATUS_STATEMENT,
    statusId: input.credential.credentialStatus.id,
    credentialId: input.credential.id,
    issuer: input.credential.issuer,
    status: input.status,
    checkedAt: input.checkedAt,
  };
}

export function prepareStatusStatementProof(
  statement: CredentialStatusStatement,
  verificationMethod: string,
  created: string,
): { proofOptions: ProofOptions; hashData: Uint8Array } {
  if (controllerOf(verificationMethod) !== statement.issuer) {
    throw new TypeError('a status statement is signed by the credential issuer');
  }
  return prepareProof(
    { ...statement },
    proofOptions(verificationMethod, 'assertionMethod', created),
  );
}

// ---- Verification ---------------------------------------------------------------------------------------------

/** A key the verifier accepts for one issuer (the Trust Domain's issuer rules). */
export interface AcceptedIssuer {
  readonly did: string;
  readonly verificationMethod: string;
  readonly publicKeyMultibase: string;
  /** Credential types this issuer is authorized to issue (explicit, scoped issuer authority). */
  readonly credentialTypes: readonly string[];
}

/** Names of the independent checks of one presented credential, in evaluation order. */
export const PRESENTATION_CHECKS = [
  'PRESENTATION_WELL_FORMED',
  'HOLDER_PROOF_VALID',
  'CREDENTIAL_SIGNATURE_VALID',
  'ISSUER_AUTHORIZED',
  'SUBJECT_IS_HOLDER',
  'WITHIN_VALIDITY_WINDOW',
  'STATUS_ACTIVE',
] as const;
export type PresentationCheck = (typeof PRESENTATION_CHECKS)[number];

export interface PresentationVerification {
  /** True only when every check passed. */
  readonly valid: boolean;
  readonly checks: Readonly<Record<PresentationCheck, boolean>>;
  /** The failing check names (stable reason codes). */
  readonly failed: readonly PresentationCheck[];
  /** The credential that was evaluated (the first of the accepted type), when well formed. */
  readonly credential?: VerifiableCredential;
}

const decodeKey = (multibase: string): Uint8Array | undefined => {
  try {
    return decodeEd25519Multikey(multibase);
  } catch {
    return undefined;
  }
};

function wellFormedProof(proof: unknown): proof is DataIntegrityProof {
  const p = proof as Partial<DataIntegrityProof> | undefined;
  return (
    typeof p === 'object' &&
    p !== null &&
    p.type === DATA_INTEGRITY_PROOF &&
    p.cryptosuite === EDDSA_JCS_2022 &&
    isString(p.verificationMethod) &&
    isString(p.proofPurpose) &&
    isString(p.proofValue)
  );
}

function wellFormedCredential(vc: unknown): vc is VerifiableCredential {
  const c = vc as Partial<VerifiableCredential> | undefined;
  return (
    typeof c === 'object' &&
    c !== null &&
    Array.isArray(c['@context']) &&
    c['@context'][0] === W3C_VC_V2_CONTEXT &&
    isString(c.id) &&
    Array.isArray(c.type) &&
    c.type.includes('VerifiableCredential') &&
    isString(c.issuer) &&
    isString(c.validFrom) &&
    isString(c.validUntil) &&
    typeof c.credentialSubject === 'object' &&
    c.credentialSubject !== null &&
    isString(c.credentialSubject.id) &&
    typeof c.credentialStatus === 'object' &&
    c.credentialStatus !== null &&
    isString(c.credentialStatus.id) &&
    wellFormedProof(c.proof)
  );
}

function verifySigned(document: { proof: DataIntegrityProof }, publicKey: Uint8Array): boolean {
  const { proof, ...unsecured } = document;
  return verifyProof(unsecured, proof, publicKey);
}

/**
 * Verifies one Verifiable Presentation for one verifier request (fail closed; every check reported by name):
 * holder proof (signature, `authentication`, holder's key, challenge, domain) · credential signature (issuer's
 * `assertionMethod` key) · issuer authority (the issuer, its key and the credential type are accepted by the Trust
 * Domain's issuer rules) · subject = holder · validity window · current status (a statement signed by the issuer for
 * this credential, ACTIVE, at most `maxStatusAgeSeconds` old). It does not judge claim truth.
 */
export function verifyPresentation(input: {
  readonly presentation: unknown;
  /** The holder's `authentication` key as resolved from its DID Document. */
  readonly holderKey: { readonly verificationMethod: string; readonly publicKeyMultibase: string };
  readonly challenge: string;
  readonly domain: string;
  readonly credentialType: string;
  readonly acceptedIssuers: readonly AcceptedIssuer[];
  readonly status: unknown;
  readonly maxStatusAgeSeconds: number;
  readonly now: Date;
}): PresentationVerification {
  const checks = Object.fromEntries(PRESENTATION_CHECKS.map((c) => [c, false])) as Record<
    PresentationCheck,
    boolean
  >;
  const result = (credential?: VerifiableCredential): PresentationVerification => {
    const failed = PRESENTATION_CHECKS.filter((c) => !checks[c]);
    return {
      valid: failed.length === 0,
      checks,
      failed,
      ...(credential ? { credential } : {}),
    };
  };
  const vp = input.presentation as Partial<VerifiablePresentation> | undefined;
  const vc = Array.isArray(vp?.verifiableCredential)
    ? vp.verifiableCredential.find(
        (c) => Array.isArray(c?.type) && c.type.includes(input.credentialType),
      )
    : undefined;
  if (
    typeof vp !== 'object' ||
    vp === null ||
    !Array.isArray(vp.type) ||
    !vp.type.includes('VerifiablePresentation') ||
    !isString(vp.holder) ||
    !wellFormedProof(vp.proof) ||
    !wellFormedCredential(vc)
  ) {
    return result();
  }
  checks.PRESENTATION_WELL_FORMED = true;

  // Holder proof.
  const holderKey = decodeKey(input.holderKey.publicKeyMultibase);
  checks.HOLDER_PROOF_VALID =
    holderKey !== undefined &&
    vp.proof.proofPurpose === 'authentication' &&
    vp.proof.verificationMethod === input.holderKey.verificationMethod &&
    controllerOf(vp.proof.verificationMethod) === vp.holder &&
    vp.proof.challenge === input.challenge &&
    vp.proof.domain === input.domain &&
    verifySigned(vp as VerifiablePresentation, holderKey);

  // Credential signature by the issuer's assertion key; issuer authority from the Trust Domain rules.
  const issuer = input.acceptedIssuers.find(
    (i) => i.did === vc.issuer && i.verificationMethod === vc.proof.verificationMethod,
  );
  const issuerKey = issuer ? decodeKey(issuer.publicKeyMultibase) : undefined;
  checks.CREDENTIAL_SIGNATURE_VALID =
    issuerKey !== undefined &&
    vc.proof.proofPurpose === 'assertionMethod' &&
    controllerOf(vc.proof.verificationMethod) === vc.issuer &&
    verifySigned(vc, issuerKey);
  checks.ISSUER_AUTHORIZED =
    issuer !== undefined && issuer.credentialTypes.includes(input.credentialType);

  checks.SUBJECT_IS_HOLDER = vc.credentialSubject.id === vp.holder;
  const now = input.now.getTime();
  checks.WITHIN_VALIDITY_WINDOW =
    Date.parse(vc.validFrom) <= now && now <= Date.parse(vc.validUntil);

  // Current status: a statement for THIS credential, signed by its issuer, ACTIVE and fresh.
  const s = input.status as Partial<SignedCredentialStatusStatement> | undefined;
  const checkedAt = typeof s?.checkedAt === 'string' ? Date.parse(s.checkedAt) : NaN;
  checks.STATUS_ACTIVE =
    typeof s === 'object' &&
    s !== null &&
    s.type === CATENOR_ONE_STATUS_STATEMENT &&
    s.statusId === vc.credentialStatus.id &&
    s.credentialId === vc.id &&
    s.issuer === vc.issuer &&
    s.status === 'ACTIVE' &&
    !Number.isNaN(checkedAt) &&
    checkedAt <= now + 60_000 &&
    now - checkedAt <= input.maxStatusAgeSeconds * 1000 &&
    wellFormedProof(s.proof) &&
    s.proof.proofPurpose === 'assertionMethod' &&
    issuerKey !== undefined &&
    s.proof.verificationMethod === vc.proof.verificationMethod &&
    verifySigned(s as SignedCredentialStatusStatement, issuerKey);

  return result(vc);
}
