// Privy SPV ATS executor — offline checks. Privy is replaced by a throwaway random secp256k1 wallet; the provider is
// a stub. No network, no real key material, nothing broadcast.
import { Factory__factory } from '@hashgraph/asset-tokenization-contracts';
import { AbiCoder, Transaction, Wallet, type JsonRpcProvider } from 'ethers';
import { describe, expect, it, vi } from 'vitest';
import { DEPLOY_GAS_LIMIT, HEDERA_TESTNET } from './hedera-ats-executor.js';
import {
  PrivySpvAtsExecutor,
  type PreparedTransaction,
  type PrivyEvmSigningApi,
} from './privy-spv-ats-executor.js';

const GAS_PRICE = 1_170_000_000_000n;
const HBAR = 10n ** 18n;
const RESOURCE = 'spv:catenor-demo-001';
const GRANT = 'capability-grant:00000000-0000-4000-8000-000000000000';

function fixture(opts: {
  chainId?: bigint;
  balance?: bigint;
  signedTamper?: (tx: PreparedTransaction) => PreparedTransaction;
  privyAddress?: string;
}) {
  const spv = Wallet.createRandom();
  const signed: PreparedTransaction[] = [];
  const api: PrivyEvmSigningApi = {
    walletAddress: async () => opts.privyAddress ?? spv.address,
    signTransaction: async (_walletId, tx) => {
      signed.push(tx);
      const t = opts.signedTamper ? opts.signedTamper(tx) : tx;
      return spv.signTransaction({
        type: 0,
        chainId: t.chain_id,
        to: t.to,
        data: t.data,
        value: t.value,
        nonce: t.nonce,
        gasLimit: t.gas_limit,
        gasPrice: BigInt(t.gas_price),
      });
    },
  };
  const equity = Wallet.createRandom().address;
  const broadcast = vi.fn(async (raw: string) => ({
    hash: Transaction.from(raw).hash!,
    wait: async () => null,
  }));
  const provider = {
    getNetwork: async () => ({ chainId: opts.chainId ?? HEDERA_TESTNET.chainId }),
    call: async () => AbiCoder.defaultAbiCoder().encode(['address'], [equity]),
    estimateGas: async () => 7_405_139n,
    send: async (method: string) => {
      if (method !== 'eth_gasPrice') throw new Error(method);
      return `0x${GAS_PRICE.toString(16)}`;
    },
    getTransactionCount: async () => 0,
    getBalance: async () => opts.balance ?? 100n * HBAR,
    broadcastTransaction: broadcast,
  } as unknown as JsonRpcProvider;
  const executor = new PrivySpvAtsExecutor(
    api,
    { walletId: 'wallet-id', walletAddress: spv.address, runtimeAuthorizationKey: 'k' },
    provider,
  );
  return { executor, spv, equity, signed, broadcast };
}

describe('PrivySpvAtsExecutor.prepareDeployEquity (READ-ONLY)', () => {
  it('prepares exactly one legacy EIP-155 deployEquity to the ATS Factory from the SPV wallet', async () => {
    const { executor, spv, equity } = fixture({});
    const prepared = await executor.prepareDeployEquity({ resource: RESOURCE, grantId: GRANT });
    expect(prepared.from).toBe(spv.address);
    expect(prepared.simulatedEquityAddress).toBe(equity);
    expect(prepared.transaction).toMatchObject({
      chain_id: 296,
      to: HEDERA_TESTNET.factory,
      value: 0,
      nonce: 0,
      gas_limit: DEPLOY_GAS_LIMIT,
      type: 0,
    });
    const decoded = Factory__factory.createInterface().decodeFunctionData(
      'deployEquity',
      prepared.transaction.data,
    );
    expect(decoded[1].additionalSecurityData.info).toBe(
      `catenor-one:TOKENIZE_ASSET:${RESOURCE}:grant:${GRANT}`,
    );
    expect(decoded[0].security.rbacs[1].members).toEqual([spv.address]);
    expect(prepared.maxCostWeibar).toBe(BigInt(DEPLOY_GAS_LIMIT) * GAS_PRICE);
  });

  it('refuses a Privy wallet whose address differs from the configured SPV address', async () => {
    const { executor } = fixture({ privyAddress: Wallet.createRandom().address });
    await expect(
      executor.prepareDeployEquity({ resource: RESOURCE, grantId: GRANT }),
    ).rejects.toThrow(/does not match/);
  });

  it('refuses when the balance does not cover gasLimit × gasPrice', async () => {
    const { executor } = fixture({ balance: 17n * HBAR });
    await expect(
      executor.prepareDeployEquity({ resource: RESOURCE, grantId: GRANT }),
    ).rejects.toThrow(/balance/);
  });

  it('refuses any chain other than Hedera testnet', async () => {
    const { executor } = fixture({ chainId: 295n });
    await expect(
      executor.prepareDeployEquity({ resource: RESOURCE, grantId: GRANT }),
    ).rejects.toThrow(/296/);
  });
});

describe('PrivySpvAtsExecutor signer boundary', () => {
  it('accepts a Privy signature over exactly the prepared transaction', async () => {
    const { executor, spv } = fixture({});
    const prepared = await executor.prepareDeployEquity({ resource: RESOURCE, grantId: GRANT });
    const raw = await executor.signPrepared(prepared);
    expect(Transaction.from(raw).from).toBe(spv.address);
  });

  it.each([
    [
      'another target',
      (t: PreparedTransaction) => ({ ...t, to: HEDERA_TESTNET.businessLogicResolver }),
    ],
    ['another chain', (t: PreparedTransaction) => ({ ...t, chain_id: 1 })],
    ['other calldata', (t: PreparedTransaction) => ({ ...t, data: '0x' })],
    ['another nonce', (t: PreparedTransaction) => ({ ...t, nonce: 7 })],
  ])('rejects a signed transaction with %s and never broadcasts', async (_name, tamper) => {
    const { executor, broadcast } = fixture({ signedTamper: tamper });
    await expect(
      executor.tokenize({ resource: RESOURCE, requester: 'x', grantId: GRANT }),
    ).rejects.toThrow(/signer boundary/);
    expect(broadcast).not.toHaveBeenCalled();
  });

  it('broadcasts the verified raw transaction exactly once', async () => {
    const { executor, broadcast } = fixture({});
    // The stub receipt is null, so the result step fails after the single broadcast.
    await expect(
      executor.tokenize({ resource: RESOURCE, requester: 'x', grantId: GRANT }),
    ).rejects.toThrow(/did not succeed/);
    expect(broadcast).toHaveBeenCalledTimes(1);
  });
});

describe('PrivySpvAtsExecutor.fromEnv', () => {
  it('is undefined unless the SPV wallet id, address and runtime-signer key are all present', () => {
    const client = {} as Parameters<typeof PrivySpvAtsExecutor.fromEnv>[0];
    expect(PrivySpvAtsExecutor.fromEnv(client, {})).toBeUndefined();
    expect(
      PrivySpvAtsExecutor.fromEnv(client, {
        PRIVY_SPV_WALLET_ID: 'w',
        PRIVY_SPV_WALLET_ADDRESS: '0x1',
      }),
    ).toBeUndefined();
  });
});
