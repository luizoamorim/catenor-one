#!/usr/bin/env node
// Final demo CP8 — adds the TWO dividend-lifecycle rules to the SPV Privy policy. Run BY THE MAINTAINER only: it uses
// the SPV management-owner authorization key, which never enters the Catenor runtime (same pattern as
// add-spv-issuance-rule.mjs).
//
//   node --env-file=apps/api/.env apps/api/scripts/privy/add-spv-lifecycle-rules.mjs            # dry run (default)
//   node --env-file=apps/api/.env apps/api/scripts/privy/add-spv-lifecycle-rules.mjs --apply    # add the rules
//
// Rules added (function-level restriction CONFIRMED live by privy-engineer, CP8 probe, 2026-09-11):
//   allow-grantRole-corporate-action-spv:
//     ALLOW eth_signTransaction iff chain_id == 296 ∧ to == the rehearsal equity ∧ function == grantRole
//                                  ∧ grantRole._role == ROLE_CORPORATE_ACTION ∧ grantRole._account == the SPV wallet
//   allow-setDividend-rehearsal-equity:
//     ALLOW eth_signTransaction iff chain_id == 296 ∧ to == the rehearsal equity ∧ function == setDividend
//     (Privy does not enforce the uint8 amountDecimals tuple field — CP8 — so the Catenor signer boundary builds and
//     checks the exact setDividend terms.)
// initializeDividend is NOT allowed: the ATS Factory already initialized dividends at deployment (hedera-engineer, CP8).
// The existing rules (deployEquity via the ATS Factory; issueByPartition; export denied) are left unchanged.
//
// Key handling: the management-owner private key is read from the key file OUTSIDE the repository
// (default ~/.catenor-one/spv-execution-privy-authorization-keys.json, override CATENOR_SPV_KEYS_FILE) and is passed
// only to the Privy SDK's authorization_context (request signing). It is never printed or written anywhere.
import { createPrivateKey, createPublicKey } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { IAsset__factory } from '@hashgraph/asset-tokenization-contracts';
import { PrivyClient } from '@privy-io/node';

const EQUITY = '0x7aeDA4b6B89dA392Efd88AD0Fcb075e12ab6a418';
const SPV = '0x6c6AD33BA7FB4DA58A1b7412706f8ECB10Ba9C93';
const ROLE_CORPORATE_ACTION = '0xa1acfc499025c99f55059195e6276f639d34a18aad7b8121b9192b7f438c55cd';
const EXISTING = [
  'allow-signTx-hedera-factory',
  'allow-issueByPartition-rehearsal-equity',
  'deny-exportPrivateKey',
  'deny-exportSeedPhrase',
];
const GRANT_RULE = 'allow-grantRole-corporate-action-spv';
const DIVIDEND_RULE = 'allow-setDividend-rehearsal-equity';
const apply = process.argv.includes('--apply');

const keyFile =
  process.env.CATENOR_SPV_KEYS_FILE ??
  join(homedir(), '.catenor-one', 'spv-execution-privy-authorization-keys.json');
const missing = [
  'PRIVY_APP_ID',
  'PRIVY_APP_SECRET',
  'PRIVY_SPV_POLICY_ID',
  'PRIVY_SPV_OWNER_PUBLIC_KEY',
  'PRIVY_SPV_WALLET_ADDRESS',
].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`BLOCKED: missing ${missing.join(', ')} (values are never printed)`);
  process.exit(2);
}
if (keyFile.startsWith(process.cwd())) {
  console.error('REFUSED: the key file must live outside the repository');
  process.exit(2);
}
if (process.env.PRIVY_SPV_WALLET_ADDRESS.toLowerCase() !== SPV.toLowerCase()) {
  console.error('REFUSED: PRIVY_SPV_WALLET_ADDRESS is not the rehearsal SPV wallet');
  process.exit(2);
}

// The exact ABI fragments the probe verified; they must match the ATS v8 package.
const GRANT_ABI = [
  {
    type: 'function',
    name: 'grantRole',
    stateMutability: 'nonpayable',
    inputs: [
      { internalType: 'bytes32', name: '_role', type: 'bytes32' },
      { internalType: 'address', name: '_account', type: 'address' },
    ],
    outputs: [{ internalType: 'bool', name: 'success_', type: 'bool' }],
  },
];
const DIVIDEND_ABI = [
  {
    type: 'function',
    name: 'setDividend',
    stateMutability: 'nonpayable',
    inputs: [
      {
        internalType: 'struct IDividendTypes.Dividend',
        name: 'newDividend',
        type: 'tuple',
        components: [
          { internalType: 'uint256', name: 'recordDate', type: 'uint256' },
          { internalType: 'uint256', name: 'executionDate', type: 'uint256' },
          { internalType: 'uint256', name: 'amount', type: 'uint256' },
          { internalType: 'uint8', name: 'amountDecimals', type: 'uint8' },
        ],
      },
    ],
    outputs: [{ internalType: 'uint256', name: 'dividendId_', type: 'uint256' }],
  },
];
const iface = IAsset__factory.createInterface();
if (
  iface.getFunction('grantRole')?.format('sighash') !== 'grantRole(bytes32,address)' ||
  iface.getFunction('setDividend')?.format('sighash') !==
    'setDividend((uint256,uint256,uint256,uint8))'
) {
  console.error('REFUSED: the ATS package lifecycle signatures differ from the verified ABI');
  process.exit(2);
}

