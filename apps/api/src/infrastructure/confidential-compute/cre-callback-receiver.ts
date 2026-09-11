// Minimal internal HTTP receiver for identity-confidential callbacks (PLAN §17.6 callbackUrl, TASKS T9.3):
// POST /v1/internal/cre/identity-confidential/results → authenticate (HMAC, timestamp, commitment recomputation)
// → U8. Only the authenticated envelope reaches the application; rejections are answered without detail beyond a
// stable code. The NestJS API (T4.1) will mount the same handler; this receiver serves the demo and simulation.
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { ConfidentialVerificationResult } from '../../modules/trust-anchor-admission/application/admission.ports.js';
import { authenticateCallback, type ChannelKeys } from './cre-channel.js';

export const CALLBACK_PATH = '/v1/internal/cre/identity-confidential/results';
const MAX_BODY_BYTES = 16 * 1024;

export interface CallbackReceiver {
  readonly url: string;
  close(): Promise<void>;
}

async function readBody(req: IncomingMessage): Promise<Uint8Array | undefined> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) return undefined;
    chunks.push(chunk as Buffer);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

export async function startCallbackReceiver(options: {
  readonly port: number;
  readonly host?: string;
  readonly keys: ChannelKeys;
  readonly now: () => Date;
  readonly deliver: (
    result: ConfidentialVerificationResult,
  ) => Promise<{ accepted: boolean; reason?: string }>;
  /** Observes every authenticated delivery or rejection (for the demo narration); never sees secrets. */
  readonly onEvent?: (event: { accepted: boolean; reason?: string; runId?: string }) => void;
}): Promise<CallbackReceiver> {
  const host = options.host ?? '127.0.0.1';
  const server: Server = createServer(async (req, res) => {
    const reply = (status: number, body: Record<string, unknown>) => {
      res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
    };
    if (req.method !== 'POST' || req.url !== CALLBACK_PATH) {
      return reply(404, { code: 'NOT_FOUND' });
    }
    const body = await readBody(req);
    if (body === undefined) return reply(413, { code: 'BODY_TOO_LARGE' });
    const verdict = authenticateCallback(
      options.keys,
      {
        timestamp: req.headers['x-catenor-timestamp'] as string | undefined,
        signature: req.headers['x-catenor-signature'] as string | undefined,
      },
      body,
      options.now(),
    );
    if (!verdict.ok) {
      options.onEvent?.({ accepted: false, reason: verdict.reason });
      return reply(401, { code: verdict.reason });
    }
    try {
      const outcome = await options.deliver(verdict.result);
      options.onEvent?.({ ...outcome, runId: verdict.result.runId });
      return reply(outcome.accepted ? 200 : 409, { code: outcome.reason ?? 'ACCEPTED' });
    } catch {
      options.onEvent?.({
        accepted: false,
        reason: 'RESULT_NOT_RECORDED',
        runId: verdict.result.runId,
      });
      return reply(500, { code: 'RESULT_NOT_RECORDED' });
    }
  });
  await new Promise<void>((resolve) => server.listen(options.port, host, resolve));
  return {
    url: `http://${host}:${options.port}${CALLBACK_PATH}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
