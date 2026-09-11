// Final demo CP9 — ATS dividend lifecycle on the rehearsal equity, signed by the Privy SPV wallet. One step per run,
// one attempt, no retry, no raw-key executor. Without --broadcast every step is READ-ONLY.
//
//   pnpm --filter @catenor-one/api lifecycle:dividend grant [--broadcast]   # grantRole(ROLE_CORPORATE_ACTION, SPV)
//   pnpm --filter @catenor-one/api lifecycle:dividend set   [--broadcast]   # setDividend(now+120s, now+300s, 1, 2)
//   pnpm --filter @catenor-one/api lifecycle:dividend read <dividendId>     # READ-ONLY entitlements
//
// Each broadcast step checks its preconditions first (expected SPV nonce, role state) and verifies afterwards
// (receipt SUCCESS, Mirror Node SUCCESS, nonce + 1, role / DividendSet). ATS records ownership-based entitlement and
// moves no funds; Catenor decides the actual payout separately.
import { IAsset__factory } from '@hashgraph/asset-tokenization-contracts';
import { PrivyClient } from '@privy-io/node';
import { JsonRpcProvider, formatEther } from 'ethers';
import {
  ATS,
  HEDERA_TESTNET,
  asRunner,
} from '../../src/infrastructure/execution/hedera-ats-executor.js';
import { PrivySpvAtsExecutor } from '../../src/infrastructure/execution/privy-spv-ats-executor.js';
import { DEMO_DIVIDEND, DEMO_INVESTORS, REHEARSAL_EQUITY } from '../demo/final-demo-config.js';

const [step, arg] = process.argv.slice(2);
const broadcast = process.argv.includes('--broadcast');
if (step !== 'grant' && step !== 'set' && step !== 'read') {
  console.error('usage: lifecycle:dividend <grant|set|read <dividendId>> [--broadcast]');
  process.exit(2);
}
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
const iface = IAsset__factory.createInterface();
const equity = IAsset__factory.connect(REHEARSAL_EQUITY, asRunner(provider));
const spv = executor.operatorAddress;
const out = (value: unknown) =>
  console.log(JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? String(v) : v), 2));
const refuse = (why: string) => {
  console.error(`REFUSED: ${why}`);
  process.exit(1);
};

async function entitlements(id: bigint) {
  const [registered, a, b, aAmount, bAmount] = await Promise.all([
    equity.getDividend(id),
    equity.getDividendFor(id, DEMO_INVESTORS.A.address),
    equity.getDividendFor(id, DEMO_INVESTORS.B.address),
    equity.getDividendAmountFor(id, DEMO_INVESTORS.A.address),
    equity.getDividendAmountFor(id, DEMO_INVESTORS.B.address),
  ]);
  const ratio = (x: { numerator: bigint; denominator: bigint }) =>
    x.denominator === 0n ? null : Number(x.numerator) / Number(x.denominator);
  const [reg, isDisabled] = registered;
  return {
    dividendId: id,
    dividend: {
      recordDate: reg.dividend.recordDate,
      executionDate: reg.dividend.executionDate,
      amount: reg.dividend.amount,
      amountDecimals: Number(reg.dividend.amountDecimals),
      snapshotId: reg.snapshotId,
      isDisabled,
    },
    investorA: {
      tokenBalance: a.tokenBalance,
      recordDateReached: a.recordDateReached,
      entitlement: ratio(aAmount),
    },
    investorB: {
      tokenBalance: b.tokenBalance,
      recordDateReached: b.recordDateReached,
      entitlement: ratio(bAmount),
    },
  };
}

if (step === 'read') {
  if (!arg || !/^\d+$/.test(arg)) refuse('read needs a numeric dividend id');
  const e = await entitlements(BigInt(arg!));
  out({
    label: 'READ-ONLY dividend entitlements (ownership-based; ATS moves no funds)',
    ...e,
    totalEntitlement:
      e.investorA.entitlement !== null && e.investorB.entitlement !== null
        ? e.investorA.entitlement + e.investorB.entitlement
        : null,
  });
  process.exit(0);
}

const [nonceBefore, hasCorporateRole, balanceBefore, dividendsBefore] = await Promise.all([
  provider.getTransactionCount(spv, 'latest'),
  equity.hasRole(ATS.corporateActionRole, spv),
  provider.getBalance(spv),
  equity.getDividendsCount(),
]);
const expectedNonce = step === 'grant' ? 3 : 4;
if (nonceBefore !== expectedNonce) refuse(`SPV nonce is ${nonceBefore}, expected ${expectedNonce}`);
if (step === 'grant' && hasCorporateRole) refuse('the SPV already holds ROLE_CORPORATE_ACTION');
if (step === 'set' && !hasCorporateRole) refuse('the SPV does not hold ROLE_CORPORATE_ACTION yet');

