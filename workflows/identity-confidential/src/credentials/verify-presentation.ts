// Verifiable Presentation verification INSIDE handlerInTee (Catenor One [REF-IMPL], clean-room demo). A faithful port
// of @catenor-one/credentials `verifyPresentation` (same check names, same order, same rules), kept self-contained
// because the workflow is bundled on its own; a parity test runs both on the same inputs.
//
// W3C Data Integrity eddsa-jcs-2022: hashData = SHA-256(JCS(proof options)) ‖ SHA-256(JCS(document)); Ed25519 strict
// (RFC 8032, no ZIP-215). Pure TypeScript for the CRE QuickJS/WASM runtime (no Node APIs, no crypto global).
import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';
import { base58 } from '@scure/base';
import { jcs } from '../trust-anchor-admission/commitment.js';

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

export interface AcceptedIssuer {
  readonly did: string;
  readonly verificationMethod: string;
  readonly publicKeyMultibase: string;
  readonly credentialTypes: readonly string[];
}

type Json = Record<string, unknown>;
interface Proof {
  readonly type: string;
  readonly cryptosuite: string;
  readonly verificationMethod: string;
  readonly proofPurpose: string;
  readonly proofValue: string;
  readonly challenge?: string;
  readonly domain?: string;
  readonly [k: string]: unknown;
}

const W3C_VC_V2_CONTEXT = 'https://www.w3.org/ns/credentials/v2';
const STATUS_STATEMENT = 'CatenorOneCredentialStatusStatement';
const isRecord = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const controllerOf = (id: string) => (id.indexOf('#') === -1 ? id : id.slice(0, id.indexOf('#')));

// XML Schema 1.1 dateTime (timezone optional) — the proof `created` rule of the domain package.
const XSD_DATE_TIME = /^-?\d{4,}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;

function wellFormedProof(p: unknown): p is Proof {
  return (
    isRecord(p) &&
    p.type === 'DataIntegrityProof' &&
    p.cryptosuite === 'eddsa-jcs-2022' &&
    isString(p.verificationMethod) &&
    isString(p.proofPurpose) &&
    isString(p.proofValue)
  );
}

/** `z` + base58btc(0xed 0x01 ‖ 32 bytes) → the raw Ed25519 public key, or undefined. */
export function decodeMultikey(multibase: unknown): Uint8Array | undefined {
  if (typeof multibase !== 'string' || !multibase.startsWith('z')) return undefined;
  try {
    const bytes = base58.decode(multibase.slice(1));
    return bytes.length === 34 && bytes[0] === 0xed && bytes[1] === 0x01 ? bytes.slice(2) : undefined;
  } catch {
    return undefined;
  }
}

/** eddsa-jcs-2022 verification of a secured document (proof embedded). Never throws. */
export function verifySecured(document: Json, publicKey: Uint8Array): boolean {
  const proof = document.proof;
  if (!wellFormedProof(proof)) return false;
  const { proof: _proof, ...unsecured } = document;
  const { proofValue, ...options } = proof;
  if (options.created !== undefined && !(typeof options.created === 'string' && XSD_DATE_TIME.test(options.created))) {
    return false;
  }
  let doc: Json = unsecured;
  const proofContext = options['@context'];
  if (proofContext !== undefined) {
    const documentContext = unsecured['@context'];
    if (
      !Array.isArray(proofContext) ||
      !Array.isArray(documentContext) ||
      !proofContext.every((v, i) => documentContext[i] === v)
    ) {
      return false;
    }
    doc = { ...unsecured, '@context': proofContext };
  }
  try {
    const signature = base58.decode(proofValue.startsWith('z') ? proofValue.slice(1) : '!');
    if (signature.length !== 64) return false;
    const message = new Uint8Array(64);
    message.set(sha256(utf8ToBytes(jcs(options))), 0);
    message.set(sha256(utf8ToBytes(jcs(doc))), 32);
    return ed25519.verify(signature, message, publicKey, { zip215: false });
  } catch {
    return false;
  }
}

export interface PresentationVerification {
  readonly valid: boolean;
  readonly checks: Record<PresentationCheck, boolean>;
  readonly failed: PresentationCheck[];
  /** Minimal claims of the evaluated credential (never the credential itself). */
  readonly claims?: { readonly identityVerified: unknown; readonly amlClear: unknown };
}

