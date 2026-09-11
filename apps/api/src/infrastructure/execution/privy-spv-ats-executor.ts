// Final demo (FD-3, Catenor One [REF-IMPL]): Hedera ATS testnet execution signed by the Privy-managed SPV EVM wallet.
// Invoked by AssetTokenizationService ONLY after a Catenor ALLOW — Catenor decides authority; the Privy SPV policy
// constrains what the wallet may sign (chain 296 + ATS Factory target; export denied; default deny); Hedera executes.
//
// Path: build the exact deployEquity transaction → READ-ONLY eth_call + eth_estimateGas from the SPV address →
// Privy eth_signTransaction with the SPV runtime-signer authorization key (an additional signer scoped by the SPV
// policy; the management-owner key never enters the runtime) → signer boundary: the signed transaction must be
// exactly the prepared one (from, chain, to, data, value, nonce, gas) → broadcast through the Hedera JSON-RPC relay →
// receipt → EquityDeployed → read-back. Privy signs only; it never broadcasts. There is no raw-key fallback.
import { Factory__factory } from '@hashgraph/asset-tokenization-contracts';
import type { PrivyClient } from '@privy-io/node';
import { JsonRpcProvider, Transaction } from 'ethers';
import type { AssetTokenizationExecutor } from '../../modules/asset-tokenization/application/asset-tokenization.service.js';
import {
  DEPLOY_GAS_LIMIT,
  HEDERA_TESTNET,
  deployEquityArguments,
  deployedEquityResult,
} from './hedera-ats-executor.js';

/** The only Privy operations this executor uses. */
export interface PrivyEvmSigningApi {
  walletAddress(walletId: string): Promise<string>;
  /** EVM eth_signTransaction (legacy, EIP-155) authorized by a runtime-signer authorization key; returns RLP hex. */
  signTransaction(
    walletId: string,
    transaction: PreparedTransaction,
    authorizationKey: string,
  ): Promise<string>;
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

export interface DeployEquityPreflight {
  readonly from: string;
  readonly transaction: PreparedTransaction;
  readonly simulatedEquityAddress: string;
  readonly estimatedGas: bigint;
  readonly balanceWeibar: bigint;
  readonly maxCostWeibar: bigint;
}

const sameAddress = (a: string | null | undefined, b: string) =>
  typeof a === 'string' && a.toLowerCase() === b.toLowerCase();

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

  /** READ-ONLY: the exact transaction, simulated from the SPV address. Nothing is signed or sent. */
  async prepareDeployEquity(input: {
    readonly resource: string;
    readonly grantId: string;
  }): Promise<DeployEquityPreflight> {
    await this.assertTestnet();
    const from = await this.api.walletAddress(this.config.walletId);
    if (!sameAddress(from, this.config.walletAddress)) {
      throw new Error('the Privy SPV wallet address does not match PRIVY_SPV_WALLET_ADDRESS');
    }
    const { equityData, regulationData } = deployEquityArguments({
      resource: input.resource,
      grantId: input.grantId,
      operator: from,
    });
    const iface = Factory__factory.createInterface();
    const data = iface.encodeFunctionData('deployEquity', [equityData, regulationData]);
    const call = { from, to: HEDERA_TESTNET.factory, data };
    const [returned, estimatedGas, gasPrice, nonce, balanceWeibar] = await Promise.all([
      this.provider.call(call),
      this.provider.estimateGas(call),
      this.provider.send('eth_gasPrice', []) as Promise<string>,
      this.provider.getTransactionCount(from, 'latest'),
      this.provider.getBalance(from),
    ]);
    if (estimatedGas > BigInt(DEPLOY_GAS_LIMIT)) {
      throw new Error(
        `deployEquity needs ${estimatedGas} gas, above the ${DEPLOY_GAS_LIMIT} limit`,
      );
    }
    const maxCostWeibar = BigInt(DEPLOY_GAS_LIMIT) * BigInt(gasPrice);
    if (balanceWeibar < maxCostWeibar) {
      throw new Error('the SPV wallet balance does not cover gasLimit × gasPrice');
    }
    const [simulatedEquityAddress] = iface.decodeFunctionResult('deployEquity', returned);
    return {
      from,
      transaction: {
        chain_id: Number(HEDERA_TESTNET.chainId),
        to: HEDERA_TESTNET.factory,
        data,
        value: 0,
        nonce,
        gas_limit: DEPLOY_GAS_LIMIT,
        gas_price: gasPrice,
        type: 0,
      },
      simulatedEquityAddress: simulatedEquityAddress as string,
      estimatedGas,
      balanceWeibar,
      maxCostWeibar,
    };
  }

  /** Privy signs; the signed transaction must be exactly the prepared one. Returns the raw transaction (not sent). */
  async signPrepared(prepared: DeployEquityPreflight): Promise<string> {
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
  }) {
    const prepared = await this.prepareDeployEquity(input);
    const raw = await this.signPrepared(prepared);
    const sent = await this.provider.broadcastTransaction(raw);
    return deployedEquityResult(sent.hash, await sent.wait(1, 180_000), this.provider);
  }
}
