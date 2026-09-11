import { attachProofValue, prepareProof, type DataIntegrityProof } from '@catenor-one/credentials';
import {
  createDidDocument,
  createVerificationMethod,
  verificationMethodId,
  type KeyManagementReference,
} from '@catenor-one/identity';
import {
  FACT_NAMES,
  FactSet,
  evaluatePolicy,
  policyHash,
  type FactInput,
} from '@catenor-one/policy';
import { ed25519 } from '@noble/curves/ed25519.js';
import { describe, expect, it } from 'vitest';
import {
  CHALLENGE_TTL_SECONDS,
  consumeChallenge,
  issueChallenge,
  verifyKeyPossession,
  type ChallengeRecord,
  type KeyPossessionChallenge,
} from './key-possession.js';
import {
  CANDIDATE_DID,
  OTHER_DID,
  POLICY,
  TRUST_DOMAIN,
  happyScenario,
  newKey,
} from './scenario.test-fixtures.js';

// The six evidence facts, all true, so that only the key facts decide the trace under test.
const otherFactsTrue: FactInput[] = FACT_NAMES.filter((n) => !n.startsWith('ASSERTION_KEY_')).map(
  (name) => ({
    name,
    value: true,
    provenance: { source: 'CONFIDENTIAL_VERIFICATION', ref: 'run:fixture' },
  }),
);

// TEST-VECTORS §7 challenge fixture (fixed clock).
const CHALLENGE: KeyPossessionChallenge = {
  type: 'CatenorOneKeyPossessionChallenge',
  challengeId: 'challenge:admission:001',
  subject: CANDIDATE_DID,
  verificationMethod: `${CANDIDATE_DID}#assertion-key-1`,
  operation: 'ADMIT_TRUST_ANCHOR',
  trustDomain: TRUST_DOMAIN,
  nonce: 'opaque-random-nonce-001',
  issuedAt: '2026-09-09T22:00:00Z',
  expiresAt: '2026-09-09T22:05:00Z',
};
const ISSUED: ChallengeRecord = { challenge: CHALLENGE, status: 'ISSUED' };
const NOW = new Date('2026-09-09T22:01:00Z');

function sign(
  challenge: KeyPossessionChallenge,
  secretKey: Uint8Array,
  overrides = {},
): DataIntegrityProof {
  const { proofOptions, hashData } = prepareProof(challenge as unknown as Record<string, unknown>, {
    type: 'DataIntegrityProof',
    cryptosuite: 'eddsa-jcs-2022',
    verificationMethod: challenge.verificationMethod,
    proofPurpose: 'assertionMethod',
    created: '2026-09-09T22:01:00Z',
    challenge: challenge.nonce,
    domain: challenge.trustDomain,
    ...overrides,
  });
  return attachProofValue(proofOptions, ed25519.sign(hashData, secretKey));
}

const s = happyScenario();
const base = {
  record: ISSUED,
  requestedSubject: CANDIDATE_DID,
  trustDomain: TRUST_DOMAIN,
  didDocument: s.document,
  keyReference: s.keyReference,
  now: NOW,
};

