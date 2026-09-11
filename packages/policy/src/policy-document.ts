import { commit, type Commitment } from '@catenor-one/audit';
import { isFactName, type FactName } from './facts.js';

export const TRUST_ANCHOR_ADMISSION_POLICY_ID = 'policy:trust-anchor-admission:v1';

export interface PolicyRequirement {
  readonly claim: FactName;
  readonly equals: boolean;
}

/**
 * Policy document (PLAN §22) — conforms to the protocol `policy.schema.json`
 * (`id`, `action`, `requirements[].claim`; extra properties allowed).
 */
export interface PolicyDocument {
  readonly id: string;
  readonly action: string;
  readonly requirements: readonly PolicyRequirement[];
  readonly decision: { readonly allRequirementsSatisfied: 'ALLOW'; readonly otherwise: 'DENY' };
}

export class MalformedPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MalformedPolicyError';
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Validates a parsed policy document; throws {@link MalformedPolicyError} on any deviation. */
export function parsePolicyDocument(value: unknown): PolicyDocument {
  if (!isRecord(value)) throw new MalformedPolicyError('policy must be an object');
  const { id, action, requirements, decision } = value;
  if (typeof id !== 'string' || id.length === 0) {
    throw new MalformedPolicyError('policy.id missing');
  }
  if (typeof action !== 'string' || action.length === 0) {
    throw new MalformedPolicyError('policy.action missing');
  }
  if (!Array.isArray(requirements) || requirements.length === 0) {
    throw new MalformedPolicyError('policy.requirements must be a non-empty array');
  }
  const seen = new Set<string>();
  const parsed: PolicyRequirement[] = requirements.map((r: unknown) => {
    if (!isRecord(r) || !isFactName(r.claim) || typeof r.equals !== 'boolean') {
      throw new MalformedPolicyError(
        'each requirement must be {claim: <known fact>, equals: boolean}',
      );
    }
    if (seen.has(r.claim)) throw new MalformedPolicyError(`duplicate requirement: ${r.claim}`);
    seen.add(r.claim);
    return { claim: r.claim, equals: r.equals };
  });
  if (
    !isRecord(decision) ||
    decision.allRequirementsSatisfied !== 'ALLOW' ||
    decision.otherwise !== 'DENY'
  ) {
    throw new MalformedPolicyError(
      'policy.decision must be {allRequirementsSatisfied: ALLOW, otherwise: DENY}',
    );
  }
  return {
    id,
    action,
    requirements: parsed,
    decision: { allRequirementsSatisfied: 'ALLOW', otherwise: 'DENY' },
  };
}

/** `policyHash = commit(policy)` — 0x + SHA-256(JCS(policy)) [REF-IMPL] (PLAN §22, AC-039). */
export function policyHash(policy: unknown): Commitment {
  return commit(policy);
}
