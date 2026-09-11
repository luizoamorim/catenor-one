// API side of the identity-confidential channel: callback authentication (T9.3). The API ↔ TEE byte-level
// contract is in cre-channel.contract.test.ts.
import { createHash, createHmac } from 'node:crypto';
import { canonicalizeToString } from '@catenor-one/audit';
import { describe, expect, it } from 'vitest';
import { authenticateCallback, deriveChannelKeys } from './cre-channel.js';

const TOKEN = 'a1'.repeat(32);
const NOW = new Date('2026-09-11T12:00:00Z');

describe('callback authentication (T9.3)', () => {
  const keys = deriveChannelKeys(TOKEN);
  const facts = {
    ORGANIZATION_KYB_VERIFIED: true,
    ORGANIZATION_STATUS_VALID: true,
    ORGANIZATION_AML_CLEAR: true,
    AUTHORIZED_REPRESENTATIVE_VERIFIED: true,
    REPRESENTATIVE_AUTHORITY_CONFIRMED: true,
    EVIDENCE_FRESH: true,
  };
  const evidenceSources = { company: 'SYNTHETIC_MOCK', representative: 'REAL_SUMSUB_SANDBOX' };
  const commitmentInput = {
    profile: 'catenor-one/evidence-commitment/v1',
    runId: 'run:1',
    sessionRef: 'sref:1',
    bootstrapConfigurationHash: `0x${'b'.repeat(64)}`,
    evidenceProfile: 'HYBRID_DEMO',
    evidenceSources,
    facts,
  };
  const salt = `0x${createHmac('sha256', keys.salt).update('run:1').digest('hex')}`;
  const envelope = {
    v: 1,
    operation: 'TRUST_ANCHOR_ADMISSION',
    runId: 'run:1',
    sessionRef: 'sref:1',
    mode: 'SIMULATION',
    status: 'OK',
    bootstrapConfigurationHash: `0x${'b'.repeat(64)}`,
    evidenceProfile: 'HYBRID_DEMO',
    evidenceSources,
    facts,
    evidenceCommitment: `0x${createHash('sha256')
      .update(canonicalizeToString({ ...commitmentInput, salt }))
      .digest('hex')}`,
    commitmentInput,
  };
  const sign = (body: Buffer, timestamp: string) =>
    createHmac('sha256', keys.cb)
      .update(Buffer.concat([Buffer.from(`${timestamp}.`), body]))
      .digest('hex');

  it('accepts an authentic, fresh envelope whose commitment recomputes', () => {
    const body = Buffer.from(JSON.stringify(envelope));
    const ts = '2026-09-11T12:00:01Z';
    expect(
      authenticateCallback(keys, { timestamp: ts, signature: sign(body, ts) }, body, NOW),
    ).toMatchObject({
      ok: true,
    });
  });

  it.each([
    [
      'a wrong signature',
      (b: Buffer, ts: string) => ({ body: b, ts, sig: '0'.repeat(64) }),
      'CALLBACK_UNAUTHENTICATED',
    ],
    [
      'a body changed after signing',
      (b: Buffer, ts: string) => ({
        body: Buffer.from(b.toString().replace('"OK"', '"OK" ')),
        ts,
        sig: sign(b, ts),
      }),
      'CALLBACK_UNAUTHENTICATED',
    ],
    [
      'a stale timestamp',
      (b: Buffer) => ({
        body: b,
        ts: '2026-09-11T11:00:00Z',
        sig: sign(b, '2026-09-11T11:00:00Z'),
      }),
      'CALLBACK_STALE',
    ],
  ])('rejects %s', (_label, make, reason) => {
    const m = make(Buffer.from(JSON.stringify(envelope)), '2026-09-11T12:00:01Z');
    expect(authenticateCallback(keys, { timestamp: m.ts, signature: m.sig }, m.body, NOW)).toEqual({
      ok: false,
      reason,
    });
  });

  it('rejects an authentic envelope whose facts differ from the committed facts', () => {
    const forged = {
      ...envelope,
      facts: { ...facts, ORGANIZATION_AML_CLEAR: true, EVIDENCE_FRESH: false },
    };
    const body = Buffer.from(JSON.stringify(forged));
    const ts = '2026-09-11T12:00:01Z';
    expect(
      authenticateCallback(keys, { timestamp: ts, signature: sign(body, ts) }, body, NOW),
    ).toEqual({
      ok: false,
      reason: 'COMMITMENT_ECHO_MISMATCH',
    });
  });

  it('rejects an envelope whose commitment does not recompute', () => {
    const forged = { ...envelope, evidenceCommitment: `0x${'c'.repeat(64)}` };
    const body = Buffer.from(JSON.stringify(forged));
    const ts = '2026-09-11T12:00:01Z';
    expect(
      authenticateCallback(keys, { timestamp: ts, signature: sign(body, ts) }, body, NOW),
    ).toEqual({
      ok: false,
      reason: 'COMMITMENT_MISMATCH',
    });
  });
});
