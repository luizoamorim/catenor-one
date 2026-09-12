// CRE callback relay (prompt 024 — Railway as the public HTTPS endpoint of a DEPLOYED identity-confidential workflow).
//
// A deployed workflow POSTs its HMAC-authenticated result to CALLBACK_PATH on the public API. The result is awaited by
// the process that requested it — the maintainer's local stage runner (in-memory for investor operations) — so the
// public API cannot record it itself. The relay therefore only stores and forwards:
//   1. the API authenticates the callback exactly as the local receiver does (authenticateCallback) and keeps the raw
//      delivery (timestamp, signature, body) in memory, keyed by runId, for at most CALLBACK_MAX_SKEW_SECONDS;
//   2. the runner pulls it once (GET CALLBACK_PATH/<runId>, authenticated), re-authenticates the same bytes and
//      delivers them through the unchanged path (authenticateCallback → deliver → U8 / recordResult).
// Nothing is persisted: a restart drops undelivered results (the runner's request times out and is re-run).
//
// Pull authentication [REF-IMPL]: relay key = HKDF-SHA256(K, salt = empty, info = "catenor-one/identity-confidential/
// relay/v1"); x-catenor-signature = hex(HMAC-SHA256(relay key, timestamp + "." + "GET " + path)), timestamp (RFC 3339)
// within ±5 minutes. K = CATENOR_INTERNAL_API_TOKEN, the same value as the Vault DON secret; the relay key is separate
// from the callback key, so a pull signature can never be mistaken for a callback signature.
import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';
import type { ConfidentialVerificationResult } from '../../modules/trust-anchor-admission/application/admission.ports.js';
import { CALLBACK_PATH } from './cre-callback-receiver.js';
import {
  CALLBACK_MAX_SKEW_SECONDS,
  authenticateCallback,
  type ChannelKeys,
} from './cre-channel.js';

const RUN_ID = /^[A-Za-z0-9:._-]{1,128}$/;
const TTL_MS = CALLBACK_MAX_SKEW_SECONDS * 1000;

/** One authenticated callback exactly as received (body base64-encoded). */
export interface RelayedDelivery {
  readonly timestamp: string;
  readonly signature: string;
  readonly body: string;
}

export function deriveRelayKey(tokenHex: string): Uint8Array {
  if (!/^[0-9a-fA-F]{64}$/.test(tokenHex)) {
    throw new TypeError(
      'CATENOR_INTERNAL_API_TOKEN must be 32 bytes hex-encoded (64 hex characters)',
    );
  }
  return new Uint8Array(
    hkdfSync(
      'sha256',
      Buffer.from(tokenHex, 'hex'),
      Buffer.alloc(0),
      Buffer.from('catenor-one/identity-confidential/relay/v1', 'utf8'),
      32,
    ),
  );
}

export const isRunId = (runId: string): boolean => RUN_ID.test(runId);

export const relayPullPath = (runId: string): string =>
  `${CALLBACK_PATH}/${encodeURIComponent(runId)}`;

export function signRelayPull(relayKey: Uint8Array, timestamp: string, path: string): string {
  return createHmac('sha256', relayKey).update(`${timestamp}.GET ${path}`, 'utf8').digest('hex');
}

/** Authenticates a pull request; returns undefined when valid, otherwise a stable rejection code. */
export function verifyRelayPull(
  relayKey: Uint8Array,
  headers: { timestamp?: string; signature?: string },
  path: string,
  now: Date,
): string | undefined {
  const { timestamp, signature } = headers;
  if (!timestamp || !signature || !/^[0-9a-f]{64}$/.test(signature)) {
    return 'PULL_UNAUTHENTICATED';
  }
  const expected = Buffer.from(signRelayPull(relayKey, timestamp, path), 'hex');
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) return 'PULL_UNAUTHENTICATED';
  const at = Date.parse(timestamp);
  if (Number.isNaN(at) || Math.abs(now.getTime() - at) > TTL_MS) return 'PULL_STALE';
  return undefined;
}

/**
 * In-memory mailbox: at most `capacity` undelivered results, each kept for CALLBACK_MAX_SKEW_SECONDS (after that the
 * runner's re-authentication would reject it as stale anyway) and handed out once. A runId already stored or already
 * handed out is refused, so a replayed callback is never forwarded twice.
 */
export class CallbackMailbox {
  private readonly entries = new Map<string, { delivery: RelayedDelivery; expiresAt: number }>();
  private readonly consumed = new Map<string, number>();

  constructor(private readonly capacity = 64) {}

  get size(): number {
    return this.entries.size;
  }

