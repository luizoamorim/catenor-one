import type { FactName, FactSet } from './facts.js';
import { parsePolicyDocument, policyHash, type PolicyDocument } from './policy-document.js';

export type PolicyOutcome = 'ALLOW' | 'DENY' | 'ERROR';

/** Per-requirement trace. FALSE and MISSING are never collapsed (D4). */
export type RequirementStatus = 'SATISFIED' | 'FALSE' | 'MISSING';

export interface RequirementResult {
  readonly claim: FactName;
  readonly status: RequirementStatus;
}

export type PolicyEvaluation =
  | {
      readonly outcome: 'ALLOW' | 'DENY';
      readonly policy: PolicyDocument;
      readonly requirementResults: readonly RequirementResult[];
    }
  | { readonly outcome: 'ERROR'; readonly reason: string };

export interface EvaluatePolicyInput {
  /** The policy as loaded (parsed JSON); validated here. */
  readonly policy: unknown;
  /** The pinned `admissionPolicyHash` (Bootstrap Configuration). */
  readonly expectedPolicyHash: string;
  readonly facts: FactSet;
}

/**
 * Deterministic evaluation (PLAN §3.4, D4):
 *
 *   all required facts present and equal to the requirement  → ALLOW
 *   ≥ 1 required fact present with another value              → DENY
 *   no fact false, ≥ 1 missing                                → DENY  ("otherwise: DENY")
 *   policy malformed / hash mismatch                          → ERROR (evaluation refused; never ALLOW)
 */
export function evaluatePolicy(input: EvaluatePolicyInput): PolicyEvaluation {
  let actualHash: string;
  try {
    actualHash = policyHash(input.policy);
  } catch {
    return { outcome: 'ERROR', reason: 'policy cannot be canonicalized' };
  }
  if (actualHash !== input.expectedPolicyHash) {
    return { outcome: 'ERROR', reason: 'policy hash does not match the pinned policy hash' };
  }
  let policy: PolicyDocument;
  try {
    policy = parsePolicyDocument(input.policy);
  } catch (e) {
    return { outcome: 'ERROR', reason: e instanceof Error ? e.message : 'malformed policy' };
  }

  const requirementResults: RequirementResult[] = policy.requirements.map((req) => {
    const fact = input.facts.get(req.claim);
    if (fact === undefined) return { claim: req.claim, status: 'MISSING' };
    return { claim: req.claim, status: fact.value === req.equals ? 'SATISFIED' : 'FALSE' };
  });

  const allSatisfied = requirementResults.every((r) => r.status === 'SATISFIED');
  return {
    outcome: allSatisfied ? policy.decision.allRequirementsSatisfied : policy.decision.otherwise,
    policy,
    requirementResults,
  };
}
