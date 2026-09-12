// Railway API surface (prompt 024): health, read-only DB readiness, and the CRE callback relay end to end —
// a callback signed the way the TEE signs it is authenticated, parked, pulled once by the runner's poller and
// delivered through authenticateCallback → deliver.
import { createHmac } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { CALLBACK_PATH } from '../confidential-compute/cre-callback-receiver.js';
import {
  CallbackMailbox,
  deriveRelayKey,
  relayPullPath,
  signRelayPull,
  startRelayPoller,
} from '../confidential-compute/cre-callback-relay.js';
import { deriveChannelKeys } from '../confidential-compute/cre-channel.js';
import { createApiServer, type ApiServerOptions } from './api-server.js';

const TOKEN = 'c3'.repeat(32);
const keys = deriveChannelKeys(TOKEN);
const relayKey = deriveRelayKey(TOKEN);

const envelope = (runId: string) => ({
  v: 1,
  operation: 'OFFERING_ELIGIBILITY',
  runId,
  sessionRef: 'sref:1',
  mode: 'DEPLOYED',
  status: 'ERROR',
  code: 'PROVIDER_UNAVAILABLE',
});

/** Headers exactly as the workflow computes them (commitment.ts callbackHeaders). */
const callbackHeaders = (body: string, timestamp = new Date().toISOString()) => ({
  'content-type': 'application/json',
  'x-catenor-timestamp': timestamp,
  'x-catenor-signature': createHmac('sha256', keys.cb).update(`${timestamp}.${body}`).digest('hex'),
});

const pullHeaders = (path: string, key = relayKey, timestamp = new Date().toISOString()) => ({
  'x-catenor-timestamp': timestamp,
  'x-catenor-signature': signRelayPull(key, timestamp, path),
});

const servers: { close(): void }[] = [];
afterEach(() => servers.splice(0).forEach((s) => s.close()));

