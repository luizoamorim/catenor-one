import { commit } from '@catenor-one/audit';
import { createVerificationMethod, type VerificationMethod } from '@catenor-one/identity';
import { createDecision } from '@catenor-one/policy';
import { describe, expect, it } from 'vitest';
import {
  EndorsementRefusedError,
  buildEndorsementPayload,
  verificationMethodCommitment,
  verifyEndorsement,
  type EndorsementExpectation,
} from './endorsement.js';
import {
  CANDIDATE_DID,
  OTHER_DID,
  happyScenario,
  newKey,
  signEndorsement,
} from './scenario.test-fixtures.js';

const s = happyScenario();
const expectation: EndorsementExpectation = {
  config: s.config,
  candidate: CANDIDATE_DID,
  verificationMethod: s.vm,
  decision: s.decision,
  decisionRef: s.decisionRef,
  policyHash: s.config.admissionPolicyHash,
  evidenceCommitment: s.decision.evidenceCommitment,
};

describe('verificationMethodCommitment (Q1, PLAN §16.2)', () => {
  it('commits to exactly {id, controller, type, publicKeyMultibase}', () => {
    expect(verificationMethodCommitment(s.vm)).toBe(
      commit({
        id: s.vm.id,
        controller: s.vm.controller,
        type: 'Multikey',
        publicKeyMultibase: s.vm.publicKeyMultibase,
      }),
    );
  });

  it('TEST-VECTORS §6 fixture commitment is 0x-hex SHA-256 of the canonical VM', () => {
    const fixtureVm = {
      id: 'did:catenor:8f0c92d7e5f04e40a41faee32e5e180b#assertion-key-1',
      controller: 'did:catenor:8f0c92d7e5f04e40a41faee32e5e180b',
      type: 'Multikey',
      publicKeyMultibase: 'z6MkFixtureAssertionPublicKey001',
    } as VerificationMethod;
    expect(verificationMethodCommitment(fixtureVm)).toBe(commit(fixtureVm));
    expect(
      verificationMethodCommitment({
        ...fixtureVm,
        publicKeyMultibase: 'z6MkFixtureReplacementKey999',
      }),
    ).not.toBe(verificationMethodCommitment(fixtureVm));
  });
});

describe('bootstrap endorsement', () => {
  it('TV-S001-G01 — a valid ALLOW is endorsed and verifies (AC-S001-044)', () => {
    expect(verifyEndorsement(s.endorsement, expectation)).toEqual({ valid: true, failures: [] });
    expect(s.endorsement).toMatchObject({
      trustDomain: s.config.trustDomain,
      bootstrapConfigurationHash: s.pin,
      candidate: CANDIDATE_DID,
      verificationMethod: s.vm.id,
      verificationMethodCommitment: verificationMethodCommitment(s.vm),
      admissionPolicy: 'policy:trust-anchor-admission:v1',
      policyHash: s.config.admissionPolicyHash,
      evidenceCommitment: s.decision.evidenceCommitment,
    });
    expect(s.endorsement.proof.verificationMethod).toBe('bootstrap-verification-method:1');
  });

  it.each(['DENY', 'ERROR'] as const)(
    'TV-S001-G02 — a %s decision cannot be endorsed (AC-S001-045)',
    (outcome) => {
      expect(() =>
        buildEndorsementPayload({
          config: s.config,
          decision: { ...s.decision, decision: outcome },
          decisionRef: s.decisionRef,
          verificationMethod: s.vm,
          endorsementId: 'endorsement:bootstrap:002',
          endorsedAt: '2026-09-10T00:00:00Z',
        }),
      ).toThrow(EndorsementRefusedError);
    },
  );

  it('TV-S001-G03 — endorsement for did:A presented for did:B → false', () => {
    const otherVm = createVerificationMethod(
      `${OTHER_DID}#assertion-key-1` as VerificationMethod['id'],
      OTHER_DID,
      s.vm.publicKeyMultibase,
    );
    const result = verifyEndorsement(s.endorsement, {
      ...expectation,
      candidate: OTHER_DID,
      verificationMethod: otherVm,
    });
    expect(result.valid).toBe(false);
    expect(result.failures).toContain('CANDIDATE_MISMATCH');
  });

  it('TV-S001-G04 — runtime Admission policy hash differs from the endorsed policy hash → false', () => {
    const result = verifyEndorsement(s.endorsement, {
      ...expectation,
      policyHash: commit({ altered: true }),
    });
    expect(result.valid).toBe(false);
    expect(result.failures).toContain('POLICY_HASH_MISMATCH');
  });

  it('TV-S001-G05 — signature by an unauthorized key → false', () => {
    const payload = (({ proof: _p, ...rest }) => rest)(s.endorsement);
    const forged = signEndorsement(s.config, payload, newKey().secretKey);
    const result = verifyEndorsement(forged, expectation);
    expect(result).toEqual({ valid: false, failures: ['SIGNATURE_INVALID'] });
  });

  it('TV-S001-G06 — Verification Method key replaced before activation → false (AC-S001-076)', () => {
    const replaced = { ...s.vm, publicKeyMultibase: newKey().multikey };
    const result = verifyEndorsement(s.endorsement, {
      ...expectation,
      verificationMethod: replaced,
    });
    expect(result.valid).toBe(false);
    expect(result.failures).toEqual(['VERIFICATION_METHOD_COMMITMENT_MISMATCH']);
  });

  it('the candidate cannot sign its own endorsement (assertion key ≠ bootstrap key)', () => {
    const payload = (({ proof: _p, ...rest }) => rest)(s.endorsement);
    const selfSigned = signEndorsement(s.config, payload, s.assertionKey.secretKey);
    expect(verifyEndorsement(selfSigned, expectation).failures).toContain('SIGNATURE_INVALID');
  });

  it.each([
    ['evidenceCommitment', { evidenceCommitment: commit({ tampered: true }) }, 'SIGNATURE_INVALID'],
    ['decisionRef', { decisionRef: 'decision:admission:999' }, 'DECISION_REF_MISMATCH'],
    ['trustDomain', { trustDomain: 'trust-domain:other' }, 'TRUST_DOMAIN_MISMATCH'],
    [
      'bootstrapConfigurationHash',
      { bootstrapConfigurationHash: commit({ other: 'config' }) },
      'CONFIGURATION_HASH_MISMATCH',
    ],
  ])('tampered endorsed field %s is detected', (_label, change, expected) => {
    const result = verifyEndorsement(
      { ...s.endorsement, ...change } as typeof s.endorsement,
      expectation,
    );
    expect(result.valid).toBe(false);
    expect(result.failures).toContain('SIGNATURE_INVALID');
    expect(result.failures).toContain(expected);
  });

  it('a DENY decision presented at activation fails verification', () => {
    const deny = createDecision({ ...s.decision, decision: 'DENY' });
    const result = verifyEndorsement(s.endorsement, { ...expectation, decision: deny });
    expect(result.failures).toEqual(
      expect.arrayContaining(['DECISION_NOT_ALLOW', 'DECISION_COMMITMENT_MISMATCH']),
    );
  });

  it('a proof naming another bootstrap verification method is rejected', () => {
    const result = verifyEndorsement(
      {
        ...s.endorsement,
        proof: { ...s.endorsement.proof, verificationMethod: 'bootstrap-verification-method:2' },
      },
      expectation,
    );
    expect(result.failures).toContain('BOOTSTRAP_KEY_MISMATCH');
  });
});
