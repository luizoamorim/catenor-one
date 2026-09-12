// 01 setup-env · 02 reset-local-demo. External credentials are validated without printing them; values our scripts
// generate (instance id, DB URL, channel token) are written automatically to git-ignored files.
//
// Database: the local Docker PostgreSQL by default. When apps/api/.env has RAILWAY_DATABASE_PUBLIC_URL (the Railway
// Postgres service's DATABASE_PUBLIC_URL, i.e. its TCP proxy), the runner uses the deployed backend's database instead:
// no container is started, and a fresh instance refuses a database that already holds Catenor rows. 02 never touches
// it (the audit log is append-only: a Railway database is emptied only by recreating it, a maintainer action).
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, renameSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createPrismaClient } from '../../../../src/infrastructure/persistence/prisma/prisma-persistence.js';
import type { Stage } from '../stage.js';
import { say } from '../stage.js';
import {
  API_ENV,
  DEMO_DIR,
  ROOT,
  RUNTIME_ENV,
  STATE_ENV,
  WORKFLOW_ENV,
  env,
  ownerKeyDir,
  parseEnvFile,
  setRuntime,
  setState,
} from '../state.js';

const PG_CONTAINER = 'catenor-one-demo-postgres';
const PG_VOLUME = 'catenor-one-demo-pgdata';
const PG_PORT = '55432';
const PG_IMAGE = 'postgres:17.11-alpine';

const RAILWAY_DB = 'RAILWAY_DATABASE_PUBLIC_URL';
const CATENOR_SCHEMAS = ['catenor_public', 'catenor_private'];

const run = (cmd: string, args: string[], extraEnv: Record<string, string> = {}) =>
  spawnSync(cmd, args, { encoding: 'utf8', env: { ...process.env, ...extraEnv } });

/** The Railway database URL from apps/api/.env, or '' for the local Docker PostgreSQL. Never printed. */
const railwayDatabaseUrl = () => parseEnvFile(API_ENV)[RAILWAY_DB] ?? '';

/** Runs `work` over the Catenor tables (both schemas; `_prisma_migrations` is not one of them). */
async function withCatenorTables<T>(
  databaseUrl: string,
  work: (db: ReturnType<typeof createPrismaClient>, tables: string[]) => Promise<T>,
): Promise<T> {
  const db = createPrismaClient(databaseUrl);
  try {
    const rows = await db.$queryRaw<{ s: string; t: string }[]>`
      SELECT table_schema AS s, table_name AS t FROM information_schema.tables
      WHERE table_schema = ANY(${CATENOR_SCHEMAS}) AND table_type = 'BASE TABLE' ORDER BY 1, 2`;
    const tables = rows
      .filter(({ s, t }) => /^[a-z_][a-z0-9_]*$/i.test(s) && /^[a-z_][a-z0-9_]*$/i.test(t))
      .map(({ s, t }) => `"${s}"."${t}"`);
    return await work(db, tables);
  } finally {
    await db.$disconnect();
  }
}

const catenorRowCount = (databaseUrl: string) =>
  withCatenorTables(databaseUrl, async (db, tables) => {
    if (tables.length === 0) return 0;
    const sql = tables.map((t) => `SELECT count(*)::int AS n FROM ${t}`).join(' UNION ALL ');
    const counts = await db.$queryRawUnsafe<{ n: number }[]>(sql);
    return counts.reduce((sum, { n }) => sum + n, 0);
  });

/** Present / absent only — the value is never printed. */
function check(file: string, name: string, test: (v: string) => boolean = (v) => v.length > 0) {
  const v = parseEnvFile(file)[name] ?? '';
  return v === '' ? 'MISSING' : test(v) ? 'PRESENT' : 'INVALID';
}

