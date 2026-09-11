/**
 * Package boundaries — PLAN §2.3 (S001). Enforced in CI (`pnpm boundaries`).
 *
 *   packages/audit        → (none)
 *   packages/identity     → (none)
 *   packages/policy       → audit
 *   packages/credentials  → identity, audit
 *   packages/authority    → identity, credentials, policy, audit
 *
 * Domain packages are framework- and vendor-independent: besides the allowed sibling packages they may
 * only use the vendor-neutral crypto/encoding libraries approved in D17. Test files are exempt.
 */
const DOMAIN = '^packages/(audit|identity|policy|credentials|authority)/src/';
const TESTS = '\\.test(-fixtures)?\\.ts$';
const TEST_KEYS = '^test-vectors/(src|dist)/test-keys\\.';
const ALLOWED_THIRD_PARTY = 'node_modules/(@noble/curves|@noble/hashes|@scure/base|canonicalize)/';

const onlyMayUse = (pkg, allowed) => ({
  name: `${pkg}-dependency-direction`,
  comment: `packages/${pkg} may only depend on: ${allowed.length ? allowed.join(', ') : '(no sibling packages)'} (PLAN §2.3)`,
  severity: 'error',
  from: { path: `^packages/${pkg}/src/`, pathNot: TESTS },
  to: {
    path: '^(packages|test-vectors)/',
    pathNot: [`^packages/${pkg}/`, ...allowed.map((a) => `^packages/${a}/`)],
  },
});

module.exports = {
  forbidden: [
    {
      name: 'not-to-unresolvable',
      comment: 'Every import must resolve (pnpm links only declared dependencies)',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'no-undeclared-dependencies',
      comment: "Imported npm packages must be declared in the importing package's package.json",
      severity: 'error',
      from: { pathNot: TESTS },
      to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown'] },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    onlyMayUse('audit', []),
    onlyMayUse('identity', []),
    onlyMayUse('policy', ['audit']),
    onlyMayUse('credentials', ['identity', 'audit']),
    onlyMayUse('authority', ['identity', 'credentials', 'policy', 'audit']),
    {
      name: 'domain-no-vendor-or-framework',
      comment:
        'Domain packages must not import frameworks or vendor SDKs (NestJS, Prisma, Privy, Chainlink, Sumsub, viem, …); only the D17 crypto/encoding libraries are allowed',
      severity: 'error',
      from: { path: DOMAIN, pathNot: TESTS },
      to: { path: 'node_modules/', pathNot: ALLOWED_THIRD_PARTY },
    },
    {
      name: 'domain-no-apps-or-workflows',
      severity: 'error',
      from: { path: '^(packages|test-vectors)/' },
      to: { path: '^(apps|workflows)/' },
    },
    {
      name: 'test-vectors-only-from-tests',
      comment:
        'Golden vectors are consumed by tests, never by domain, app or workflow runtime code',
      severity: 'error',
      from: { path: `${DOMAIN}|^(apps|workflows)/`, pathNot: TESTS },
      to: { path: '^test-vectors/' },
    },
    {
      name: 'test-keys-only-from-tests-and-vector-scripts',
      comment:
        'TEST-ONLY, NON-SECRET golden keys: only test files and scripts/vectors/ may import them — never a production package, app, adapter or workflow (maintainer decision 2026-09-11)',
      severity: 'error',
      from: { pathNot: [TESTS, '^scripts/vectors/', TEST_KEYS] },
      to: { path: TEST_KEYS },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: {
      path: [
        '^(packages/[^/]+|test-vectors|apps/[^/]+)/(dist|coverage)/',
        // Prisma-generated client (git-ignored, vendor-generated; contains internal import cycles)
        '^apps/api/src/infrastructure/persistence/prisma/generated/',
      ],
    },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['@catenor-one/source', 'import', 'types', 'default'],
      extensions: ['.ts', '.js', '.json'],
    },
  },
};
