// READ-ONLY verifier for a Catenor One ATS deployEquity transaction on Hedera Testnet. No keys, no signing, no sends.
//
//   pnpm --filter @catenor-one/api verify:ats <transaction hash>
//
// Checks from public chain data only: the receipt (status, sender, target, gas), the on-chain transaction input
// (the Catenor grant reference in the regulation `info` field, the SPV wallet as ATS admin + issuer), the
// EquityDeployed event, the new ATS token's state (name, symbol, decimals, ISIN, supply, roles, KYC mode), and the
// Mirror Node contract result.
import { Factory__factory, IAsset__factory } from '@hashgraph/asset-tokenization-contracts';
import { JsonRpcProvider, formatEther } from 'ethers';
import {
  ATS,
  HEDERA_TESTNET,
  asRunner,
} from '../../src/infrastructure/execution/hedera-ats-executor.js';

const hash = process.argv[2] ?? '';
if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
  console.error('usage: verify:ats <0x transaction hash>');
  process.exit(2);
}
const provider = new JsonRpcProvider(HEDERA_TESTNET.rpcUrl);
const factory = Factory__factory.createInterface();

const [tx, receipt] = await Promise.all([
  provider.getTransaction(hash),
  provider.getTransactionReceipt(hash),
]);
if (!tx || !receipt) throw new Error(`transaction ${hash} not found`);
const call = factory.parseTransaction({ data: tx.data, value: tx.value });
const [equityData, regulationData] = call?.args ?? [];
const deployed = receipt.logs
  .map((log) => factory.parseLog(log))
  .find((parsed) => parsed?.name === 'EquityDeployed');
const equityAddress = deployed?.args['equityAddress'] as string;
const equity = IAsset__factory.connect(equityAddress, asRunner(provider));
const spv = tx.from;
const [name, symbol, decimals, totalSupply, maxSupply, metadata, isAdmin, isIssuer, kyc] =
  await Promise.all([
    equity.name(),
    equity.symbol(),
    equity.decimals(),
    equity.totalSupply(),
    equity.getMaxSupply(),
    equity.getERC20Metadata(),
    equity.hasRole(ATS.defaultAdminRole, spv),
    equity.hasRole(ATS.issuerRole, spv),
    equity.isInternalKycActivated(),
  ]);
const mirror = (await (
  await fetch(`https://testnet.mirrornode.hedera.com/api/v1/contracts/results/${hash}`)
).json()) as Record<string, unknown>;
const gasPrice = receipt.gasPrice ?? tx.gasPrice ?? 0n;

console.log(
  JSON.stringify(
    {
      label: 'READ-ONLY verification (public Hedera Testnet data)',
      transaction: hash,
      hashscan: `${HEDERA_TESTNET.explorer}/transaction/${hash}`,
      chainId: String(tx.chainId),
      status: receipt.status === 1 ? 'SUCCESS' : `FAILED (${receipt.status})`,
      from: spv,
      to: tx.to,
      toIsAtsFactory: tx.to?.toLowerCase() === HEDERA_TESTNET.factory.toLowerCase(),
      function: call?.name,
      value: String(tx.value),
      nonce: tx.nonce,
      gasLimit: String(tx.gasLimit),
      gasUsed: String(receipt.gasUsed),
      gasPriceWeibar: String(gasPrice),
      feeAtGasUsedHbar: formatEther(receipt.gasUsed * gasPrice),
      onChainInput: {
        regulationInfo: regulationData?.additionalSecurityData?.info,
        rbacs: equityData?.security?.rbacs?.map((r: { role: string; members: string[] }) => ({
          role: r.role,
          members: [...r.members],
        })),
      },
      equity: {
        address: equityAddress,
        hashscan: `${HEDERA_TESTNET.explorer}/contract/${equityAddress}`,
        name,
        symbol,
        decimals: Number(decimals),
        isin: metadata.info.isin,
        totalSupply: String(totalSupply),
        maxSupply: String(maxSupply),
        spvHasDefaultAdminRole: isAdmin,
        spvHasIssuerRole: isIssuer,
        internalKycActivated: kyc,
      },
      mirrorNode: {
        result: mirror['result'],
        gasUsed: mirror['gas_used'],
        contractId: mirror['contract_id'],
        createdContractIds: mirror['created_contract_ids'],
        timestamp: mirror['timestamp'],
      },
    },
    null,
    2,
  ),
);
