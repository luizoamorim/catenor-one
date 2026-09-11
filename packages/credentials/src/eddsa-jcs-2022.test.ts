import { decodeEd25519Multikey, encodeEd25519Multikey } from '@catenor-one/identity';
import { loadVector } from '@catenor-one/test-vectors';
import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { describe, expect, it } from 'vitest';
import {
  HASH_DATA_LENGTH,
  ProofConfigurationError,
  attachProofValue,
  canonicalProofConfiguration,
  decodeProofValue,
  hashData,
  prepareProof,
  transformDocument,
  verifyProof,
  verifySecuredDocument,
  type DataIntegrityProof,
  type ProofOptions,
} from './eddsa-jcs-2022.js';

interface W3cVector {
  publicKeyMultibase: string;
  unsecuredDocument: Record<string, unknown>;
  canonicalDocument: string;
  canonicalDocumentSha256: string;
  proofOptions: ProofOptions;
  canonicalProofOptions: string;
  canonicalProofOptionsSha256: string;
  hashData: string;
  signatureHex: string;
  proofValue: string;
  securedDocument: Record<string, unknown> & { proof: DataIntegrityProof };
}

const w3c = loadVector<W3cVector>('s001', 'w3c-vc-di-eddsa-jcs-2022');
const w3cKey = decodeEd25519Multikey(w3c.publicKeyMultibase);
const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe('W3C vc-di-eddsa Appendix B.3 — eddsa-jcs-2022 interoperability (D3, T2.3)', () => {
  it('Example 31/32 — transformation is the JCS of the credential, SHA-256 matches', () => {
    const transformed = transformDocument(w3c.unsecuredDocument, w3c.proofOptions);
    expect(text(transformed)).toBe(w3c.canonicalDocument);
    expect(bytesToHex(sha256(transformed))).toBe(w3c.canonicalDocumentSha256);
  });

  it('Example 34/35 — canonical proof configuration and its SHA-256 match', () => {
    const config = canonicalProofConfiguration(w3c.proofOptions);
    expect(text(config)).toBe(w3c.canonicalProofOptions);
    expect(bytesToHex(sha256(config))).toBe(w3c.canonicalProofOptionsSha256);
  });

  it('Example 36 — hashData = SHA-256(proof config) ‖ SHA-256(document), 64 bytes', () => {
    const data = hashData(w3c.unsecuredDocument, w3c.proofOptions);
    expect(data).toHaveLength(HASH_DATA_LENGTH);
    expect(bytesToHex(data)).toBe(w3c.hashData);
  });

  it('prepareProof copies the document @context into the proof options (§3.3.1 step 2)', () => {
    const optionsWithoutContext = { ...w3c.proofOptions };
    delete (optionsWithoutContext as { '@context'?: unknown })['@context'];
    const { proofOptions, hashData: data } = prepareProof(
      w3c.unsecuredDocument,
      optionsWithoutContext,
    );
    expect(proofOptions['@context']).toEqual(w3c.unsecuredDocument['@context']);
    expect(bytesToHex(data)).toBe(w3c.hashData);
  });

  it('Example 37/38 — proofValue is z + base58btc of the 64-byte signature', () => {
    const signature = decodeProofValue(w3c.proofValue);
    expect(signature && bytesToHex(signature)).toBe(w3c.signatureHex);
    const rebuilt = attachProofValue(
      w3c.proofOptions,
      Uint8Array.from(Buffer.from(w3c.signatureHex, 'hex')),
    );
    expect(rebuilt.proofValue).toBe(w3c.proofValue);
  });

  it('Example 39 — the signed credential verifies with the published public key', () => {
    expect(verifySecuredDocument(w3c.securedDocument, w3cKey)).toBe(true);
  });

  describe('tampering → false', () => {
    const secured = w3c.securedDocument;
    const proof = secured.proof;

    it.each([
      [
        'credential content',
        { ...secured, credentialSubject: { id: 'did:example:abcdefgh', alumniOf: 'Other School' } },
      ],
      ['proof created', { ...secured, proof: { ...proof, created: '2023-02-24T23:36:39Z' } }],
      ['proof purpose', { ...secured, proof: { ...proof, proofPurpose: 'authentication' } }],
      [
        'proofValue',
        { ...secured, proof: { ...proof, proofValue: `${proof.proofValue.slice(0, -2)}11` } },
      ],
      ['non-base58 proofValue', { ...secured, proof: { ...proof, proofValue: 'z0OIl' } }],
      [
        'missing multibase prefix',
        { ...secured, proof: { ...proof, proofValue: proof.proofValue.slice(1) } },
      ],
      [
        '@context not a prefix of the document context',
        { ...secured, '@context': ['https://www.w3.org/ns/credentials/v2'] },
      ],
      ['wrong cryptosuite', { ...secured, proof: { ...proof, cryptosuite: 'eddsa-rdfc-2022' } }],
      ['missing proof', (({ proof: _p, ...rest }) => rest)(secured)],
    ])('%s', (_label, tampered) => {
      expect(verifySecuredDocument(tampered as Record<string, unknown>, w3cKey)).toBe(false);
    });

    it('wrong public key', () => {
      const other = ed25519.getPublicKey(ed25519.utils.randomSecretKey());
      expect(verifySecuredDocument(secured, other)).toBe(false);
    });
  });
});

