// Final demo CP10 — Distribution Agent payout preflight on the PRE-SEEDED Agent wallet. NEVER broadcasts.
//
//   pnpm --filter @catenor-one/api preflight:payout
//
// 1. Resolves the pre-seeded Agent wallet (PRIVY_AGENT_WALLET_ADDRESS) and verifies its stored Privy policy is exactly
//    the approved boundary (chain 296 ∧ to ∈ {Investor A, Investor B} ∧ value ≤ 20 HBAR; export denied; nothing else).
// 2. Catenor signer boundary: requests that differ from an approved payout are refused BEFORE Privy (zero signature
//    requests): HOLD result, another amount, non-empty calldata, a recipient other than the bound account.
// 3. Privy policy (second layer, reached here only by deliberately bypassing the Catenor boundary): recipient outside
//    A/B, value > 20 HBAR and another chain are DENIED. Agent nonce unchanged.
// The positive dry signature for Investor A comes from the real approved plan: `pnpm demo:s001 --distribution`.
import { PrivyClient } from '@privy-io/node';
import { JsonRpcProvider, formatEther, getAddress } from 'ethers';
import { HEDERA_TESTNET } from '../../src/infrastructure/execution/hedera-ats-executor.js';
import {
  PAYOUT_GAS_LIMIT,
  PayoutRefused,
  PrivyAgentPayoutExecutor,
  buildPayoutTransaction,
} from '../../src/infrastructure/execution/privy-agent-payout-executor.js';
import {
  privyEvmSigningApi,
  type NativeTransferTransaction,
} from '../../src/infrastructure/execution/privy-spv-ats-executor.js';
import { PrivyDistributionAgentProvisioner } from '../../src/infrastructure/key-management/privy-distribution-agent.js';
import type { ApprovedPayout } from '../../src/modules/distribution/application/distribution.service.js';
import { DEMO_INVESTORS } from '../demo/final-demo-config.js';

