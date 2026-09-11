// Final demo — Distribution Agent payout (Catenor One [REF-IMPL], FINAL-DEMO FD-7). Signed by the Privy-managed Agent
// EVM wallet with the Agent runtime-signer key, only for a holder the approved Catenor plan marked PAY.
//
// Two layers, both required:
//   Privy Agent policy (execution control): chain 296 ∧ to ∈ {the SPV investors' wallets} ∧ value ≤ 20 HBAR; export
//   denied; default deny. It cannot require empty calldata and does not know the plan.
//   Catenor signer boundary (this file): the transaction is BUILT here from the approved plan outcome and the
//   privately bound account — never from caller-provided bytes: plan result == PAY; chain 296; native transfer only;
//   empty calldata; recipient == the bound account; value == the plan amount. The signed transaction must be exactly
//   the built one before anything is broadcast. A HOLD holder never reaches Privy.
import type { PrivyClient } from '@privy-io/node';
import { JsonRpcProvider, Transaction, getAddress, isAddress } from 'ethers';
import type { ApprovedPayout } from '../../modules/distribution/application/distribution.service.js';
import { HEDERA_TESTNET } from './hedera-ats-executor.js';
import {
  privyEvmSigningApi,
  type NativeTransferTransaction,
  type PrivyEvmSigningApi,
} from './privy-spv-ats-executor.js';

/** A plain transfer costs ≈ 21–23K gas on Hedera; the limit bounds the up-front gas reservation. */
export const PAYOUT_GAS_LIMIT = 30_000;

/** What is being asked for — must match the approval exactly. */
export interface PayoutRequest {
  readonly recipient: string;
  readonly amountWeibar: bigint;
  /** A payout is a plain transfer: anything but empty calldata is refused. */
  readonly data?: string;
}

export class PayoutRefused extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'PayoutRefused';
  }
}

/**
 * Pure signer-boundary check + construction. Throws PayoutRefused before any Privy call when the request is not
 * exactly the approved payout.
 */
export function buildPayoutTransaction(
  approval: ApprovedPayout,
  request: PayoutRequest,
  chain: { nonce: number; gasPrice: string },
): NativeTransferTransaction {
  if (approval.controlled !== 'PAY') throw new PayoutRefused('PLAN_RESULT_NOT_PAY');
  if (approval.approvedWeibar <= 0n) throw new PayoutRefused('NOTHING_TO_PAY');
  if (!isAddress(approval.boundAccount) || !isAddress(request.recipient)) {
    throw new PayoutRefused('INVALID_RECIPIENT');
  }
  if (getAddress(request.recipient) !== getAddress(approval.boundAccount)) {
    throw new PayoutRefused('RECIPIENT_NOT_BOUND_ACCOUNT');
  }
  if (request.amountWeibar !== approval.approvedWeibar) {
    throw new PayoutRefused('AMOUNT_NOT_APPROVED');
  }
  if ((request.data ?? '0x') !== '0x') throw new PayoutRefused('CALLDATA_NOT_EMPTY');
  return {
    chain_id: Number(HEDERA_TESTNET.chainId),
    to: getAddress(approval.boundAccount),
    data: '0x',
    value: `0x${approval.approvedWeibar.toString(16)}`,
    nonce: chain.nonce,
    gas_limit: PAYOUT_GAS_LIMIT,
    gas_price: chain.gasPrice,
    type: 0,
  };
}

export interface PreparedPayout {
  readonly approval: ApprovedPayout;
  readonly from: string;
  readonly transaction: NativeTransferTransaction;
  readonly estimatedGas: bigint;
  readonly balanceWeibar: bigint;
  readonly maxCostWeibar: bigint;
}

export interface PrivyAgentPayoutConfig {
  readonly walletId: string;
  readonly walletAddress: string;
  /** Agent runtime-signer authorization private key (PKCS#8 DER, base64) — never logged. */
  readonly runtimeAuthorizationKey: string;
}

const same = (a: string | null | undefined, b: string) =>
  typeof a === 'string' && a.toLowerCase() === b.toLowerCase();

export class PrivyAgentPayoutExecutor {
  constructor(
    private readonly api: PrivyEvmSigningApi,
    private readonly config: PrivyAgentPayoutConfig,
    private readonly provider: JsonRpcProvider = new JsonRpcProvider(HEDERA_TESTNET.rpcUrl),
  ) {}

