import { createHash } from 'node:crypto';
import { validateProtocolObject } from '@catenor-one/test-vectors';
import { describe, expect, it } from 'vitest';
import {
  AUDIT_EVENT_TYPES,
  GENESIS_PREV_HASH,
  chainEvent,
  verifyChain,
  type AuditEvent,
  type ChainedAuditEvent,
} from './audit-event.js';
import { commit, type Commitment } from './commitment.js';
import { canonicalizeToString } from './jcs.js';

const SUBJECT = 'did:catenor:8f0c92d7e5f04e40a41faee32e5e180b';
const DOMAIN = 'trust-domain:catenor-one-demo';
const OTHER_DOMAIN = 'trust-domain:other';

const events: AuditEvent[] = [
  {
    type: 'SUBJECT_CREATED',
    subject: SUBJECT,
    timestamp: '2026-09-09T22:00:00Z',
    requestId: 'admission-session:1',
  },
  {
    type: 'KEY_POSSESSION_VERIFIED',
    subject: SUBJECT,
    timestamp: '2026-09-09T22:01:00Z',
    requestId: 'admission-session:1',
  },
  {
    type: 'POLICY_EVALUATED',
    subject: SUBJECT,
    timestamp: '2026-09-09T22:02:00Z',
    requestId: 'admission-session:1',
    details: {
      decision: 'DENY',
      falseRequirements: ['ORGANIZATION_AML_CLEAR'],
      missingRequirements: [],
    },
  },
];

function buildChain(list: readonly AuditEvent[], trustDomain = DOMAIN): ChainedAuditEvent[] {
  const chain: ChainedAuditEvent[] = [];
  let prev: Commitment = GENESIS_PREV_HASH;
  for (const e of list) {
    const linked = chainEvent(trustDomain, prev, e);
    chain.push(linked);
    prev = linked.eventHash;
  }
  return chain;
}

describe('AuditEvent', () => {
  it('chained events conform to the pinned protocol audit-event schema', () => {
    for (const e of buildChain(events)) {
      expect(validateProtocolObject('audit-event', e)).toEqual({ valid: true, errors: [] });
    }
  });

  it('includes the protocol vocabulary and the S001 extensions (PLAN §25.2)', () => {
    expect(AUDIT_EVENT_TYPES).toContain('TRUST_ANCHOR_ADMITTED');
    expect(AUDIT_EVENT_TYPES).toContain('CONFIDENTIAL_VERIFICATION_FAILED');
    expect(new Set(AUDIT_EVENT_TYPES).size).toBe(AUDIT_EVENT_TYPES.length);
  });

  it('rejects unknown types and non RFC 3339 timestamps', () => {
    expect(() =>
      chainEvent(DOMAIN, GENESIS_PREV_HASH, { ...events[0]!, type: 'MADE_UP' as never }),
    ).toThrow();
    expect(() =>
      chainEvent(DOMAIN, GENESIS_PREV_HASH, { ...events[0]!, timestamp: '09/09/2026' }),
    ).toThrow();
  });
});

describe('hash chain', () => {
  it('links each event to the previous eventHash, starting at genesis', () => {
    const chain = buildChain(events);
    expect(chain[0]!.prevHash).toBe(GENESIS_PREV_HASH);
    expect(chain[1]!.prevHash).toBe(chain[0]!.eventHash);
    expect(chain[2]!.prevHash).toBe(chain[1]!.eventHash);
    expect(verifyChain(DOMAIN, chain)).toEqual({ valid: true });
  });

  it('is deterministic', () => {
    expect(buildChain(events)).toEqual(buildChain(events));
  });

  it('detects a tampered event', () => {
    const chain = buildChain(events);
    chain[1] = { ...chain[1]!, subject: 'did:catenor:00000000000000000000000000000000' };
    expect(verifyChain(DOMAIN, chain)).toMatchObject({ valid: false, brokenAt: 1 });
  });

  it('detects tampered details', () => {
    const chain = buildChain(events);
    chain[2] = { ...chain[2]!, details: { ...chain[2]!.details, decision: 'ALLOW' } };
    expect(verifyChain(DOMAIN, chain)).toMatchObject({ valid: false, brokenAt: 2 });
  });

  it('detects reordering and deletion', () => {
    const chain = buildChain(events);
    expect(verifyChain(DOMAIN, [chain[1]!, chain[0]!, chain[2]!])).toMatchObject({
      valid: false,
      brokenAt: 0,
    });
    expect(verifyChain(DOMAIN, [chain[0]!, chain[2]!])).toMatchObject({
      valid: false,
      brokenAt: 1,
    });
  });

  it('detects a re-linked event whose eventHash was recomputed but breaks the next link', () => {
    const chain = buildChain(events);
    const forged = chainEvent(DOMAIN, chain[0]!.eventHash, { ...events[1]!, requestId: 'forged' });
    expect(verifyChain(DOMAIN, [chain[0]!, forged, chain[2]!])).toMatchObject({
      valid: false,
      brokenAt: 2,
    });
  });

  it('hash preimage is JCS(event ∪ {trustDomain}) ‖ prevHash raw bytes [REF-IMPL]', () => {
    const [first] = buildChain(events);
    const preimage = Buffer.concat([
      Buffer.from(canonicalizeToString({ ...events[0]!, trustDomain: DOMAIN }), 'utf8'),
      Buffer.alloc(32),
    ]);
    expect(first!.trustDomain).toBe(DOMAIN);
    expect(first!.eventHash).toBe(`0x${createHash('sha256').update(preimage).digest('hex')}`);
  });

  it('rejects a malformed prevHash', () => {
    expect(() => chainEvent(DOMAIN, '0xnothex' as Commitment, events[0]!)).toThrow(TypeError);
    expect(commit({})).not.toBe(GENESIS_PREV_HASH);
  });
});

describe('hash chain — Trust Domain binding', () => {
  it('the same events hash differently in another Trust Domain', () => {
    const a = buildChain(events, DOMAIN);
    const b = buildChain(events, OTHER_DOMAIN);
    a.forEach((event, i) => expect(event.eventHash).not.toBe(b[i]!.eventHash));
    expect(verifyChain(OTHER_DOMAIN, b)).toEqual({ valid: true });
  });

  it('a valid chain presented as another Trust Domain’s chain fails', () => {
    expect(verifyChain(OTHER_DOMAIN, buildChain(events))).toMatchObject({
      valid: false,
      brokenAt: 0,
      reason: 'event belongs to another trust domain',
    });
  });

  it('reclassifying a valid event into another Trust Domain breaks its eventHash', () => {
    const other = buildChain(events, OTHER_DOMAIN);
    const moved = { ...buildChain(events)[0]!, trustDomain: OTHER_DOMAIN };
    expect(verifyChain(OTHER_DOMAIN, [moved, ...other.slice(1)])).toMatchObject({
      valid: false,
      brokenAt: 0,
      reason: 'eventHash does not match the event content',
    });
  });

  it('chainEvent rejects an empty trustDomain or an event of another Trust Domain', () => {
    expect(() => chainEvent('', GENESIS_PREV_HASH, events[0]!)).toThrow(TypeError);
    const [linked] = buildChain(events, OTHER_DOMAIN);
    expect(() => chainEvent(DOMAIN, GENESIS_PREV_HASH, linked!)).toThrow(
      'event already belongs to another trust domain',
    );
  });
});