describe('KeyPossessionVerifier (PLAN §14.3)', () => {
  it('TV-S001-D01 — valid assertion-key proof → POSSESSION and PURPOSE true (AC-S001-014)', () => {
    const result = verifyKeyPossession({
      ...base,
      proof: sign(CHALLENGE, s.assertionKey.secretKey),
    });
    expect(result).toMatchObject({ possessionValid: true, purposeValid: true, reasons: [] });
    expect(result.facts).toEqual([
      {
        name: 'ASSERTION_KEY_POSSESSION_VALID',
        value: true,
        provenance: { source: 'KEY_POSSESSION_VERIFIER', ref: 'challenge:admission:001' },
      },
      {
        name: 'ASSERTION_KEY_PURPOSE_VALID',
        value: true,
        provenance: { source: 'KEY_POSSESSION_VERIFIER', ref: 'challenge:admission:001' },
      },
    ]);
  });

  it('TV-S001-D02 — wrong key signs the challenge → POSSESSION false (AC-S001-015)', () => {
    const result = verifyKeyPossession({ ...base, proof: sign(CHALLENGE, newKey().secretKey) });
    expect(result.possessionValid).toBe(false);
    expect(result.reasons).toContain('SIGNATURE_INVALID');
  });

  it('TV-S001-D03 — expired challenge → false even with a valid signature (AC-S001-016)', () => {
    const result = verifyKeyPossession({
      ...base,
      now: new Date('2026-09-09T22:06:00Z'),
      proof: sign(CHALLENGE, s.assertionKey.secretKey),
    });
    expect(result).toMatchObject({
      possessionValid: false,
      purposeValid: undefined,
      reasons: ['CHALLENGE_EXPIRED'],
    });
  });

  it('TV-S001-D04 — replay: the first verification succeeds, the consumed challenge is rejected (AC-S001-017)', () => {
    const proof = sign(CHALLENGE, s.assertionKey.secretKey);
    expect(verifyKeyPossession({ ...base, proof }).possessionValid).toBe(true);
    const consumed = consumeChallenge(ISSUED);
    const second = verifyKeyPossession({ ...base, record: consumed, proof });
    expect(second).toMatchObject({
      possessionValid: false,
      purposeValid: undefined,
      reasons: ['CHALLENGE_CONSUMED'],
    });
    expect(() => consumeChallenge(consumed)).toThrow('CHALLENGE_CONSUMED');
  });

  it('TV-S001-D05 — challenge belongs to another DID → false (AC-S001-018)', () => {
    const result = verifyKeyPossession({
      ...base,
      requestedSubject: OTHER_DID,
      proof: sign(CHALLENGE, s.assertionKey.secretKey),
    });
    expect(result).toMatchObject({
      possessionValid: false,
      purposeValid: undefined,
      reasons: ['CHALLENGE_SUBJECT_MISMATCH'],
    });
  });

  it('TV-S001-D06 — Verification Method not listed under assertionMethod → PURPOSE false', () => {
    const authKey = newKey();
    const authVm = createVerificationMethod(
      verificationMethodId(CANDIDATE_DID, 'authentication-key-1'),
      CANDIDATE_DID,
      authKey.multikey,
    );
    const document = createDidDocument(CANDIDATE_DID, [s.vm, authVm], [s.vm.id]);
    const challenge = { ...CHALLENGE, verificationMethod: authVm.id };
    const keyReference: KeyManagementReference = {
      ...s.keyReference,
      verificationMethod: authVm.id,
      purpose: 'AUTHENTICATION',
    };
    const result = verifyKeyPossession({
      ...base,
      record: { challenge, status: 'ISSUED' },
      didDocument: document,
      keyReference,
      proof: sign(challenge, authKey.secretKey),
    });
    expect(result.purposeValid).toBe(false);
    expect(result.reasons).toContain('VERIFICATION_METHOD_NOT_FOR_ASSERTION');
  });

  it('a key bound for FINANCIAL_EXECUTION is never a valid assertion key (AC-S001-013)', () => {
    const result = verifyKeyPossession({
      ...base,
      keyReference: { ...s.keyReference, purpose: 'FINANCIAL_EXECUTION' },
      proof: sign(CHALLENGE, s.assertionKey.secretKey),
    });
    expect(result.purposeValid).toBe(false);
    expect(result.reasons).toContain('KEY_PURPOSE_NOT_CREDENTIAL_ASSERTION');
  });

  it.each([
    ['another nonce', { challenge: 'other-nonce' }],
    ['another trust domain', { domain: 'trust-domain:other' }],
    ['another proof purpose', { proofPurpose: 'authentication' }],
  ])('a proof bound to %s is rejected', (_label, overrides) => {
    const result = verifyKeyPossession({
      ...base,
      proof: sign(CHALLENGE, s.assertionKey.secretKey, overrides),
    });
    expect(result.possessionValid).toBe(false);
    expect(result.reasons).toContain('PROOF_BINDING_MISMATCH');
  });

  it('unknown challenge, other operation context and unknown verification method fail closed', () => {
    const proof = sign(CHALLENGE, s.assertionKey.secretKey);
    expect(verifyKeyPossession({ ...base, record: undefined, proof }).reasons).toEqual([
      'CHALLENGE_UNKNOWN',
    ]);
    expect(
      verifyKeyPossession({ ...base, trustDomain: 'trust-domain:other', proof }).reasons,
    ).toEqual(['CHALLENGE_CONTEXT_MISMATCH']);
    const noVm = { ...proof, verificationMethod: `${CANDIDATE_DID}#assertion-key-9` };
    expect(verifyKeyPossession({ ...base, proof: noVm }).reasons).toEqual([
      'VERIFICATION_METHOD_MISSING',
    ]);
  });
});