/** Same rules as @catenor-one/credentials verifyPresentation (see there for the check definitions). */
export function verifyPresentation(input: {
  readonly presentation: unknown;
  readonly holderKey: unknown;
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
  const done = (claims?: PresentationVerification['claims']): PresentationVerification => {
    const failed = PRESENTATION_CHECKS.filter((c) => !checks[c]);
    return { valid: failed.length === 0, checks, failed, ...(claims ? { claims } : {}) };
  };
  const vp = input.presentation;
  const holderKey = input.holderKey;
  if (!isRecord(vp) || !isRecord(holderKey)) return done();
  const list = vp.verifiableCredential;
  const vc = Array.isArray(list)
    ? (list.find((c) => isRecord(c) && Array.isArray(c.type) && c.type.includes(input.credentialType)) as
        | Json
        | undefined)
    : undefined;
  const subject = vc && isRecord(vc.credentialSubject) ? vc.credentialSubject : undefined;
  const status = vc && isRecord(vc.credentialStatus) ? vc.credentialStatus : undefined;
  if (
    !Array.isArray(vp.type) ||
    !vp.type.includes('VerifiablePresentation') ||
    !isString(vp.holder) ||
    !wellFormedProof(vp.proof) ||
    !vc ||
    !Array.isArray(vc['@context']) ||
    vc['@context'][0] !== W3C_VC_V2_CONTEXT ||
    !isString(vc.id) ||
    !Array.isArray(vc.type) ||
    !vc.type.includes('VerifiableCredential') ||
    !isString(vc.issuer) ||
    !isString(vc.validFrom) ||
    !isString(vc.validUntil) ||
    !subject ||
    !isString(subject.id) ||
    !status ||
    !isString(status.id) ||
    !wellFormedProof(vc.proof)
  ) {
    return done();
  }
  checks.PRESENTATION_WELL_FORMED = true;
  const vpProof = vp.proof as Proof;
  const vcProof = vc.proof as Proof;

  const holderPublicKey = decodeMultikey(holderKey.publicKeyMultibase);
  checks.HOLDER_PROOF_VALID =
    holderPublicKey !== undefined &&
    vpProof.proofPurpose === 'authentication' &&
    vpProof.verificationMethod === holderKey.verificationMethod &&
    controllerOf(vpProof.verificationMethod) === vp.holder &&
    vpProof.challenge === input.challenge &&
    vpProof.domain === input.domain &&
    verifySecured(vp, holderPublicKey);

  const issuer = input.acceptedIssuers.find(
    (i) => i.did === vc.issuer && i.verificationMethod === vcProof.verificationMethod,
  );
  const issuerKey = issuer ? decodeMultikey(issuer.publicKeyMultibase) : undefined;
  checks.CREDENTIAL_SIGNATURE_VALID =
    issuerKey !== undefined &&
    vcProof.proofPurpose === 'assertionMethod' &&
    controllerOf(vcProof.verificationMethod) === vc.issuer &&
    verifySecured(vc, issuerKey);
  checks.ISSUER_AUTHORIZED = issuer !== undefined && issuer.credentialTypes.includes(input.credentialType);
  checks.SUBJECT_IS_HOLDER = subject.id === vp.holder;
  const now = input.now.getTime();
  checks.WITHIN_VALIDITY_WINDOW =
    Date.parse(vc.validFrom as string) <= now && now <= Date.parse(vc.validUntil as string);

  const s = input.status;
  const checkedAt = isRecord(s) && typeof s.checkedAt === 'string' ? Date.parse(s.checkedAt) : NaN;
  checks.STATUS_ACTIVE =
    isRecord(s) &&
    s.type === STATUS_STATEMENT &&
    s.statusId === status.id &&
    s.credentialId === vc.id &&
    s.issuer === vc.issuer &&
    s.status === 'ACTIVE' &&
    !Number.isNaN(checkedAt) &&
    checkedAt <= now + 60_000 &&
    now - checkedAt <= input.maxStatusAgeSeconds * 1000 &&
    wellFormedProof(s.proof) &&
    (s.proof as Proof).proofPurpose === 'assertionMethod' &&
    issuerKey !== undefined &&
    (s.proof as Proof).verificationMethod === vcProof.verificationMethod &&
    verifySecured(s, issuerKey);

  return done({ identityVerified: subject.investorIdentityVerified, amlClear: subject.investorAmlClear });
}

/** SHA-256 of the canonical JSON of a document, 0x-hex — the policy hash rule (same as policyHash in packages/policy). */
export function documentHash(value: unknown): string {
  const hash = sha256(utf8ToBytes(jcs(value)));
  return `0x${Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}
