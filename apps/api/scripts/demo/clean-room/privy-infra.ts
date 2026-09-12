// Clean-room Privy signer infrastructure (development app). Same custody pattern as the maintainer scripts under
// scripts/privy/, with the generated values written automatically instead of printed for copy/paste:
//   management-owner P-256 private key → ~/.catenor-one/clean-room/<instance>/<name>.json (0600, refuses overwrite)
//   runtime-signer P-256 private key   → .catenor-demo/runtime.env (0600)
//   public key, key-quorum id          → .catenor-demo/state.env
// Nothing secret is printed.
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PrivyClient } from '@privy-io/node';
import { base58 } from '@scure/base';
import { ROOT, ownerKeyDir, setRuntime, setState } from './state.js';

export function p256() {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
  };
}

/** Writes one management-owner private key to its own 0600 file outside the repository. */
export function saveOwnerKey(instance: string, name: string, privateKey: string): string {
  const dir = ownerKeyDir(instance);
  const file = join(dir, `${name}.json`);
  if (file.startsWith(ROOT)) throw new Error('owner keys must live outside the repository');
  if (existsSync(file)) {
    throw new Error(`${file} already exists — owner keys are never overwritten`);
  }
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(
    file,
    `${JSON.stringify(
      {
        warning:
          'SECRET — Catenor One clean-room management-owner authorization key. Never commit or share.',
        custody: 'maintainer only — never runtime env, repository or logs',
        createdAt: new Date().toISOString(),
        privateKey,
      },
      null,
      2,
    )}\n`,
    { mode: 0o600, flag: 'wx' },
  );
  return file;
}

/** Reads a management-owner key back (maintainer-run owner-authorized steps only). */
export function readOwnerKey(instance: string, name: string): string {
  return (
    JSON.parse(readFileSync(join(ownerKeyDir(instance), `${name}.json`), 'utf8')) as {
      privateKey: string;
    }
  ).privateKey;
}

/**
 * One signer: management owner (file) + runtime signer (runtime.env) + key quorum. Env names:
 *   <PREFIX>_OWNER_PUBLIC_KEY, <PREFIX>_RUNTIME_QUORUM_ID (state) · <PREFIX>_RUNTIME_AUTHORIZATION_KEY (runtime).
 */
export async function provisionSigner(
  privy: PrivyClient,
  instance: string,
  prefix: string,
  displayName: string,
): Promise<{ ownerPublicKey: string; runtimeSignerQuorumId: string; ownerKeyFile: string }> {
  const owner = p256();
  const runtime = p256();
  const ownerKeyFile = saveOwnerKey(instance, `${prefix.toLowerCase()}-owner`, owner.privateKey);
  setRuntime({ [`${prefix}_RUNTIME_AUTHORIZATION_KEY`]: runtime.privateKey });
  const quorum = await privy.keyQuorums().create({
    public_keys: [runtime.publicKey],
    authorization_threshold: 1,
    display_name: displayName,
  });
  setState({
    [`${prefix}_OWNER_PUBLIC_KEY`]: owner.publicKey,
    [`${prefix}_RUNTIME_QUORUM_ID`]: quorum.id,
  });
  return { ownerPublicKey: owner.publicKey, runtimeSignerQuorumId: quorum.id, ownerKeyFile };
}

const signMessageOnly = [
  {
    name: 'allow-signMessage',
    method: 'signMessage' as const,
    conditions: [],
    action: 'ALLOW' as const,
  },
  {
    name: 'deny-exportPrivateKey',
    method: 'exportPrivateKey' as const,
    conditions: [],
    action: 'DENY' as const,
  },
  {
    name: 'deny-exportSeedPhrase',
    method: 'exportSeedPhrase' as const,
    conditions: [],
    action: 'DENY' as const,
  },
];

/**
 * S001 signer infrastructure for this Trust Domain (same as scripts/privy/provision-s001-signers.mjs): the Credential
 * Assertion signer (quorum + P_ASSERT; wallets created per Subject at runtime) and the separate Bootstrap Endorsement
 * Key wallet (P_BOOTSTRAP). Returns the bootstrap public key as Multikey.
 */
export async function provisionS001Signers(privy: PrivyClient, instance: string) {
  const assertion = await provisionSigner(
    privy,
    instance,
    'DEMO_ASSERTION',
    'catenor-one-clean-room-assertion',
  );
  const bootstrap = await provisionSigner(
    privy,
    instance,
    'DEMO_BOOTSTRAP',
    'catenor-one-clean-room-bootstrap',
  );
  const pAssert = await privy.policies().create({
    version: '1.0',
    name: 'catenor-one-clean-room-P_ASSERT',
    chain_type: 'solana',
    owner: { public_key: assertion.ownerPublicKey },
    rules: signMessageOnly,
  });
  const pBootstrap = await privy.policies().create({
    version: '1.0',
    name: 'catenor-one-clean-room-P_BOOTSTRAP',
    chain_type: 'solana',
    owner: { public_key: bootstrap.ownerPublicKey },
    rules: signMessageOnly,
  });
  const wallet = await privy.wallets().create({
    chain_type: 'solana',
    owner: { public_key: bootstrap.ownerPublicKey },
    policy_ids: [pBootstrap.id],
    additional_signers: [
      { signer_id: bootstrap.runtimeSignerQuorumId, override_policy_ids: [pBootstrap.id] },
    ],
  });
  setState({
    DEMO_ASSERTION_POLICY_ID: pAssert.id,
    DEMO_BOOTSTRAP_POLICY_ID: pBootstrap.id,
    DEMO_BOOTSTRAP_WALLET_ID: wallet.id,
  });
  return {
    bootstrapMultikey: `z${base58.encode(Uint8Array.from([0xed, 0x01, ...base58.decode(wallet.address)]))}`,
    ownerKeyFiles: [assertion.ownerKeyFile, bootstrap.ownerKeyFile],
  };
}

/** An investor's receiving-only EVM wallet: its own owner key (file), no signer, no policy (it only receives). */
export async function provisionReceivingWallet(
  privy: PrivyClient,
  instance: string,
  label: 'A' | 'B',
) {
  const owner = p256();
  const ownerKeyFile = saveOwnerKey(
    instance,
    `investor-${label.toLowerCase()}-owner`,
    owner.privateKey,
  );
  const wallet = await privy
    .wallets()
    .create({ chain_type: 'ethereum', owner: { public_key: owner.publicKey } });
  return { walletId: wallet.id, address: wallet.address, ownerKeyFile };
}
