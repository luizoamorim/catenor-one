import { ed25519 } from '@noble/curves/ed25519.js';
import { describe, expect, it } from 'vitest';
import { parseCatenorDid } from './did.js';
import {
  KeyPurposeCollisionError,
  bindKeyPurpose,
  type KeyBinding,
  type KeyPurpose,
} from './key-management.js';
import { encodeEd25519Multikey } from './multikey.js';
import { assertionKeyId, verificationMethodId } from './verification-method.js';

const DID = parseCatenorDid('did:catenor:8f0c92d7e5f04e40a41faee32e5e180b');
const keyA = encodeEd25519Multikey(ed25519.getPublicKey(ed25519.utils.randomSecretKey()));
const keyB = encodeEd25519Multikey(ed25519.getPublicKey(ed25519.utils.randomSecretKey()));

function binding(
  purpose: KeyPurpose,
  publicKeyMultibase: string,
  signerRef: string,
  fragment: string,
): KeyBinding {
  return {
    publicKeyMultibase,
    reference: {
      subject: DID,
      verificationMethod: verificationMethodId(DID, fragment),
      signerRef,
      purpose,
      status: 'ACTIVE',
    },
  };
}

describe('AC-S001-013 — Credential Assertion Key ≠ Financial Execution Key', () => {
  const assertion = binding(
    'CREDENTIAL_ASSERTION',
    keyA,
    'signer:fixture:assertion-key-1',
    'assertion-key-1',
  );

  it('rejects binding the same public key as FINANCIAL_EXECUTION', () => {
    expect(() =>
      bindKeyPurpose(
        [assertion],
        binding('FINANCIAL_EXECUTION', keyA, 'signer:other', 'financial-key-1'),
      ),
    ).toThrow(KeyPurposeCollisionError);
  });

  it('rejects binding the same signer as FINANCIAL_EXECUTION even with a different public key', () => {
    expect(() =>
      bindKeyPurpose(
        [assertion],
        binding('FINANCIAL_EXECUTION', keyB, 'signer:fixture:assertion-key-1', 'financial-key-1'),
      ),
    ).toThrow(KeyPurposeCollisionError);
  });

  it('rejects the reverse direction (financial key later bound for assertion)', () => {
    const financial = binding('FINANCIAL_EXECUTION', keyB, 'signer:financial', 'financial-key-1');
    expect(() =>
      bindKeyPurpose(
        [financial],
        binding('CREDENTIAL_ASSERTION', keyB, 'signer:x', 'assertion-key-2'),
      ),
    ).toThrow(KeyPurposeCollisionError);
  });

  it('allows a separate key for financial execution', () => {
    const result = bindKeyPurpose(
      [assertion],
      binding('FINANCIAL_EXECUTION', keyB, 'signer:financial', 'financial-key-1'),
    );
    expect(result).toHaveLength(2);
  });

  it('never stores key material in a reference', () => {
    expect(Object.keys(assertion.reference).sort()).toEqual([
      'purpose',
      'signerRef',
      'status',
      'subject',
      'verificationMethod',
    ]);
    expect(assertion.reference.verificationMethod).toBe(assertionKeyId(DID, 1));
  });
});
