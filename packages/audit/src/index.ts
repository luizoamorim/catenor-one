// @catenor-one/audit — RFC 8785 JCS, SHA-256 commitments, audit event model and hash chain (PLAN §3.1).
export { canonicalize, canonicalizeToString } from './jcs.js';
export {
  COMMITMENT_PATTERN,
  commit,
  commitBytes,
  commitmentBytes,
  isCommitment,
  parseCommitment,
  type Commitment,
} from './commitment.js';
export {
  AUDIT_EVENT_TYPES,
  GENESIS_PREV_HASH,
  chainEvent,
  computeEventHash,
  verifyChain,
  type AuditDetailValue,
  type AuditEvent,
  type AuditEventType,
  type ChainVerification,
  type ChainedAuditEvent,
} from './audit-event.js';
