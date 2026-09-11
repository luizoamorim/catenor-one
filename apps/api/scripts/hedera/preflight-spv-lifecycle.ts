// Final demo CP8 preflight — ATS dividend lifecycle on the rehearsal equity via the Privy SPV wallet. NEVER broadcasts.
//
//   pnpm --filter @catenor-one/api preflight:lifecycle
//
// READ-ONLY: SPV roles, dividends count, eth_call + eth_estimateGas of grantRole(ROLE_CORPORATE_ACTION, SPV) from the
// SPV address, eth_call of setDividend (reverts until the role is granted). Privy dry signatures (discarded): the two
// lifecycle calls must be DENIED before the maintainer's policy update and SIGNED after it; unrelated functions (other
// roles/accounts, revokeRole, renounceRole, initializeDividend, setDividend elsewhere, another partition) must stay
// DENIED. A setDividend with other amountDecimals is refused by the Catenor signer boundary (Privy cannot enforce it).
import { IAsset__factory } from '@hashgraph/asset-tokenization-contracts';
import { PrivyClient } from '@privy-io/node';
import { JsonRpcProvider, formatEther } from 'ethers';
import {
  ATS,
  HEDERA_TESTNET,
  asRunner,
} from '../../src/infrastructure/execution/hedera-ats-executor.js';
import {
  PrivySpvAtsExecutor,
  SET_DIVIDEND_GAS_LIMIT,
  privyEvmSigningApi,
  setDividendCalldata,
  type PreparedTransaction,
} from '../../src/infrastructure/execution/privy-spv-ats-executor.js';
import { DEMO_DIVIDEND, DEMO_INVESTORS, REHEARSAL_EQUITY } from '../demo/final-demo-config.js';

