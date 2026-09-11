// Hedera ATS adapter — offline checks (no network, no key material beyond a throwaway random wallet).
import { Factory__factory } from '@hashgraph/asset-tokenization-contracts';
import { Wallet, type Provider } from 'ethers';
import { describe, expect, it } from 'vitest';
import {
  ATS,
  HederaAtsTestnetExecutor,
  deployEquityArguments,
  isinCheckDigit,
} from './hedera-ats-executor.js';

describe('isinCheckDigit (mirrors the ATS factory isinValidator.sol)', () => {
  it.each([
    ['US037833100', '5'],
    ['AU0000XVGZA', '3'],
    ['GB000263494', '6'],
    ['US594918104', '5'],
  ])('%s → %s', (body, digit) => {
    expect(isinCheckDigit(body)).toBe(digit);
  });

  it('rejects malformed bodies', () => {
    expect(() => isinCheckDigit('us037833100')).toThrow();
    expect(() => isinCheckDigit('US03783310')).toThrow();
  });
});

describe('deployEquityArguments', () => {
  const operator = Wallet.createRandom().address;
  const args = deployEquityArguments({
    resource: 'spv:catenor-demo-001',
    grantId: 'capability-grant-1',
    operator,
  });

  it('encodes against the ATS v8 Factory ABI', () => {
    const data = Factory__factory.createInterface().encodeFunctionData('deployEquity', [
      args.equityData,
      args.regulationData,
    ]);
    expect(data.startsWith('0x')).toBe(true);
  });

  it('operator holds only admin + issuer; KYC, identity registry, compliance and external lists are off', () => {
    const { security } = args.equityData;
    expect(security.rbacs).toEqual([
      { role: ATS.defaultAdminRole, members: [operator] },
      { role: ATS.issuerRole, members: [operator] },
    ]);
    expect(security.internalKycActivated).toBe(false);
    expect(security.externalKycLists).toEqual([]);
    expect(security.compliance).toBe('0x0000000000000000000000000000000000000000');
    expect(security.identityRegistry).toBe('0x0000000000000000000000000000000000000000');
    expect(security.erc20MetadataInfo.isin).toMatch(/^XXCATENOR01\d$/);
  });

  it('links the on-chain token to the Catenor grant that authorized it', () => {
    expect(args.regulationData.additionalSecurityData.info).toBe(
      'catenor-one:TOKENIZE_ASSET:spv:catenor-demo-001:grant:capability-grant-1',
    );
  });

  it('refuses a resource without an ATS mapping', () => {
    expect(() =>
      deployEquityArguments({ resource: 'spv:catenor-demo-002', grantId: 'g', operator }),
    ).toThrow(/no ATS mapping/);
  });
});

describe('HederaAtsTestnetExecutor', () => {
  it('refuses to execute on any chain other than Hedera testnet (296)', async () => {
    const mainnet = { getNetwork: async () => ({ chainId: 295n }) } as unknown as Provider;
    const executor = new HederaAtsTestnetExecutor(Wallet.createRandom().privateKey, mainnet);
    await expect(
      executor.tokenize({ resource: 'spv:catenor-demo-001', requester: 'x', grantId: 'g' }),
    ).rejects.toThrow(/Hedera testnet \(296\) only/);
  });

  it('is not configured without HEDERA_OPERATOR_EVM_PRIVATE_KEY', () => {
    expect(HederaAtsTestnetExecutor.fromEnv({})).toBeUndefined();
  });
});