const now = BigInt(Math.floor(Date.now() / 1000));
const terms = {
  recordDate: now + BigInt(DEMO_DIVIDEND.recordDelaySeconds),
  executionDate: now + BigInt(DEMO_DIVIDEND.executionDelaySeconds),
  amount: DEMO_DIVIDEND.amount,
  amountDecimals: DEMO_DIVIDEND.amountDecimals,
};
const prepared =
  step === 'grant'
    ? await executor.prepareCorporateActionRoleGrant(REHEARSAL_EQUITY)
    : await executor.prepareSetDividend(REHEARSAL_EQUITY, terms, DEMO_DIVIDEND.amountDecimals);
const summary = {
  step,
  call:
    step === 'grant'
      ? `grantRole(ROLE_CORPORATE_ACTION ${ATS.corporateActionRole}, SPV ${spv})`
      : `setDividend({recordDate: ${terms.recordDate}, executionDate: ${terms.executionDate}, amount: 1, amountDecimals: 2})`,
  from: `${spv} (Privy SPV wallet)`,
  to: REHEARSAL_EQUITY,
  chainId: prepared.transaction.chain_id,
  nonce: prepared.transaction.nonce,
  gasLimit: prepared.transaction.gas_limit,
  estimatedGas: prepared.estimatedGas,
  before: {
    nonce: nonceBefore,
    hasCorporateRole,
    dividends: dividendsBefore,
    hbar: formatEther(balanceBefore),
  },
};
if (!broadcast) {
  await executor.signPrepared(prepared); // dry signature through the signer boundary; discarded
  out({ label: 'PREFLIGHT — Privy dry signature passed; NOTHING BROADCAST', ...summary });
  process.exit(0);
}

const result = await executor.executePrepared(prepared); // exactly one attempt
const [receipt, nonceAfter, hasRoleAfter, balanceAfter] = await Promise.all([
  provider.getTransactionReceipt(result.transactionId),
  provider.getTransactionCount(spv, 'latest'),
  equity.hasRole(ATS.corporateActionRole, spv),
  provider.getBalance(spv),
]);
const mirror = (await (
  await fetch(
    `https://testnet.mirrornode.hedera.com/api/v1/contracts/results/${result.transactionId}`,
  )
).json()) as Record<string, unknown>;
const events = (receipt?.logs ?? [])
  .map((log) => {
    try {
      return iface.parseLog(log);
    } catch {
      return null;
    }
  })
  .filter((e) => e !== null);
const dividendSet = events.find((e) => e!.name === 'DividendSet');
const roleGranted = events.find((e) => e!.name === 'RoleGranted');
const checks: Record<string, boolean> = {
  receiptSuccess: receipt?.status === 1,
  mirrorNodeSuccess: mirror['result'] === 'SUCCESS',
  nonceIncrementedByOne: nonceAfter === nonceBefore + 1,
  ...(step === 'grant'
    ? { spvHoldsCorporateActionRole: hasRoleAfter, roleGrantedEvent: roleGranted !== undefined }
    : { dividendSetEvent: dividendSet !== undefined }),
};
const dividendId = dividendSet ? (dividendSet.args['dividendId'] as bigint) : undefined;
out({
  label: 'LIVE — one lifecycle transaction (Hedera Testnet)',
  ...summary,
  transaction: result.transactionId,
  hashscan: result.explorerUrl,
  gasUsed: receipt?.gasUsed,
  gasPriceWeibar: receipt?.gasPrice,
  actualCostHbar: formatEther(balanceBefore - balanceAfter),
  after: { nonce: nonceAfter, hasCorporateRole: hasRoleAfter, hbar: formatEther(balanceAfter) },
  ...(dividendSet
    ? {
        dividendSet: {
          corporateActionId: dividendSet.args['corporateActionId'],
          dividendId,
          recordDate: dividendSet.args['recordDate'],
          executionDate: dividendSet.args['executionDate'],
          amount: dividendSet.args['amount'],
          amountDecimals: Number(dividendSet.args['amountDecimals']),
        },
        readBack: await entitlements(dividendId!),
      }
    : {}),
  mirrorNode: {
    result: mirror['result'],
    gasUsed: mirror['gas_used'],
    timestamp: mirror['timestamp'],
  },
  checks,
});
process.exit(Object.values(checks).every(Boolean) ? 0 : 1);