process.loadEnvFile(new URL('../../.env', import.meta.url));
const env = (name: string) => process.env[name] ?? '';
const client = new PrivyClient({ appId: env('PRIVY_APP_ID'), appSecret: env('PRIVY_APP_SECRET') });
const executor = PrivySpvAtsExecutor.fromEnv(client);
if (!executor) {
  console.error('BLOCKED: PRIVY_SPV_* values missing in apps/api/.env (values are never printed)');
  process.exit(2);
}
const api = privyEvmSigningApi(client);
const provider = new JsonRpcProvider(HEDERA_TESTNET.rpcUrl);
const iface = IAsset__factory.createInterface();
const equity = IAsset__factory.connect(REHEARSAL_EQUITY, asRunner(provider));
const spv = executor.operatorAddress;
const failures: string[] = [];
const line = (ok: boolean, text: string) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${text}`);
  if (!ok) failures.push(text);
};

const policy = await client.policies().get(env('PRIVY_SPV_POLICY_ID'));
const updated = [
  'allow-grantRole-corporate-action-spv',
  'allow-setDividend-rehearsal-equity',
].every((n) => policy.rules.some((r) => r.name === n));
console.log(`SPV policy lifecycle rules present: ${updated}`);

console.log('1. Hedera (READ-ONLY)');
const [isAdmin, isCorporate, count, paused] = await Promise.all([
  equity.hasRole(ATS.defaultAdminRole, spv),
  equity.hasRole(ATS.corporateActionRole, spv),
  equity.getDividendsCount(),
  equity.paused(),
]);
line(isAdmin, 'SPV holds DEFAULT_ADMIN_ROLE (can grant ROLE_CORPORATE_ACTION)');
line(!paused, 'equity is not paused');
console.log(`  info  SPV holds ROLE_CORPORATE_ACTION: ${isCorporate}; dividends so far: ${count}`);
const grant = await executor.prepareCorporateActionRoleGrant(REHEARSAL_EQUITY);
line(true, `grantRole eth_call accepted; estimateGas ${grant.estimatedGas}`);
const now = BigInt(Math.floor(Date.now() / 1000));
const terms = {
  recordDate: now + BigInt(DEMO_DIVIDEND.recordDelaySeconds),
  executionDate: now + BigInt(DEMO_DIVIDEND.executionDelaySeconds),
  amount: DEMO_DIVIDEND.amount,
  amountDecimals: DEMO_DIVIDEND.amountDecimals,
};
const dividendData = setDividendCalldata(terms, DEMO_DIVIDEND.amountDecimals);
let setDividendSim: string;
try {
  await provider.call({ from: spv, to: REHEARSAL_EQUITY, data: dividendData });
  setDividendSim = 'eth_call accepted (role already granted)';
} catch (e) {
  const data = (e as { data?: string }).data ?? '';
  const parsed = data ? iface.parseError(data) : null;
  setDividendSim = `reverts ${parsed?.name ?? 'UNKNOWN'} until ROLE_CORPORATE_ACTION is granted`;
}
line(isCorporate || setDividendSim.includes('AccountHasNoRole'), `setDividend ${setDividendSim}`);

console.log(
  `2. Privy dry signatures (discarded; nothing is broadcast) — policy ${updated ? 'UPDATED' : 'NOT YET UPDATED'}`,
);
const tx = (data: string, overrides: Partial<PreparedTransaction> = {}): PreparedTransaction => ({
  ...grant.transaction,
  gas_limit: SET_DIVIDEND_GAS_LIMIT,
  data,
  ...overrides,
});
const sign = async (t: PreparedTransaction): Promise<'SIGNED' | 'DENIED' | string> => {
  try {
    await api.signTransaction(
      env('PRIVY_SPV_WALLET_ID'),
      t,
      env('CATENOR_SPV_RUNTIME_AUTHORIZATION_KEY'),
    );
    return 'SIGNED';
  } catch (e) {
    const status = (e as { status?: number }).status;
    return status === 400 ? 'DENIED' : `ERROR ${status ?? ''}`;
  }
};
const expectSigned = updated ? 'SIGNED' : 'DENIED';
try {
  await executor.signPrepared(grant);
  line(
    updated,
    `grantRole(ROLE_CORPORATE_ACTION, SPV) → SIGNED through the signer boundary (expected ${expectSigned})`,
  );
} catch (e) {
  const status = (e as { status?: number }).status;
  line(
    !updated && status === 400,
    `grantRole(ROLE_CORPORATE_ACTION, SPV) → DENIED (expected ${expectSigned})`,
  );
}
line((await sign(tx(dividendData))) === expectSigned, `setDividend(demo terms) → ${expectSigned}`);
const other = DEMO_INVESTORS.A.address;
const denied: [string, PreparedTransaction][] = [
  ['grantRole(ROLE_ISSUER, SPV)', tx(iface.encodeFunctionData('grantRole', [ATS.issuerRole, spv]))],
  [
    'grantRole(DEFAULT_ADMIN_ROLE, SPV)',
    tx(iface.encodeFunctionData('grantRole', [ATS.defaultAdminRole, spv])),
  ],
  [
    'grantRole(ROLE_CORPORATE_ACTION, Investor A)',
    tx(iface.encodeFunctionData('grantRole', [ATS.corporateActionRole, other])),
  ],
  [
    'revokeRole(ROLE_CORPORATE_ACTION, SPV)',
    tx(iface.encodeFunctionData('revokeRole', [ATS.corporateActionRole, spv])),
  ],
  [
    'renounceRole(ROLE_CORPORATE_ACTION)',
    tx(iface.encodeFunctionData('renounceRole', [ATS.corporateActionRole])),
  ],
  ['initializeDividend()', tx(iface.encodeFunctionData('initializeDividend'))],
  // (The CP1 deployEquity rule allows the ATS Factory target without a function restriction, so an unrelated contract
  // is used here; the Factory itself has no setDividend.)
  [
    'setDividend → Business Logic Resolver',
    tx(dividendData, { to: HEDERA_TESTNET.businessLogicResolver }),
  ],
  ['setDividend on chain 1', tx(dividendData, { chain_id: 1 })],
  [
    'issueByPartition on partition 0x…02',
    tx(
      iface.encodeFunctionData('issueByPartition', [
        { partition: `0x${'0'.repeat(63)}2`, tokenHolder: other, value: 1n, data: '0x' },
      ]),
    ),
  ],
];
for (const [name, t] of denied) line((await sign(t)) === 'DENIED', `${name} → DENIED`);
try {
  setDividendCalldata({ ...terms, amountDecimals: 3 }, DEMO_DIVIDEND.amountDecimals);
  line(false, 'setDividend with amountDecimals 3 → refused by the Catenor signer boundary');
} catch {
  line(
    true,
    'setDividend with amountDecimals 3 → refused by the Catenor signer boundary (never sent to Privy)',
  );
}

const price = BigInt(grant.transaction.gas_price);
console.log(
  `\n${JSON.stringify(
    {
      label: 'PREFLIGHT — READ-ONLY + Privy dry signatures; NOTHING BROADCAST',
      equity: REHEARSAL_EQUITY,
      spv,
      spvBalanceHbar: formatEther(grant.balanceWeibar),
      spvNonce: grant.transaction.nonce,
      grantRole: {
        call: 'grantRole(ROLE_CORPORATE_ACTION, SPV)',
        estimatedGas: String(grant.estimatedGas),
        gasLimit: grant.transaction.gas_limit,
        estimatedHbar: formatEther(grant.estimatedGas * price),
        maxHbar: formatEther(grant.maxCostWeibar),
      },
      setDividend: {
        call: `setDividend({recordDate: now+${DEMO_DIVIDEND.recordDelaySeconds}s, executionDate: now+${DEMO_DIVIDEND.executionDelaySeconds}s, amount: ${DEMO_DIVIDEND.amount}, amountDecimals: ${DEMO_DIVIDEND.amountDecimals}})`,
        simulation: setDividendSim,
        gasLimit: SET_DIVIDEND_GAS_LIMIT,
        maxHbar: formatEther(BigInt(SET_DIVIDEND_GAS_LIMIT) * price),
        expectedEntitlements:
          'A 600 × 0.01 = 6; B 400 × 0.01 = 4 (ownership-based; ATS moves no funds)',
      },
      failures,
    },
    null,
    2,
  )}`,
);
process.exit(failures.length === 0 ? 0 : 1);
