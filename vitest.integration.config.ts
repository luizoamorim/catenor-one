import { defineConfig } from 'vitest/config';

// Integration tests: real PostgreSQL through Testcontainers (Docker required). Run with `pnpm test:integration`.
const conditions = ['@catenor-one/source', 'module', 'node', 'development|production'];

export default defineConfig({
  resolve: { conditions },
  ssr: { resolve: { conditions } },
  test: {
    environment: 'node',
    include: ['apps/*/src/**/*.int.test.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 300_000,
  },
});
