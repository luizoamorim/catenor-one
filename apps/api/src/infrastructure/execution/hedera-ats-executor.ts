// Hedera Asset Tokenization Studio (ATS) — testnet execution adapter for Part B (hackathon, Catenor One [REF-IMPL]).
// Invoked by AssetTokenizationService ONLY after a Catenor ALLOW. The authorized action is exactly ONE transaction:
// `Factory.deployEquity` on the live ATS testnet factory, which creates the ATS security token for the demo asset
// (`spv:catenor-demo-001`). No units are issued. The transaction carries the Catenor grant reference in the
// regulation `info` field so the on-chain token links back to the grant that authorized it.
//
// DEV/TEST ONLY (final demo, 2026-09-11): the demo path uses PrivySpvAtsExecutor (privy-spv-ats-executor.ts) — the
// Privy-managed SPV wallet signs; HEDERA_OPERATOR_EVM_PRIVATE_KEY is not used by the final demo.
//
// Execution separation: the transaction is sent by a Catenor One Hedera testnet operator account (ECDSA secp256k1,
// EVM alias). That account is an execution adapter — it is not Org B's authority and not a Catenor signing key
// (Credential Assertion Key ≠ Financial Execution Key). Its private key comes from the git-ignored apps/api/.env
// (HEDERA_OPERATOR_EVM_PRIVATE_KEY) and is never printed or logged.
//
// Contract bindings: @hashgraph/asset-tokenization-contracts 8.0.0 (typechain, ethers v6). Addresses are the v8
// testnet deployment (packages/ats/contracts/deployments/hedera-testnet in the ATS repository), not the outdated
// v4 addresses on the documentation site.
import { Factory__factory, IAsset__factory } from '@hashgraph/asset-tokenization-contracts';
import { JsonRpcProvider, Wallet, ZeroAddress, ZeroHash, type Provider } from 'ethers';
import type { AssetTokenizationExecutor } from '../../modules/asset-tokenization/application/asset-tokenization.service.js';

export const HEDERA_TESTNET = {
  chainId: 296n,
  rpcUrl: 'https://testnet.hashio.io/api',
  factory: '0xd1F118A40f3b02883D35909eF2517e7EDd78379d', // 0.0.9213391
  businessLogicResolver: '0xBA2D5FC2083A0b8f164c50e65d782087fBA18E0a', // 0.0.9212226
  explorer: 'https://hashscan.io/testnet',
} as const;

/** ATS constants (contracts/constants/roles.sol, scripts EQUITY_CONFIG_ID). */
export const ATS = {
  equityConfigId: `0x${'0'.repeat(63)}1`,
  equityConfigVersion: 1,
  defaultAdminRole: ZeroHash,
  issuerRole: '0x5eeaf5602c75bf26e73b5206d0bd6ee82f621166255e5fd73cc06bc7bd84a95f',
  regulationTypeRegS: 1,
  regulationSubTypeNone: 0,
  /** _DEFAULT_PARTITION (contracts/constants/values.sol); the demo equity is single-partition. */
  defaultPartition: `0x${'0'.repeat(63)}1`,
  /** ROLE_CORPORATE_ACTION (contracts/constants/roles.sol) — required by setDividend. */
  corporateActionRole: '0xa1acfc499025c99f55059195e6276f639d34a18aad7b8121b9192b7f438c55cd',
} as const;

/** Hedera's per-transaction maximum; unused gas is refunded, but the sender must hold gasLimit × gasPrice up front. */
export const DEPLOY_GAS_LIMIT = 15_000_000;

// The typechain bindings are CommonJS, so their `ethers` types resolve to ethers' lib.commonjs declarations while
// this ESM module resolves lib.esm — two nominally different copies of the same ethers 6.17.0 API. ethers accepts
// any object with the ContractRunner shape at runtime, so the runner is passed through this narrow cast.
type AtsRunner = Parameters<typeof Factory__factory.connect>[1];
export const asRunner = (runner: Wallet | Provider) => runner as unknown as AtsRunner;

/** ISO 6166 check digit, mirroring the ATS factory's isinValidator.sol (letters → 10..35, Luhn over the digits). */
export function isinCheckDigit(first11: string): string {
  if (!/^[A-Z]{2}[A-Z0-9]{9}$/.test(first11)) {
    throw new Error('ISIN body must be 2 letters + 9 alphanumerics');
  }
  const digits = [...first11]
    .map((c) => (c >= 'A' ? String(c.charCodeAt(0) - 55) : c))
    .join('')
    .split('')
    .map(Number);
  let sum = 0;
  // From the rightmost digit, every other digit (starting with the rightmost) is doubled.
  for (let i = digits.length - 1, double = true; i >= 0; i--, double = !double) {
    const d = digits[i]! * (double ? 2 : 1);
    sum += d > 9 ? Math.floor(d / 10) + (d % 10) : d;
  }
  return String((10 - (sum % 10)) % 10);
}

/** Clean-room demo token identity for spv:catenor-demo-001 (SYNTHETIC; "XX" is not an ISIN country prefix). */
export const CLEAN_ROOM_ASSET = {
  name: 'Catenor One Demo SPV 001 (SYNTHETIC)',
  symbol: 'C1SPV001',
  isinBody: 'XXCATSPV001',
} as const;

/** The demo assets this adapter may tokenize. SYNTHETIC: "XX" is not an assigned ISIN country prefix. */
export const DEMO_ASSETS: Readonly<
  Record<string, { readonly name: string; readonly symbol: string; readonly isinBody: string }>
> = {
  'spv:catenor-demo-001': {
    name: 'Catenor One Demo Asset 001 (SYNTHETIC)',
    symbol: 'C1DA001',
    isinBody: 'XXCATENOR01',
  },
};

