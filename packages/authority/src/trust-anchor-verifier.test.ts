import { commit } from '@catenor-one/audit';
import { createDecision } from '@catenor-one/policy';
import { describe, expect, it } from 'vitest';
import { configFor, happyScenario, newKey, verifierInput } from './scenario.test-fixtures.js';
import {
  S001_VERIFICATION_CLAIM,
  verifyTrustAnchor,
  type TrustAnchorVerificationInput,
} from './trust-anchor-verifier.js';

const s = happyScenario();
const input = verifierInput(s);

const failed = (input: TrustAnchorVerificationInput) =>
  verifyTrustAnchor(input)
    .checks.filter((c) => !c.passed)
    .map((c) => c.id);

describe('TrustAnchorVerifier — 12 checks (PLAN §26.2)', () => {
  it('TV-S001-J01 — happy path: TRUST_ANCHOR_VALID = true with all 12 checks passing (AC-S001-063)', () => {
    const result = verifyTrustAnchor(input);
    expect(result.TRUST_ANCHOR_VALID).toBe(true);
    expect(result.admissionProvenanceVerified).toBe(true);
    expect(result.checks.map((c) => c.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(result.checks.every((c) => c.passed)).toBe(true);
  });

  it('labels each check with its basis and states the narrow S001 claim (PLAN §26.1)', () => {
    const result = verifyTrustAnchor(input);
    const basis = Object.fromEntries(result.checks.map((c) => [c.id, c.basis]));
    expect(basis).toEqual({
      1: 'CRYPTOGRAPHIC',
      2: 'OPERATIONAL',
      3: 'STRUCTURAL',
      4: 'CRYPTOGRAPHIC',
      5: 'OPERATIONAL',
      6: 'CRYPTOGRAPHIC',
      7: 'CRYPTOGRAPHIC',
      8: 'CRYPTOGRAPHIC',
      9: 'CRYPTOGRAPHIC',
      10: 'CRYPTOGRAPHIC',
      11: 'OPERATIONAL_PROJECTION',
      12: 'OPERATIONAL_PROJECTION',
    });
    expect(result.lifecycleStatusSource).toBe('catenor-one-operational-projection');
    expect(result.claim).toBe(S001_VERIFICATION_CLAIM);
  });

  it('TV-S001-J02 — tampered evidenceCommitment → false (AC-S001-064)', () => {
    const tampered = {
      ...input,
      record: { ...s.record, evidenceCommitment: commit({ tampered: true }) },
    };
    expect(verifyTrustAnchor(tampered).TRUST_ANCHOR_VALID).toBe(false);
    expect(failed(tampered)).toEqual(expect.arrayContaining([9, 10]));
  });

  it('TV-S001-J03 — tampered policy hash → false', () => {
    const tampered = {
      ...input,
      record: { ...s.record, policyHash: commit({ altered: 'policy' }) },
    };
    expect(verifyTrustAnchor(tampered).TRUST_ANCHOR_VALID).toBe(false);
    expect(failed(tampered)).toEqual(expect.arrayContaining([8, 10]));
  });

  it('TV-S001-J04 — missing bootstrap endorsement → false', () => {
    const result = verifyTrustAnchor({ ...input, endorsement: undefined });
    expect(result.TRUST_ANCHOR_VALID).toBe(false);
    expect(result.checks.find((c) => c.id === 10)).toMatchObject({
      passed: false,
      reason: 'missing bootstrap endorsement',
    });
  });

  it.each(['SUSPENDED', 'REVOKED', 'DEACTIVATED'] as const)(
    'TV-S001-J05/J06 — %s status → false, while admission provenance still verifies (AC-S001-065)',
    (status) => {
      const result = verifyTrustAnchor({
        ...input,
        status: { ...input.status, trustAnchorStatus: status },
      });
      expect(result.TRUST_ANCHOR_VALID).toBe(false);
      expect(result.admissionProvenanceVerified).toBe(true);
      expect(failed({ ...input, status: { ...input.status, trustAnchorStatus: status } })).toEqual([
        11,
      ]);
    },
  );

  it('TV-S001-J07 — Verification Method key replaced after admission → false (AC-S001-076)', () => {
    const replacedVm = { ...s.vm, publicKeyMultibase: newKey().multikey };
    const document = { ...s.document, verificationMethod: [replacedVm] };
    const result = verifyTrustAnchor({ ...input, resolution: { status: 'RESOLVED', document } });
    expect(result.TRUST_ANCHOR_VALID).toBe(false);
    expect(result.checks.find((c) => c.id === 4)?.passed).toBe(false);
  });

  it('a revoked Verification Method or deactivated Subject fails check 12', () => {
    expect(
      failed({ ...input, status: { ...input.status, verificationMethodStatus: 'REVOKED' } }),
    ).toEqual([12]);
    expect(
      failed({ ...input, status: { ...input.status, subjectLifecycle: 'SUSPENDED' } }),
    ).toEqual([12]);
  });

  describe('tampered-field matrix — every record field bound by the endorsement', () => {
    it.each([
      ['trustDomain', { trustDomain: 'trust-domain:other' }],
      ['trustAnchor', { trustAnchor: 'did:catenor:00000000000000000000000000000001' }],
      ['admissionPolicy', { admissionPolicy: 'policy:other:v1' }],
      ['policyHash', { policyHash: commit({ x: 1 }) }],
      ['verificationMethod', { verificationMethod: `${s.vm.controller}#assertion-key-2` }],
      ['evidenceCommitment', { evidenceCommitment: commit({ x: 2 }) }],
      ['decisionRef', { decisionRef: 'decision:admission:999' }],
      ['bootstrapEndorsementRef', { bootstrapEndorsementRef: 'endorsement:bootstrap:999' }],
    ])('record.%s changed → TRUST_ANCHOR_VALID = false', (_field, change) => {
      const result = verifyTrustAnchor({ ...input, record: { ...s.record, ...change } });
      expect(result.TRUST_ANCHOR_VALID).toBe(false);
      expect(result.admissionProvenanceVerified).toBe(false);
    });
  });

  it('check 1 — a configuration that is not the pinned one fails (and so does its endorsement)', () => {
    const otherConfig = configFor(newKey().multikey);
    expect(failed({ ...input, config: otherConfig })).toEqual(expect.arrayContaining([1, 10]));
    expect(failed({ ...input, pinnedConfigurationHash: commit({ other: 'pin' }) })).toEqual(
      expect.arrayContaining([1, 10]),
    );
  });

  it('checks 2 and 3 — unresolvable DID and non-minimized DID Document fail', () => {
    expect(failed({ ...input, resolution: { status: 'DEACTIVATED' } })).toEqual(
      expect.arrayContaining([2, 3, 4]),
    );
    const leaky = {
      ...s.document,
      service: [{ id: 'x', type: 'Sumsub', serviceEndpoint: 'sumsub_company_fixture_001' }],
    };
    expect(failed({ ...input, resolution: { status: 'RESOLVED', document: leaky } })).toContain(3);
  });

  it('check 9 — a DENY Decision presented for the admission fails', () => {
    const deny = createDecision({ ...s.decision, decision: 'DENY' });
    expect(failed({ ...input, decision: deny })).toEqual(expect.arrayContaining([9, 10]));
  });

  it('check 7/8 — a different published policy fails', () => {
    const relaxed = structuredClone(input.policy) as { requirements: unknown[] };
    relaxed.requirements.pop();
    expect(failed({ ...input, policy: relaxed })).toEqual([8]);
    expect(
      failed({ ...input, policy: { ...(input.policy as object), id: 'policy:other:v1' } }),
    ).toEqual(expect.arrayContaining([7, 8]));
  });
});
