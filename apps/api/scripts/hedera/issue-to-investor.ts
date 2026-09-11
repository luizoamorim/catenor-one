// Final demo FD-4 — ONE issueByPartition to ONE named investor on the rehearsal ATS equity, signed by the Privy SPV
// wallet under its Privy issuance rule. No raw-key executor. No retry.
//
//   pnpm --filter @catenor-one/api issue:investor A              # preflight only (READ-ONLY + Privy dry signature)
//   pnpm --filter @catenor-one/api issue:investor A --broadcast  # exactly one live transaction (maintainer-authorized)
//
// Before: SPV nonce, equity totalSupply, holder balance (READ-ONLY). Broadcast: prepare → Privy eth_signTransaction →
// signer boundary → hashio → receipt. After: status SUCCESS, holder balance, totalSupply, SPV nonce + 1, fee.
import { IAsset__factory } from '@hashgraph/asset-tokenization-contracts';
import { PrivyClient } from '@privy-io/node';
import { JsonRpcProvider, formatEther } from 'ethers';
import {
  HEDERA_TESTNET,
  asRunner,
} from '../../src/infrastructure/execution/hedera-ats-executor.js';
import { PrivySpvAtsExecutor } from '../../src/infrastructure/execution/privy-spv-ats-executor.js';
import { DEMO_INVESTORS, REHEARSAL_EQUITY } from '../demo/final-demo-config.js';

const which = process.argv[2];
const broadcast = process.argv.includes('--broadcast');
if (which !== 'A' && which !== 'B') {
  console.error('usage: issue:investor <A|B> [--broadcast]');
  process.exit(2);
}
const investor = DEMO_INVESTORS[which];

process.loadEnvFile(new URL('../../.env', import.meta.url));
const env = (name: string) => process.env[name] ?? '';
const executor = PrivySpvAtsExecutor.fromEnv(
  new PrivyClient({ appId: env('PRIVY_APP_ID'), appSecret: env('PRIVY_APP_SECRET') }),
);
if (!executor) {
  console.error('BLOCKED: PRIVY_SPV_* values missing in apps/api/.env (values are never printed)');
  process.exit(2);
}
const provider = new JsonRpcProvider(HEDERA_TESTNET.rpcUrl);
const equity = IAsset__factory.connect(REHEARSAL_EQUITY, asRunner(provider));
const spv = executor.operatorAddress;
const state = async () => {
  const [nonce, spvBalance, totalSupply, holderBalance] = await Promise.all([
    provider.getTransactionCount(spv, 'latest'),
    provider.getBalance(spv),
    equity.totalSupply(),
    equity.balanceOf(investor.address),
  ]);
  return { nonce, spvBalance, totalSupply, holderBalance };
};

const before = await state();
const input = {
  equity: REHEARSAL_EQUITY,
  tokenHolder: investor.address,
  amount: investor.issueUnits,
};
const prepared = await executor.prepareIssueByPartition(input);
await executor.signPrepared(prepared); // dry signature through the signer boundary; discarded
const t = prepared.transaction;
const summary = {
  operation: 'IAsset.issueByPartition({partition: 0x…01, tokenHolder, value, data: 0x})',
  investor: investor.label,
  token: REHEARSAL_EQUITY,
  holder: investor.address,
  amount: String(investor.issueUnits),
  chainId: t.chain_id,
  sender: `${spv} (Privy SPV wallet)`,
  gasLimit: t.gas_limit,
  estimatedGas: String(prepared.estimatedGas),
  before: {
    spvNonce: before.nonce,
    spvBalanceHbar: formatEther(before.spvBalance),
    totalSupply: String(before.totalSupply),
    holderBalance: String(before.holderBalance),
  },
};
if (!broadcast) {
  console.log(JSON.stringify({ label: 'PREFLIGHT — nothing broadcast', ...summary }, null, 2));
  process.exit(0);
}

const result = await executor.issueByPartition(input); // exactly one attempt
const [receipt, after] = await Promise.all([
  provider.getTransactionReceipt(result.transactionId),
  state(),
]);
const mirror = (await (
  await fetch(
    `https://testnet.mirrornode.hedera.com/api/v1/contracts/results/${result.transactionId}`,
  )
).json()) as Record<string, unknown>;
const checks = {
  receiptSuccess: receipt?.status === 1,
  holderBalanceIncreasedByAmount:
    after.holderBalance - before.holderBalance === investor.issueUnits,
  totalSupplyIncreasedByAmount: after.totalSupply - before.totalSupply === investor.issueUnits,
  spvNonceIncrementedByOne: after.nonce === before.nonce + 1,
  mirrorNodeSuccess: mirror['result'] === 'SUCCESS',
};
console.log(
  JSON.stringify(
    {
      label: 'LIVE — one issueByPartition broadcast (Hedera Testnet)',
      ...summary,
      transaction: result.transactionId,
      hashscan: result.explorerUrl,
      gasUsed: String(receipt?.gasUsed),
      gasPriceWeibar: String(receipt?.gasPrice),
      actualCostHbar: formatEther(before.spvBalance - after.spvBalance),
      after: {
        spvNonce: after.nonce,
        spvBalanceHbar: formatEther(after.spvBalance),
        totalSupply: String(after.totalSupply),
        holderBalance: String(after.holderBalance),
      },
      mirrorNode: {
        result: mirror['result'],
        gasUsed: mirror['gas_used'],
        timestamp: mirror['timestamp'],
      },
      checks,
    },
    null,
    2,
  ),
);
process.exit(Object.values(checks).every(Boolean) ? 0 : 1);
