// Final demo (FD-3, Catenor One [REF-IMPL]): Hedera ATS testnet execution signed by the Privy-managed SPV EVM wallet.
// Invoked by AssetTokenizationService ONLY after a Catenor ALLOW — Catenor decides authority; the Privy SPV policy
// constrains what the wallet may sign (chain 296 + ATS Factory target; export denied; default deny); Hedera executes.
//
// Path: build the exact deployEquity transaction → READ-ONLY eth_call + eth_estimateGas from the SPV address →
// Privy eth_signTransaction with the SPV runtime-signer authorization key (an additional signer scoped by the SPV
// policy; the management-owner key never enters the runtime) → signer boundary: the signed transaction must be
// exactly the prepared one (from, chain, to, data, value, nonce, gas) → broadcast through the Hedera JSON-RPC relay →
// receipt → EquityDeployed → read-back. Privy signs only; it never broadcasts. There is no raw-key fallback.
// issueByPartition (FD-4) uses the same path; Catenor builds its calldata from structured input only.
import { Factory__factory, IAsset__factory } from '@hashgraph/asset-tokenization-contracts';
import type { PrivyClient } from '@privy-io/node';
import { JsonRpcProvider, Transaction, ZeroAddress, isAddress } from 'ethers';
import type { AssetTokenizationExecutor } from '../../modules/asset-tokenization/application/asset-tokenization.service.js';
import {
  ATS,
  DEPLOY_GAS_LIMIT,
  HEDERA_TESTNET,
  asRunner,
  deployEquityArguments,
  deployedEquityResult,
} from './hedera-ats-executor.js';

/** The only Privy operations this executor uses. */
export interface PrivyEvmSigningApi {
  walletAddress(walletId: string): Promise<string>;
  /** EVM eth_signTransaction (legacy, EIP-155) authorized by a runtime-signer authorization key; returns RLP hex. */
  signTransaction(
    walletId: string,
    transaction: PreparedTransaction | NativeTransferTransaction,
    authorizationKey: string,
  ): Promise<string>;
}

/** A plain native HBAR transfer (Distribution Agent payout): value in 18-decimal weibar (hex), empty calldata. */
export interface NativeTransferTransaction {
  readonly chain_id: number;
  readonly to: string;
  readonly data: '0x';
  readonly value: string;
  readonly nonce: number;
  readonly gas_limit: number;
  readonly gas_price: string;
  readonly type: 0;
}

export interface PreparedTransaction {
  readonly chain_id: number;
  readonly to: string;
  readonly data: string;
  readonly value: 0;
  readonly nonce: number;
  readonly gas_limit: number;
  readonly gas_price: string;
  readonly type: 0;
}

export function privyEvmSigningApi(client: PrivyClient): PrivyEvmSigningApi {
  return {
    async walletAddress(walletId) {
      return (await client.wallets().get(walletId)).address;
    },
    async signTransaction(walletId, transaction, authorizationKey) {
      const { signed_transaction, encoding } = await client
        .wallets()
        .ethereum()
        .signTransaction(walletId, {
          params: { transaction },
          authorization_context: { authorization_private_keys: [authorizationKey] },
        });
      if (encoding !== 'rlp') throw new Error(`unexpected Privy transaction encoding ${encoding}`);
      return signed_transaction;
    },
  };
}

export interface PrivySpvExecutorConfig {
  readonly walletId: string;
  /** Expected SPV wallet address (public); checked against Privy before anything is signed. */
  readonly walletAddress: string;
  /** SPV runtime-signer authorization private key (PKCS#8 DER, base64) — never logged. */
  readonly runtimeAuthorizationKey: string;
}

/** A transaction prepared and simulated READ-ONLY from the SPV address; nothing signed or sent. */
export interface PreparedCall {
  readonly from: string;
  readonly transaction: PreparedTransaction;
  readonly returned: string;
  readonly estimatedGas: bigint;
  readonly balanceWeibar: bigint;
  readonly maxCostWeibar: bigint;
}

export interface DeployEquityPreflight extends PreparedCall {
  readonly simulatedEquityAddress: string;
}

export interface IssuancePreflight extends PreparedCall {
  readonly equity: string;
  readonly tokenHolder: string;
  readonly amount: bigint;
}

/** Gas limits for the dividend lifecycle (READ-ONLY estimate grantRole ≈ 194K; setDividend ≈ 0.3–0.5M). */
export const GRANT_ROLE_GAS_LIMIT = 500_000;
export const SET_DIVIDEND_GAS_LIMIT = 1_000_000;

