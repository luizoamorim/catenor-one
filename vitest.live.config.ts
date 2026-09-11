import { defineConfig } from 'vitest/config';

// LIVE sponsor tests (opt-in; they call real sandbox/dev services and need maintainer-provisioned values in
// the git-ignored apps/api/.env). Run with `pnpm test:privy-live` / `pnpm test:cre-sim`. Never part of `pnpm check` or CI.
const conditions = ['@catenor-one/source', 'module', 'node', 'development|production'];

export default defineConfig({
  resolve: { conditions },
  ssr: { resolve: { conditions } },
  test: {
    environment: 'node',
    include: ['apps/*/src/**/*.live.test.ts'],
    testTimeout: 300_000,
    hookTimeout: 300_000,
    fileParallelism: false,
  },
});
