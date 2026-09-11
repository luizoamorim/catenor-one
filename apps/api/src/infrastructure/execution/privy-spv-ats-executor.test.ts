// Privy SPV ATS executor — offline checks. Privy is replaced by a throwaway random secp256k1 wallet; the provider is
// a stub. No network, no real key material, nothing broadcast.
import { Factory__factory, IAsset__factory } from '@hashgraph/asset-tokenization-contracts';
import { AbiCoder, Transaction, Wallet, type JsonRpcProvider } from 'ethers';
import { describe, expect, it, vi } from 'vitest';
import { ATS, DEPLOY_GAS_LIMIT, HEDERA_TESTNET } from './hedera-ats-executor.js';
import {
  ISSUE_GAS_LIMIT,
  PrivySpvAtsExecutor,
  corporateActionRoleGrantCalldata,
  issueByPartitionCalldata,
  setDividendCalldata,
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
    signTransaction: async (_walletId, input) => {
      const tx = input as PreparedTransaction; // this suite only signs SPV contract calls
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
    estimateGas: async (call: { to: string }) =>
      call.to === HEDERA_TESTNET.factory ? 7_405_139n : 250_000n,
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

describe('issueByPartition (FD-4) — Catenor-built calldata + signer boundary', () => {
  const EQUITY = '0x7aeDA4b6B89dA392Efd88AD0Fcb075e12ab6a418';
  const holder = Wallet.createRandom().address;

  it('builds exactly issueByPartition(default partition, holder, amount, empty data)', () => {
    const data = issueByPartitionCalldata({ tokenHolder: holder, amount: 600n });
    const iface = IAsset__factory.createInterface();
    expect(data.slice(0, 10)).toBe(iface.getFunction('issueByPartition')!.selector);
    const [issue] = iface.decodeFunctionData('issueByPartition', data);
    expect(issue.partition).toBe(ATS.defaultPartition);
    expect(issue.tokenHolder).toBe(holder);
    expect(issue.value).toBe(600n);
    expect(issue.data).toBe('0x');
  });

  it('refuses a zero amount, an invalid holder and the SPV wallet as holder', async () => {
    expect(() => issueByPartitionCalldata({ tokenHolder: holder, amount: 0n })).toThrow(/positive/);
    expect(() => issueByPartitionCalldata({ tokenHolder: '0x1234', amount: 1n })).toThrow(/holder/);
    const { executor, spv } = fixture({});
    await expect(
      executor.prepareIssueByPartition({ equity: EQUITY, tokenHolder: spv.address, amount: 1n }),
    ).rejects.toThrow(/SPV wallet cannot be the token holder/);
  });

  it('prepares the issuance to the equity with the issuance gas limit', async () => {
    const { executor } = fixture({});
    const prepared = await executor.prepareIssueByPartition({
      equity: EQUITY,
      tokenHolder: holder,
      amount: 600n,
    });
    expect(prepared.transaction).toMatchObject({
      to: EQUITY,
      value: 0,
      gas_limit: ISSUE_GAS_LIMIT,
    });
    expect(prepared.transaction.data).toBe(
      issueByPartitionCalldata({ tokenHolder: holder, amount: 600n }),
    );
  });

  it('never broadcasts when Privy returns a signature over another holder', async () => {
    const other = Wallet.createRandom().address;
    const { executor, broadcast } = fixture({
      signedTamper: (t) => ({
        ...t,
        data: issueByPartitionCalldata({ tokenHolder: other, amount: 600n }),
      }),
    });
    await expect(
      executor.issueByPartition({ equity: EQUITY, tokenHolder: holder, amount: 600n }),
    ).rejects.toThrow(/signer boundary/);
    expect(broadcast).not.toHaveBeenCalled();
  });
});

describe('dividend lifecycle (CP8) — Catenor-built calldata', () => {
  const spvAddr = Wallet.createRandom().address;
  const iface = IAsset__factory.createInterface();
  const terms = {
    recordDate: 1_789_150_000n,
    executionDate: 1_789_150_180n,
    amount: 1n,
    amountDecimals: 2,
  };

  it('grantRole is fixed to ROLE_CORPORATE_ACTION for the SPV account', () => {
    const [role, account] = iface.decodeFunctionData(
      'grantRole',
      corporateActionRoleGrantCalldata(spvAddr),
    );
    expect(role).toBe(ATS.corporateActionRole);
    expect(account).toBe(spvAddr);
  });

  it('setDividend encodes exactly the validated terms', () => {
    const [d] = iface.decodeFunctionData('setDividend', setDividendCalldata(terms, 2));
    expect([d.recordDate, d.executionDate, d.amount, Number(d.amountDecimals)]).toEqual([
      terms.recordDate,
      terms.executionDate,
      1n,
      2,
    ]);
  });

  it('refuses another amountDecimals (Privy cannot enforce this uint8 field), zero amount and bad dates', () => {
    expect(() => setDividendCalldata({ ...terms, amountDecimals: 3 }, 2)).toThrow(/amountDecimals/);
    expect(() => setDividendCalldata({ ...terms, amount: 0n }, 2)).toThrow(/amount/);
    expect(() =>
      setDividendCalldata({ ...terms, executionDate: terms.recordDate - 1n }, 2),
    ).toThrow(/dates/);
    expect(() => setDividendCalldata({ ...terms, recordDate: 0n }, 2)).toThrow(/dates/);
  });

  it('never broadcasts a lifecycle call whose Privy signature covers other calldata', async () => {
    const { executor, broadcast } = fixture({
      signedTamper: (t) => ({
        ...t,
        data: corporateActionRoleGrantCalldata(Wallet.createRandom().address),
      }),
    });
    const prepared = await executor.prepareCorporateActionRoleGrant(
      '0x7aeDA4b6B89dA392Efd88AD0Fcb075e12ab6a418',
    );
    await expect(executor.executePrepared(prepared)).rejects.toThrow(/signer boundary/);
    expect(broadcast).not.toHaveBeenCalled();
  });
});
