import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { canonicalize } from './jcs.js';

/**
 * A Catenor One commitment: `0x` + lowercase hex SHA-256 [REF-IMPL] (PLAN §3.1, D3).
 * Branded so that arbitrary strings are not accepted where a commitment is required.
 */
export type Commitment = string & { readonly __brand: 'Commitment' };

export const COMMITMENT_PATTERN = /^0x[0-9a-f]{64}$/;

export function isCommitment(value: unknown): value is Commitment {
  return typeof value === 'string' && COMMITMENT_PATTERN.test(value);
}

export function parseCommitment(value: string): Commitment {
  if (!isCommitment(value)) {
    throw new TypeError('not a commitment: expected 0x followed by 64 lowercase hex characters');
  }
  return value;
}

/** Commitment over raw bytes: `0x` + hex(SHA-256(bytes)). */
export function commitBytes(bytes: Uint8Array): Commitment {
  return `0x${bytesToHex(sha256(bytes))}` as Commitment;
}

/** Commitment over a JSON value: `0x` + hex(SHA-256(JCS(value))). */
export function commit(value: unknown): Commitment {
  return commitBytes(canonicalize(value));
}

/** The 32 raw bytes of a commitment. */
export function commitmentBytes(commitment: Commitment): Uint8Array {
  const hex = commitment.slice(2);
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
