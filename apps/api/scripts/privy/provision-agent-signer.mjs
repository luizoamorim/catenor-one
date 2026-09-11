#!/usr/bin/env node
// Final demo FD-5 — Distribution Agent signer infrastructure (pre-seeded). Creates real Privy resources:
//   - 2 P-256 authorization keys, generated here in memory: Agent management owner · Agent runtime signer;
//   - 1 key quorum holding the Agent runtime-signer public key.
// It does NOT create the Agent wallet or its policy: the CREATE DISTRIBUTION AGENT action creates both LIVE, from
// public values only (PRIVY_AGENT_OWNER_PUBLIC_KEY, PRIVY_AGENT_RUNTIME_QUORUM_ID). Distinct from every S001, SPV and
// investor key (Credential Assertion Key ≠ Financial Execution Key; no key reuse).
//
//   node --env-file=apps/api/.env apps/api/scripts/privy/provision-agent-signer.mjs
//
// Secrets: the two private keys are written ONCE to a file OUTSIDE the repository (default
// ~/.catenor-one/agent-privy-authorization-keys.json, mode 0600; refuses to overwrite). Nothing secret is printed.
// The management-owner key stays in maintainer custody; the runtime-signer key is needed only when the Agent signs a
// payout (CATENOR_AGENT_RUNTIME_AUTHORIZATION_KEY, git-ignored apps/api/.env / Railway sealed variable).
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { PrivyClient } from '@privy-io/node';

const out =
  process.env.CATENOR_AGENT_KEYS_FILE ??
  join(homedir(), '.catenor-one', 'agent-privy-authorization-keys.json');
const missing = ['PRIVY_APP_ID', 'PRIVY_APP_SECRET'].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`BLOCKED: missing ${missing.join(', ')} (values are never printed)`);
  process.exit(2);
}
if (existsSync(out)) {
  console.error(`REFUSED: ${out} already exists — existing keys are never overwritten`);
  process.exit(2);
}
if (out.startsWith(process.cwd())) {
  console.error('REFUSED: the key file must live outside the repository');
  process.exit(2);
}

const privy = new PrivyClient({
  appId: process.env.PRIVY_APP_ID,
  appSecret: process.env.PRIVY_APP_SECRET,
});

function p256() {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
  };
}

const keys = { agentManagementOwner: p256(), agentRuntimeSigner: p256() };

// Persist the private keys before creating anything that depends on them.
mkdirSync(dirname(out), { recursive: true, mode: 0o700 });
writeFileSync(
  out,
  `${JSON.stringify(
    {
      warning:
        'SECRET — Catenor One Distribution Agent Privy authorization private keys. Never commit or share.',
      createdAt: new Date().toISOString(),
      privyAppId: process.env.PRIVY_APP_ID,
      custody: {
        agentManagementOwner: 'maintainer custody only — never Railway, repo or runtime',
        agentRuntimeSigner:
          'CATENOR_AGENT_RUNTIME_AUTHORIZATION_KEY (git-ignored .env / Railway sealed)',
      },
      keys,
    },
    null,
    2,
  )}\n`,
  { mode: 0o600, flag: 'wx' },
);

const quorum = await privy.keyQuorums().create({
  public_keys: [keys.agentRuntimeSigner.publicKey],
  authorization_threshold: 1,
  display_name: 'catenor-one-distribution-agent-runtime-signer',
});

console.log(`Private keys written to ${out} (mode 0600). Nothing secret is printed below.

# Public, non-secret configuration — apps/api/.env and Railway (plain variables)
PRIVY_AGENT_OWNER_PUBLIC_KEY=${keys.agentManagementOwner.publicKey}
PRIVY_AGENT_RUNTIME_QUORUM_ID=${quorum.id}

# Secret — copy from the key file only when the Agent must sign a payout; never paste into chat or commit:
#   CATENOR_AGENT_RUNTIME_AUTHORIZATION_KEY = keys.agentRuntimeSigner.privateKey
# Keep keys.agentManagementOwner.privateKey offline (maintainer custody).`);
