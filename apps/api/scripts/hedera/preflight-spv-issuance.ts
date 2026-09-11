// Final demo preflight for issueByPartition → Investor A and Investor B (FD-4). NEVER broadcasts.
//
//   pnpm --filter @catenor-one/api preflight:issuance
//
// Reads apps/api/.env (values never printed). For each investor: READ-ONLY eth_call + eth_estimateGas of the exact,
// Catenor-built issueByPartition from the SPV wallet (ROLE_ISSUER on the equity), then a Privy dry signature
// (discarded, never sent) through the signer boundary. Before the maintainer's policy update the SPV policy must DENY
// the issuance (it only allows the ATS Factory); after it, the signature must pass. It also checks that the SPV policy
// has no chain-only ALLOW rule, and after the update that grantRole and a non-default partition are still denied.
import { PrivyClient } from '@privy-io/node';
import { formatEther } from 'ethers';
import { IAsset__factory } from '@hashgraph/asset-tokenization-contracts';
import { ATS, HEDERA_TESTNET } from '../../src/infrastructure/execution/hedera-ats-executor.js';
import {
  PrivySpvAtsExecutor,
  privyEvmSigningApi,
} from '../../src/infrastructure/execution/privy-spv-ats-executor.js';
import { DEMO_INVESTORS, REHEARSAL_EQUITY } from '../demo/final-demo-config.js';

process.loadEnvFile(new URL('../../.env', import.meta.url));
const env = (name: string) => process.env[name] ?? '';
const client = new PrivyClient({ appId: env('PRIVY_APP_ID'), appSecret: env('PRIVY_APP_SECRET') });
const executor = PrivySpvAtsExecutor.fromEnv(client);
if (!executor || !env('PRIVY_SPV_POLICY_ID')) {
  console.error('BLOCKED: PRIVY_SPV_* values missing in apps/api/.env (values are never printed)');
  process.exit(2);
}
const lower = (s: unknown) => String(s).toLowerCase();

const policy = await client.policies().get(env('PRIVY_SPV_POLICY_ID'));
const allowRules = policy.rules.filter((r) => r.action === 'ALLOW');
const conditionOn = (r: (typeof policy.rules)[number], field: string) =>
  r.conditions.find((c) => 'field' in c && c.field === field);
const chainOnly = allowRules.filter((r) => !conditionOn(r, 'to'));
const issuanceRule = allowRules.find(
  (r) =>
    r.method === 'eth_signTransaction' &&
    lower(conditionOn(r, 'chain_id')?.value) === '296' &&
    lower(conditionOn(r, 'to')?.value) === lower(REHEARSAL_EQUITY),
);
console.log(
  JSON.stringify(
    {
      policy: policy.id,
      rules: policy.rules.map((r) => ({
        name: r.name,
        method: r.method,
        action: r.action,
        conditions: r.conditions,
      })),
      noChainOnlyAllowRule: chainOnly.length === 0,
      issuanceRulePresent: issuanceRule !== undefined,
      issuanceRuleFunctionRestricted:
        issuanceRule?.conditions.some((c) => c.field_source === 'ethereum_calldata') ?? false,
    },
    null,
    2,
  ),
);
if (chainOnly.length > 0) {
  console.error('FAIL: the SPV policy has an ALLOW rule without a target restriction');
  process.exit(1);
}

let failures = 0;
for (const investor of Object.values(DEMO_INVESTORS)) {
  const prepared = await executor.prepareIssueByPartition({
    equity: REHEARSAL_EQUITY,
    tokenHolder: investor.address,
    amount: investor.issueUnits,
  });
  const price = BigInt(prepared.transaction.gas_price);
  let privySignature: string;
  try {
    await executor.signPrepared(prepared); // discarded — never broadcast
    privySignature = 'SIGNED (dry) — passes the signer boundary; discarded';
    if (!issuanceRule) failures++; // the current policy should not allow it yet
  } catch (e) {
    const status = (e as { status?: number }).status;
    privySignature =
      status === 400
        ? 'DENIED by the current Privy policy (policy_violation)'
        : `ERROR ${status ?? ''} ${(e as Error).message.slice(0, 120)}`;
    if (issuanceRule || status !== 400) failures++;
  }
  console.log(
    JSON.stringify(
      {
        label: `PREFLIGHT ${investor.label} — READ-ONLY + Privy dry signature; NOTHING BROADCAST`,
        operation: 'IAsset.issueByPartition({partition: 0x…01, tokenHolder, value, data: 0x})',
        from: `${prepared.from} (Privy SPV wallet, ROLE_ISSUER)`,
        to: `${prepared.transaction.to} (ATS equity)`,
        chainId: prepared.transaction.chain_id,
        tokenHolder: investor.address,
        units: String(investor.issueUnits),
        ethCall: 'accepted (no revert)',
        estimatedGas: String(prepared.estimatedGas),
        gasLimit: prepared.transaction.gas_limit,
        gasPriceWeibar: String(price),
        estimatedHbar: formatEther(prepared.estimatedGas * price),
        maxHbar: formatEther(prepared.maxCostWeibar),
        spvBalanceHbar: formatEther(prepared.balanceWeibar),
        nonce: prepared.transaction.nonce,
        privySignature,
        explorer: `${HEDERA_TESTNET.explorer}/contract/${REHEARSAL_EQUITY}`,
      },
      null,
      2,
    ),
  );
}
if (issuanceRule) {
  // After the maintainer update: the new rule must be function- and partition-restricted.
  const api = privyEvmSigningApi(client);
  const sample = await executor.prepareIssueByPartition({
    equity: REHEARSAL_EQUITY,
    tokenHolder: DEMO_INVESTORS.A.address,
    amount: DEMO_INVESTORS.A.issueUnits,
  });
  const asset = IAsset__factory.createInterface();
  const cases: [string, string][] = [
    [
      'grantRole on the equity',
      asset.encodeFunctionData('grantRole', [ATS.issuerRole, DEMO_INVESTORS.A.address]),
    ],
    [
      'issueByPartition on partition 0x…02',
      asset.encodeFunctionData('issueByPartition', [
        {
          partition: `0x${'0'.repeat(63)}2`,
          tokenHolder: DEMO_INVESTORS.A.address,
          value: 1n,
          data: '0x',
        },
      ]),
    ],
  ];
  for (const [name, data] of cases) {
    try {
      await api.signTransaction(
        env('PRIVY_SPV_WALLET_ID'),
        { ...sample.transaction, data },
        env('CATENOR_SPV_RUNTIME_AUTHORIZATION_KEY'),
      );
      console.log(`FAIL  ${name} → SIGNED (the issuance rule is too broad)`);
      failures++;
    } catch (e) {
      const status = (e as { status?: number }).status;
      console.log(`${status === 400 ? 'PASS' : 'FAIL'}  ${name} → DENIED (${status ?? 'error'})`);
      if (status !== 400) failures++;
    }
  }
}
process.exit(failures === 0 ? 0 : 1);