  /** The Agent wallet id comes from the (verified) pre-seeded wallet resolution; the key from the environment. */
  static fromEnv(
    client: PrivyClient,
    wallet: { walletRef: string; address: string },
    env: NodeJS.ProcessEnv = process.env,
  ): PrivyAgentPayoutExecutor | undefined {
    const runtimeAuthorizationKey = env['CATENOR_AGENT_RUNTIME_AUTHORIZATION_KEY'] ?? '';
    if (!runtimeAuthorizationKey) return undefined;
    return new PrivyAgentPayoutExecutor(privyEvmSigningApi(client), {
      walletId: wallet.walletRef,
      walletAddress: wallet.address,
      runtimeAuthorizationKey,
    });
  }

  get walletAddress(): string {
    return this.config.walletAddress;
  }

  nonce(): Promise<number> {
    return this.provider.getTransactionCount(this.config.walletAddress, 'latest');
  }

  /** READ-ONLY: builds the exact payout (signer boundary) and checks gas and balance. Nothing is signed. */
  async prepare(approval: ApprovedPayout, request: PayoutRequest): Promise<PreparedPayout> {
    const { chainId } = await this.provider.getNetwork();
    if (chainId !== HEDERA_TESTNET.chainId) throw new PayoutRefused('WRONG_CHAIN');
    const from = await this.api.walletAddress(this.config.walletId);
    if (!same(from, this.config.walletAddress)) throw new PayoutRefused('AGENT_WALLET_MISMATCH');
    const [nonce, gasPrice, balanceWeibar] = await Promise.all([
      this.provider.getTransactionCount(from, 'latest'),
      this.provider.send('eth_gasPrice', []) as Promise<string>,
      this.provider.getBalance(from),
    ]);
    const transaction = buildPayoutTransaction(approval, request, { nonce, gasPrice });
    // Fail closed before any gas estimation or signature: the wallet must cover value + gasLimit × gasPrice.
    const maxCostWeibar = BigInt(transaction.value) + BigInt(PAYOUT_GAS_LIMIT) * BigInt(gasPrice);
    if (balanceWeibar < maxCostWeibar) throw new PayoutRefused('INSUFFICIENT_AGENT_BALANCE');
    const estimatedGas = await this.provider.estimateGas({
      from,
      to: transaction.to,
      value: BigInt(transaction.value),
    });
    if (estimatedGas > BigInt(PAYOUT_GAS_LIMIT)) throw new PayoutRefused('GAS_ABOVE_LIMIT');
    return { approval, from, transaction, estimatedGas, balanceWeibar, maxCostWeibar };
  }

  /** Privy signs; the signed transaction must be exactly the built payout. Returns the raw transaction (not sent). */
  async sign(prepared: PreparedPayout): Promise<{ raw: string; recoveredFrom: string }> {
    const raw = await this.api.signTransaction(
      this.config.walletId,
      prepared.transaction,
      this.config.runtimeAuthorizationKey,
    );
    const signed = Transaction.from(raw);
    const t = prepared.transaction;
    if (
      !same(signed.from, prepared.from) ||
      signed.chainId !== BigInt(t.chain_id) ||
      !same(signed.to, t.to) ||
      signed.data !== '0x' ||
      signed.value !== BigInt(t.value) ||
      signed.nonce !== t.nonce ||
      signed.gasLimit !== BigInt(t.gas_limit) ||
      signed.gasPrice !== BigInt(t.gas_price)
    ) {
      throw new PayoutRefused('SIGNED_TRANSACTION_NOT_THE_APPROVED_PAYOUT');
    }
    return { raw, recoveredFrom: signed.from! };
  }

  /** Broadcasts one verified payout (maintainer-authorized step). */
  async execute(prepared: PreparedPayout) {
    const { raw } = await this.sign(prepared);
    const sent = await this.provider.broadcastTransaction(raw);
    const receipt = await sent.wait(1, 180_000);
    if (receipt === null || receipt.status !== 1) {
      throw new Error(`payout transaction ${sent.hash} did not succeed`);
    }
    return {
      transactionId: sent.hash,
      explorerUrl: `${HEDERA_TESTNET.explorer}/transaction/${sent.hash}`,
      gasUsed: receipt.gasUsed,
    };
  }
}
