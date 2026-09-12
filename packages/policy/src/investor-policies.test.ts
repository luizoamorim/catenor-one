import { validateProtocolObject } from '@catenor-one/test-vectors';
import { describe, expect, it } from 'vitest';
import {
  DISTRIBUTION_ELIGIBILITY_V2_POLICY,
  DISTRIBUTION_ELIGIBILITY_V2_POLICY_HASH,
  OFFERING_ELIGIBILITY_POLICY,
  OFFERING_ELIGIBILITY_POLICY_HASH,
  evaluateRequirements,
} from './investor-policies.js';
import { policyHash } from './policy-document.js';

const allTrue = {
  INVESTOR_PRESENTATION_VALID: true,
  INVESTOR_IDENTITY_VERIFIED: true,
  INVESTOR_AML_CLEAR: true,
  EVIDENCE_FRESH: true,
} as const;

describe('clean-room investor policies [REF-IMPL]', () => {
  it('both documents conform to the pinned protocol policy.schema.json', () => {
    for (const p of [OFFERING_ELIGIBILITY_POLICY, DISTRIBUTION_ELIGIBILITY_V2_POLICY]) {
      expect(validateProtocolObject('policy', p)).toEqual({ valid: true, errors: [] });
    }
  });

  it('are pinned by SHA-256(JCS(document)), like the admission policy', () => {
    expect(OFFERING_ELIGIBILITY_POLICY_HASH).toBe(policyHash(OFFERING_ELIGIBILITY_POLICY));
    expect(DISTRIBUTION_ELIGIBILITY_V2_POLICY_HASH).not.toBe(OFFERING_ELIGIBILITY_POLICY_HASH);
  });

  it('offering: ALLOW only with a valid presentation AND current evidence', () => {
    expect(evaluateRequirements(OFFERING_ELIGIBILITY_POLICY, allTrue).outcome).toBe('ALLOW');
    const r = evaluateRequirements(OFFERING_ELIGIBILITY_POLICY, {
      ...allTrue,
      INVESTOR_PRESENTATION_VALID: false,
    });
    expect(r).toMatchObject({ outcome: 'DENY', failed: ['INVESTOR_PRESENTATION_VALID'] });
  });

  it('distribution v2: a holder with a valid credential but RED current evidence is DENIED', () => {
    const r = evaluateRequirements(DISTRIBUTION_ELIGIBILITY_V2_POLICY, {
      HOLDS_ASSET: true,
      ...allTrue,
      INVESTOR_IDENTITY_VERIFIED: false,
      INVESTOR_AML_CLEAR: false,
    });
    expect(r.outcome).toBe('DENY');
    expect(r.failed).toEqual(['INVESTOR_IDENTITY_VERIFIED', 'INVESTOR_AML_CLEAR']);
  });

  it('MISSING never becomes ALLOW and stays distinct from FALSE', () => {
    const r = evaluateRequirements(DISTRIBUTION_ELIGIBILITY_V2_POLICY, {
      ...allTrue,
      HOLDS_ASSET: null,
    });
    expect(r.outcome).toBe('DENY');
    expect(r.trace[0]).toEqual({ requirement: 'HOLDS_ASSET', status: 'MISSING' });
  });
});
