import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluatePolicy, type PolicyEvaluation } from './evaluate.js';
import { FACT_NAMES, FactSet, type FactInput, type FactName } from './facts.js';
import { policyHash } from './policy-document.js';

const policy: unknown = JSON.parse(
  readFileSync(new URL('../policies/trust-anchor-admission.v1.json', import.meta.url), 'utf8'),
);
const PINNED = policyHash(policy);

function fact(name: string, value: boolean): FactInput {
  const source =
    name === 'ASSERTION_KEY_POSSESSION_VALID' || name === 'ASSERTION_KEY_PURPOSE_VALID'
      ? 'KEY_POSSESSION_VERIFIER'
      : 'CONFIDENTIAL_VERIFICATION';
  return { name, value, provenance: { source, ref: 'run:fixture' } };
}

/** TEST-VECTORS §8 canonical happy-path fact set, with overrides / removals. */
function facts(
  overrides: Partial<Record<FactName, boolean>> = {},
  remove: FactName[] = [],
): FactInput[] {
  return FACT_NAMES.filter((n) => !remove.includes(n)).map((n) => fact(n, overrides[n] ?? true));
}

function evaluate(inputs: FactInput[]): PolicyEvaluation {
  return evaluatePolicy({ policy, expectedPolicyHash: PINNED, facts: FactSet.from(inputs) });
}

function statusOf(result: PolicyEvaluation, claim: FactName) {
  if (result.outcome === 'ERROR') throw new Error('unexpected ERROR');
  return result.requirementResults.find((r) => r.claim === claim)?.status;
}

describe('Admission Policy v1 evaluation (T2.5)', () => {
  it('TV-S001-F01 — all facts true → ALLOW (AC-S001-035)', () => {
    const result = evaluate(facts());
    expect(result.outcome).toBe('ALLOW');
    if (result.outcome !== 'ERROR') {
      expect(result.requirementResults.every((r) => r.status === 'SATISFIED')).toBe(true);
    }
  });

  it.each([
    ['TV-S001-F02', 'ORGANIZATION_KYB_VERIFIED'],
    ['TV-S001-F03', 'ORGANIZATION_STATUS_VALID'],
    ['TV-S001-F04', 'ORGANIZATION_AML_CLEAR'],
    ['TV-S001-F05', 'AUTHORIZED_REPRESENTATIVE_VERIFIED'],
    ['TV-S001-F07', 'ASSERTION_KEY_POSSESSION_VALID'],
    ['TV-S001-F08', 'ASSERTION_KEY_PURPOSE_VALID'],
    ['TV-S001-F09', 'EVIDENCE_FRESH'],
  ] as const)('%s — %s = false → DENY (AC-S001-036)', (_tv, name) => {
    const result = evaluate(facts({ [name]: false }));
    expect(result.outcome).toBe('DENY');
    expect(statusOf(result, name)).toBe('FALSE');
  });

  it('TV-S001-F06 — representative verified but authority not confirmed → DENY (AC-S001-040)', () => {
    const result = evaluate(
      facts({
        AUTHORIZED_REPRESENTATIVE_VERIFIED: true,
        REPRESENTATIVE_AUTHORITY_CONFIRMED: false,
      }),
    );
    expect(result.outcome).toBe('DENY');
    expect(statusOf(result, 'AUTHORIZED_REPRESENTATIVE_VERIFIED')).toBe('SATISFIED');
    expect(statusOf(result, 'REPRESENTATIVE_AUTHORITY_CONFIRMED')).toBe('FALSE');
  });

  it('TV-S001-F10 — required fact missing → DENY, trace MISSING (not FALSE) (AC-S001-037, D4)', () => {
    const result = evaluate(facts({}, ['ORGANIZATION_AML_CLEAR']));
    expect(result.outcome).toBe('DENY');
    expect(statusOf(result, 'ORGANIZATION_AML_CLEAR')).toBe('MISSING');
  });

  it('keeps FALSE and MISSING distinct in the same trace', () => {
    const result = evaluate(facts({ EVIDENCE_FRESH: false }, ['ORGANIZATION_AML_CLEAR']));
    expect(result.outcome).toBe('DENY');
    expect(statusOf(result, 'EVIDENCE_FRESH')).toBe('FALSE');
    expect(statusOf(result, 'ORGANIZATION_AML_CLEAR')).toBe('MISSING');
  });

  it('TV-S001-F11 — an extra unknown fact does not bypass policy → DENY', () => {
    const inputs = [...facts({ ORGANIZATION_AML_CLEAR: false }), fact('SUPER_TRUSTED_BY_UI', true)];
    const set = FactSet.from(inputs);
    expect(set.dropped).toEqual(['SUPER_TRUSTED_BY_UI']);
    expect(evaluatePolicy({ policy, expectedPolicyHash: PINNED, facts: set }).outcome).toBe('DENY');
  });

  it('no facts at all → DENY with every requirement MISSING', () => {
    const result = evaluate([]);
    expect(result.outcome).toBe('DENY');
    if (result.outcome !== 'ERROR') {
      expect(result.requirementResults.every((r) => r.status === 'MISSING')).toBe(true);
    }
  });

  it('is deterministic', () => {
    expect(evaluate(facts({ EVIDENCE_FRESH: false }))).toEqual(
      evaluate(facts({ EVIDENCE_FRESH: false })),
    );
  });
});

describe('integrity failures → ERROR, never ALLOW (AC-S001-038)', () => {
  it('TV-S001-B02 — runtime policy hash differs from the pinned hash → ERROR', () => {
    const tampered = structuredClone(policy) as { requirements: unknown[] };
    tampered.requirements.pop(); // a relaxed policy with all remaining facts true
    const result = evaluatePolicy({
      policy: tampered,
      expectedPolicyHash: PINNED,
      facts: FactSet.from(facts()),
    });
    expect(result.outcome).toBe('ERROR');
  });

  it('pinned hash is not a commitment (e.g. the TEST-VECTORS placeholder) → ERROR', () => {
    const result = evaluatePolicy({
      policy,
      expectedPolicyHash: '0xpolicyhash_demo_v1',
      facts: FactSet.from(facts()),
    });
    expect(result.outcome).toBe('ERROR');
  });

  it('malformed policy that matches its own pinned hash → ERROR', () => {
    const malformed = {
      id: 'policy:x',
      action: 'A',
      requirements: [{ claim: 'UNKNOWN', equals: true }],
    };
    const result = evaluatePolicy({
      policy: malformed,
      expectedPolicyHash: policyHash(malformed),
      facts: FactSet.from(facts()),
    });
    expect(result.outcome).toBe('ERROR');
  });

  it('a known fact supplied twice is rejected before evaluation', () => {
    expect(() => FactSet.from([...facts(), fact('EVIDENCE_FRESH', false)])).toThrow(
      /more than once/,
    );
  });
});
