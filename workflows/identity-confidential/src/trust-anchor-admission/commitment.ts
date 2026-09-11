// Evidence commitment (PLAN §23), Sumsub request signing (PLAN §20.1) and the callback authentication
// [REF-IMPL]. @noble/hashes + canonicalize only (both SIMULATION-CONFIRMED in the CRE runtime, T0.7).
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import canonicalize from 'canonicalize';
import type { AcceptedEvidence, EvidenceFactName, Tri } from './types.js';

const digest = (bytes: Uint8Array) => `0x${bytesToHex(sha256(bytes))}`;
export const jcs = (value: unknown): string => {
  const text = canonicalize(value);
  if (text === undefined) throw new TypeError('value cannot be canonicalized');
  return text;
};

/** Sumsub request signature: hex(HMAC-SHA256(secret, ts + METHOD + pathWithQuery + body)). */
export function sumsubSignature(
  secretKey: string,
  ts: string,
  method: 'GET' | 'POST',
  pathWithQuery: string,
  body = '',
): string {
  return bytesToHex(hmac(sha256, utf8ToBytes(secretKey), utf8ToBytes(ts + method + pathWithQuery + body)));
}

export interface CommitmentParts {
  readonly runId: string;
  readonly sessionRef: string;
  readonly trustDomain: string;
  readonly subject: string;
  readonly bootstrapConfigurationHash: string;
  readonly observedAt: string;
  readonly accepted: AcceptedEvidence;
  readonly companyReference: string;
  readonly representativeApplicantId: string;
  /** MOCK: SHA-256(JCS(fixture)); REAL: SHA-256 of the raw response bytes. */
  readonly companyApplicantBytes: Uint8Array;
  readonly representativeApplicantBytes: Uint8Array;
  readonly reasonCodes: { readonly company: readonly string[]; readonly representative: readonly string[] };
  readonly facts: Record<EvidenceFactName, Tri>;
}

/**
 * commitmentInput (PLAN §23) and evidenceCommitment = 0x + hex(SHA-256(JCS(commitmentInput))).
 * salt = HMAC-SHA256(saltKey, runId) — the TEE has no CSPRNG; the API re-derives it from K. The callback carries
 * commitmentInput WITHOUT the salt. [REF-IMPL encoding: salt and digests as 0x-hex.]
 */
export function evidenceCommitment(parts: CommitmentParts, saltKey: Uint8Array) {
  const withoutSalt = {
    profile: 'catenor-one/evidence-commitment/v1',
    operation: 'TRUST_ANCHOR_ADMISSION',
    runId: parts.runId,
    sessionRef: parts.sessionRef,
    trustDomain: parts.trustDomain,
    subject: parts.subject,
    bootstrapConfigurationHash: parts.bootstrapConfigurationHash,
    providerEnvironment: 'sandbox',
    observedAt: parts.observedAt,
    evidenceProfile: parts.accepted.evidenceProfile,
    evidenceSources: parts.accepted.evidenceSources,
    providerRefDigests: {
      company: digest(utf8ToBytes(parts.companyReference)),
      representative: digest(utf8ToBytes(parts.representativeApplicantId)),
    },
    responseDigests: {
      companyApplicant: digest(parts.companyApplicantBytes),
      representativeApplicant: digest(parts.representativeApplicantBytes),
    },
    reasonCodes: parts.reasonCodes,
    facts: parts.facts,
  };
  const salt = `0x${bytesToHex(hmac(sha256, saltKey, utf8ToBytes(parts.runId)))}`;
  const commitment = digest(utf8ToBytes(jcs({ ...withoutSalt, salt })));
  return { evidenceCommitment: commitment, commitmentInput: withoutSalt };
}

/**
 * [REF-IMPL] callback authentication: x-catenor-timestamp (RFC 3339) and
 * x-catenor-signature = hex(HMAC-SHA256(callbackKey, timestamp + "." + body)).
 */
export function callbackHeaders(callbackKey: Uint8Array, timestamp: string, body: Uint8Array) {
  const signed = new Uint8Array([...utf8ToBytes(`${timestamp}.`), ...body]);
  return {
    'content-type': 'application/json',
    'x-catenor-timestamp': timestamp,
    'x-catenor-signature': bytesToHex(hmac(sha256, callbackKey, signed)),
  };
}
