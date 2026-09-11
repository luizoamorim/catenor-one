#!/usr/bin/env node
// Final demo FD-4 — adds ONE issuance rule to the SPV Privy policy. Run BY THE MAINTAINER only: it uses the SPV
// management-owner authorization key, which never enters the Catenor runtime.
//
//   node --env-file=apps/api/.env apps/api/scripts/privy/add-spv-issuance-rule.mjs            # dry run (default)
//   node --env-file=apps/api/.env apps/api/scripts/privy/add-spv-issuance-rule.mjs --apply    # add the rule
//
// Rule added (function-level restriction CONFIRMED live by privy-engineer, CP4 probe, 2026-09-11):
//   ALLOW eth_signTransaction iff chain_id == 296
//                                ∧ to == the rehearsal ATS equity 0x7aeDA4b6B89dA392Efd88AD0Fcb075e12ab6a418
//                                ∧ calldata function == issueByPartition
//                                ∧ issueByPartition._issueData.partition == 0x…01 (the single default partition)
// The existing rules (deployEquity via the ATS Factory; export denied) are left unchanged. There is no chain-only rule.
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
const ATS_FACTORY = '0xd1F118A40f3b02883D35909eF2517e7EDd78379d';
const DEFAULT_PARTITION = `0x${'0'.repeat(63)}1`;
const RULE_NAME = 'allow-issueByPartition-rehearsal-equity';
const apply = process.argv.includes('--apply');

const keyFile =
  process.env.CATENOR_SPV_KEYS_FILE ??
  join(homedir(), '.catenor-one', 'spv-execution-privy-authorization-keys.json');
const missing = [
  'PRIVY_APP_ID',
  'PRIVY_APP_SECRET',
  'PRIVY_SPV_POLICY_ID',
  'PRIVY_SPV_OWNER_PUBLIC_KEY',
].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`BLOCKED: missing ${missing.join(', ')} (values are never printed)`);
  process.exit(2);
}
if (keyFile.startsWith(process.cwd())) {
  console.error('REFUSED: the key file must live outside the repository');
  process.exit(2);
}

// The exact ABI fragment the probe verified; it must match the ATS v8 package's issueByPartition.
const ISSUE_ABI = [
  {
    type: 'function',
    name: 'issueByPartition',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: '_issueData',
        type: 'tuple',
        components: [
          { name: 'partition', type: 'bytes32' },
          { name: 'tokenHolder', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'data', type: 'bytes' },
        ],
      },
    ],
    outputs: [],
  },
];
const packaged = IAsset__factory.createInterface().getFunction('issueByPartition');
if (packaged?.format('sighash') !== 'issueByPartition((bytes32,address,uint256,bytes))') {
  console.error(
    'REFUSED: the ATS package issueByPartition signature differs from the verified ABI',
  );
  process.exit(2);
}

const rule = {
  name: RULE_NAME,
  method: 'eth_signTransaction',
  action: 'ALLOW',
  conditions: [
    { field_source: 'ethereum_transaction', field: 'chain_id', operator: 'eq', value: '296' },
    { field_source: 'ethereum_transaction', field: 'to', operator: 'eq', value: EQUITY },
    {
      field_source: 'ethereum_calldata',
      field: 'function_name',
      abi: ISSUE_ABI,
      operator: 'eq',
      value: 'issueByPartition',
    },
    {
      field_source: 'ethereum_calldata',
      field: 'issueByPartition._issueData.partition',
      abi: ISSUE_ABI,
      operator: 'eq',
      value: DEFAULT_PARTITION,
    },
  ],
};

const privy = new PrivyClient({
  appId: process.env.PRIVY_APP_ID,
  appSecret: process.env.PRIVY_APP_SECRET,
});
const policyId = process.env.PRIVY_SPV_POLICY_ID;
const lower = (v) => String(v).toLowerCase();

// Preconditions: the policy is the CP1 SPV policy, unchanged, and does not already have the rule.
const before = await privy.policies().get(policyId);
const summary = (p) =>
  p.rules.map((r) => ({
    name: r.name,
    method: r.method,
    action: r.action,
    conditions: r.conditions,
  }));
if (before.rules.some((r) => r.name === RULE_NAME)) {
  console.log('Nothing to do: the issuance rule is already present.');
  console.log(JSON.stringify(summary(before), null, 2));
  process.exit(0);
}
const factoryRule = before.rules.find(
  (r) => r.method === 'eth_signTransaction' && r.action === 'ALLOW',
);
const expectedShape =
  before.chain_type === 'ethereum' &&
  before.rules.length === 3 &&
  factoryRule?.conditions.some((c) => c.field === 'to' && lower(c.value) === lower(ATS_FACTORY)) &&
  before.rules.some((r) => r.method === 'exportPrivateKey' && r.action === 'DENY') &&
  before.rules.some((r) => r.method === 'exportSeedPhrase' && r.action === 'DENY');
if (!expectedShape) {
  console.error(
    'REFUSED: the SPV policy is not in the expected CP1 shape — inspect it before changing it',
  );
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
  `SPV policy ${policyId}: preconditions OK (CP1 shape; owner key matches; no issuance rule yet).`,
);
console.log('Rule to add:');
console.log(
  JSON.stringify({ ...rule, conditions: rule.conditions.map(({ abi: _abi, ...c }) => c) }, null, 2),
);
if (!apply) {
  console.log('\nDRY RUN — nothing changed. Re-run with --apply to add the rule.');
  process.exit(0);
}

await privy.policies().createRule(policyId, {
  ...rule,
  authorization_context: { authorization_private_keys: [ownerPrivateKey] },
});
const after = await privy.policies().get(policyId);
const added = after.rules.find((r) => r.name === RULE_NAME);
if (!added || after.rules.length !== 4) {
  console.error('FAIL: read-back does not show exactly the 3 previous rules + the issuance rule');
  process.exit(1);
}
console.log('\nAPPLIED. Policy rules as stored by Privy:');
console.log(
  JSON.stringify(
    summary(after).map((r) => ({ ...r, conditions: r.conditions.map(({ abi: _abi, ...c }) => c) })),
    null,
    2,
  ),
);
