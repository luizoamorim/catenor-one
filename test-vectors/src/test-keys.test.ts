import { createHash, createPrivateKey, createPublicKey } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { S001_TEST_KEY_LABELS, testEd25519Key, testSeedFromLabel } from './test-keys.js';

// Frozen known answers: changing the derivation or a label must fail here (and regenerate every golden).
const KNOWN_PUBLIC_KEYS = {
  assertionKey1: '5b7ec1d262ba70ca39133351dca0fea0058c2d26f042f3a988b312cade27bbe4',
  bootstrapKey1: '0d48b4bc7146b5eede08a2004fa472c311e499310538f8d40592d07653d1d4ff',
} as const;

/** Independent Ed25519 public-key derivation with node:crypto (PKCS#8 wrapping of the raw seed). */
function nodePublicKey(seed: Uint8Array): string {
  const pkcs8 = Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]);
  const spki = createPublicKey(createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' }))
    .export({ format: 'der', type: 'spki' })
    .subarray(-32);
  return Buffer.from(spki).toString('hex');
}

describe('TEST-ONLY golden keys (T2.9, maintainer decision 2026-09-11)', () => {
  it.each(Object.entries(S001_TEST_KEY_LABELS))(
    '%s: seed = SHA-256(UTF-8(label)); public key matches the frozen known answer and node:crypto',
    (name, label) => {
      const key = testEd25519Key(label);
      const seed = createHash('sha256').update(label, 'utf8').digest();
      expect(Buffer.from(key.secretKey).equals(seed)).toBe(true);
      const publicHex = Buffer.from(key.publicKey).toString('hex');
      expect(publicHex).toBe(KNOWN_PUBLIC_KEYS[name as keyof typeof KNOWN_PUBLIC_KEYS]);
      expect(nodePublicKey(key.secretKey)).toBe(publicHex);
    },
  );

  it('assertion and bootstrap keys are different', () => {
    const { assertionKey1, bootstrapKey1 } = S001_TEST_KEY_LABELS;
    expect(testEd25519Key(assertionKey1).publicKey).not.toEqual(
      testEd25519Key(bootstrapKey1).publicKey,
    );
  });

  it('labels are explicitly test-only and non-secret', () => {
    for (const label of Object.values(S001_TEST_KEY_LABELS)) {
      expect(label).toMatch(/^catenor-one\/test-vectors\/s001\/.+\/NOT-A-SECRET$/);
    }
    expect(() => testSeedFromLabel('catenor-one/prod/assertion-key-1')).toThrow(TypeError);
    expect(() => testSeedFromLabel('catenor-one/test-vectors/s001/assertion-key-1')).toThrow(
      TypeError,
    );
  });
});