/** One ATS dividend (IDividendTypes.Dividend): rate = amount / 10^amountDecimals per whole unit (decimals 0). */
export interface DividendTerms {
  readonly recordDate: bigint;
  readonly executionDate: bigint;
  readonly amount: bigint;
  readonly amountDecimals: number;
}

/** grantRole(ROLE_CORPORATE_ACTION, SPV) — the ONLY role grant Catenor builds (fixed role, fixed account). */
export function corporateActionRoleGrantCalldata(spv: string): string {
  if (!isAddress(spv) || spv === ZeroAddress) throw new Error('grantRole: invalid SPV address');
  return IAsset__factory.createInterface().encodeFunctionData('grantRole', [
    ATS.corporateActionRole,
    spv,
  ]);
}

/**
 * setDividend calldata from structured, validated terms only. The Privy SPV rule pins the function (setDividend on
 * the equity); Privy cannot enforce the uint8 amountDecimals field (CP8 probe), so it is checked here.
 */
export function setDividendCalldata(terms: DividendTerms, expectedAmountDecimals: number): string {
  if (terms.amountDecimals !== expectedAmountDecimals) {
    throw new Error(`setDividend: amountDecimals must be ${expectedAmountDecimals}`);
  }
  if (
    !Number.isInteger(terms.amountDecimals) ||
    terms.amountDecimals < 0 ||
    terms.amountDecimals > 18
  ) {
    throw new Error('setDividend: invalid amountDecimals');
  }
  if (terms.amount <= 0n) throw new Error('setDividend: amount must be positive');
  if (terms.recordDate <= 0n || terms.executionDate < terms.recordDate) {
    throw new Error('setDividend: invalid dates (0 < recordDate <= executionDate)');
  }
  return IAsset__factory.createInterface().encodeFunctionData('setDividend', [
    {
      recordDate: terms.recordDate,
      executionDate: terms.executionDate,
      amount: terms.amount,
      amountDecimals: terms.amountDecimals,
    },
  ]);
}

/** Gas limit for one issueByPartition (READ-ONLY estimate ≈ 0.2–0.5M); unused gas is refunded. */
export const ISSUE_GAS_LIMIT = 1_000_000;

const sameAddress = (a: string | null | undefined, b: string) =>
  typeof a === 'string' && a.toLowerCase() === b.toLowerCase();

/**
 * The exact issueByPartition calldata, built by Catenor from structured input only (never arbitrary bytes): the
 * single default partition, one holder, a positive whole-unit amount, empty data.
 */
export function issueByPartitionCalldata(input: {
  readonly tokenHolder: string;
  readonly amount: bigint;
}): string {
  if (!isAddress(input.tokenHolder) || input.tokenHolder === ZeroAddress) {
    throw new Error('issueByPartition: invalid token holder');
  }
  if (input.amount <= 0n) throw new Error('issueByPartition: amount must be positive');
  return IAsset__factory.createInterface().encodeFunctionData('issueByPartition', [
    {
      partition: ATS.defaultPartition,
      tokenHolder: input.tokenHolder,
      value: input.amount,
      data: '0x',
    },
  ]);
}

export class PrivySpvAtsExecutor implements AssetTokenizationExecutor {
  readonly network = 'hedera-testnet';

  constructor(
    private readonly api: PrivyEvmSigningApi,
    private readonly config: PrivySpvExecutorConfig,
    private readonly provider: JsonRpcProvider = new JsonRpcProvider(HEDERA_TESTNET.rpcUrl),
  ) {}

  /** Reads the PRIVY_SPV_* values and CATENOR_SPV_RUNTIME_AUTHORIZATION_KEY; undefined when not configured. */
  static fromEnv(
    client: PrivyClient,
    env: NodeJS.ProcessEnv = process.env,
  ): PrivySpvAtsExecutor | undefined {
    const walletId = env['PRIVY_SPV_WALLET_ID'] ?? '';
    const walletAddress = env['PRIVY_SPV_WALLET_ADDRESS'] ?? '';
    const runtimeAuthorizationKey = env['CATENOR_SPV_RUNTIME_AUTHORIZATION_KEY'] ?? '';
    if (!walletId || !walletAddress || !runtimeAuthorizationKey) return undefined;
    const rpcUrl = env['HEDERA_JSON_RPC_URL'] || HEDERA_TESTNET.rpcUrl;
    return new PrivySpvAtsExecutor(
      privyEvmSigningApi(client),
      { walletId, walletAddress, runtimeAuthorizationKey },
      new JsonRpcProvider(rpcUrl),
    );
  }

