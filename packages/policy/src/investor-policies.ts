// Clean-room demo policies — Catenor One [REF-IMPL] (the protocol's policy language and action vocabulary are open in
// Draft v0.1). Policy documents in the same working shape as the S001 admission policy ({id, action, requirements,
// decision}) and pinned by the same hash (SHA-256 of RFC 8785 JCS). They are separate from the S001 admission policy
// and its closed FACT_NAMES, which they do not touch.
//
//   policy:offering-eligibility:v1   — may this investor SUBSCRIBE to the offering now?
//   policy:distribution-eligibility:v2 — may this holder RECEIVE this distribution now? (v1 + the presentation fact)
//
// INVESTOR_PRESENTATION_VALID is TRUE only when all seven named presentation checks pass inside the confidential
// workflow (holder proof, credential signature, issuer authority, subject = holder, validity window, status ACTIVE,
// well formed); the check results travel with the result, so the fact is never an opaque "verified" label.
// Every requirement must be TRUE; FALSE and MISSING both DENY and stay distinct in the trace. Deterministic.
import { policyHash } from './policy-document.js';

export const SUBSCRIBE_OFFERING = 'SUBSCRIBE_OFFERING';
export const RECEIVE_DISTRIBUTION_ACTION = 'RECEIVE_DISTRIBUTION';
export const OFFERING_ELIGIBILITY_POLICY_ID = 'policy:offering-eligibility:v1';
export const DISTRIBUTION_ELIGIBILITY_V2_POLICY_ID = 'policy:distribution-eligibility:v2';
/** The Catenor credential type both policies accept (issued by the Trust Domain's Trust Anchor). */
export const INVESTOR_ELIGIBILITY_CREDENTIAL = 'CatenorInvestorEligibilityCredential';

export const INVESTOR_REQUIREMENTS = [
  'INVESTOR_PRESENTATION_VALID',
  'INVESTOR_IDENTITY_VERIFIED',
  'INVESTOR_AML_CLEAR',
  'EVIDENCE_FRESH',
] as const;
export type InvestorRequirement = (typeof INVESTOR_REQUIREMENTS)[number];
export type HolderRequirement = 'HOLDS_ASSET' | InvestorRequirement;

interface InvestorPolicyDocument<C extends string> {
  readonly id: string;
  readonly action: string;
  readonly requirements: readonly { readonly claim: C; readonly equals: true }[];
  readonly decision: { readonly allRequirementsSatisfied: 'ALLOW'; readonly otherwise: 'DENY' };
}

const document = <C extends string>(
  id: string,
  action: string,
  claims: readonly C[],
): InvestorPolicyDocument<C> => ({
  id,
  action,
  requirements: claims.map((claim) => ({ claim, equals: true as const })),
  decision: { allRequirementsSatisfied: 'ALLOW', otherwise: 'DENY' },
});

export const OFFERING_ELIGIBILITY_POLICY = document<InvestorRequirement>(
  OFFERING_ELIGIBILITY_POLICY_ID,
  SUBSCRIBE_OFFERING,
  INVESTOR_REQUIREMENTS,
);
export const DISTRIBUTION_ELIGIBILITY_V2_POLICY = document<HolderRequirement>(
  DISTRIBUTION_ELIGIBILITY_V2_POLICY_ID,
  RECEIVE_DISTRIBUTION_ACTION,
  ['HOLDS_ASSET', ...INVESTOR_REQUIREMENTS],
);

export const OFFERING_ELIGIBILITY_POLICY_HASH = policyHash(OFFERING_ELIGIBILITY_POLICY);
export const DISTRIBUTION_ELIGIBILITY_V2_POLICY_HASH = policyHash(
  DISTRIBUTION_ELIGIBILITY_V2_POLICY,
);

export interface RequirementsEvaluation<C extends string> {
  readonly policy: string;
  readonly outcome: 'ALLOW' | 'DENY';
  readonly trace: readonly {
    readonly requirement: C;
    readonly status: 'TRUE' | 'FALSE' | 'MISSING';
  }[];
  readonly failed: readonly C[];
}

/** ALLOW iff every requirement's value is exactly `true` (`false` → FALSE, absent/`null` → MISSING). */
export function evaluateRequirements<C extends string>(
  policy: InvestorPolicyDocument<C>,
  values: Partial<Record<C, boolean | null>>,
): RequirementsEvaluation<C> {
  const trace = policy.requirements.map(({ claim }) => {
    const value = values[claim];
    const status: 'TRUE' | 'FALSE' | 'MISSING' =
      value === true ? 'TRUE' : value === false ? 'FALSE' : 'MISSING';
    return { requirement: claim, status };
  });
  const failed = trace.filter((t) => t.status !== 'TRUE').map((t) => t.requirement);
  return { policy: policy.id, outcome: failed.length === 0 ? 'ALLOW' : 'DENY', trace, failed };
}