describe('KeyPossessionVerifier — FALSE vs MISSING (maintainer decision 2026-09-11, option B)', () => {
  const proof = sign(CHALLENGE, s.assertionKey.secretKey);
  const stopped: [string, Partial<typeof base> & { proof?: DataIntegrityProof }][] = [
    ['unknown challenge', { record: undefined }],
    ['consumed challenge', { record: consumeChallenge(ISSUED) }],
    ['expired challenge', { now: new Date('2026-09-09T22:06:00Z') }],
    ['challenge of another DID', { requestedSubject: OTHER_DID }],
    ['other trust-domain context', { trustDomain: 'trust-domain:other' }],
    [
      'verification method absent from the DID Document',
      { proof: { ...proof, verificationMethod: `${CANDIDATE_DID}#assertion-key-9` } },
    ],
  ];

  it.each(stopped)(
    '%s → POSSESSION false, PURPOSE not produced (MISSING in the trace), DENY',
    (_label, overrides) => {
      const result = verifyKeyPossession({ ...base, proof, ...overrides });
      expect(result.possessionValid).toBe(false);
      expect(result.purposeValid).toBeUndefined();
      expect(result.facts.map((f) => f.name)).toEqual(['ASSERTION_KEY_POSSESSION_VALID']);
      const evaluation = evaluatePolicy({
        policy: POLICY,
        expectedPolicyHash: policyHash(POLICY),
        facts: FactSet.from([...otherFactsTrue, ...result.facts]),
      });
      expect(evaluation.outcome).toBe('DENY');
      const status = Object.fromEntries(
        evaluation.outcome === 'ERROR'
          ? []
          : evaluation.requirementResults.map((r) => [r.claim, r.status]),
      );
      expect(status).toMatchObject({
        ASSERTION_KEY_POSSESSION_VALID: 'FALSE',
        ASSERTION_KEY_PURPOSE_VALID: 'MISSING',
      });
    },
  );

  it('purpose evaluated and invalid → PURPOSE false (FALSE in the trace)', () => {
    const result = verifyKeyPossession({
      ...base,
      keyReference: { ...s.keyReference, purpose: 'FINANCIAL_EXECUTION' },
      proof,
    });
    expect(result.facts).toContainEqual(
      expect.objectContaining({ name: 'ASSERTION_KEY_PURPOSE_VALID', value: false }),
    );
  });

  it('a proof-binding failure after step 6 keeps the evaluated purpose (true) and possession false', () => {
    const result = verifyKeyPossession({
      ...base,
      proof: sign(CHALLENGE, s.assertionKey.secretKey, { challenge: 'other-nonce' }),
    });
    expect(result).toMatchObject({ possessionValid: false, purposeValid: true });
    expect(result.facts.map((f) => [f.name, f.value])).toEqual([
      ['ASSERTION_KEY_POSSESSION_VALID', false],
      ['ASSERTION_KEY_PURPOSE_VALID', true],
    ]);
  });
});

describe('issueChallenge', () => {
  it('binds DID, verification method, operation and trust domain with a 5-minute TTL', () => {
    const record = issueChallenge({
      challengeId: 'challenge:admission:002',
      subject: CANDIDATE_DID,
      verificationMethod: s.vm.id,
      trustDomain: TRUST_DOMAIN,
      nonce: Buffer.alloc(32, 7).toString('base64url'),
      issuedAt: new Date('2026-09-09T22:00:00Z'),
    });
    expect(record.status).toBe('ISSUED');
    expect(record.challenge).toMatchObject({
      operation: 'ADMIT_TRUST_ANCHOR',
      issuedAt: '2026-09-09T22:00:00Z',
      expiresAt: '2026-09-09T22:05:00Z',
    });
    expect(CHALLENGE_TTL_SECONDS).toBe(300);
  });

  it('requires a 32-byte base64url nonce', () => {
    expect(() =>
      issueChallenge({
        challengeId: 'c',
        subject: CANDIDATE_DID,
        verificationMethod: s.vm.id,
        trustDomain: TRUST_DOMAIN,
        nonce: 'short',
        issuedAt: NOW,
      }),
    ).toThrow(TypeError);
  });
});
