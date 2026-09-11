import { isCommitment, type Commitment } from '@catenor-one/audit';
import type { PolicyOutcome } from './evaluate.js';

/**
 * Protocol Decision — exact `decision.schema.json` shape (`additionalProperties: false`):
 * `{policy, subject, action, resource, decision, evaluatedAt, evidenceCommitment}`.
 */
export interface Decision {
  readonly policy: string;
  readonly subject: string;
  readonly action: string;
  readonly resource: string;
  readonly decision: PolicyOutcome;
  readonly evaluatedAt: string;
  readonly evidenceCommitment: Commitment;
}

const SUBJECT_PATTERN = /^did:catenor:/;
const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

export function createDecision(input: Decision): Decision {
  if (!SUBJECT_PATTERN.test(input.subject)) {
    throw new TypeError('decision subject must be a did:catenor');
  }
  if (!DATE_TIME_PATTERN.test(input.evaluatedAt)) {
    throw new TypeError('evaluatedAt must be an RFC 3339 date-time');
  }
  if (!isCommitment(input.evidenceCommitment)) {
    throw new TypeError('evidenceCommitment must be a commitment');
  }
  for (const field of ['policy', 'action', 'resource'] as const) {
    if (typeof input[field] !== 'string' || input[field].length === 0) {
      throw new TypeError(`decision ${field} must be a non-empty string`);
    }
  }
  if (!['ALLOW', 'DENY', 'ERROR'].includes(input.decision)) {
    throw new TypeError('decision must be ALLOW, DENY or ERROR');
  }
  // Exactly the protocol fields — nothing else is carried.
  return {
    policy: input.policy,
    subject: input.subject,
    action: input.action,
    resource: input.resource,
    decision: input.decision,
    evaluatedAt: input.evaluatedAt,
    evidenceCommitment: input.evidenceCommitment,
  };
}