describe('Catenor key-possession shaped proof (own round trip)', () => {
  const secretKey = ed25519.utils.randomSecretKey();
  const publicKey = ed25519.getPublicKey(secretKey);
  const did = 'did:catenor:8f0c92d7e5f04e40a41faee32e5e180b';
  const challenge = {
    type: 'CatenorOneKeyPossessionChallenge',
    challengeId: 'challenge:admission:001',
    subject: did,
    verificationMethod: `${did}#assertion-key-1`,
    operation: 'ADMIT_TRUST_ANCHOR',
    trustDomain: 'trust-domain:catenor-one-demo',
    nonce: 'opaque-random-nonce-001',
    issuedAt: '2026-09-09T22:00:00Z',
    expiresAt: '2026-09-09T22:05:00Z',
  };
  const options: ProofOptions = {
    type: 'DataIntegrityProof',
    cryptosuite: 'eddsa-jcs-2022',
    verificationMethod: `${did}#assertion-key-1`,
    proofPurpose: 'assertionMethod',
    created: '2026-09-09T22:01:00Z',
    challenge: 'opaque-random-nonce-001',
    domain: 'trust-domain:catenor-one-demo',
  };

  it('signs exactly the 64 hashData bytes and verifies (PLAN §14.2)', () => {
    const { proofOptions, hashData: data } = prepareProof(challenge, options);
    expect(data).toHaveLength(64);
    expect(proofOptions).toEqual(options); // challenge has no @context
    const proof = attachProofValue(proofOptions, ed25519.sign(data, secretKey));
    expect(verifyProof(challenge, proof, publicKey)).toBe(true);
    expect(encodeEd25519Multikey(publicKey).startsWith('z6Mk')).toBe(true);
  });

  it.each([
    ['challenge nonce', { challenge: { ...challenge, nonce: 'other' } }],
    [
      'challenge subject',
      { challenge: { ...challenge, subject: 'did:catenor:00000000000000000000000000000000' } },
    ],
    ['proof domain', { options: { ...options, domain: 'trust-domain:other' } }],
    ['proof challenge', { options: { ...options, challenge: 'other' } }],
  ])('rejects a proof whose %s changed after signing', (_label, change) => {
    const { proofOptions, hashData: data } = prepareProof(challenge, options);
    const proof = attachProofValue(proofOptions, ed25519.sign(data, secretKey));
    const doc = 'challenge' in change ? change.challenge : challenge;
    const tamperedProof = 'options' in change ? { ...proof, ...change.options } : proof;
    expect(verifyProof(doc, tamperedProof as DataIntegrityProof, publicKey)).toBe(false);
  });

  it('rejects invalid proof configuration', () => {
    expect(() =>
      canonicalProofConfiguration({
        ...options,
        cryptosuite: 'eddsa-rdfc-2022',
      } as unknown as ProofOptions),
    ).toThrow(ProofConfigurationError);
    expect(() => canonicalProofConfiguration({ ...options, created: 'yesterday' })).toThrow(
      ProofConfigurationError,
    );
    expect(() => attachProofValue(options, new Uint8Array(63))).toThrow(ProofConfigurationError);
  });
});