export const setupEnv: Stage = {
  id: '01-setup-env',
  title: 'Local environment — credentials check, local database, generated values',
  actor: 'Maintainer (local machine)',
  operation: 'none (infrastructure)',
  changes: [
    'validates PRIVY_APP_ID / PRIVY_APP_SECRET (apps/api/.env) and the Sumsub sandbox token/secret (workflows/.env) — never printed',
    'generates CATENOR_INTERNAL_API_TOKEN_VAR (CRE ↔ Catenor channel secret) into workflows/.env if absent',
    `database: the Railway PostgreSQL when apps/api/.env has ${RAILWAY_DB} (must be empty for a new instance), else a local PostgreSQL (${PG_IMAGE}, container ${PG_CONTAINER}, 127.0.0.1:${PG_PORT}); deploys the migrations`,
    'writes DEMO_INSTANCE / DEMO_DATABASE to .catenor-demo/state.env and DEMO_DATABASE_URL to .catenor-demo/runtime.env (0600)',
  ],
  sponsors: ['none (reads whether `cre whoami` succeeds; prints no account data)'],
  mode: 'LOCAL',
  expected: 'all required credentials PRESENT; database migrated; instance id written',
  async run() {
    const credentials = {
      PRIVY_APP_ID: check(API_ENV, 'PRIVY_APP_ID'),
      PRIVY_APP_SECRET: check(API_ENV, 'PRIVY_APP_SECRET'),
      SUMSUB_APP_TOKEN_VAR: check(WORKFLOW_ENV, 'SUMSUB_APP_TOKEN_VAR', (v) =>
        v.startsWith('sbx:'),
      ),
      SUMSUB_SECRET_KEY_VAR: check(WORKFLOW_ENV, 'SUMSUB_SECRET_KEY_VAR'),
      CATENOR_INTERNAL_API_TOKEN_VAR: check(WORKFLOW_ENV, 'CATENOR_INTERNAL_API_TOKEN_VAR', (v) =>
        /^[0-9a-f]{64}$/.test(v),
      ),
    };
    if (credentials.CATENOR_INTERNAL_API_TOKEN_VAR === 'MISSING') {
      if (!existsSync(WORKFLOW_ENV)) {
        console.error(
          'BLOCKED: workflows/.env is missing (Sumsub sandbox values — maintainer action)',
        );
        process.exit(2);
      }
      appendFileSync(
        WORKFLOW_ENV,
        `\nCATENOR_INTERNAL_API_TOKEN_VAR=${randomBytes(32).toString('hex')}\n`,
      );
      credentials.CATENOR_INTERNAL_API_TOKEN_VAR = 'GENERATED';
    }
    say('external credentials (values never printed)', credentials);
    const cre = run(env('CRE_BIN') || join(homedir(), '.cre/bin/cre'), ['whoami']);
    const creLogin =
      cre.status === 0 ? 'LOGGED IN' : 'NOT LOGGED IN (needed only for CRE deployment)';
    say('CRE CLI session', creLogin);

    if (!env('DEMO_INSTANCE')) {
      setState({
        DEMO_INSTANCE: `c1-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`,
      });
    }
    say('instance', env('DEMO_INSTANCE'));

    const railwayUrl = railwayDatabaseUrl();
    let databaseUrl: string;
    let database: string;
    if (railwayUrl) {
      // The deployed backend's PostgreSQL, through the Railway TCP proxy (the private *.railway.internal host is
      // reachable only from inside Railway).
      let host = '';
      try {
        const u = new URL(railwayUrl);
        if (u.protocol === 'postgres:' || u.protocol === 'postgresql:') host = u.hostname;
      } catch {
        // reported below without echoing the value
      }
      if (!host || host.endsWith('.railway.internal')) {
        console.error(
          `BLOCKED: ${RAILWAY_DB} in apps/api/.env must be the Postgres service's DATABASE_PUBLIC_URL (TCP proxy), not the private URL — value not printed`,
        );
        process.exit(2);
      }
      databaseUrl = railwayUrl;
      database = 'RAILWAY PostgreSQL (the deployed backend database, via its public TCP proxy)';
    } else {
      // Local PostgreSQL (container reused when present).
      const docker = run('docker', ['info', '--format', '{{.ServerVersion}}']);
      if (docker.status !== 0) {
        console.error('BLOCKED: Docker is not running (needed for the local PostgreSQL)');
        process.exit(2);
      }
      const inspect = run('docker', ['inspect', '-f', '{{.State.Running}}', PG_CONTAINER]);
      if (inspect.status !== 0) {
        const password = randomBytes(18).toString('hex');
        const started = run('docker', [
          'run',
          '-d',
          '--name',
          PG_CONTAINER,
          '-e',
          `POSTGRES_PASSWORD=${password}`,
          '-e',
          'POSTGRES_DB=catenor',
          '-p',
          `127.0.0.1:${PG_PORT}:5432`,
          '-v',
          `${PG_VOLUME}:/var/lib/postgresql/data`,
          PG_IMAGE,
        ]);
        if (started.status !== 0) {
          console.error('BLOCKED: could not start the PostgreSQL container');
          process.exit(2);
        }
        setRuntime({
          DEMO_DATABASE_URL: `postgresql://postgres:${password}@127.0.0.1:${PG_PORT}/catenor`,
        });
      } else if (inspect.stdout.trim() !== 'true') {
        run('docker', ['start', PG_CONTAINER]);
      }
      if (!env('DEMO_DATABASE_URL')) {
        console.error(
          `BLOCKED: ${PG_CONTAINER} exists but DEMO_DATABASE_URL is unknown — run 02-reset-local-demo.sh --yes`,
        );
        process.exit(2);
      }
      for (let i = 0; i < 30; i++) {
        if (run('docker', ['exec', PG_CONTAINER, 'pg_isready', '-U', 'postgres']).status === 0) {
          break;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
      databaseUrl = env('DEMO_DATABASE_URL');
      database = `LOCAL PostgreSQL ${PG_IMAGE} on 127.0.0.1:${PG_PORT}`;
    }
    const migrate = spawnSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
      cwd: join(ROOT, 'apps/api'),
      encoding: 'utf8',
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });
    if (migrate.status !== 0) {
      console.error('BLOCKED: prisma migrate deploy failed');
      console.error(
        `${migrate.stdout}\n${migrate.stderr}`
          .slice(-1500)
          .replace(/postgres(ql)?:\/\/[^@\s]+@/g, 'postgresql://***@'),
      );
      process.exit(2);
    }
    const applied = /(\d+) migrations? found/.exec(migrate.stdout)?.[1] ?? '?';
    if (railwayUrl) {
      // A clean-room instance starts on an empty database; re-running 01 for the same instance is fine.
      const rows = await catenorRowCount(railwayUrl);
      if (rows > 0 && env('DEMO_DATABASE_URL') !== railwayUrl) {
        console.error(
          `BLOCKED: the Railway database already holds ${rows} Catenor rows from another instance — a new instance needs a fresh (empty) Railway database`,
        );
        process.exit(2);
      }
      setRuntime({ DEMO_DATABASE_URL: railwayUrl });
      setState({ DEMO_DATABASE: 'RAILWAY' });
      database = `${database}; ${rows} Catenor rows`;
    } else {
      setState({ DEMO_DATABASE: 'LOCAL' });
    }
    say('database', `${database}; ${applied} migrations; up to date`);
    const missing = Object.entries(credentials).filter(
      ([, v]) => v === 'MISSING' || v === 'INVALID',
    );
    return {
      credentials,
      creLogin,
      instance: env('DEMO_INSTANCE'),
      database: railwayUrl ? 'RAILWAY PostgreSQL' : `LOCAL PostgreSQL (${PG_IMAGE})`,
      migrations: applied,
      ready: missing.length === 0,
      ...(missing.length ? { maintainerMustProvide: missing.map(([k]) => k) } : {}),
    };
  },
};

