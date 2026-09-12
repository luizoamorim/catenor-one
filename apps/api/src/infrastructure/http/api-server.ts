// Minimal public HTTP surface of the Catenor One API on Railway (prompt 024). Operationally inert: no route creates
// demo state or calls a sponsor; the only mutable state is the in-memory CRE callback relay (cre-callback-relay.ts).
//
//   GET  /v1/health                                            liveness (Railway health check); no DB, no sponsor
//   GET  /v1/health/db                                         read-only readiness: DB reachable + migrations applied
//   POST /v1/internal/cre/identity-confidential/results        CRE callback → authenticate → relay mailbox (202)
//   GET  /v1/internal/cre/identity-confidential/results/<run>  authenticated one-time pull by the local stage runner
//
// Responses carry stable codes only — never request bodies, headers, secrets or provider data. Not a NestJS app (T4.1
// remains open); the existing callback path and authenticator are reused as they are.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { CALLBACK_PATH, readBody } from '../confidential-compute/cre-callback-receiver.js';
import {
  isRunId,
  verifyRelayPull,
  type CallbackMailbox,
} from '../confidential-compute/cre-callback-relay.js';
import { authenticateCallback, type ChannelKeys } from '../confidential-compute/cre-channel.js';
import type { DatabaseProbe, DatabaseProbeResult } from '../persistence/prisma/database-probe.js';

export interface ApiServerOptions {
  /** Present only when CATENOR_INTERNAL_API_TOKEN is configured. */
  readonly relay?: {
    readonly keys: ChannelKeys;
    readonly relayKey: Uint8Array;
    readonly mailbox: CallbackMailbox;
  };
  /** Present only when DATABASE_URL is configured. */
  readonly database?: Pick<DatabaseProbe, 'probe'>;
  readonly commit?: string;
  readonly now?: () => Date;
  /** Structured, secret-free event log (one JSON line per event in production). */
  readonly log?: (event: Record<string, unknown>) => void;
}

const header = (req: IncomingMessage, name: string) => {
  const v = req.headers[name];
  return typeof v === 'string' ? v : undefined;
};

export function createApiServer(options: ApiServerOptions): Server {
  const now = options.now ?? (() => new Date());
  const log = options.log ?? (() => undefined);

  const reply = (res: ServerResponse, status: number, body: Record<string, unknown>) => {
    res
      .writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' })
      .end(JSON.stringify(body));
  };

  const health = (res: ServerResponse) =>
    reply(res, 200, {
      status: 'ok',
      service: 'catenor-one-api',
      startup: 'INERT',
      creRelay: options.relay ? 'ENABLED' : 'NOT_CONFIGURED',
      database: options.database ? 'CONFIGURED' : 'NOT_CONFIGURED',
      ...(options.commit ? { commit: options.commit } : {}),
    });

  const databaseHealth = async (res: ServerResponse) => {
    if (!options.database) return reply(res, 503, { database: 'NOT_CONFIGURED' });
    const result: DatabaseProbeResult = await options.database.probe();
    return reply(res, result.database === 'REACHABLE' ? 200 : 503, { ...result });
  };

  const receiveCallback = async (req: IncomingMessage, res: ServerResponse) => {
    const relay = options.relay;
    if (!relay) return reply(res, 503, { code: 'CRE_RELAY_NOT_CONFIGURED' });
    const body = await readBody(req);
    if (body === undefined) return reply(res, 413, { code: 'BODY_TOO_LARGE' });
    const timestamp = header(req, 'x-catenor-timestamp');
    const signature = header(req, 'x-catenor-signature');
    const verdict = authenticateCallback(relay.keys, { timestamp, signature }, body, now());
    if (!verdict.ok) {
      log({ event: 'cre_callback', accepted: false, code: verdict.reason });
      return reply(res, 401, { code: verdict.reason });
    }
    const runId = String(verdict.result.runId);
    if (!isRunId(runId)) return reply(res, 400, { code: 'RESULT_SCHEMA_INVALID' });
    const stored = relay.mailbox.put(
      runId,
      { timestamp: timestamp!, signature: signature!, body: Buffer.from(body).toString('base64') },
      now(),
    );
    const code =
      stored === 'STORED'
        ? 'RELAYED'
        : stored === 'DUPLICATE'
          ? 'LATE_OR_DUPLICATE_RESULT'
          : 'RELAY_FULL';
    log({ event: 'cre_callback', accepted: stored === 'STORED', code, runId });
    return reply(res, stored === 'STORED' ? 202 : stored === 'DUPLICATE' ? 409 : 503, { code });
  };

  const pullCallback = (req: IncomingMessage, res: ServerResponse, path: string) => {
    const relay = options.relay;
    if (!relay) return reply(res, 503, { code: 'CRE_RELAY_NOT_CONFIGURED' });
    const rejection = verifyRelayPull(
      relay.relayKey,
      {
        timestamp: header(req, 'x-catenor-timestamp'),
        signature: header(req, 'x-catenor-signature'),
      },
      path,
      now(),
    );
    if (rejection) {
      log({ event: 'cre_relay_pull', delivered: false, code: rejection });
      return reply(res, 401, { code: rejection });
    }
    let runId: string;
    try {
      runId = decodeURIComponent(path.slice(CALLBACK_PATH.length + 1));
    } catch {
      return reply(res, 400, { code: 'RUN_ID_INVALID' });
    }
    if (!isRunId(runId)) return reply(res, 400, { code: 'RUN_ID_INVALID' });
    const delivery = relay.mailbox.take(runId, now());
    if (!delivery) return reply(res, 404, { code: 'NOT_FOUND' });
    log({ event: 'cre_relay_pull', delivered: true, runId });
    return reply(res, 200, { ...delivery });
  };

  return createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    const route = async () => {
      if (req.method === 'GET' && path === '/v1/health') return health(res);
      if (req.method === 'GET' && path === '/v1/health/db') return databaseHealth(res);
      if (req.method === 'POST' && path === CALLBACK_PATH) return receiveCallback(req, res);
      if (req.method === 'GET' && path.startsWith(`${CALLBACK_PATH}/`)) {
        return pullCallback(req, res, path);
      }
      return reply(res, 404, { code: 'NOT_FOUND' });
    };
    route().catch(() => {
      log({ event: 'http_error', path });
      if (!res.headersSent) reply(res, 500, { code: 'INTERNAL' });
    });
  });
}
