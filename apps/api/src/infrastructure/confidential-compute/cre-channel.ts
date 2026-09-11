// API side of the identity-confidential channel (PLAN §18, §23; TASKS T9.1 sealer, T9.3 authenticator).
// K = CATENOR_INTERNAL_API_TOKEN (Railway sealed variable; the same value lives in the Vault DON). From K:
//   ctx  key  HKDF-SHA256(K, salt = empty, info = "catenor-one/identity-confidential/ctx/v1")  — seals the context
//   cb   key  HKDF-SHA256(K, salt = empty, info = "catenor-one/identity-confidential/cb/v1")   — callback HMAC [REF-IMPL]
//   salt key  HKDF-SHA256(K, salt = empty, info = "catenor-one/identity-confidential/salt/v1") — commitment salt [REF-IMPL]
// The API generates every nonce (the TEE has no CSPRNG); the TEE only opens.
import {
  createCipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { canonicalizeToString } from '@catenor-one/audit';
import type {
  ConfidentialVerificationResult,
  PrivateVerificationContext,
} from '../../modules/trust-anchor-admission/application/admission.ports.js';
import type { InvestorVerificationContext } from '../../modules/distribution/application/distribution.service.js';

export const CALLBACK_MAX_SKEW_SECONDS = 300;

export interface ChannelKeys {
  readonly ctx: Uint8Array;
  readonly cb: Uint8Array;
  readonly salt: Uint8Array;
}

/** K is 32 random bytes, hex-encoded (TASKS T0.4); the HKDF input is the decoded 32 bytes (same as the TEE). */
export function deriveChannelKeys(tokenHex: string): ChannelKeys {
  if (!/^[0-9a-fA-F]{64}$/.test(tokenHex)) {
    throw new TypeError(
      'CATENOR_INTERNAL_API_TOKEN must be 32 bytes hex-encoded (64 hex characters)',
    );
  }
  const ikm = Buffer.from(tokenHex, 'hex');
  const key = (info: string) =>
    new Uint8Array(hkdfSync('sha256', ikm, Buffer.alloc(0), Buffer.from(info, 'utf8'), 32));
  return {
    ctx: key('catenor-one/identity-confidential/ctx/v1'),
    cb: key('catenor-one/identity-confidential/cb/v1'),
    salt: key('catenor-one/identity-confidential/salt/v1'),
  };
}

export interface TriggerPayload {
  readonly v: 1;
  readonly operation: string;
  readonly runId: string;
  readonly sealedContext: { readonly nonce: string; readonly ct: string };
}

/** AES-256-GCM(k_ctx, nonce, JCS(context), aad = operation ‖ runId); nonce and ciphertext‖tag as base64. */
export function sealContext(
  keys: ChannelKeys,
  operation: string,
  context: PrivateVerificationContext | InvestorVerificationContext,
): TriggerPayload {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keys.ctx, nonce);
  cipher.setAAD(Buffer.from(operation + context.runId, 'utf8'));
  const ct = Buffer.concat([
    cipher.update(Buffer.from(canonicalizeToString(context), 'utf8')),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  return {
    v: 1,
    operation,
    runId: context.runId,
    sealedContext: { nonce: nonce.toString('base64'), ct: ct.toString('base64') },
  };
}

export type CallbackVerdict =
  | { readonly ok: true; readonly result: ConfidentialVerificationResult }
  | { readonly ok: false; readonly reason: string };

/**
 * Authenticates a TEE callback (T9.3): HMAC-SHA256(cb, timestamp + "." + rawBody) in constant time, a timestamp
 * within ±5 minutes, a parseable envelope, and — for OK results — the evidence commitment recomputed from the
 * delivered commitmentInput and the re-derived salt, with its facts and echoes equal to the envelope's.
 */
export function authenticateCallback(
  keys: ChannelKeys,
  headers: { timestamp?: string; signature?: string },
  rawBody: Uint8Array,
  now: Date,
): CallbackVerdict {
  const { timestamp, signature } = headers;
  if (!timestamp || !signature || !/^[0-9a-f]{64}$/.test(signature)) {
    return { ok: false, reason: 'CALLBACK_UNAUTHENTICATED' };
  }
  const expected = createHmac('sha256', keys.cb)
    .update(Buffer.concat([Buffer.from(`${timestamp}.`, 'utf8'), Buffer.from(rawBody)]))
    .digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) {
    return { ok: false, reason: 'CALLBACK_UNAUTHENTICATED' };
  }
  const at = Date.parse(timestamp);
  if (Number.isNaN(at) || Math.abs(now.getTime() - at) > CALLBACK_MAX_SKEW_SECONDS * 1000) {
    return { ok: false, reason: 'CALLBACK_STALE' };
  }
  let result: ConfidentialVerificationResult;
  try {
    result = JSON.parse(Buffer.from(rawBody).toString('utf8')) as ConfidentialVerificationResult;
  } catch {
    return { ok: false, reason: 'RESULT_SCHEMA_INVALID' };
  }
  if (result.status === 'OK') {
    const reason = commitmentMismatch(keys, result);
    if (reason) return { ok: false, reason };
  }
  return { ok: true, result };
}

function commitmentMismatch(
  keys: ChannelKeys,
  result: ConfidentialVerificationResult,
): string | undefined {
  const input = result.commitmentInput as Record<string, unknown> | undefined;
  if (!input || 'salt' in input) return 'COMMITMENT_INPUT_INVALID';
  const salt = `0x${createHmac('sha256', keys.salt).update(result.runId, 'utf8').digest('hex')}`;
  const recomputed = `0x${createHash('sha256')
    .update(canonicalizeToString({ ...input, salt }), 'utf8')
    .digest('hex')}`;
  if (recomputed !== result.evidenceCommitment) return 'COMMITMENT_MISMATCH';
  const same = (a: unknown, b: unknown) => canonicalizeToString(a) === canonicalizeToString(b);
  if (
    input.runId !== result.runId ||
    input.sessionRef !== result.sessionRef ||
    input.bootstrapConfigurationHash !== result.bootstrapConfigurationHash ||
    input.evidenceProfile !== result.evidenceProfile ||
    !same(input.evidenceSources, result.evidenceSources) ||
    !same(input.facts, result.facts)
  ) {
    return 'COMMITMENT_ECHO_MISMATCH';
  }
  return undefined;
}