export const resetLocal: Stage = {
  id: '02-reset-local-demo',
  title: 'Reset LOCAL demo state (public blockchain / sponsor state is NOT reverted)',
  actor: 'Maintainer (local machine)',
  operation: 'none (local cleanup)',
  changes: [
    `removes the local PostgreSQL container ${PG_CONTAINER} and its volume ${PG_VOLUME}`,
    'moves .catenor-demo/state.env and runtime.env aside (*.bak-<time>) — nothing is deleted outright',
    'keeps ~/.catenor-one/clean-room/<instance>/ owner keys (they control live Privy wallets/policies)',
    `Railway PostgreSQL (${RAILWAY_DB} set): never touched — only its Catenor row count is shown`,
  ],
  sponsors: ['none'],
  mode: 'LOCAL',
  expected: 'local state gone; a fresh 01-setup-env.sh starts a new instance',
  async run(_ctx, flags) {
    const railwayUrl = railwayDatabaseUrl();
    const railwayRows = railwayUrl ? await catenorRowCount(railwayUrl) : 0;
    const remains = [
      'Hedera Testnet: every transaction, token, balance and account stays on the public ledger (HashScan / Mirror Node)',
      'Privy development app: the wallets, policies and key quorums created by this instance stay (owner keys in ~/.catenor-one/clean-room/)',
      'Sumsub sandbox: the synthetic applicants stay in the sandbox',
      'CRE: a deployed workflow stays deployed until `cre workflow pause|delete` (scripts/demo/cre/)',
    ];
    if (railwayUrl) {
      say(
        'Railway PostgreSQL',
        `${railwayRows} Catenor rows — NOT touched${railwayRows > 0 ? '; a new instance needs a fresh Railway database' : ''}`,
      );
    }
    if (!flags.yes) {
      say('DRY RUN', 'nothing removed — re-run with --yes');
      say('what a reset does NOT undo', remains);
      return { reset: false, remains };
    }
    const instance = env('DEMO_INSTANCE');
    run('docker', ['rm', '-f', PG_CONTAINER]);
    run('docker', ['volume', 'rm', PG_VOLUME]);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    for (const f of [STATE_ENV, RUNTIME_ENV]) if (existsSync(f)) renameSync(f, `${f}.bak-${stamp}`);
    say('removed', `${PG_CONTAINER} + ${PG_VOLUME}; state files moved aside in ${DEMO_DIR}`);
    say('kept (controls live sponsor resources)', instance ? ownerKeyDir(instance) : 'n/a');
    say('what a reset does NOT undo', remains);
    return {
      reset: true,
      previousInstance: instance || null,
      ...(railwayUrl ? { railwayRows } : {}),
      remains,
    };
  },
};
