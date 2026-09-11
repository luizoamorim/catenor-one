// Final demo preflight for the live ATS deployEquity signed by the Privy SPV wallet (FD-3). NEVER broadcasts.
//
//   pnpm --filter @catenor-one/api preflight:spv
//
// Reads apps/api/.env (values never printed). Checks, in order:
//   1. Privy: the SPV wallet exists at PRIVY_SPV_WALLET_ADDRESS, has exactly the SPV policy attached, and its runtime
//      access is the SPV runtime-signer quorum scoped by that policy (override_policy_ids);
//   2. Privy: the SPV policy's rules are exactly the approved ones (chain 296 + ATS Factory only; export denied);
//   3. Hedera (READ-ONLY): chain 296, SPV balance/nonce, eth_call + eth_estimateGas of the exact deployEquity from the
//      SPV address, balance ≥ gasLimit × gasPrice;
//   4. Privy dry signatures (discarded, never sent): the prepared transaction is signed by the runtime-signer key and
//      passes the signer boundary; wrong chain, wrong target and a plain transfer are denied by the policy.
import { PrivyClient } from '@privy-io/node';
import { formatEther, keccak256 } from 'ethers';
import { HEDERA_TESTNET } from '../../src/infrastructure/execution/hedera-ats-executor.js';
import {
  PrivySpvAtsExecutor,
  privyEvmSigningApi,
} from '../../src/infrastructure/execution/privy-spv-ats-executor.js';

const ENV = new URL('../../.env', import.meta.url);
process.loadEnvFile(ENV);
const env = (name: string) => process.env[name] ?? '';
const required = [
  'PRIVY_APP_ID',
  'PRIVY_APP_SECRET',
  'PRIVY_SPV_WALLET_ID',
  'PRIVY_SPV_WALLET_ADDRESS',
  'PRIVY_SPV_POLICY_ID',
  'PRIVY_SPV_RUNTIME_QUORUM_ID',
  'CATENOR_SPV_RUNTIME_AUTHORIZATION_KEY',
];
const missing = required.filter((n) => env(n) === '');
if (missing.length) {
  console.error(
    `BLOCKED: missing ${missing.join(', ')} in apps/api/.env (values are never printed)`,
  );
  process.exit(2);
}

const client = new PrivyClient({ appId: env('PRIVY_APP_ID'), appSecret: env('PRIVY_APP_SECRET') });
const executor = PrivySpvAtsExecutor.fromEnv(client)!;
const api = privyEvmSigningApi(client);
const policyId = env('PRIVY_SPV_POLICY_ID');
const failures: string[] = [];
const check = (name: string, ok: boolean) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failures.push(name);
};
const lower = (s: string) => s.toLowerCase();

console.log('1. Privy SPV wallet (development app)');
const wallet = await client.wallets().get(env('PRIVY_SPV_WALLET_ID'));
check('chain_type ethereum', wallet.chain_type === 'ethereum');
check(
  'address = PRIVY_SPV_WALLET_ADDRESS',
  lower(wallet.address) === lower(env('PRIVY_SPV_WALLET_ADDRESS')),
);
check(
  'owner set (management-owner key quorum)',
  typeof wallet.owner_id === 'string' && wallet.owner_id !== '',
);
check(
  'policy_ids = [SPV policy]',
  JSON.stringify(wallet.policy_ids) === JSON.stringify([policyId]),
);
check(
  'only additional signer = SPV runtime quorum, override_policy_ids = [SPV policy]',
  JSON.stringify(wallet.additional_signers) ===
    JSON.stringify([
      { signer_id: env('PRIVY_SPV_RUNTIME_QUORUM_ID'), override_policy_ids: [policyId] },
    ]),
);

console.log('2. Privy SPV policy rules');
const policy = await client.policies().get(policyId);
// FD-4 / CP8 add the issuance and lifecycle rules (maintainer scripts); the deployEquity rules must stay as approved.
const rules = policy.rules
  .filter(
    (r) =>
      ![
        'allow-issueByPartition-rehearsal-equity',
        'allow-grantRole-corporate-action-spv',
        'allow-setDividend-rehearsal-equity',
      ].includes(r.name),
  )
  .map((r) => ({
    method: r.method,
    action: r.action,
    conditions: r.conditions.map((c) => ({
      field_source: c.field_source,
      field: 'field' in c ? c.field : undefined,
      operator: c.operator,
      value: lower(String(c.value)),
    })),
  }));
