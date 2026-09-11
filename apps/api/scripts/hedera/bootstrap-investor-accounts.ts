// TESTNET BOOTSTRAP FUNDING — NOT A DISTRIBUTION (final demo, maintainer prompt 2026-09-11-020).
//
//   pnpm --filter @catenor-one/api bootstrap:investors                  # preflight only (READ-ONLY + Privy dry signatures)
//   pnpm --filter @catenor-one/api bootstrap:investors --broadcast A    # exactly one transfer (maintainer-authorized)
//   pnpm --filter @catenor-one/api bootstrap:investors --broadcast B
//
// Activates the two investor receiving accounts on Hedera testnet before the demo: the first transfer to a new EVM
// address lazily creates the account (HIP-583), which costs ≈ 650K gas; afterwards a payout is a normal ≈ 23K-gas
// transfer. Fixed destinations (the two demo investor wallets), fixed 1 HBAR, empty calldata, gas limit 700,000, sent
// from the pre-seeded Privy Agent wallet with the Agent runtime signer. This is pre-demo setup: it does not use the
// distribution plan or the payout signer, writes no Catenor audit event, and is never a CREATE_DISTRIBUTION or payout
// event. The resulting 1 HBAR is each investor's starting balance for the demo's balance comparisons.
import { PrivyClient } from '@privy-io/node';
import { JsonRpcProvider, Transaction, formatEther, getAddress } from 'ethers';
import { HEDERA_TESTNET } from '../../src/infrastructure/execution/hedera-ats-executor.js';
import {
  privyEvmSigningApi,
  type NativeTransferTransaction,
} from '../../src/infrastructure/execution/privy-spv-ats-executor.js';
import { PrivyDistributionAgentProvisioner } from '../../src/infrastructure/key-management/privy-distribution-agent.js';
import { DEMO_INVESTORS } from '../demo/final-demo-config.js';

const HBAR = 10n ** 18n;
const AMOUNT = 1n * HBAR;
const GAS_LIMIT = 700_000;
const target = (() => {
  const i = process.argv.indexOf('--broadcast');
  return i === -1 ? undefined : process.argv[i + 1];
})();
if (target !== undefined && target !== 'A' && target !== 'B') {
  console.error('usage: bootstrap:investors [--broadcast A|B]');
  process.exit(2);
}

process.loadEnvFile(new URL('../../.env', import.meta.url));
const env = (name: string) => process.env[name] ?? '';
const privy = new PrivyClient({ appId: env('PRIVY_APP_ID'), appSecret: env('PRIVY_APP_SECRET') });
const provisioner = PrivyDistributionAgentProvisioner.fromEnv(privy);
const runtimeKey = env('CATENOR_AGENT_RUNTIME_AUTHORIZATION_KEY');
if (!provisioner || !env('PRIVY_AGENT_WALLET_ADDRESS') || !runtimeKey) {
  console.error(
    'BLOCKED: PRIVY_AGENT_* / CATENOR_AGENT_RUNTIME_AUTHORIZATION_KEY missing (values are never printed)',
  );
  process.exit(2);
}
// The Agent policy must still be exactly the approved boundary (to ∈ {A, B} ∧ value ≤ 20 HBAR ∧ chain 296).
const wallet = await provisioner.provision({
  agentDid: 'did:catenor:00000000000000000000000000000000',
  resource: 'spv:catenor-demo-001',
  recipients: [DEMO_INVESTORS.A.address, DEMO_INVESTORS.B.address],
  maxPayoutWeibar: 20n * HBAR,
});
const api = privyEvmSigningApi(privy);
const provider = new JsonRpcProvider(HEDERA_TESTNET.rpcUrl);
const isAccount = async (address: string) =>
  (await fetch(`https://testnet.mirrornode.hedera.com/api/v1/accounts/${address}`)).status === 200;

async function prepare(label: 'A' | 'B') {
  const to = getAddress(DEMO_INVESTORS[label].address);
  const [nonce, gasPrice, estimatedGas, exists, balance] = await Promise.all([
    provider.getTransactionCount(wallet.address, 'latest'),
    provider.send('eth_gasPrice', []) as Promise<string>,
    provider.estimateGas({ from: wallet.address, to, value: AMOUNT }),
    isAccount(to),
    provider.getBalance(to),
  ]);
  const transaction: NativeTransferTransaction = {
    chain_id: Number(HEDERA_TESTNET.chainId),
    to,
    data: '0x',
    value: `0x${AMOUNT.toString(16)}`,
    nonce,
    gas_limit: GAS_LIMIT,
    gas_price: gasPrice,
    type: 0,
  };
  return {
    label,
    to,
    transaction,
    estimatedGas,
    exists,
    balance,
    maxCost: AMOUNT + BigInt(GAS_LIMIT) * BigInt(gasPrice),
  };
}

