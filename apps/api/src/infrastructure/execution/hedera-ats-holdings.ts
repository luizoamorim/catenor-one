// READ-ONLY ATS holdings on Hedera testnet for the distribution plan (final demo). No keys, no transactions.
import { IAsset__factory } from '@hashgraph/asset-tokenization-contracts';
import { JsonRpcProvider, type Provider } from 'ethers';
import type { HoldingsReader } from '../../modules/distribution/application/distribution.service.js';
import { HEDERA_TESTNET, asRunner } from './hedera-ats-executor.js';

export class HederaAtsHoldingsReader implements HoldingsReader {
  constructor(private readonly provider: Provider = new JsonRpcProvider(HEDERA_TESTNET.rpcUrl)) {}

  balanceOf(asset: string, holder: string): Promise<bigint> {
    return IAsset__factory.connect(asset, asRunner(this.provider)).balanceOf(holder);
  }

  /** Native HBAR balance (18-decimal weibar) — READ-ONLY. */
  nativeBalance(account: string): Promise<bigint> {
    return this.provider.getBalance(account);
  }
}
