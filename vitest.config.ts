import { defineConfig } from 'vitest/config';

// Resolve workspace packages to their TypeScript sources during tests (see package.json "exports").
const conditions = ['@catenor-one/source', 'module', 'node', 'development|production'];

export default defineConfig({
  resolve: { conditions },
  ssr: { resolve: { conditions } },
  test: {
    environment: 'node',
    include: [
      'packages/*/src/**/*.test.ts',
      'test-vectors/src/**/*.test.ts',
      'apps/*/src/**/*.test.ts',
      'workflows/*/test/unit/**/*.test.ts',
    ],
    // Integration tests need Docker (`pnpm test:integration`); live sponsor tests are opt-in (`pnpm test:privy-live`).
    exclude: ['**/node_modules/**', '**/*.int.test.ts', '**/*.live.test.ts'],
  },
});
