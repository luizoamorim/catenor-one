// TEST-ONLY, NON-SECRET Ed25519 keys for golden vectors (maintainer decision 2026-09-11, TASKS T2.9).
//
// Frozen derivation: seed = SHA-256(UTF-8(label)); the 32-byte seed is the RFC 8032 Ed25519 private key.
// Ed25519 signing is deterministic, so goldens signed with these keys regenerate byte-for-byte.
//
// Anyone can re-derive these keys from their public labels: they protect nothing and must never sign
// anything outside test vectors. Production packages, apps, adapters and workflows must not import this
// module — enforced by the dependency-cruiser rule `test-keys-only-from-tests-and-vector-scripts`.
import { createHash } from 'node:crypto';
import { ed25519 } from '@noble/curves/ed25519.js';

/** Public labels of the S001 golden keys. Assertion and bootstrap keys are distinct (PLAN D36). */
export const S001_TEST_KEY_LABELS = {
  assertionKey1: 'catenor-one/test-vectors/s001/assertion-key-1/NOT-A-SECRET',
  bootstrapKey1: 'catenor-one/test-vectors/s001/bootstrap-key-1/NOT-A-SECRET',
} as const;

const LABEL_PATTERN = /^catenor-one\/test-vectors\/[a-z0-9-]+\/[a-z0-9-]+\/NOT-A-SECRET$/;

export interface TestEd25519Key {
  readonly label: string;
  /** TEST-ONLY private key (= the derived seed). */
  readonly secretKey: Uint8Array;
  readonly publicKey: Uint8Array;
}

/** `SHA-256(UTF-8(label))` — the frozen seed derivation. */
export function testSeedFromLabel(label: string): Uint8Array {
  if (!LABEL_PATTERN.test(label)) {
    throw new TypeError(
      'test key labels must match catenor-one/test-vectors/<slice>/<name>/NOT-A-SECRET',
    );
  }
  return new Uint8Array(createHash('sha256').update(label, 'utf8').digest());
}

export function testEd25519Key(label: string): TestEd25519Key {
  const secretKey = testSeedFromLabel(label);
  return { label, secretKey, publicKey: ed25519.getPublicKey(secretKey) };
}
