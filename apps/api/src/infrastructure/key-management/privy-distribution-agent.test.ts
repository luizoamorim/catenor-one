// Distribution Agent wallet policy — offline shape checks (the live Privy behaviour was probed in CP7).
import { describe, expect, it } from 'vitest';
import { agentPolicyRules } from './privy-distribution-agent.js';

const A = '0x8D726Ab3aD261f03C60D9073F2bf05C9899a7F78';
const B = '0x72f94a15A815853B488BCf225ec3cb67eC5ba444';

describe('agentPolicyRules (narrower than the SPV policy)', () => {
  it('allows only eth_signTransaction on chain 296, to the investor wallets, up to the cap; denies exports', () => {
    const rules = agentPolicyRules([A.toLowerCase(), B], 20n * 10n ** 18n);
    expect(rules).toHaveLength(3);
    expect(rules[0]).toEqual({
      name: 'allow-distribution-payout-hedera',
      method: 'eth_signTransaction',
      action: 'ALLOW',
      conditions: [
        { field_source: 'ethereum_transaction', field: 'chain_id', operator: 'eq', value: '296' },
        { field_source: 'ethereum_transaction', field: 'to', operator: 'in', value: [A, B] },
        {
          field_source: 'ethereum_transaction',
          field: 'value',
          operator: 'lte',
          value: '0x1158e460913d00000',
        },
      ],
    });
    expect(rules.slice(1).map((r) => [r.method, r.action])).toEqual([
      ['exportPrivateKey', 'DENY'],
      ['exportSeedPhrase', 'DENY'],
    ]);
    // No rule reaches ATS contracts, calldata functions or any other method.
    expect(JSON.stringify(rules)).not.toContain('ethereum_calldata');
  });

  it('refuses an empty or invalid recipient list and a non-positive cap', () => {
    expect(() => agentPolicyRules([], 1n)).toThrow();
    expect(() => agentPolicyRules(['0x1234'], 1n)).toThrow();
    expect(() => agentPolicyRules([A], 0n)).toThrow();
  });
});
