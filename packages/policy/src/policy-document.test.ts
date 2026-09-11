import { readFileSync } from 'node:fs';
import { validateProtocolObject } from '@catenor-one/test-vectors';
import { describe, expect, it } from 'vitest';
import { FACT_NAMES } from './facts.js';
import {
  MalformedPolicyError,
  TRUST_ANCHOR_ADMISSION_POLICY_ID,
  parsePolicyDocument,
  policyHash,
} from './policy-document.js';

const POLICY_FILE = new URL('../policies/trust-anchor-admission.v1.json', import.meta.url);
const policyJson: unknown = JSON.parse(readFileSync(POLICY_FILE, 'utf8'));

// Locked golden value: 0x + SHA-256(JCS(policy)). Changing the policy file must be a deliberate change
// that also updates the Bootstrap Configuration pin (AC-S001-039).
const GOLDEN_POLICY_HASH = '0xb2d0783063808e7f93be27179cec2910ef7f88630979b3ff5a246695c48ecec4';

describe('policy:trust-anchor-admission:v1 document (T2.4)', () => {
  const policy = parsePolicyDocument(policyJson);

  it('is faithful to SPEC §17: id, action, eight required facts = true, ALLOW/otherwise DENY', () => {
    expect(policy.id).toBe(TRUST_ANCHOR_ADMISSION_POLICY_ID);
    expect(policy.action).toBe('ADMIT_TRUST_ANCHOR');
    expect(policy.requirements.map((r) => r.claim)).toEqual([...FACT_NAMES]);
    expect(policy.requirements.every((r) => r.equals === true)).toBe(true);
    expect(policy.decision).toEqual({ allRequirementsSatisfied: 'ALLOW', otherwise: 'DENY' });
  });

  it('conforms to the pinned protocol policy.schema.json', () => {
    expect(validateProtocolObject('policy', policyJson)).toEqual({ valid: true, errors: [] });
  });

  it('has the locked golden policyHash (AC-S001-039)', () => {
    expect(policyHash(policyJson)).toBe(GOLDEN_POLICY_HASH);
  });

  it('any content change changes the policyHash', () => {
    const relaxed = structuredClone(policyJson) as { requirements: unknown[] };
    relaxed.requirements.pop();
    expect(policyHash(relaxed)).not.toBe(GOLDEN_POLICY_HASH);
  });
});

describe('parsePolicyDocument', () => {
  const valid = policyJson as Record<string, unknown>;
  it.each([
    ['not an object', []],
    ['missing id', { ...valid, id: undefined }],
    ['empty requirements', { ...valid, requirements: [] }],
    ['unknown claim', { ...valid, requirements: [{ claim: 'SUPER_TRUSTED_BY_UI', equals: true }] }],
    [
      'non-boolean equals',
      { ...valid, requirements: [{ claim: 'EVIDENCE_FRESH', equals: 'yes' }] },
    ],
    [
      'duplicate requirement',
      {
        ...valid,
        requirements: [
          { claim: 'EVIDENCE_FRESH', equals: true },
          { claim: 'EVIDENCE_FRESH', equals: true },
        ],
      },
    ],
    [
      'permissive decision',
      { ...valid, decision: { allRequirementsSatisfied: 'ALLOW', otherwise: 'ALLOW' } },
    ],
  ])('rejects %s', (_label, value) => {
    expect(() => parsePolicyDocument(value)).toThrow(MalformedPolicyError);
  });
});
