// Catenor One API — production entrypoint (Railway, prompt 024).
//
// Startup is operationally INERT: it reads three optional variables, derives the CRE channel keys in memory and listens.
// It never connects to the database, never calls Privy, Sumsub, Hedera or Chainlink, never admits, issues, delegates,
// deploys, pays or migrates. Demo state is created only by the maintainer's local stage runner (scripts/demo/).
//
//   PORT                         injected by Railway (default 8080)
//   CATENOR_INTERNAL_API_TOKEN   optional; enables the CRE callback relay (must equal the Vault DON secret)
//   DATABASE_URL                 optional; enables GET /v1/health/db (read-only)
// No value is ever printed; the start line reports which features are enabled.
import {
  CallbackMailbox,
  deriveRelayKey,
} from './infrastructure/confidential-compute/cre-callback-relay.js';
import { deriveChannelKeys } from './infrastructure/confidential-compute/cre-channel.js';
import { createApiServer } from './infrastructure/http/api-server.js';
import { createDatabaseProbe } from './infrastructure/persistence/prisma/database-probe.js';

const log = (event: Record<string, unknown>) =>
  console.log(JSON.stringify({ at: new Date().toISOString(), ...event }));

function fail(message: string): never {
  console.error(
    JSON.stringify({ at: new Date().toISOString(), event: 'api_start_refused', message }),
  );
  process.exit(1);
}

const port = Number(process.env['PORT'] ?? '8080');
if (!Number.isInteger(port) || port < 1 || port > 65_535) fail('PORT must be an integer 1–65535');
const host = process.env['HOST'] ?? '::';

const token = process.env['CATENOR_INTERNAL_API_TOKEN'] ?? '';
let relay: Parameters<typeof createApiServer>[0]['relay'];
if (token !== '') {
  try {
    relay = {
      keys: deriveChannelKeys(token),
      relayKey: deriveRelayKey(token),
      mailbox: new CallbackMailbox(),
    };
  } catch {
    fail('CATENOR_INTERNAL_API_TOKEN is set but is not 32 bytes hex-encoded (64 hex characters)');
  }
}

const databaseUrl = process.env['DATABASE_URL'] ?? '';
const database = databaseUrl !== '' ? createDatabaseProbe(databaseUrl) : undefined;
const commit = process.env['RAILWAY_GIT_COMMIT_SHA']?.slice(0, 12);

const server = createApiServer({
  relay,
  database,
  ...(commit ? { commit } : {}),
  log,
});

server.listen(port, host, () =>
  log({
    event: 'api_started',
    port,
    startup: 'INERT',
    creRelay: relay ? 'ENABLED' : 'NOT_CONFIGURED',
    database: database ? 'CONFIGURED' : 'NOT_CONFIGURED',
  }),
);

const shutdown = (signal: string) => {
  log({ event: 'api_stopping', signal });
  server.close(() => {
    void (database?.close() ?? Promise.resolve()).finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(0), 10_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
