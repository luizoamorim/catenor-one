// Clean-room demo state (git-ignored, local only). Nothing here is authority: the signed documents and the audit chain
// live in the local PostgreSQL; these files only let separate stage processes find what earlier stages created.
//
//   .catenor-demo/state.env     public refs (DIDs, addresses, Privy wallet/policy/quorum ids, public keys, tx hashes)
//   .catenor-demo/runtime.env   runtime secrets (runtime-signer authorization keys, DB URL, CRE trigger key) — 0600,
//                               never printed
//   .catenor-demo/runs/         sanitized evidence of each stage run (what the judge inspects)
//   ~/.catenor-one/clean-room/<instance>/   management-owner private keys (0600) — never loaded into the runtime
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../../../../', import.meta.url));
export const DEMO_DIR = join(ROOT, '.catenor-demo');
export const STATE_ENV = join(DEMO_DIR, 'state.env');
export const RUNTIME_ENV = join(DEMO_DIR, 'runtime.env');
export const RUNS_DIR = join(DEMO_DIR, 'runs');
export const API_ENV = join(ROOT, 'apps/api/.env');
export const WORKFLOWS = join(ROOT, 'workflows/');
export const WORKFLOW_ENV = join(WORKFLOWS, '.env');
export const BOOTSTRAP_CONFIG_FILE = join(DEMO_DIR, 'bootstrap-configuration.json');

export function ownerKeyDir(instance: string): string {
  return join(homedir(), '.catenor-one', 'clean-room', instance);
}

/** Parses KEY=value lines (no expansion); quotes are stripped. */
export function parseEnvFile(file: string): Record<string, string> {
  if (!existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]!] = m[2]!.trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

/** Sets (or replaces) KEY=value entries, keeping every other line. Runtime files stay 0600. */
export function upsertEnv(file: string, entries: Record<string, string>, secret = false): void {
  mkdirSync(DEMO_DIR, { recursive: true, mode: 0o700 });
  const lines = existsSync(file)
    ? readFileSync(file, 'utf8')
        .split('\n')
        .filter((l) => l !== '')
    : [];
  for (const [k, v] of Object.entries(entries)) {
    if (!/^[A-Z0-9_]+$/.test(k) || /[\n\r]/.test(v)) throw new Error(`invalid env entry ${k}`);
    const i = lines.findIndex((l) => l.startsWith(`${k}=`));
    if (i === -1) lines.push(`${k}=${v}`);
    else lines[i] = `${k}=${v}`;
  }
  writeFileSync(file, `${lines.join('\n')}\n`, { mode: secret ? 0o600 : 0o644 });
  if (secret) chmodSync(file, 0o600);
}

export const setState = (entries: Record<string, string>) => {
  upsertEnv(STATE_ENV, entries);
  Object.assign(process.env, entries);
};
export const setRuntime = (entries: Record<string, string>) => {
  upsertEnv(RUNTIME_ENV, entries, true);
  Object.assign(process.env, entries);
};

/** state.env, runtime.env and apps/api/.env into process.env (clean-room values take precedence). */
export function loadEnvironment(): void {
  for (const [k, v] of Object.entries({
    ...parseEnvFile(API_ENV),
    ...parseEnvFile(STATE_ENV),
    ...parseEnvFile(RUNTIME_ENV),
  })) {
    process.env[k] = v;
  }
}

export const env = (name: string): string => process.env[name] ?? '';

/** A value an earlier stage must have written; exits with a clear pointer when it is missing. */
export function need(name: string, producedBy: string): string {
  const v = env(name);
  if (!v) {
    console.error(`BLOCKED: ${name} is not set — run ${producedBy} first`);
    process.exit(2);
  }
  return v;
}

/** A value of workflows/.env read by this process only (never printed). */
export function workflowSecret(name: string): string {
  return parseEnvFile(WORKFLOW_ENV)[name] ?? '';
}

/** Writes a sanitized evidence record for this stage run and returns its path. */
export function writeRun(stage: string, record: unknown): string {
  mkdirSync(RUNS_DIR, { recursive: true });
  const file = join(RUNS_DIR, `${stage}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(
    file,
    `${JSON.stringify(record, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2)}\n`,
  );
  return file;
}