  put(runId: string, delivery: RelayedDelivery, now: Date): 'STORED' | 'DUPLICATE' | 'FULL' {
    this.sweep(now);
    if (this.entries.has(runId) || this.consumed.has(runId)) return 'DUPLICATE';
    if (this.entries.size >= this.capacity) return 'FULL';
    this.entries.set(runId, { delivery, expiresAt: now.getTime() + TTL_MS });
    return 'STORED';
  }

  take(runId: string, now: Date): RelayedDelivery | undefined {
    this.sweep(now);
    const entry = this.entries.get(runId);
    if (!entry) return undefined;
    this.entries.delete(runId);
    this.consumed.set(runId, now.getTime() + TTL_MS);
    return entry.delivery;
  }

  private sweep(now: Date) {
    const t = now.getTime();
    for (const [runId, e] of this.entries) if (e.expiresAt <= t) this.entries.delete(runId);
    for (const [runId, expiresAt] of this.consumed) if (expiresAt <= t) this.consumed.delete(runId);
  }
}

export interface RelayEvent {
  readonly accepted: boolean;
  readonly reason?: string;
  readonly runId?: string;
}

export interface RelayPoller {
  /** Resolves once the result of `runId` was delivered (or rejected), or after `timeoutMs`. */
  settled(runId: string, timeoutMs?: number): Promise<void>;
  stop(): void;
}

/**
 * Runner side: polls the relay for every run this process requested and delivers each result through the same
 * authenticateCallback → deliver path the local receiver uses. Secrets are never logged; events carry codes only.
 */
export function startRelayPoller(options: {
  readonly baseUrl: string;
  readonly relayKey: Uint8Array;
  readonly keys: ChannelKeys;
  readonly runIds: () => readonly string[];
  readonly deliver: (
    result: ConfidentialVerificationResult,
  ) => Promise<{ accepted: boolean; reason?: string }>;
  readonly onEvent?: (event: RelayEvent) => void;
  readonly intervalMs?: number;
  readonly fetch?: typeof fetch;
  readonly now?: () => Date;
}): RelayPoller {
  const now = options.now ?? (() => new Date());
  const doFetch = options.fetch ?? fetch;
  const done = new Set<string>();
  const reported = new Map<string, string>();
  const waiters = new Map<string, (() => void)[]>();
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const finish = (runId: string, event: RelayEvent) => {
    done.add(runId);
    options.onEvent?.(event);
    for (const w of waiters.get(runId) ?? []) w();
    waiters.delete(runId);
  };

  const pull = async (runId: string) => {
    const path = relayPullPath(runId);
    const timestamp = now().toISOString();
    let response: Response;
    try {
      response = await doFetch(new URL(path, options.baseUrl), {
        headers: {
          'x-catenor-timestamp': timestamp,
          'x-catenor-signature': signRelayPull(options.relayKey, timestamp, path),
        },
      });
    } catch {
      return; // network hiccup: retried on the next tick
    }
    if (response.status === 404) return;
    if (response.status !== 200) {
      const reason = `RELAY_HTTP_${response.status}`;
      if (reported.get(runId) !== reason) {
        reported.set(runId, reason);
        options.onEvent?.({ accepted: false, reason, runId });
      }
      return;
    }
    let delivery: RelayedDelivery;
    try {
      delivery = (await response.json()) as RelayedDelivery;
      if (typeof delivery.body !== 'string') throw new TypeError('body');
    } catch {
      return finish(runId, { accepted: false, reason: 'RELAY_RESPONSE_INVALID', runId });
    }
    const verdict = authenticateCallback(
      options.keys,
      { timestamp: delivery.timestamp, signature: delivery.signature },
      new Uint8Array(Buffer.from(delivery.body, 'base64')),
      now(),
    );
    if (!verdict.ok) return finish(runId, { accepted: false, reason: verdict.reason, runId });
    const outcome = await options
      .deliver(verdict.result)
      .catch(() => ({ accepted: false, reason: 'RESULT_NOT_RECORDED' }));
    finish(runId, { ...outcome, runId });
  };

  const tick = async () => {
    for (const runId of options.runIds()) {
      if (stopped) return;
      if (!done.has(runId)) await pull(runId).catch(() => undefined);
    }
    if (!stopped) {
      timer = setTimeout(() => void tick(), options.intervalMs ?? 1500);
      timer.unref();
    }
  };
  void tick();

  return {
    settled(runId, timeoutMs = TTL_MS) {
      if (done.has(runId)) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const t = setTimeout(resolve, timeoutMs);
        t.unref();
        waiters.set(runId, [
          ...(waiters.get(runId) ?? []),
          () => {
            clearTimeout(t);
            resolve();
          },
        ]);
      });
    },
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
