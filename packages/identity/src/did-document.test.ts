import { ed25519 } from '@noble/curves/ed25519.js';
import { describe, expect, it } from 'vitest';
import { authorizesAssertion, createDidDocument, findVerificationMethod } from './did-document.js';
import { parseCatenorDid } from './did.js';
import { decodeEd25519Multikey, encodeEd25519Multikey, isEd25519Multikey } from './multikey.js';
import {
  assertionKeyId,
  createVerificationMethod,
  verificationMethodId,
} from './verification-method.js';

const DID = parseCatenorDid('did:catenor:8f0c92d7e5f04e40a41faee32e5e180b');
const OTHER = parseCatenorDid('did:catenor:00000000000000000000000000000001');
const publicKey = ed25519.getPublicKey(ed25519.utils.randomSecretKey());
const multikey = encodeEd25519Multikey(publicKey);

describe('Multikey (Ed25519)', () => {
  it('round-trips a 32-byte public key through z + base58btc(0xed01 ‖ key)', () => {
    expect(multikey.startsWith('z6Mk')).toBe(true);
    expect(decodeEd25519Multikey(multikey)).toEqual(publicKey);
  });

  it('rejects wrong lengths, wrong multicodec, wrong multibase and non-base58 input', () => {
    expect(() => encodeEd25519Multikey(new Uint8Array(31))).toThrow(TypeError);
    expect(isEd25519Multikey(`m${multikey.slice(1)}`)).toBe(false);
    // TEST-VECTORS §6 placeholder is not a decodable key (contains "0", outside base58btc).
    expect(isEd25519Multikey('z6MkFixtureAssertionPublicKey001')).toBe(false);
    // secp256k1 multicodec (0xe7 0x01) is not Ed25519
    const secp = new Uint8Array(35);
    secp.set([0xe7, 0x01]);
    expect(isEd25519Multikey(`z${Buffer.from(secp).toString('hex')}`)).toBe(false);
  });
});

describe('VerificationMethod', () => {
  it('uses <did>#assertion-key-<n> ids controlled by the DID', () => {
    const vm = createVerificationMethod(assertionKeyId(DID, 1), DID, multikey);
    expect(vm).toEqual({
      id: `${DID}#assertion-key-1`,
      controller: DID,
      type: 'Multikey',
      publicKeyMultibase: multikey,
    });
  });

  it('rejects a controller mismatch and non-Ed25519 keys', () => {
    expect(() => createVerificationMethod(assertionKeyId(DID, 1), OTHER, multikey)).toThrow(
      TypeError,
    );
    expect(() =>
      createVerificationMethod(assertionKeyId(DID, 1), DID, 'z6MkFixtureAssertionPublicKey001'),
    ).toThrow(TypeError);
    expect(() => assertionKeyId(DID, 0)).toThrow(TypeError);
  });
});

describe('TV-S001-C03 — public DID Document is minimized', () => {
  const vm = createVerificationMethod(assertionKeyId(DID, 1), DID, multikey);
  const doc = createDidDocument(DID, [vm], [vm.id]);

  it('has exactly the fixture shape {id, verificationMethod[], assertionMethod[]}', () => {
    expect(doc).toEqual({
      id: DID,
      verificationMethod: [
        {
          id: `${DID}#assertion-key-1`,
          controller: DID,
          type: 'Multikey',
          publicKeyMultibase: multikey,
        },
      ],
      assertionMethod: [`${DID}#assertion-key-1`],
    });
    expect(Object.keys(doc).sort()).toEqual(['assertionMethod', 'id', 'verificationMethod']);
  });

  it('contains no provider references, email, PII, private key or financial binding', () => {
    const text = JSON.stringify(doc);
    for (const forbidden of [
      'sumsub_company_fixture_001',
      'sumsub_person_fixture_001',
      '@',
      'Organization A',
      'privateKey',
      'secret',
      'accountBinding',
      'FINANCIAL',
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it('authorizes assertion only for keys listed in assertionMethod (TV-S001-D06 precondition)', () => {
    const auth = createVerificationMethod(
      verificationMethodId(DID, 'authentication-key-1'),
      DID,
      multikey,
    );
    const withAuthKey = createDidDocument(DID, [vm, auth], [vm.id]);
    expect(authorizesAssertion(withAuthKey, vm.id)).toBe(true);
    expect(authorizesAssertion(withAuthKey, auth.id)).toBe(false);
    expect(authorizesAssertion(withAuthKey, `${DID}#assertion-key-9`)).toBe(false);
    expect(findVerificationMethod(withAuthKey, auth.id)).toEqual(auth);
  });

  it('rejects foreign keys, duplicates and dangling assertionMethod references', () => {
    const foreign = createVerificationMethod(assertionKeyId(OTHER, 1), OTHER, multikey);
    expect(() => createDidDocument(DID, [foreign], [])).toThrow(TypeError);
    expect(() => createDidDocument(DID, [vm, vm], [vm.id])).toThrow(TypeError);
    expect(() => createDidDocument(DID, [vm], [assertionKeyId(DID, 2)])).toThrow(TypeError);
  });
});
