// @catenor-one/policy — policy document + hash, verified facts, evaluator, protocol Decision (PLAN §3.4).
export {
  FACT_NAMES,
  DuplicateFactError,
  FactSet,
  isFactName,
  type FactInput,
  type FactName,
  type FactSource,
  type VerifiedFact,
} from './facts.js';
export {
  MalformedPolicyError,
  TRUST_ANCHOR_ADMISSION_POLICY_ID,
  parsePolicyDocument,
  policyHash,
  type PolicyDocument,
  type PolicyRequirement,
} from './policy-document.js';
export {
  evaluatePolicy,
  type EvaluatePolicyInput,
  type PolicyEvaluation,
  type PolicyOutcome,
  type RequirementResult,
  type RequirementStatus,
} from './evaluate.js';
export { createDecision, type Decision } from './decision.js';
export {
  DISTRIBUTION_ELIGIBILITY_POLICY_ID,
  DISTRIBUTION_EVIDENCE_FACTS,
  DISTRIBUTION_REQUIREMENTS,
  evaluateDistributionEligibility,
  type DistributionEligibilityEvaluation,
  type DistributionEvidenceFact,
  type DistributionRequirement,
} from './distribution-eligibility.js';
export {
  DISTRIBUTION_ELIGIBILITY_V2_POLICY,
  DISTRIBUTION_ELIGIBILITY_V2_POLICY_HASH,
  DISTRIBUTION_ELIGIBILITY_V2_POLICY_ID,
  INVESTOR_ELIGIBILITY_CREDENTIAL,
  INVESTOR_REQUIREMENTS,
  OFFERING_ELIGIBILITY_POLICY,
  OFFERING_ELIGIBILITY_POLICY_HASH,
  OFFERING_ELIGIBILITY_POLICY_ID,
  RECEIVE_DISTRIBUTION_ACTION,
  SUBSCRIBE_OFFERING,
  evaluateRequirements,
  type HolderRequirement,
  type InvestorRequirement,
  type RequirementsEvaluation,
} from './investor-policies.js';