/** Privy signs; the signed transaction must be exactly the built one (fixed destination, 1 HBAR, empty calldata). */
async function sign(p: Awaited<ReturnType<typeof prepare>>) {
  const raw = await api.signTransaction(wallet.walletRef, p.transaction, runtimeKey);
  const signed = Transaction.from(raw);
  const t = p.transaction;
  if (
    getAddress(signed.from!) !== wallet.address ||
    signed.chainId !== 296n ||
    getAddress(signed.to!) !== t.to ||
    signed.value !== AMOUNT ||
    signed.data !== '0x' ||
    signed.nonce !== t.nonce ||
    signed.gasLimit !== BigInt(GAS_LIMIT) ||
    signed.gasPrice !== BigInt(t.gas_price)
  ) {
    throw new Error(
      'signer boundary: the Privy-signed transaction is not the prepared bootstrap transfer',
    );
  }
  return { raw, recoveredFrom: getAddress(signed.from!) };
}

const agentBalance = await provider.getBalance(wallet.address);
const agentNonce = await provider.getTransactionCount(wallet.address, 'latest');
const out = (v: unknown) =>
  console.log(JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? String(x) : x), 2));

if (target === undefined) {
  const prepared = [await prepare('A'), await prepare('B')];
  const signatures: string[] = [];
  for (const p of prepared) signatures.push((await sign(p)).recoveredFrom); // dry signatures, discarded
  const totalMax = prepared.reduce((a, p) => a + p.maxCost, 0n);
  out({
    label:
      'TESTNET BOOTSTRAP PREFLIGHT — not a distribution; READ-ONLY + Privy dry signatures; NOTHING BROADCAST',
    agentWallet: wallet.address,
    agentPolicy: { id: wallet.policyRef, verified: wallet.provisioning, controls: wallet.controls },
    agentBalanceHbar: formatEther(agentBalance),
    agentNonce,
    transactions: prepared.map((p, i) => ({
      investor: `Investor ${p.label}`,
      to: p.to,
      alreadyHederaAccount: p.exists,
      currentBalanceHbar: formatEther(p.balance),
      amountHbar: '1.0',
      data: '0x',
      chainId: 296,
      gasLimit: GAS_LIMIT,
      estimatedGas: p.estimatedGas,
      gasPriceWeibar: BigInt(p.transaction.gas_price),
      estimatedFeeHbar: formatEther(p.estimatedGas * BigInt(p.transaction.gas_price)),
      maxCostHbar: formatEther(p.maxCost),
      privyDrySignature: 'SIGNED (discarded)',
      recoveredFrom: signatures[i],
      nonceAtBroadcast: agentNonce + i,
    })),
    totalMaxCostHbar: formatEther(totalMax),
    sufficientBalance: agentBalance >= totalMax,
    gasWithinLimit: prepared.every((p) => p.estimatedGas <= BigInt(GAS_LIMIT)),
  });
  process.exit(0);
}

// One authorized bootstrap transfer; exactly one attempt, no retry.
const p = await prepare(target);
if (p.exists) {
  console.error(`REFUSED: Investor ${target} is already a Hedera account — no bootstrap needed`);
  process.exit(1);
}
if (p.estimatedGas > BigInt(GAS_LIMIT)) {
  console.error(`REFUSED: estimated gas ${p.estimatedGas} exceeds the authorized ${GAS_LIMIT}`);
  process.exit(1);
}
if (agentBalance < p.maxCost) {
  console.error('REFUSED: the Agent balance does not cover 1 HBAR + gas limit × gas price');
  process.exit(1);
}
const { raw } = await sign(p);
const sent = await provider.broadcastTransaction(raw);
const receipt = await sent.wait(1, 180_000);
const [agentAfter, nonceAfter, toAfter, exists] = await Promise.all([
  provider.getBalance(wallet.address),
  provider.getTransactionCount(wallet.address, 'latest'),
  provider.getBalance(p.to),
  isAccount(p.to),
]);
const mirror = (await (
  await fetch(`https://testnet.mirrornode.hedera.com/api/v1/contracts/results/${sent.hash}`)
).json()) as Record<string, unknown>;
const gasPrice = receipt?.gasPrice ?? 0n;
const checks = {
  receiptSuccess: receipt?.status === 1,
  mirrorNodeSuccess: mirror['result'] === 'SUCCESS',
  agentNonceIncrementedByOne: nonceAfter === agentNonce + 1,
  investorReceivedExactly1Hbar: toAfter - p.balance === AMOUNT,
  investorIsNowHederaAccount: exists,
};
out({
  label: 'LIVE TESTNET BOOTSTRAP — account activation, not a distribution',
  investor: `Investor ${target}`,
  to: p.to,
  transaction: sent.hash,
  hashscan: `${HEDERA_TESTNET.explorer}/transaction/${sent.hash}`,
  gasUsed: receipt?.gasUsed,
  gasFeeHbar: formatEther((receipt?.gasUsed ?? 0n) * gasPrice),
  agentHbar: { before: formatEther(agentBalance), after: formatEther(agentAfter) },
  investorHbar: { before: formatEther(p.balance), after: formatEther(toAfter) },
  agentNonce: { before: agentNonce, after: nonceAfter },
  mirrorNode: { result: mirror['result'], timestamp: mirror['timestamp'] },
  checks,
});
process.exit(Object.values(checks).every(Boolean) ? 0 : 1);
