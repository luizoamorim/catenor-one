// Read-only database readiness probe for the Railway API (prompt 024): is PostgreSQL reachable, and how many of the
// packaged migrations are applied? Never migrates, never writes. The Prisma client is loaded and connected on the
// first probe only, so the API boots without a database and without a generated client being exercised.
import { readdirSync } from 'node:fs';
import type { PrismaClient } from './generated/client.js';

export interface DatabaseProbeResult {
  readonly database: 'REACHABLE' | 'UNREACHABLE';
  readonly migrations?: { readonly applied: number; readonly packaged: number };
}

export interface DatabaseProbe {
  probe(): Promise<DatabaseProbeResult>;
  close(): Promise<void>;
}

const MIGRATIONS_DIR = new URL('../../../../prisma/migrations/', import.meta.url);

/** Migration directories shipped with this build (Prisma's `<14-digit timestamp>_<name>` layout). */
export function packagedMigrationCount(dir: URL = MIGRATIONS_DIR): number {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter(
      (e) => e.isDirectory() && /^\d{14}_[a-z0-9_]+$/.test(e.name),
    ).length;
  } catch {
    return 0;
  }
}

export function createDatabaseProbe(databaseUrl: string): DatabaseProbe {
  let client: Promise<PrismaClient> | undefined;
  const connect = () =>
    (client ??= import('./prisma-persistence.js').then((m) => m.createPrismaClient(databaseUrl)));
  return {
    async probe() {
      try {
        const db = await connect();
        await db.$queryRaw`SELECT 1`;
        const table = await db.$queryRaw<{ schema: string }[]>`
          SELECT n.nspname AS schema FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relname = '_prisma_migrations' AND c.relkind = 'r' LIMIT 1`;
        const schema = table[0]?.schema;
        let applied = 0;
        if (schema !== undefined && /^[a-z_][a-z0-9_]*$/.test(schema)) {
          const rows = await db.$queryRawUnsafe<{ n: number }[]>(
            `SELECT count(*)::int AS n FROM "${schema}"."_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
          );
          applied = rows[0]?.n ?? 0;
        }
        return {
          database: 'REACHABLE',
          migrations: { applied, packaged: packagedMigrationCount() },
        };
      } catch {
        return { database: 'UNREACHABLE' };
      }
    },
    async close() {
      if (client) await (await client).$disconnect();
    },
  };
}
