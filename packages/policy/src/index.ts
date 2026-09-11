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
