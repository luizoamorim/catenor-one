// API ↔ TEE channel CONTRACT test (imports workflow code; typechecked by the workflow's own compiler, excluded from
// the API tsc) — (PLAN §18, §23): the API seals with node:crypto; the workflow's own pure-JS opener
// (workflows/identity-confidential/shared/sealed-context.ts) must open it — byte-exact profile, base64 transport.
import { describe, expect, it } from 'vitest';
import { deriveKeys } from '../../../../../workflows/identity-confidential/shared/keys.js';
import { openSealedContext } from '../../../../../workflows/identity-confidential/shared/sealed-context.js';
import { runTrustAnchorAdmission } from '../../../../../workflows/identity-confidential/src/trust-anchor-admission/index.js';
import { authenticateCallback, deriveChannelKeys, sealContext } from './cre-channel.js';

const TOKEN = 'a1'.repeat(32);
const NOW = new Date('2026-09-11T12:00:00Z');
const context = {
  sessionRef: 'sref:1',
  runId: 'run:1',
  trustDomain: 'trust-domain:catenor-one-demo',
  subjectDid: 'did:catenor:8f0c92d7e5f04e40a41faee32e5e180b',
  companyApplicantId: 'mock:company-fixture:MOCK_COMPANY_ACTIVE_GREEN',
  representativeApplicantId: 'applicant-synthetic',
  companyBindingRef: 'cbr-company',
  representativeBindingRef: 'cbr-representative',
  notAfter: '2026-09-11T12:05:00Z',
};

describe('sealed context — API sealer ↔ TEE opener', () => {
  it('derives the same three keys as the TEE key schedule', () => {
    const api = deriveChannelKeys(TOKEN);
    const tee = deriveKeys(TOKEN);
    expect(Buffer.from(api.ctx).equals(Buffer.from(tee.contextKey))).toBe(true);
    expect(Buffer.from(api.cb).equals(Buffer.from(tee.callbackKey))).toBe(true);
    expect(Buffer.from(api.salt).equals(Buffer.from(tee.commitmentSaltKey))).toBe(true);
  });

  it('the TEE opens what the API sealed', () => {
    const payload = sealContext(deriveChannelKeys(TOKEN), 'TRUST_ANCHOR_ADMISSION', context);
    expect(payload.sealedContext.nonce).toMatch(/^[A-Za-z0-9+/]{16}$/);
    expect(openSealedContext(payload, deriveKeys(TOKEN).contextKey, NOW)).toEqual(context);
  });

  it.each([
    ['another key', () => ({ key: deriveKeys('b2'.repeat(32)).contextKey })],
    ['another operation (AAD)', () => ({ operation: 'SUBJECT_CONTINUITY' })],
    ['another runId (AAD)', () => ({ runId: 'run:2' })],
    ['a flipped ciphertext bit', () => ({ flip: 0 })],
    ['a flipped tag bit', () => ({ flip: -1 })],
  ])('fails closed with %s', (_label, change) => {
    const payload = sealContext(deriveChannelKeys(TOKEN), 'TRUST_ANCHOR_ADMISSION', context);
    const c = change() as { key?: Uint8Array; operation?: string; runId?: string; flip?: number };
    let ct = payload.sealedContext.ct;
    if (c.flip !== undefined) {
      const bytes = Buffer.from(ct, 'base64');
      const i = c.flip < 0 ? bytes.length + c.flip : c.flip;
      bytes[i] = (bytes[i] ?? 0) ^ 1;
      ct = bytes.toString('base64');
    }
    const tampered = {
      ...payload,
      operation: c.operation ?? payload.operation,
      runId: c.runId ?? payload.runId,
      sealedContext: { ...payload.sealedContext, ct },
    };
    expect(() => openSealedContext(tampered, c.key ?? deriveKeys(TOKEN).contextKey, NOW)).toThrow();
  });

  it('rejects an expired context', () => {
    const payload = sealContext(deriveChannelKeys(TOKEN), 'TRUST_ANCHOR_ADMISSION', context);
    expect(() =>
      openSealedContext(payload, deriveKeys(TOKEN).contextKey, new Date('2026-09-11T12:06:00Z')),
    ).toThrow('expired');
  });
});

describe('TEE callback → API authenticator (two independent implementations)', () => {
  it('the API authenticates the envelope the workflow delivers and its commitment recomputes', () => {
    const tee = deriveKeys(TOKEN);
    let delivered: { headers: Record<string, string>; body: Uint8Array } | undefined;
    const out = runTrustAnchorAdmission({
      runId: 'run:1',
      context,
      config: {
        callbackUrl: 'http://127.0.0.1:8787/v1/internal/cre/identity-confidential/results',
        sumsubBaseUrl: 'https://api.sumsub.com',
        executionMode: 'SIMULATION',
        companyEvidence: {
          source: 'SYNTHETIC_MOCK',
          scenario: 'MOCK_COMPANY_ACTIVE_GREEN',
          label: 'MOCK',
        },
        bootstrapConfigurationHash: `0x${'b'.repeat(64)}`,
        acceptedEvidence: {
          evidenceProfile: 'HYBRID_DEMO',
          evidenceSources: { company: 'SYNTHETIC_MOCK', representative: 'REAL_SUMSUB_SANDBOX' },
          companyLevelNames: ['MOCK_KYB_LEVEL'],
          representativeLevelNames: ['id-only'],
          authorityRoles: ['MOCK_AUTHORIZED_SIGNATORY'],
          activeRegistryStatuses: ['MOCK_ACTIVE'],
          evidenceMaxAgeDays: 180,
        },
      },
      secrets: {
        sumsubAppToken: 'sbx-synthetic-not-a-token',
        sumsubSecretKey: 'synthetic-not-a-secret',
        callbackKey: tee.callbackKey,
        saltKey: tee.commitmentSaltKey,
      },
      runtime: {
        now: () => NOW,
        httpGet: () => ({
          status: 200,
          body: Buffer.from(
            JSON.stringify({
              externalUserId: 'cbr-representative',
              type: 'individual',
              review: {
                levelName: 'id-only',
                reviewStatus: 'completed',
                reviewDate: '2026-09-10 12:00:00+0000',
                reviewResult: { reviewAnswer: 'GREEN' },
              },
            }),
          ),
        }),
        httpPost: (_url, headers, body) => {
          delivered = { headers, body };
          return { status: 200 };
        },
        log: () => undefined,
      },
    });
    expect(out).toEqual({ status: 'DELIVERED', code: 'OK' });
    const verdict = authenticateCallback(
      deriveChannelKeys(TOKEN),
      {
        timestamp: delivered!.headers['x-catenor-timestamp'],
        signature: delivered!.headers['x-catenor-signature'],
      },
      delivered!.body,
      NOW,
    );
    expect(verdict).toMatchObject({ ok: true, result: { status: 'OK', mode: 'SIMULATION' } });
  });
});