  get operatorAddress(): string {
    return this.config.walletAddress;
  }

  /** SPV account nonce — equal before and after a DENY shows that no transaction was sent. */
  async operatorNonce(): Promise<number> {
    return this.provider.getTransactionCount(this.config.walletAddress, 'latest');
  }

  async assertTestnet(): Promise<void> {
    const { chainId } = await this.provider.getNetwork();
    if (chainId !== HEDERA_TESTNET.chainId) {
      throw new Error(`refusing to execute on chain ${chainId}: Hedera testnet (296) only`);
    }
  }

  /** READ-ONLY: the SPV wallet address as Privy reports it, checked against the configured one. */
  private async spvAddress(): Promise<string> {
    const from = await this.api.walletAddress(this.config.walletId);
    if (!sameAddress(from, this.config.walletAddress)) {
      throw new Error('the Privy SPV wallet address does not match PRIVY_SPV_WALLET_ADDRESS');
    }
    return from;
  }

  /** READ-ONLY: eth_call + eth_estimateGas from the SPV address; balance must cover gasLimit × gasPrice. */
  private async prepareCall(to: string, data: string, gasLimit: number): Promise<PreparedCall> {
    await this.assertTestnet();
    const from = await this.spvAddress();
    const call = { from, to, data };
    const [returned, estimatedGas, gasPrice, nonce, balanceWeibar] = await Promise.all([
      this.provider.call(call),
      this.provider.estimateGas(call),
      this.provider.send('eth_gasPrice', []) as Promise<string>,
      this.provider.getTransactionCount(from, 'latest'),
      this.provider.getBalance(from),
    ]);
    if (estimatedGas > BigInt(gasLimit)) {
      throw new Error(`the call needs ${estimatedGas} gas, above the ${gasLimit} limit`);
    }
    const maxCostWeibar = BigInt(gasLimit) * BigInt(gasPrice);
    if (balanceWeibar < maxCostWeibar) {
      throw new Error('the SPV wallet balance does not cover gasLimit × gasPrice');
    }
    return {
      from,
      transaction: {
        chain_id: Number(HEDERA_TESTNET.chainId),
        to,
        data,
        value: 0,
        nonce,
        gas_limit: gasLimit,
        gas_price: gasPrice,
        type: 0,
      },
      returned,
      estimatedGas,
      balanceWeibar,
      maxCostWeibar,
    };
  }

  /** READ-ONLY: the exact deployEquity transaction, simulated from the SPV address. Nothing is signed or sent. */
  async prepareDeployEquity(input: {
    readonly resource: string;
    readonly grantId: string;
    readonly asset?: { readonly name: string; readonly symbol: string; readonly isinBody: string };
  }): Promise<DeployEquityPreflight> {
    const operator = await this.spvAddress();
    const { equityData, regulationData } = deployEquityArguments({
      resource: input.resource,
      grantId: input.grantId,
      operator,
      ...(input.asset ? { asset: input.asset } : {}),
    });
    const iface = Factory__factory.createInterface();
    const data = iface.encodeFunctionData('deployEquity', [equityData, regulationData]);
    const prepared = await this.prepareCall(HEDERA_TESTNET.factory, data, DEPLOY_GAS_LIMIT);
    const [simulatedEquityAddress] = iface.decodeFunctionResult('deployEquity', prepared.returned);
    return { ...prepared, simulatedEquityAddress: simulatedEquityAddress as string };
  }

  /** READ-ONLY: the exact issueByPartition transaction (SPV = ROLE_ISSUER) simulated from the SPV address. */
  async prepareIssueByPartition(input: {
    readonly equity: string;
    readonly tokenHolder: string;
    readonly amount: bigint;
  }): Promise<IssuancePreflight> {
    if (!isAddress(input.equity)) throw new Error('issueByPartition: invalid equity address');
    if (sameAddress(input.tokenHolder, this.config.walletAddress)) {
      throw new Error('issueByPartition: the SPV wallet cannot be the token holder');
    }
    const data = issueByPartitionCalldata(input);
    const prepared = await this.prepareCall(input.equity, data, ISSUE_GAS_LIMIT);
    return {
      ...prepared,
      equity: input.equity,
      tokenHolder: input.tokenHolder,
      amount: input.amount,
    };
  }

