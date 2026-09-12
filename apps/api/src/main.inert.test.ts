// Inert startup guard (prompt 024): everything the Railway entrypoint can load — statically or through a lazy
// import — must be free of sponsor SDKs and of the application services that create demo state. If this fails, a
// change made Railway startup (or one of its routes) able to reach Privy, Sumsub, Hedera/ATS, the CRE gateway or
// simulator, or a protocol service; move that code behind the local stage runner instead.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(SRC, 'main.ts');

const FORBIDDEN_FILES = [
  /^modules\//,
  /^infrastructure\/(key-management|identity-providers|execution|runtime)\//,
  /^infrastructure\/confidential-compute\/cre-(gateway|simulation)-verifier\.ts$/,
  /^infrastructure\/confidential-compute\/fake-confidential-verifier\.ts$/,
];
const FORBIDDEN_PACKAGES = [
  /^@privy-io\//,
  /^@hashgraph\//,
  /^ethers$/,
  /^node:child_process$/,
  /^@catenor-one\/authority$/,
];

/** Runtime imports of one file: `import … from`, `export … from`, side-effect and dynamic imports (not `import type`). */
function importsOf(source: string): string[] {
  const out: string[] = [];
  const staticRe = /^\s*(?:import|export)\s+(type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/gm;
  for (const m of source.matchAll(staticRe)) if (!m[1]) out.push(m[2]!);
  for (const m of source.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push(m[1]!);
  return out;
}

function reachable() {
  const files = new Set<string>();
  const packages = new Set<string>();
  const queue = [ENTRY];
  while (queue.length) {
    const file = queue.pop()!;
    if (files.has(file)) continue;
    files.add(file);
    for (const spec of importsOf(readFileSync(file, 'utf8'))) {
      if (!spec.startsWith('.')) {
        packages.add(spec);
        continue;
      }
      const target = join(dirname(file), spec.replace(/\.js$/, '.ts'));
      if (target.includes('/prisma/generated/')) continue; // vendor-generated Prisma client
      if (existsSync(target)) queue.push(target);
    }
  }
  return { files: [...files].map((f) => relative(SRC, f)), packages: [...packages] };
}

describe('Railway entrypoint is operationally inert', () => {
  const graph = reachable();

  it('reaches the HTTP server, the CRE relay/channel and the read-only DB probe only', () => {
    expect(graph.files).toContain('infrastructure/http/api-server.ts');
    expect(graph.files).toContain('infrastructure/confidential-compute/cre-callback-relay.ts');
    expect(graph.files).toContain('infrastructure/persistence/prisma/database-probe.ts');
    expect(graph.files.filter((f) => FORBIDDEN_FILES.some((re) => re.test(f)))).toEqual([]);
  });

  it('loads no sponsor SDK, no process spawning and no protocol authority service', () => {
    expect(graph.packages.filter((p) => FORBIDDEN_PACKAGES.some((re) => re.test(p)))).toEqual([]);
  });
});