const base = [
  { field_source: 'ethereum_transaction', field: 'chain_id', operator: 'eq', value: '296' },
  { field_source: 'ethereum_transaction', field: 'to', operator: 'eq', value: EQUITY },
];
const rules = [
  {
    name: GRANT_RULE,
    method: 'eth_signTransaction',
    action: 'ALLOW',
    conditions: [
      ...base,
      {
        field_source: 'ethereum_calldata',
        field: 'function_name',
        abi: GRANT_ABI,
        operator: 'eq',
        value: 'grantRole',
      },
      {
        field_source: 'ethereum_calldata',
        field: 'grantRole._role',
        abi: GRANT_ABI,
        operator: 'eq',
        value: ROLE_CORPORATE_ACTION,
      },
      {
        field_source: 'ethereum_calldata',
        field: 'grantRole._account',
        abi: GRANT_ABI,
        operator: 'eq',
        value: SPV,
      },
    ],
  },
  {
    name: DIVIDEND_RULE,
    method: 'eth_signTransaction',
    action: 'ALLOW',
    conditions: [
      ...base,
      {
        field_source: 'ethereum_calldata',
        field: 'function_name',
        abi: DIVIDEND_ABI,
        operator: 'eq',
        value: 'setDividend',
      },
    ],
  },
];

const privy = new PrivyClient({
  appId: process.env.PRIVY_APP_ID,
  appSecret: process.env.PRIVY_APP_SECRET,
});
const policyId = process.env.PRIVY_SPV_POLICY_ID;
const strip = (conditions) => conditions.map(({ abi: _abi, ...c }) => c);
const summary = (p) =>
  p.rules.map((r) => ({
    name: r.name,
    method: r.method,
    action: r.action,
    conditions: strip(r.conditions),
  }));

// Preconditions: exactly the CP4 rule set (no lifecycle rule yet, nothing else).
const before = await privy.policies().get(policyId);
const names = before.rules.map((r) => r.name).sort();
if (names.includes(GRANT_RULE) && names.includes(DIVIDEND_RULE)) {
  console.log('Nothing to do: the lifecycle rules are already present.');
  console.log(JSON.stringify(summary(before), null, 2));
  process.exit(0);
}
if (
  before.chain_type !== 'ethereum' ||
  JSON.stringify(names) !== JSON.stringify([...EXISTING].sort())
) {
  console.error(
    'REFUSED: the SPV policy is not in the expected CP4 shape — inspect it before changing it',
  );
  console.error(JSON.stringify(names));
  process.exit(1);
}

// The key in the file must be the configured owner (PRIVY_SPV_OWNER_PUBLIC_KEY); compared without printing either.
let ownerPrivateKey;
try {
  ownerPrivateKey = JSON.parse(readFileSync(keyFile, 'utf8')).keys.spvManagementOwner.privateKey;
} catch {
  console.error(`BLOCKED: cannot read keys.spvManagementOwner.privateKey from ${keyFile}`);
  process.exit(2);
}
const derivedPublic = createPublicKey(
  createPrivateKey({ key: Buffer.from(ownerPrivateKey, 'base64'), format: 'der', type: 'pkcs8' }),
)
  .export({ type: 'spki', format: 'der' })
  .toString('base64');
if (derivedPublic !== process.env.PRIVY_SPV_OWNER_PUBLIC_KEY) {
  console.error('REFUSED: the key file owner key does not match PRIVY_SPV_OWNER_PUBLIC_KEY');
  process.exit(1);
}

console.log(
  `SPV policy ${policyId}: preconditions OK (CP4 shape; owner key matches; no lifecycle rule yet).`,
);
console.log('Rules to add:');
console.log(
  JSON.stringify(
    rules.map((r) => ({ ...r, conditions: strip(r.conditions) })),
    null,
    2,
  ),
);
if (!apply) {
  console.log('\nDRY RUN — nothing changed. Re-run with --apply to add the rules.');
  process.exit(0);
}

for (const rule of rules) {
  await privy.policies().createRule(policyId, {
    ...rule,
    authorization_context: { authorization_private_keys: [ownerPrivateKey] },
  });
}
const after = await privy.policies().get(policyId);
const afterNames = after.rules.map((r) => r.name).sort();
if (
  JSON.stringify(afterNames) !== JSON.stringify([...EXISTING, GRANT_RULE, DIVIDEND_RULE].sort())
) {
  console.error(
    'FAIL: read-back does not show exactly the 4 previous rules + the 2 lifecycle rules',
  );
  process.exit(1);
}
console.log('\nAPPLIED. Policy rules as stored by Privy:');
console.log(JSON.stringify(summary(after), null, 2));