process.loadEnvFile(new URL('../../.env', import.meta.url));
const env = (name: string) => process.env[name] ?? '';
const HBAR = 10n ** 18n;
// Same explicit option as the demo (default 30,000): --payout-gas-limit=N
const gasLimit = Number(
  (process.argv.find((x) => x.startsWith('--payout-gas-limit=')) ?? '=30000').split('=')[1],
);
const CAP = 20n * HBAR;
const A = DEMO_INVESTORS.A.address;
const B = DEMO_INVESTORS.B.address;
const SPV = '0x6c6AD33BA7FB4DA58A1b7412706f8ECB10Ba9C93';
const privy = new PrivyClient({ appId: env('PRIVY_APP_ID'), appSecret: env('PRIVY_APP_SECRET') });
const provisioner = PrivyDistributionAgentProvisioner.fromEnv(privy);
if (
  !provisioner ||
  !env('PRIVY_AGENT_WALLET_ADDRESS') ||
  !env('CATENOR_AGENT_RUNTIME_AUTHORIZATION_KEY')
) {
  console.error(
    'BLOCKED: PRIVY_AGENT_* / CATENOR_AGENT_RUNTIME_AUTHORIZATION_KEY missing (values are never printed)',
  );
  process.exit(2);
}
const failures: string[] = [];
const line = (ok: boolean, text: string) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${text}`);
  if (!ok) failures.push(text);
};

console.log('1. Pre-seeded Agent wallet and Privy policy (read back)');
const wallet = await provisioner.provision({
  agentDid: 'did:catenor:00000000000000000000000000000000',
  resource: 'spv:catenor-demo-001',
  recipients: [A, B],
  maxPayoutWeibar: CAP,
});
line(
  wallet.provisioning === 'PRE_SEEDED_VERIFIED',
  'resolved and verified: policy is exactly the approved boundary',
);
const provider = new JsonRpcProvider(HEDERA_TESTNET.rpcUrl);
const [balance, nonceBefore, gasPrice] = await Promise.all([
  provider.getBalance(wallet.address),
  provider.getTransactionCount(wallet.address, 'latest'),
  provider.send('eth_gasPrice', []) as Promise<string>,
]);

console.log('2. Catenor signer boundary — refused before Privy');
const signatureRequests: string[] = [];
const privyApi = privyEvmSigningApi(privy);
const sign = async (tx: NativeTransferTransaction) => {
  signatureRequests.push(getAddress(tx.to));
  try {
    await privyApi.signTransaction(
      wallet.walletRef,
      tx,
      env('CATENOR_AGENT_RUNTIME_AUTHORIZATION_KEY'),
    );
    return 'SIGNED';
  } catch (e) {
    return (e as { status?: number }).status === 400
      ? 'DENIED'
      : `ERROR ${(e as { status?: number }).status ?? ''}`;
  }
};
// Demo plan values for the boundary checks (the real approved plan is produced by Part C of the demo command).
const approvedA: ApprovedPayout = {
  planRef: 'preflight',
  investor: 'Investor A',
  controlled: 'PAY',
  approvedWeibar: 6n * HBAR,
  boundAccount: A,
};
const heldB: ApprovedPayout = {
  ...approvedA,
  investor: 'Investor B',
  controlled: 'HOLD',
  approvedWeibar: 0n,
  boundAccount: B,
};
const chain = { nonce: nonceBefore, gasPrice };
const refusedBy = (
  approval: ApprovedPayout,
  request: { recipient: string; amountWeibar: bigint; data?: string },
) => {
  try {
    buildPayoutTransaction(approval, request, chain);
    return 'NOT_REFUSED';
  } catch (e) {
    return e instanceof PayoutRefused ? e.code : 'ERROR';
  }
};
for (const [name, approval, request, code] of [
  [
    'Investor B (plan HOLD) — no transaction constructed',
    heldB,
    { recipient: B, amountWeibar: 4n * HBAR },
    'PLAN_RESULT_NOT_PAY',
  ],
  [
    'amount 5 HBAR ≠ approved 6 HBAR',
    approvedA,
    { recipient: A, amountWeibar: 5n * HBAR },
    'AMOUNT_NOT_APPROVED',
  ],
  [
    'non-empty calldata',
    approvedA,
    { recipient: A, amountWeibar: 6n * HBAR, data: '0x12345678' },
    'CALLDATA_NOT_EMPTY',
  ],
  [
    "recipient ≠ A's bound account",
    approvedA,
    { recipient: B, amountWeibar: 6n * HBAR },
    'RECIPIENT_NOT_BOUND_ACCOUNT',
  ],
] as const) {
  line(refusedBy(approval, request) === code, `${name} → refused ${code}`);
}
line(signatureRequests.length === 0, 'zero Privy signature requests for all refused cases');

console.log(
  '3. Privy Agent policy — second layer (Catenor boundary deliberately bypassed; dry, discarded)',
);
const raw = (over: Partial<NativeTransferTransaction>): NativeTransferTransaction => ({
  chain_id: 296,
  to: A,
  data: '0x',
  value: `0x${(1n * HBAR).toString(16)}`,
  nonce: nonceBefore,
  gas_limit: PAYOUT_GAS_LIMIT,
  gas_price: gasPrice,
  type: 0,
  ...over,
});
line((await sign(raw({ to: SPV }))) === 'DENIED', 'recipient not A/B (the SPV wallet) → DENIED');
line(
  (await sign(raw({ value: `0x${(21n * HBAR).toString(16)}` }))) === 'DENIED',
  'amount 21 HBAR > 20 HBAR cap → DENIED',
);
line((await sign(raw({ chain_id: 1 }))) === 'DENIED', 'chain 1 → DENIED');
console.log(
  '4. Exact approved payout (Investor A, 6 HBAR) — Catenor boundary + Privy dry signature (discarded)',
);
const exact = buildPayoutTransaction(
  approvedA,
  { recipient: A, amountWeibar: 6n * HBAR },
  { ...chain, gasLimit },
);
line(
  exact.to === getAddress(A) && exact.data === '0x' && exact.chain_id === 296,
  'boundary PASS: plain transfer to A, empty calldata, chain 296',
);
const executor = new PrivyAgentPayoutExecutor(
  {
    walletAddress: (id) => privyApi.walletAddress(id),
    signTransaction: (id, tx, key) => {
      signatureRequests.push(getAddress(tx.to));
      return privyApi.signTransaction(id, tx, key);
    },
  },
  {
    walletId: wallet.walletRef,
    walletAddress: wallet.address,
    runtimeAuthorizationKey: env('CATENOR_AGENT_RUNTIME_AUTHORIZATION_KEY'),
  },
);
const maxCost = BigInt(exact.value) + BigInt(gasLimit) * BigInt(gasPrice);
const { recoveredFrom } = await executor.sign({
  approval: approvedA,
  from: wallet.address,
  transaction: exact,
  estimatedGas: 0n,
  balanceWeibar: balance,
  maxCostWeibar: maxCost,
});
line(
  getAddress(recoveredFrom) === wallet.address,
  `Privy dry signature SIGNED; recovers to the Agent wallet ${recoveredFrom}`,
);
// Gas for the exact payout (READ-ONLY). A first transfer to an EVM address that is not yet a Hedera account creates
// the account (HIP-583 lazy create) and costs far more than a plain transfer.
let payoutGas: bigint | undefined;
try {
  payoutGas = await provider.estimateGas({
    from: wallet.address,
    to: exact.to,
    value: BigInt(exact.value),
  });
} catch {
  payoutGas = undefined;
}
const recipientIsAccount =
  (await fetch(`https://testnet.mirrornode.hedera.com/api/v1/accounts/${exact.to}`)).status === 200;
const gasOk = payoutGas !== undefined && payoutGas <= BigInt(gasLimit);
console.log(
  `  ${gasOk ? 'PASS' : 'BLOCK'}  payout gas estimate ${payoutGas ?? 'unavailable'} ${gasOk ? '≤' : '>'} gas limit ${gasLimit}` +
    (recipientIsAccount
      ? ''
      : ' (Investor A is not yet a Hedera account: the first transfer lazily creates it)'),
);
const funded = balance >= maxCost;
console.log(
  `  ${funded ? 'PASS' : 'BLOCK'}  Agent balance ${formatEther(balance)} HBAR ${funded ? '≥' : '<'} max cost ${formatEther(maxCost)} HBAR (6 HBAR + gas limit × gas price)`,
);
const nonceAfter = await provider.getTransactionCount(wallet.address, 'latest');
line(nonceAfter === nonceBefore, `Agent nonce unchanged (${nonceBefore} → ${nonceAfter})`);

console.log(
  `\n${JSON.stringify(
    {
      label: 'PREFLIGHT — READ-ONLY + Privy dry signatures; NOTHING BROADCAST',
      agentWallet: wallet.address,
      provisioning: wallet.provisioning,
      policyId: wallet.policyRef,
      controls: wallet.controls,
      balanceHbar: formatEther(balance),
      nonce: nonceBefore,
      privySignatureRequestsTo: signatureRequests,
      investorBSignatureRequests: signatureRequests.filter((t) => t === getAddress(B)).length,
      exactPayoutA: {
        to: exact.to,
        amountHbar: '6.0',
        data: exact.data,
        chainId: exact.chain_id,
        gasLimit: exact.gas_limit,
        maxCostHbar: formatEther(maxCost),
      },
      failures,
    },
    null,
    2,
  )}`,
);
process.exit(failures.length === 0 ? 0 : 1);
