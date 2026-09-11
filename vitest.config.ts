import { defineConfig } from 'vitest/config';

// Resolve workspace packages to their TypeScript sources during tests (see package.json "exports").
const conditions = ['@catenor-one/source', 'module', 'node', 'development|production'];

export default defineConfig({
  resolve: { conditions },
  ssr: { resolve: { conditions } },
  test: {
    environment: 'node',
    include: ['packages/*/src/**/*.test.ts', 'test-vectors/src/**/*.test.ts'],
  },
});
