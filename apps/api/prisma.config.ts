// Prisma 7 configuration (TASKS T3.2). The connection string comes only from the environment
// (Railway internal DATABASE_URL in deployment, a Testcontainers URL in integration tests); it is never
// committed. Commands that need no database (validate, generate) work without it.
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env['DATABASE_URL'] },
});
