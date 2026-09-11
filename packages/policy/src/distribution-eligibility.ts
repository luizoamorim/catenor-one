// policy:distribution-eligibility:v1 — Catenor One [REF-IMPL] final-demo policy (not frozen Catenor Protocol
// vocabulary; the protocol's policy language is open in Draft v0.1). Separate from the S001 admission policy and its
// closed FACT_NAMES, which it does not touch.
//
// Question: may this investor receive a regulated distribution NOW? Holding the asset is necessary but not
// sufficient (ownership ≠ current eligibility). Every requirement must be TRUE; FALSE and MISSING both DENY and stay
// distinct in the trace. Deterministic — no LLM, no provider-specific branching.
export const DISTRIBUTION_ELIGIBILITY_POLICY_ID = 'policy:distribution-eligibility:v1';

/** Evidence facts from the confidential investor check (identity-confidential INVESTOR_ELIGIBILITY). */
export const DISTRIBUTION_EVIDENCE_FACTS = [
  'INVESTOR_IDENTITY_VERIFIED',
  'INVESTOR_AML_CLEAR',
  'EVIDENCE_FRESH',
] as const;
export type DistributionEvidenceFact = (typeof DISTRIBUTION_EVIDENCE_FACTS)[number];

/** All requirements, in evaluation order: the local holding fact first, then the confidential evidence facts. */
export const DISTRIBUTION_REQUIREMENTS = ['HOLDS_ASSET', ...DISTRIBUTION_EVIDENCE_FACTS] as const;
export type DistributionRequirement = (typeof DISTRIBUTION_REQUIREMENTS)[number];

export type RequirementValue = boolean | null;

export interface DistributionEligibilityEvaluation {
  readonly policy: typeof DISTRIBUTION_ELIGIBILITY_POLICY_ID;
  readonly outcome: 'ALLOW' | 'DENY';
  readonly trace: readonly {
    readonly requirement: DistributionRequirement;
    readonly status: 'TRUE' | 'FALSE' | 'MISSING';
  }[];
  /** Requirements that were not TRUE (FALSE or MISSING), in order. */
  readonly failed: readonly DistributionRequirement[];
}

export function evaluateDistributionEligibility(
  values: Partial<Record<DistributionRequirement, RequirementValue>>,
): DistributionEligibilityEvaluation {
  const trace = DISTRIBUTION_REQUIREMENTS.map((requirement) => {
    const value = values[requirement];
    const status: 'TRUE' | 'FALSE' | 'MISSING' =
      value === true ? 'TRUE' : value === false ? 'FALSE' : 'MISSING';
    return { requirement, status };
  });
  const failed = trace.filter((t) => t.status !== 'TRUE').map((t) => t.requirement);
  return {
    policy: DISTRIBUTION_ELIGIBILITY_POLICY_ID,
    outcome: failed.length === 0 ? 'ALLOW' : 'DENY',
    trace,
    failed,
  };
}
