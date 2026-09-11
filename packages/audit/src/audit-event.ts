import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { commitmentBytes, isCommitment, parseCommitment, type Commitment } from './commitment.js';
import { canonicalize } from './jcs.js';

/**
 * Audit vocabulary (PLAN §25.2): protocol / SPEC §27 event types plus Catenor One [REF-IMPL] extensions.
 */
export const AUDIT_EVENT_TYPES = [
  // protocol / SPEC §27
  'SUBJECT_CREATED',
  'KEY_ADDED',
  'DID_DOCUMENT_CREATED',
  'ADMISSION_REQUESTED',
  'KEY_POSSESSION_VERIFIED',
  'CONFIDENTIAL_EVIDENCE_VERIFIED',
  'POLICY_EVALUATED',
  'BOOTSTRAP_ENDORSEMENT_CREATED',
  'TRUST_ANCHOR_ADMITTED',
  'TRUST_ANCHOR_ADMISSION_DENIED',
  // Catenor One extensions [REF-IMPL]
  'BOOTSTRAP_ACCESS_DENIED',
  'PROVIDER_REFERENCES_ATTACHED',
  'KEY_POSSESSION_FAILED',
  'CONFIDENTIAL_VERIFICATION_REQUESTED',
  'CONFIDENTIAL_VERIFICATION_FAILED',
  'ADMISSION_ALREADY_ADMITTED',
  // Catenor One [REF-IMPL] hackathon Part B (scoped capability → authorized asset action)
  'CAPABILITY_GRANTED',
  'ASSET_ACTION_AUTHORIZED',
  'ASSET_ACTION_DENIED',
  'ASSET_ACTION_EXECUTED',
  // Catenor One [REF-IMPL] final demo (Distribution Agent → eligibility-gated distribution plan)
  'AGENT_EXECUTION_WALLET_PROVISIONED',
  'ACCOUNT_BINDING_CREATED',
  'DISTRIBUTION_REQUEST_DENIED',
  'DISTRIBUTION_ELIGIBILITY_EVALUATED',
  'DISTRIBUTION_PLAN_CREATED',
] as const;

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

/** Values allowed in sanitized `details` (typed, allowlisted by the application layer — PLAN §25.1). */
export type AuditDetailValue = string | number | boolean | null | readonly string[];

/**
 * Protocol working shape (`audit-event.schema.json`: extra properties allowed) plus sanitized `details`.
 * `details` never carries free-form provider strings, applicant IDs or bindingRefs.
 */
export interface AuditEvent {
  readonly type: AuditEventType;
  readonly subject?: string;
  readonly issuer?: string;
  readonly timestamp: string;
  readonly requestId?: string;
  readonly details?: Readonly<Record<string, AuditDetailValue>>;
}

/**
 * An event linked into a per-trust-domain hash chain [REF-IMPL] (PLAN §25.3, D16). `trustDomain` is part of
 * the hashed body, so an event cannot be moved into another Trust Domain's chain without changing its hash.
 */
export interface ChainedAuditEvent extends AuditEvent {
  readonly trustDomain: string;
  readonly prevHash: Commitment;
  readonly eventHash: Commitment;
}

/** `prevHash` of the first event in a chain. */
export const GENESIS_PREV_HASH = `0x${'0'.repeat(64)}` as Commitment;

const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

function assertEvent(event: AuditEvent): void {
  if (!(AUDIT_EVENT_TYPES as readonly string[]).includes(event.type)) {
    throw new TypeError(`unknown audit event type: ${String(event.type)}`);
  }
  if (!TIMESTAMP_PATTERN.test(event.timestamp)) {
    throw new TypeError('audit event timestamp must be an RFC 3339 date-time');
  }
}

function assertTrustDomain(trustDomain: string): void {
  if (typeof trustDomain !== 'string' || trustDomain.length === 0) {
    throw new TypeError('trustDomain must be a non-empty string');
  }
}

/** The hashed body: the event plus its chain's `trustDomain`, without `prevHash` / `eventHash`. */
function hashedBody(trustDomain: string, event: AuditEvent | ChainedAuditEvent): object {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { prevHash, eventHash, trustDomain: _ignored, ...body } = event as ChainedAuditEvent;
  return { ...body, trustDomain };
}

/**
 * `eventHash = SHA-256(JCS(event ∪ {trustDomain}) ‖ prevHash)`, with `prevHash` as its 32 raw bytes
 * [REF-IMPL hash-chain encoding; not a Catenor Protocol requirement].
 */
export function computeEventHash(
  trustDomain: string,
  prevHash: Commitment,
  event: AuditEvent,
): Commitment {
  const body = canonicalize(hashedBody(trustDomain, event));
  const prev = commitmentBytes(prevHash);
  const input = new Uint8Array(body.length + prev.length);
  input.set(body, 0);
  input.set(prev, body.length);
  return `0x${bytesToHex(sha256(input))}` as Commitment;
}

/** Links `event` into `trustDomain`'s chain after `prevHash` ({@link GENESIS_PREV_HASH} for the first). */
export function chainEvent(
  trustDomain: string,
  prevHash: Commitment,
  event: AuditEvent,
): ChainedAuditEvent {
  assertTrustDomain(trustDomain);
  parseCommitment(prevHash);
  assertEvent(event);
  const existing = (event as Partial<ChainedAuditEvent>).trustDomain;
  if (existing !== undefined && existing !== trustDomain) {
    throw new TypeError('event already belongs to another trust domain');
  }
  const body = hashedBody(trustDomain, event) as AuditEvent & { trustDomain: string };
  return { ...body, prevHash, eventHash: computeEventHash(trustDomain, prevHash, body) };
}

export type ChainVerification =
  { valid: true } | { valid: false; brokenAt: number; reason: string };

/** Verifies continuity and integrity of `trustDomain`'s chain, which starts at {@link GENESIS_PREV_HASH}. */
export function verifyChain(
  trustDomain: string,
  events: readonly ChainedAuditEvent[],
): ChainVerification {
  let expectedPrev: Commitment = GENESIS_PREV_HASH;
  for (let i = 0; i < events.length; i++) {
    const event = events[i]!;
    if (event.trustDomain !== trustDomain) {
      return { valid: false, brokenAt: i, reason: 'event belongs to another trust domain' };
    }
    if (!isCommitment(event.prevHash) || event.prevHash !== expectedPrev) {
      return { valid: false, brokenAt: i, reason: 'prevHash does not link to the previous event' };
    }
    if (
      !isCommitment(event.eventHash) ||
      computeEventHash(trustDomain, event.prevHash, event) !== event.eventHash
    ) {
      return { valid: false, brokenAt: i, reason: 'eventHash does not match the event content' };
    }
    expectedPrev = event.eventHash;
  }
  return { valid: true };
}