/** The deployEquity arguments: KYC off, no identity registry / compliance / external lists, operator = admin + issuer. */
export function deployEquityArguments(input: {
  readonly resource: string;
  readonly grantId: string;
  readonly operator: string;
  /** Clean-room demo: an explicit token identity for the resource (else the rehearsal DEMO_ASSETS mapping). */
  readonly asset?: { readonly name: string; readonly symbol: string; readonly isinBody: string };
}) {
  const asset = input.asset ?? DEMO_ASSETS[input.resource];
  if (asset === undefined) throw new Error(`no ATS mapping for resource ${input.resource}`);
  const equityData = {
    security: {
      resolver: HEDERA_TESTNET.businessLogicResolver,
      maxSupply: 1_000_000n,
      resolverProxyConfiguration: { key: ATS.equityConfigId, version: ATS.equityConfigVersion },
      erc20MetadataInfo: {
        name: asset.name,
        symbol: asset.symbol,
        isin: asset.isinBody + isinCheckDigit(asset.isinBody),
        decimals: 0,
      },
      rbacs: [
        { role: ATS.defaultAdminRole, members: [input.operator] },
        { role: ATS.issuerRole, members: [input.operator] },
      ],
      externalPauses: [],
      externalControlLists: [],
      externalKycLists: [],
      compliance: ZeroAddress,
      identityRegistry: ZeroAddress,
      arePartitionsProtected: false,
      isMultiPartition: false,
      isControllable: true,
      isWhiteList: false,
      clearingActive: false,
      internalKycActivated: false,
      erc20VotesActivated: false,
    },
    equityDetails: {
      votingRight: false,
      informationRight: true,
      liquidationRight: false,
      subscriptionRight: false,
      conversionRight: false,
      redemptionRight: false,
      putRight: false,
      dividendRight: 0,
      currency: '0x555344', // "USD"
      nominalValue: 100n,
      nominalValueDecimals: 2,
    },
  };
  const regulationData = {
    regulationType: ATS.regulationTypeRegS,
    regulationSubType: ATS.regulationSubTypeNone,
    additionalSecurityData: {
      countriesControlListType: false,
      listOfCountries: '',
      info: `catenor-one:TOKENIZE_ASSET:${input.resource}:grant:${input.grantId}`,
    },
  };
  return { equityData, regulationData };
}

/** Receipt → EquityDeployed address → read-back of the new ATS token's name (no transaction). */
export async function deployedEquityResult(
  hash: string,
  // Structural: the CommonJS typechain receipt and the ESM ethers receipt are nominally different types.
  receipt: {
    readonly status: number | null;
    readonly logs: readonly { readonly topics: readonly string[]; readonly data: string }[];
  } | null,
  provider: Provider,
) {
  if (receipt === null || receipt.status !== 1) {
    throw new Error(`deployEquity transaction ${hash} did not succeed`);
  }
  const factory = Factory__factory.createInterface();
  const deployed = receipt.logs
    .map((log) => factory.parseLog(log))
    .find((parsed) => parsed?.name === 'EquityDeployed');
  const equityAddress = deployed?.args['equityAddress'] as string | undefined;
  if (equityAddress === undefined) throw new Error(`no EquityDeployed event in ${hash}`);
  const name = await IAsset__factory.connect(equityAddress, asRunner(provider)).name();
  return {
    transactionId: hash,
    explorerUrl: `${HEDERA_TESTNET.explorer}/transaction/${hash}`,
    assetReference: `hedera-testnet:ats-equity:${equityAddress}`,
    assetName: name,
  };
}

export class HederaAtsTestnetExecutor implements AssetTokenizationExecutor {
  readonly network = 'hedera-testnet';
  private readonly wallet: Wallet;

  constructor(
    operatorPrivateKey: string,
    private readonly provider: Provider = new JsonRpcProvider(HEDERA_TESTNET.rpcUrl),
  ) {
    this.wallet = new Wallet(operatorPrivateKey, provider);
  }

  /** Reads HEDERA_OPERATOR_EVM_PRIVATE_KEY (and optional HEDERA_JSON_RPC_URL); undefined when not configured. */
  static fromEnv(env: NodeJS.ProcessEnv = process.env): HederaAtsTestnetExecutor | undefined {
    const key = env['HEDERA_OPERATOR_EVM_PRIVATE_KEY'] ?? '';
    if (key === '') return undefined;
    const rpcUrl = env['HEDERA_JSON_RPC_URL'] || HEDERA_TESTNET.rpcUrl;
    return new HederaAtsTestnetExecutor(key, new JsonRpcProvider(rpcUrl));
  }

  get operatorAddress(): string {
    return this.wallet.address;
  }

  /** Account nonce — equal before and after a DENY shows that no transaction was sent. */
  async operatorNonce(): Promise<number> {
    return this.provider.getTransactionCount(this.wallet.address, 'latest');
  }

  async assertTestnet(): Promise<void> {
    const { chainId } = await this.provider.getNetwork();
    if (chainId !== HEDERA_TESTNET.chainId) {
      throw new Error(`refusing to execute on chain ${chainId}: Hedera testnet (296) only`);
    }
  }

  async tokenize(input: {
    readonly resource: string;
    readonly requester: string;
    readonly grantId: string;
  }) {
    await this.assertTestnet();
    const { equityData, regulationData } = deployEquityArguments({
      resource: input.resource,
      grantId: input.grantId,
      operator: this.wallet.address,
    });
    const factory = Factory__factory.connect(HEDERA_TESTNET.factory, asRunner(this.wallet));
    const tx = await factory.deployEquity(equityData, regulationData, {
      gasLimit: DEPLOY_GAS_LIMIT,
    });
    return deployedEquityResult(tx.hash, await tx.wait(1, 180_000), this.provider);
  }
}
