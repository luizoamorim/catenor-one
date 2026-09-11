// Agent payout signer boundary — offline checks. Privy is replaced by a throwaway random secp256k1 wallet; the
// provider is a stub. No network, no real key material, nothing broadcast.
import { Transaction, Wallet, type JsonRpcProvider } from 'ethers';
import { describe, expect, it, vi } from 'vitest';
import type { ApprovedPayout } from '../../modules/distribution/application/distribution.service.js';
import { HEDERA_TESTNET } from './hedera-ats-executor.js';
import type { PayoutRefused } from './privy-agent-payout-executor.js';
import {
  PAYOUT_GAS_LIMIT,
  PrivyAgentPayoutExecutor,
  buildPayoutTransaction,
} from './privy-agent-payout-executor.js';
import type { NativeTransferTransaction, PrivyEvmSigningApi } from './privy-spv-ats-executor.js';

const HBAR = 10n ** 18n;
const A = '0x8D726Ab3aD261f03C60D9073F2bf05C9899a7F78';
const B = '0x72f94a15A815853B488BCf225ec3cb67eC5ba444';
const pay: ApprovedPayout = {
  planRef: 'distribution-plan:1',
  investor: 'did:catenor:6109f3910e206af2ed06ecdff4a1bf9f',
  controlled: 'PAY',
  approvedWeibar: 6n * HBAR,
  boundAccount: A,
};
const hold: ApprovedPayout = { ...pay, controlled: 'HOLD', approvedWeibar: 0n, boundAccount: B };
const chain = { nonce: 0, gasPrice: '0x10e15635000' };
const refusal = (f: () => unknown) => {
  try {
    f();
  } catch (e) {
    return (e as PayoutRefused).code;
  }
  return 'NOT_REFUSED';
};

describe('buildPayoutTransaction — Catenor signer boundary (before Privy)', () => {
  it('builds exactly one plain 6 HBAR transfer to the bound account on chain 296', () => {
    expect(buildPayoutTransaction(pay, { recipient: A, amountWeibar: 6n * HBAR }, chain)).toEqual({
      chain_id: 296,
      to: A,
      data: '0x',
      value: '0x53444835ec580000',
      nonce: 0,
      gas_limit: PAYOUT_GAS_LIMIT,
      gas_price: chain.gasPrice,
      type: 0,
    });
  });

  it.each([
    ['a HOLD holder', hold, { recipient: B, amountWeibar: 4n * HBAR }, 'PLAN_RESULT_NOT_PAY'],
    [
      'another recipient',
      pay,
      { recipient: B, amountWeibar: 6n * HBAR },
      'RECIPIENT_NOT_BOUND_ACCOUNT',
    ],
    ['another amount', pay, { recipient: A, amountWeibar: 5n * HBAR }, 'AMOUNT_NOT_APPROVED'],
    [
      'non-empty calldata',
      pay,
      { recipient: A, amountWeibar: 6n * HBAR, data: '0x12345678' },
      'CALLDATA_NOT_EMPTY',
    ],
    [
      'an invalid recipient',
      pay,
      { recipient: '0x1234', amountWeibar: 6n * HBAR },
      'INVALID_RECIPIENT',
    ],
  ])('refuses %s', (_name, approval, request, code) => {
    expect(refusal(() => buildPayoutTransaction(approval, request, chain))).toBe(code);
  });
});

function fixture(
  opts: {
    tamper?: (t: NativeTransferTransaction) => NativeTransferTransaction;
    balance?: bigint;
  } = {},
) {
  const agent = Wallet.createRandom();
  const signRequests: NativeTransferTransaction[] = [];
  const api: PrivyEvmSigningApi = {
    walletAddress: async () => agent.address,
    signTransaction: async (_id, input) => {
      const t0 = input as NativeTransferTransaction;
      signRequests.push(t0);
      const t = opts.tamper ? opts.tamper(t0) : t0;
      return agent.signTransaction({
        type: 0,
        chainId: t.chain_id,
        to: t.to,
        data: t.data,
        value: BigInt(t.value),
        nonce: t.nonce,
        gasLimit: t.gas_limit,
        gasPrice: BigInt(t.gas_price),
      });
    },
  };
  const broadcast = vi.fn();
  const provider = {
    getNetwork: async () => ({ chainId: HEDERA_TESTNET.chainId }),
    getTransactionCount: async () => 0,
    send: async () => chain.gasPrice,
    getBalance: async () => opts.balance ?? 20n * HBAR,
    estimateGas: async () => 22_828n,
    broadcastTransaction: broadcast,
  } as unknown as JsonRpcProvider;
  const executor = new PrivyAgentPayoutExecutor(
    api,
    { walletId: 'agent-wallet', walletAddress: agent.address, runtimeAuthorizationKey: 'k' },
    provider,
  );
  return { executor, agent, signRequests, broadcast };
}

describe('PrivyAgentPayoutExecutor', () => {
  it('prepares and signs the approved payout; the signature recovers to the Agent wallet', async () => {
    const { executor, agent } = fixture();
    const prepared = await executor.prepare(pay, { recipient: A, amountWeibar: 6n * HBAR });
    expect(prepared.maxCostWeibar).toBe(
      6n * HBAR + BigInt(PAYOUT_GAS_LIMIT) * BigInt(chain.gasPrice),
    );
    const { raw, recoveredFrom } = await executor.sign(prepared);
    expect(recoveredFrom).toBe(agent.address);
    expect(Transaction.from(raw).data).toBe('0x');
  });

  it('refuses a gas limit outside [21000, 1000000]', () => {
    const api = {} as PrivyEvmSigningApi;
    const config = { walletId: 'w', walletAddress: A, runtimeAuthorizationKey: 'k' };
    expect(() => new PrivyAgentPayoutExecutor(api, config, undefined, 20_000)).toThrow();
    expect(() => new PrivyAgentPayoutExecutor(api, config, undefined, 2_000_000)).toThrow();
  });

  it('an underfunded Agent wallet is refused before any Privy signature request', async () => {
    const { executor, signRequests } = fixture({ balance: 6n * HBAR });
    await expect(executor.prepare(pay, { recipient: A, amountWeibar: 6n * HBAR })).rejects.toThrow(
      'INSUFFICIENT_AGENT_BALANCE',
    );
    expect(signRequests).toHaveLength(0);
  });

  it('a HOLD holder is refused before any Privy signature request', async () => {
    const { executor, signRequests } = fixture();
    await expect(executor.prepare(hold, { recipient: B, amountWeibar: 0n })).rejects.toThrow(
      'PLAN_RESULT_NOT_PAY',
    );
    expect(signRequests).toHaveLength(0);
  });

  it('never broadcasts when Privy returns a signature over another recipient or amount', async () => {
    for (const tamper of [
      (t: NativeTransferTransaction) => ({ ...t, to: B }),
      (t: NativeTransferTransaction) => ({ ...t, value: `0x${(7n * HBAR).toString(16)}` }),
    ]) {
      const { executor, broadcast } = fixture({ tamper });
      const prepared = await executor.prepare(pay, { recipient: A, amountWeibar: 6n * HBAR });
      await expect(executor.execute(prepared)).rejects.toThrow(
        'SIGNED_TRANSACTION_NOT_THE_APPROVED_PAYOUT',
      );
      expect(broadcast).not.toHaveBeenCalled();
    }
  });
});
