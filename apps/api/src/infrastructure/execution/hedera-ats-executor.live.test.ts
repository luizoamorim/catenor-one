// LIVE Hedera ATS testnet — opt-in: `pnpm test:hedera-live`. Sends ONE real `deployEquity` transaction (≈ 9 HBAR)
// from the maintainer's testnet operator account. Skipped unless apps/api/.env has HEDERA_OPERATOR_EVM_PRIVATE_KEY
// and CATENOR_HEDERA_LIVE=1 is set (so `pnpm test:privy-live` never spends HBAR). The key is never printed.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { HederaAtsTestnetExecutor } from './hedera-ats-executor.js';

const envFile = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);
const executor =
  process.env['CATENOR_HEDERA_LIVE'] === '1' ? HederaAtsTestnetExecutor.fromEnv() : undefined;

describe.skipIf(executor === undefined)('LIVE Hedera ATS testnet executor', () => {
  it('deploys the demo asset as an ATS equity in exactly one transaction', async () => {
    const before = await executor!.operatorNonce();
    const result = await executor!.tokenize({
      resource: 'spv:catenor-demo-001',
      requester: 'did:catenor:live-test',
      grantId: 'capability-grant-live-test',
    });
    expect(result.transactionId).toMatch(/^0x[0-9a-f]{64}$/);
    expect(result.assetReference).toMatch(/^hedera-testnet:ats-equity:0x[0-9a-fA-F]{40}$/);
    expect(result.assetName).toBe('Catenor One Demo Asset 001 (SYNTHETIC)');
    expect(await executor!.operatorNonce()).toBe(before + 1);
    console.log(`Hedera testnet: ${result.explorerUrl} → ${result.assetReference}`);
  });
});