const expectedRules = [
  {
    method: 'eth_signTransaction',
    action: 'ALLOW',
    conditions: [
      { field_source: 'ethereum_transaction', field: 'chain_id', operator: 'eq', value: '296' },
      {
        field_source: 'ethereum_transaction',
        field: 'to',
        operator: 'eq',
        value: lower(HEDERA_TESTNET.factory),
      },
    ],
  },
  { method: 'exportPrivateKey', action: 'DENY', conditions: [] },
  { method: 'exportSeedPhrase', action: 'DENY', conditions: [] },
];
check('chain_type ethereum', policy.chain_type === 'ethereum');
check('owner = the wallet owner (management-owner key)', policy.owner_id === wallet.owner_id);
check(
  'deployEquity rules exactly: ALLOW eth_signTransaction iff chain 296 ∧ to = ATS Factory; DENY exports (+ only the FD-4 issuance and CP8 lifecycle rules)',
  JSON.stringify(rules) === JSON.stringify(expectedRules),
);

console.log('3. Hedera testnet (READ-ONLY)');
// The live run embeds the real Catenor grant id; this placeholder has the same shape (nodeIds: prefix + UUID).
const prepared = await executor.prepareDeployEquity({
  resource: 'spv:catenor-demo-001',
  grantId: 'capability-grant:00000000-0000-4000-8000-000000000000',
});
check(
  'eth_call from the SPV address returns an equity address',
  /^0x[0-9a-fA-F]{40}$/.test(prepared.simulatedEquityAddress),
);
check('balance ≥ gasLimit × gasPrice', prepared.balanceWeibar >= prepared.maxCostWeibar);

console.log('4. Privy dry signatures (discarded; nothing is broadcast)');
const raw = await executor.signPrepared(prepared);
check(
  'prepared deployEquity signed by the runtime signer and passes the signer boundary',
  raw.length > 0,
);
const denied = async (name: string, tx: Parameters<typeof api.signTransaction>[1]) => {
  try {
    await api.signTransaction(
      env('PRIVY_SPV_WALLET_ID'),
      tx,
      env('CATENOR_SPV_RUNTIME_AUTHORIZATION_KEY'),
    );
    check(`${name} → DENIED`, false);
  } catch (e) {
    check(
      `${name} → DENIED (${(e as { status?: number }).status ?? 'error'})`,
      (e as { status?: number }).status === 400,
    );
  }
};
await denied('same transaction, chain_id 1', { ...prepared.transaction, chain_id: 1 });
await denied('same transaction, to = Business Logic Resolver', {
  ...prepared.transaction,
  to: HEDERA_TESTNET.businessLogicResolver,
});
await denied('plain value transfer', {
  ...prepared.transaction,
  to: HEDERA_TESTNET.businessLogicResolver,
  data: '0x',
});

const t = prepared.transaction;
console.log(
  `\n${JSON.stringify(
    {
      label: 'PREFLIGHT — READ-ONLY + Privy dry signatures; NOTHING BROADCAST',
      walletAddress: prepared.from,
      balanceHbar: formatEther(prepared.balanceWeibar),
      nonce: t.nonce,
      atsFactory: t.to,
      chainId: t.chain_id,
      operation: 'Factory.deployEquity(equityData, regulationData)',
      calldataBytes: (t.data.length - 2) / 2,
      calldataKeccak256: keccak256(t.data),
      simulatedEquityAddress: prepared.simulatedEquityAddress,
      estimatedGas: String(prepared.estimatedGas),
      gasLimit: t.gas_limit,
      gasPriceWeibar: String(BigInt(t.gas_price)),
      maxHbarRequirement: formatEther(prepared.maxCostWeibar),
      estimatedHbarCost: formatEther(prepared.estimatedGas * BigInt(t.gas_price)),
      policyId,
      failures,
    },
    null,
    2,
  )}`,
);
process.exit(failures.length === 0 ? 0 : 1);
