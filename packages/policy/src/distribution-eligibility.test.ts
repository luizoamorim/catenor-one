import { describe, expect, it } from 'vitest';
import {
  DISTRIBUTION_ELIGIBILITY_POLICY_ID,
  evaluateDistributionEligibility,
} from './distribution-eligibility.js';

const all = {
  HOLDS_ASSET: true,
  INVESTOR_IDENTITY_VERIFIED: true,
  INVESTOR_AML_CLEAR: true,
  EVIDENCE_FRESH: true,
} as const;

describe('policy:distribution-eligibility:v1 [REF-IMPL]', () => {
  it('ALLOW only when every requirement is TRUE', () => {
    const r = evaluateDistributionEligibility(all);
    expect(r).toMatchObject({
      policy: DISTRIBUTION_ELIGIBILITY_POLICY_ID,
      outcome: 'ALLOW',
      failed: [],
    });
    expect(r.trace.every((t) => t.status === 'TRUE')).toBe(true);
  });

  it('a holder whose current evidence is RED is DENIED — ownership ≠ eligibility', () => {
    const r = evaluateDistributionEligibility({
      ...all,
      INVESTOR_IDENTITY_VERIFIED: false,
      INVESTOR_AML_CLEAR: false,
    });
    expect(r.outcome).toBe('DENY');
    expect(r.failed).toEqual(['INVESTOR_IDENTITY_VERIFIED', 'INVESTOR_AML_CLEAR']);
  });

  it('MISSING never becomes ALLOW and stays distinct from FALSE in the trace', () => {
    const r = evaluateDistributionEligibility({
      ...all,
      EVIDENCE_FRESH: null,
      HOLDS_ASSET: undefined,
    });
    expect(r.outcome).toBe('DENY');
    expect(r.trace).toContainEqual({ requirement: 'EVIDENCE_FRESH', status: 'MISSING' });
    expect(r.trace).toContainEqual({ requirement: 'HOLDS_ASSET', status: 'MISSING' });
  });

  it('eligible evidence without holdings is DENIED (nothing to distribute to)', () => {
    expect(evaluateDistributionEligibility({ ...all, HOLDS_ASSET: false }).outcome).toBe('DENY');
  });
});
