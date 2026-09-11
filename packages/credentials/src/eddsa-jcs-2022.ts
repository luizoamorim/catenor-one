import { canonicalize } from '@catenor-one/audit';
import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { base58 } from '@scure/base';

/**
 * W3C Data Integrity `eddsa-jcs-2022` (vc-di-eddsa §3.3) — hashing and verification.
 * Signing happens outside this package, behind the Catenor signer boundary (PLAN §13.4): this module
 * only builds the exact bytes to be signed and verifies signatures.
 */
export const DATA_INTEGRITY_PROOF = 'DataIntegrityProof';
export const EDDSA_JCS_2022 = 'eddsa-jcs-2022';
/** Current profile value: SHA-256(proofConfig) ‖ SHA-256(document) (vc-di-eddsa §3.3.4). */
export const HASH_DATA_LENGTH = 64;
export const ED25519_SIGNATURE_LENGTH = 64;

type JsonObject = { readonly [key: string]: unknown };

/** Proof options — a data integrity proof without `proofValue`. */
export interface ProofOptions {
  readonly type: typeof DATA_INTEGRITY_PROOF;
  readonly cryptosuite: typeof EDDSA_JCS_2022;
  readonly verificationMethod: string;
  readonly proofPurpose: string;
  readonly created?: string;
  readonly challenge?: string;
  readonly domain?: string;
  readonly '@context'?: readonly string[];
}

export interface DataIntegrityProof extends ProofOptions {
  readonly proofValue: string;
}

export class ProofConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProofConfigurationError';
  }
}

// XML Schema 1.1 dateTime (timezone optional).
const XSD_DATE_TIME = /^-?\d{4,}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;

/** vc-di-eddsa §3.3.5 — returns the canonical proof configuration bytes. */
export function canonicalProofConfiguration(options: ProofOptions): Uint8Array {
  if (options.type !== DATA_INTEGRITY_PROOF || options.cryptosuite !== EDDSA_JCS_2022) {
    throw new ProofConfigurationError('proof options must be DataIntegrityProof / eddsa-jcs-2022');
  }
  if (options.created !== undefined && !XSD_DATE_TIME.test(options.created)) {
    throw new ProofConfigurationError('proof created must be an XML Schema dateTime');
  }
  if ('proofValue' in options) {
    throw new ProofConfigurationError('proof options must not contain proofValue');
  }
  return canonicalize(options);
}

/** vc-di-eddsa §3.3.3 — JCS of the unsecured document. */
export function transformDocument(
  unsecuredDocument: JsonObject,
  options: ProofOptions,
): Uint8Array {
  if (options.type !== DATA_INTEGRITY_PROOF || options.cryptosuite !== EDDSA_JCS_2022) {
    throw new ProofConfigurationError(
      'transformation requires DataIntegrityProof / eddsa-jcs-2022',
    );
  }
  return canonicalize(unsecuredDocument);
}

/** vc-di-eddsa §3.3.4 — `SHA-256(canonical proof config) ‖ SHA-256(transformed document)` (64 bytes). */
export function hashData(unsecuredDocument: JsonObject, options: ProofOptions): Uint8Array {
  const proofConfigHash = sha256(canonicalProofConfiguration(options));
  const documentHash = sha256(transformDocument(unsecuredDocument, options));
  const out = new Uint8Array(HASH_DATA_LENGTH);
  out.set(proofConfigHash, 0);
  out.set(documentHash, proofConfigHash.length);
  return out;
}

/**
 * vc-di-eddsa §3.3.1 steps 1–4: copies the document `@context` into the proof options and returns the
 * exact bytes an Ed25519 signer must sign.
 */
export function prepareProof(
  unsecuredDocument: JsonObject,
  options: ProofOptions,
): { proofOptions: ProofOptions; hashData: Uint8Array } {
  const context = unsecuredDocument['@context'];
  const proofOptions: ProofOptions =
    context === undefined ? { ...options } : { ...options, '@context': context as string[] };
  return { proofOptions, hashData: hashData(unsecuredDocument, proofOptions) };
}

/** vc-di-eddsa §3.3.1 step 7 — attaches `proofValue = z + base58btc(signature)`. */
export function attachProofValue(
  proofOptions: ProofOptions,
  signature: Uint8Array,
): DataIntegrityProof {
  if (signature.length !== ED25519_SIGNATURE_LENGTH) {
    throw new ProofConfigurationError('Ed25519 signature must be 64 bytes');
  }
  return { ...proofOptions, proofValue: `z${base58.encode(signature)}` };
}

/** Decodes `proofValue` to the 64 signature bytes, or `undefined` if it is not a valid encoding. */
export function decodeProofValue(proofValue: string): Uint8Array | undefined {
  if (typeof proofValue !== 'string' || !proofValue.startsWith('z')) return undefined;
  try {
    const bytes = base58.decode(proofValue.slice(1));
    return bytes.length === ED25519_SIGNATURE_LENGTH ? bytes : undefined;
  } catch {
    return undefined;
  }
}

/**
 * vc-di-eddsa §3.3.2 / §3.3.7 with the proof held separately from the unsecured document.
 * The caller resolves `publicKey` from the verification method named by `proof.verificationMethod`.
 * Uses strict RFC 8032 verification (no ZIP-215 relaxations). Never throws for bad input: returns false.
 */
export function verifyProof(
  unsecuredDocument: JsonObject,
  proof: DataIntegrityProof,
  publicKey: Uint8Array,
): boolean {
  const { proofValue, ...proofOptions } = proof;
  const signature = decodeProofValue(proofValue);
  if (signature === undefined) return false;

  let document: JsonObject = unsecuredDocument;
  const proofContext = proofOptions['@context'];
  if (proofContext !== undefined) {
    const documentContext = unsecuredDocument['@context'];
    if (
      !Array.isArray(proofContext) ||
      !Array.isArray(documentContext) ||
      !proofContext.every((value, i) => documentContext[i] === value)
    ) {
      return false;
    }
    document = { ...unsecuredDocument, '@context': proofContext };
  }

  try {
    return ed25519.verify(signature, hashData(document, proofOptions), publicKey, {
      zip215: false,
    });
  } catch {
    return false;
  }
}

/** vc-di-eddsa §3.3.2 for a secured document that embeds its `proof`. */
export function verifySecuredDocument(securedDocument: JsonObject, publicKey: Uint8Array): boolean {
  const proof = securedDocument.proof as DataIntegrityProof | undefined;
  if (proof === undefined || typeof proof !== 'object') return false;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { proof: _proof, ...unsecuredDocument } = securedDocument;
  return verifyProof(unsecuredDocument, proof, publicKey);
}