  /**
   * Signer boundary: Privy signs; the signed transaction must be exactly the prepared one (sender, chain, target,
   * calldata, value, nonce, gas). Returns the raw transaction (not sent).
   */
  async signPrepared(prepared: PreparedCall): Promise<string> {
    const raw = await this.api.signTransaction(
      this.config.walletId,
      prepared.transaction,
      this.config.runtimeAuthorizationKey,
    );
    const signed = Transaction.from(raw);
    const expected = prepared.transaction;
    if (
      !sameAddress(signed.from, prepared.from) ||
      signed.chainId !== BigInt(expected.chain_id) ||
      !sameAddress(signed.to, expected.to) ||
      signed.data.toLowerCase() !== expected.data.toLowerCase() ||
      signed.value !== 0n ||
      signed.nonce !== expected.nonce ||
      signed.gasLimit !== BigInt(expected.gas_limit) ||
      signed.gasPrice !== BigInt(expected.gas_price)
    ) {
      throw new Error('signer boundary: the Privy-signed transaction is not the prepared one');
    }
    return raw;
  }

  async tokenize(input: {
    readonly resource: string;
    readonly requester: string;
    readonly grantId: string;
    readonly asset?: { readonly name: string; readonly symbol: string; readonly isinBody: string };
  }) {
    const prepared = await this.prepareDeployEquity(input);
    const raw = await this.signPrepared(prepared);
    const sent = await this.provider.broadcastTransaction(raw);
    return deployedEquityResult(sent.hash, await sent.wait(1, 180_000), this.provider);
  }

  /** READ-ONLY: grantRole(ROLE_CORPORATE_ACTION, SPV) on the equity, simulated from the SPV address (DEFAULT_ADMIN). */
  async prepareCorporateActionRoleGrant(equity: string): Promise<PreparedCall> {
    if (!isAddress(equity)) throw new Error('grantRole: invalid equity address');
    const spv = await this.spvAddress();
    return this.prepareCall(equity, corporateActionRoleGrantCalldata(spv), GRANT_ROLE_GAS_LIMIT);
  }

  /** READ-ONLY: setDividend(terms) on the equity, simulated from the SPV address (needs ROLE_CORPORATE_ACTION). */
  async prepareSetDividend(
    equity: string,
    terms: DividendTerms,
    expectedAmountDecimals: number,
  ): Promise<PreparedCall> {
    if (!isAddress(equity)) throw new Error('setDividend: invalid equity address');
    return this.prepareCall(
      equity,
      setDividendCalldata(terms, expectedAmountDecimals),
      SET_DIVIDEND_GAS_LIMIT,
    );
  }

  /** Broadcasts one prepared lifecycle call after the signer boundary; returns the receipt hash and status. */
  async executePrepared(prepared: PreparedCall) {
    const raw = await this.signPrepared(prepared);
    const sent = await this.provider.broadcastTransaction(raw);
    const receipt = await sent.wait(1, 180_000);
    if (receipt === null || receipt.status !== 1) {
      throw new Error(`transaction ${sent.hash} did not succeed`);
    }
    return {
      transactionId: sent.hash,
      explorerUrl: `${HEDERA_TESTNET.explorer}/transaction/${sent.hash}`,
      gasUsed: receipt.gasUsed,
    };
  }

  /** One issueByPartition: prepare (READ-ONLY) → Privy signature → signer boundary → broadcast → receipt → balance. */
  async issueByPartition(input: {
    readonly equity: string;
    readonly tokenHolder: string;
    readonly amount: bigint;
  }) {
    const prepared = await this.prepareIssueByPartition(input);
    const raw = await this.signPrepared(prepared);
    const sent = await this.provider.broadcastTransaction(raw);
    const receipt = await sent.wait(1, 180_000);
    if (receipt === null || receipt.status !== 1) {
      throw new Error(`issueByPartition transaction ${sent.hash} did not succeed`);
    }
    const holderBalance = await IAsset__factory.connect(
      input.equity,
      asRunner(this.provider),
    ).balanceOf(input.tokenHolder);
    return {
      transactionId: sent.hash,
      explorerUrl: `${HEDERA_TESTNET.explorer}/transaction/${sent.hash}`,
      holderBalance,
    };
  }
}
