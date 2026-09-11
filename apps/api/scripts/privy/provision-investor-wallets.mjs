#!/usr/bin/env node
// Final demo investor receiving wallets (FINAL-DEMO §1, prompt 2026-09-11-012). Creates real Privy resources:
//   - 2 P-256 owner authorization keys, generated here in memory — one per investor (Investor A, Investor B);
//   - 2 Privy EVM wallets, each owned by its own key. No additional signers and no policies: the Catenor runtime
//     holds no key for these wallets and cannot sign anything with them. They are receiving accounts only.
//
//   node --env-file=apps/api/.env apps/api/scripts/privy/provision-investor-wallets.mjs
//
// Needs PRIVY_APP_ID and PRIVY_APP_SECRET (Privy DEVELOPMENT app). The two owner private keys are written ONCE to a
// file OUTSIDE the repository (default ~/.catenor-one/investor-privy-owner-keys.json, mode 0600; refuses to
// overwrite) and are never printed — maintainer custody, never Railway, the repo or the runtime. Only public values
// (addresses, wallet ids) are printed. No key export is requested.
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { PrivyClient } from '@privy-io/node';

const out =
  process.env.CATENOR_INVESTOR_KEYS_FILE ??
  join(homedir(), '.catenor-one', 'investor-privy-owner-keys.json');
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

const keys = { investorAOwner: p256(), investorBOwner: p256() };

// Persist the private keys before creating anything that depends on them.
mkdirSync(dirname(out), { recursive: true, mode: 0o700 });
writeFileSync(
  out,
  `${JSON.stringify(
    {
      warning: 'SECRET — Catenor One final-demo investor wallet owner keys. Never commit or share.',
      createdAt: new Date().toISOString(),
      privyAppId: process.env.PRIVY_APP_ID,
      custody: 'maintainer custody only — never Railway, repo or runtime',
      keys,
    },
    null,
    2,
  )}\n`,
  { mode: 0o600, flag: 'wx' },
);

const wallets = {};
for (const [label, key] of [
  ['A', keys.investorAOwner],
  ['B', keys.investorBOwner],
]) {
  const wallet = await privy.wallets().create({
    chain_type: 'ethereum',
    owner: { public_key: key.publicKey },
  });
  const readBack = await privy.wallets().get(wallet.id);
  if (
    readBack.address !== wallet.address ||
    readBack.policy_ids.length !== 0 ||
    readBack.additional_signers.length !== 0 ||
    !readBack.owner_id
  ) {
    throw new Error(`Investor ${label} wallet read-back does not match the receiving-only shape`);
  }
  wallets[label] = { id: wallet.id, address: wallet.address };
}
if (wallets.A.address.toLowerCase() === wallets.B.address.toLowerCase()) {
  throw new Error('Investor A and Investor B wallets must be distinct');
}

console.log(`Owner keys written to ${out} (mode 0600). Nothing secret is printed below.

# Public, non-secret values (receiving-only Privy EVM wallets; owner = maintainer-held key; no signer, no policy)
INVESTOR_A_WALLET_ID=${wallets.A.id}
INVESTOR_A_ADDRESS=${wallets.A.address}
INVESTOR_B_WALLET_ID=${wallets.B.id}
INVESTOR_B_ADDRESS=${wallets.B.address}`);