async function start(options: Partial<ApiServerOptions> = {}) {
  const server = createApiServer({
    relay: { keys, relayKey, mailbox: new CallbackMailbox() },
    ...options,
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe('Railway API server', () => {
  it('GET /v1/health is a static liveness answer that needs no database or secret', async () => {
    const base = await start({ relay: undefined });
    const res = await fetch(`${base}/v1/health`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({
      status: 'ok',
      service: 'catenor-one-api',
      startup: 'INERT',
      creRelay: 'NOT_CONFIGURED',
      database: 'NOT_CONFIGURED',
    });
  });

  it('GET /v1/health/db reports NOT_CONFIGURED, or the probe result', async () => {
    expect((await fetch(`${await start()}/v1/health/db`)).status).toBe(503);
    const base = await start({
      database: {
        probe: () =>
          Promise.resolve({ database: 'REACHABLE', migrations: { applied: 5, packaged: 5 } }),
      },
    });
    const res = await fetch(`${base}/v1/health/db`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      database: 'REACHABLE',
      migrations: { applied: 5, packaged: 5 },
    });
  });

  it('answers unknown routes and methods with 404 only', async () => {
    const base = await start();
    expect((await fetch(`${base}/`)).status).toBe(404);
    expect((await fetch(`${base}${CALLBACK_PATH}`)).status).toBe(404);
    expect((await fetch(`${base}/v1/health`, { method: 'POST' })).status).toBe(404);
  });

  it('without CATENOR_INTERNAL_API_TOKEN the CRE routes are disabled (503), not open', async () => {
    const base = await start({ relay: undefined });
    const body = JSON.stringify(envelope('run:a'));
    const post = await fetch(`${base}${CALLBACK_PATH}`, {
      method: 'POST',
      headers: callbackHeaders(body),
      body,
    });
    expect(post.status).toBe(503);
    expect(await post.json()).toEqual({ code: 'CRE_RELAY_NOT_CONFIGURED' });
  });
});

describe('CRE callback relay', () => {
  it('authenticates a callback, parks it, and hands it out once to an authenticated pull', async () => {
    const base = await start();
    const body = JSON.stringify(envelope('run:relay-1'));
    const headers = callbackHeaders(body);
    const post = await fetch(`${base}${CALLBACK_PATH}`, { method: 'POST', headers, body });
    expect(post.status).toBe(202);
    expect(await post.json()).toEqual({ code: 'RELAYED' });

    const path = relayPullPath('run:relay-1');
    const pulled = await fetch(`${base}${path}`, { headers: pullHeaders(path) });
    expect(pulled.status).toBe(200);
    const delivery = (await pulled.json()) as {
      timestamp: string;
      signature: string;
      body: string;
    };
    expect(delivery.timestamp).toBe(headers['x-catenor-timestamp']);
    expect(delivery.signature).toBe(headers['x-catenor-signature']);
    expect(Buffer.from(delivery.body, 'base64').toString('utf8')).toBe(body);

    expect((await fetch(`${base}${path}`, { headers: pullHeaders(path) })).status).toBe(404);
    // A replay of the same callback after delivery is refused, never forwarded twice.
    const replay = await fetch(`${base}${CALLBACK_PATH}`, { method: 'POST', headers, body });
    expect(replay.status).toBe(409);
  });

  it('rejects forged or stale callbacks and bad commitments before parking anything', async () => {
    const base = await start();
    const body = JSON.stringify(envelope('run:forged'));
    const forged = await fetch(`${base}${CALLBACK_PATH}`, {
      method: 'POST',
      headers: { ...callbackHeaders(body), 'x-catenor-signature': 'ab'.repeat(32) },
      body,
    });
    expect(forged.status).toBe(401);
    expect(await forged.json()).toEqual({ code: 'CALLBACK_UNAUTHENTICATED' });

    const stale = await fetch(`${base}${CALLBACK_PATH}`, {
      method: 'POST',
      headers: callbackHeaders(body, new Date(Date.now() - 10 * 60_000).toISOString()),
      body,
    });
    expect(await stale.json()).toEqual({ code: 'CALLBACK_STALE' });

    const ok = JSON.stringify({ ...envelope('run:bad-commitment'), status: 'OK' });
    const bad = await fetch(`${base}${CALLBACK_PATH}`, {
      method: 'POST',
      headers: callbackHeaders(ok),
      body: ok,
    });
    expect(await bad.json()).toEqual({ code: 'COMMITMENT_INPUT_INVALID' });

    const path = relayPullPath('run:forged');
    expect((await fetch(`${base}${path}`, { headers: pullHeaders(path) })).status).toBe(404);
  });

  it('refuses pulls signed with the wrong key, for another path, or stale', async () => {
    const base = await start();
    const body = JSON.stringify(envelope('run:guarded'));
    await fetch(`${base}${CALLBACK_PATH}`, {
      method: 'POST',
      headers: callbackHeaders(body),
      body,
    });
    const path = relayPullPath('run:guarded');
    const wrongKey = await fetch(`${base}${path}`, {
      headers: pullHeaders(path, deriveRelayKey('d4'.repeat(32))),
    });
    expect(wrongKey.status).toBe(401);
    const otherPath = await fetch(`${base}${path}`, {
      headers: pullHeaders(relayPullPath('run:other')),
    });
    expect(otherPath.status).toBe(401);
    const stale = await fetch(`${base}${path}`, {
      headers: pullHeaders(path, relayKey, new Date(Date.now() - 10 * 60_000).toISOString()),
    });
    expect(await stale.json()).toEqual({ code: 'PULL_STALE' });
    // The callback key itself does not authorize a pull.
    const cbKey = await fetch(`${base}${path}`, { headers: pullHeaders(path, keys.cb) });
    expect(cbKey.status).toBe(401);
    expect((await fetch(`${base}${path}`, { headers: pullHeaders(path) })).status).toBe(200);
  });

  it('the runner poller pulls its own runs and delivers them through authenticateCallback', async () => {
    const base = await start();
    const delivered: unknown[] = [];
    const events: unknown[] = [];
    const poller = startRelayPoller({
      baseUrl: base,
      relayKey,
      keys,
      runIds: () => ['run:mine'],
      deliver: (result) => {
        delivered.push(result);
        return Promise.resolve({ accepted: true });
      },
      onEvent: (e) => events.push(e),
      intervalMs: 20,
    });
    try {
      const mine = JSON.stringify(envelope('run:mine'));
      const other = JSON.stringify(envelope('run:not-mine'));
      for (const body of [other, mine]) {
        await fetch(`${base}${CALLBACK_PATH}`, {
          method: 'POST',
          headers: callbackHeaders(body),
          body,
        });
      }
      await poller.settled('run:mine', 2_000);
      expect(delivered).toEqual([envelope('run:mine')]);
      expect(events).toEqual([{ accepted: true, runId: 'run:mine' }]);
    } finally {
      poller.stop();
    }
  });
});

describe('CallbackMailbox', () => {
  const d = { timestamp: 't', signature: 's', body: 'b' };
  it('expires entries after CALLBACK_MAX_SKEW_SECONDS and bounds its size', () => {
    const box = new CallbackMailbox(2);
    const t0 = new Date('2026-09-12T00:00:00Z');
    expect(box.put('run:1', d, t0)).toBe('STORED');
    expect(box.put('run:1', d, t0)).toBe('DUPLICATE');
    expect(box.put('run:2', d, t0)).toBe('STORED');
    expect(box.put('run:3', d, t0)).toBe('FULL');
    const later = new Date(t0.getTime() + 301_000);
    expect(box.take('run:1', later)).toBeUndefined();
    expect(box.put('run:3', d, later)).toBe('STORED');
    expect(box.size).toBe(1);
  });
});
