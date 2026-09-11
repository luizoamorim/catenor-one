#!/usr/bin/env node
// S001 Privy signer provisioning — run BY THE MAINTAINER only (TASKS T0.4, T5.2, T5.3; PLAN §13.0, D34, D36).
//
//   node --env-file=apps/api/.env apps/api/scripts/privy/provision-s001-signers.mjs
//
// Needs PRIVY_APP_ID and PRIVY_APP_SECRET (Privy DEVELOPMENT app). Creates real Privy resources:
//   - 4 P-256 authorization keys, generated here in memory:
//       assertion management-owner · assertion runtime-signer · bootstrap management-owner · bootstrap runtime-signer
//   - 2 key quorums (the two runtime-signer public keys)
//   - P_ASSERT and P_BOOTSTRAP: ALLOW signMessage; DENY exportPrivateKey, exportSeedPhrase; everything else
//     default-deny. Each policy is owned by its management-owner key.
//   - the Bootstrap Endorsement Key wallet (Solana / Ed25519): owner = bootstrap management-owner key,
//     additional signer = bootstrap runtime-signer quorum scoped by P_BOOTSTRAP.
//   The Credential Assertion Key wallet is created per candidate at runtime (U4), from PUBLIC values only.
//
// Secrets: the four private keys are written ONCE to a file OUTSIDE the repository (default
// ~/.catenor-one/s001-privy-authorization-keys.json, mode 0600; refuses to overwrite). Nothing secret is
// printed. The two management-owner keys stay in maintainer custody (never Railway, repo or runtime); the two
// runtime-signer keys go to Railway sealed variables CATENOR_ASSERTION_RUNTIME_AUTHORIZATION_KEY and
// CATENOR_BOOTSTRAP_RUNTIME_AUTHORIZATION_KEY (and to the local, git-ignored apps/api/.env for the live test).
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { PrivyClient } from '@privy-io/node';
import { base58 } from '@scure/base';

const out =
  process.env.CATENOR_PRIVY_KEYS_FILE ??
  join(homedir(), '.catenor-one', 's001-privy-authorization-keys.json');
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

const keys = {
  assertionManagementOwner: p256(),
  assertionRuntimeSigner: p256(),
  bootstrapManagementOwner: p256(),
  bootstrapRuntimeSigner: p256(),
};

// Persist the private keys before creating anything that depends on them.
mkdirSync(dirname(out), { recursive: true, mode: 0o700 });
writeFileSync(
  out,
  `${JSON.stringify(
    {
      warning: 'SECRET — Catenor One S001 Privy authorization private keys. Never commit or share.',
      createdAt: new Date().toISOString(),
      privyAppId: process.env.PRIVY_APP_ID,
      custody: {
        assertionManagementOwner: 'maintainer custody only — never Railway, repo or runtime',
        bootstrapManagementOwner: 'maintainer custody only — never Railway, repo or runtime',
        assertionRuntimeSigner: 'Railway sealed CATENOR_ASSERTION_RUNTIME_AUTHORIZATION_KEY',
        bootstrapRuntimeSigner: 'Railway sealed CATENOR_BOOTSTRAP_RUNTIME_AUTHORIZATION_KEY',
      },
      keys,
    },
    null,
    2,
  )}\n`,
  { mode: 0o600, flag: 'wx' },
);

const rules = [
  { name: 'allow-signMessage', method: 'signMessage', conditions: [], action: 'ALLOW' },
  { name: 'deny-exportPrivateKey', method: 'exportPrivateKey', conditions: [], action: 'DENY' },
  { name: 'deny-exportSeedPhrase', method: 'exportSeedPhrase', conditions: [], action: 'DENY' },
];

const assertionQuorum = await privy.keyQuorums().create({
  public_keys: [keys.assertionRuntimeSigner.publicKey],
  authorization_threshold: 1,
  display_name: 'catenor-one-s001-assertion-runtime-signer',
});
const bootstrapQuorum = await privy.keyQuorums().create({
  public_keys: [keys.bootstrapRuntimeSigner.publicKey],
  authorization_threshold: 1,
  display_name: 'catenor-one-s001-bootstrap-runtime-signer',
});
const pAssert = await privy.policies().create({
  version: '1.0',
  name: 'catenor-one-s001-P_ASSERT',
  chain_type: 'solana',
  owner: { public_key: keys.assertionManagementOwner.publicKey },
  rules,
});
const pBootstrap = await privy.policies().create({
  version: '1.0',
  name: 'catenor-one-s001-P_BOOTSTRAP',
  chain_type: 'solana',
  owner: { public_key: keys.bootstrapManagementOwner.publicKey },
  rules,
});
const bootstrapWallet = await privy.wallets().create({
  chain_type: 'solana',
  owner: { public_key: keys.bootstrapManagementOwner.publicKey },
  policy_ids: [pBootstrap.id],
  additional_signers: [{ signer_id: bootstrapQuorum.id, override_policy_ids: [pBootstrap.id] }],
});
const bootstrapMultikey =
  'z' + base58.encode(Uint8Array.from([0xed, 0x01, ...base58.decode(bootstrapWallet.address)]));

console.log(`Private keys written to ${out} (mode 0600). Nothing secret is printed below.

# Public, non-secret configuration — apps/api/.env and Railway (plain variables)
PRIVY_ASSERTION_OWNER_PUBLIC_KEY=${keys.assertionManagementOwner.publicKey}
PRIVY_ASSERTION_RUNTIME_QUORUM_ID=${assertionQuorum.id}
PRIVY_ASSERTION_POLICY_ID=${pAssert.id}
PRIVY_BOOTSTRAP_WALLET_ID=${bootstrapWallet.id}
PRIVY_BOOTSTRAP_POLICY_ID=${pBootstrap.id}

# Bootstrap Configuration (T7.1): bootstrapPublicKeyMultibase
${bootstrapMultikey}

# Secrets — copy from the key file, never paste into chat or commit:
#   CATENOR_ASSERTION_RUNTIME_AUTHORIZATION_KEY = keys.assertionRuntimeSigner.privateKey
#   CATENOR_BOOTSTRAP_RUNTIME_AUTHORIZATION_KEY = keys.bootstrapRuntimeSigner.privateKey
# Keep keys.*ManagementOwner.privateKey offline (maintainer custody).`);
