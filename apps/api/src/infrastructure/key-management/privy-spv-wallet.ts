// Privy execution wallet for the SPV — clean-room demo (FD-2: created at runtime after the Sponsor's ALLOW, from
// PUBLIC values only). Same custody pattern as S001 D34/D36 and the Distribution Agent:
//   policy + wallet owner = the SPV management-owner P-256 authorization key (maintainer custody, never runtime);
//   runtime access = an additional signer (the SPV runtime-signer key quorum) scoped by this policy.
// The wallet policy is an EXECUTION CONTROL, never the Catenor authorization. Rule shapes are exactly the ones
// proven live in CP1 / CP4 / CP8 (privy-engineer probes):
//   phase 1 (at creation): ALLOW eth_signTransaction iff chain_id 296 ∧ to = the ATS v8 Factory; DENY exports.
//   phase 2 (after deployEquity, owner-authorized): issueByPartition on the default partition, grantRole(
//   ROLE_CORPORATE_ACTION, SPV) and setDividend — each pinned to chain 296 ∧ to = the new equity.
import { IAsset__factory } from '@hashgraph/asset-tokenization-contracts';
import type { PrivyClient } from '@privy-io/node';
import { getAddress, isAddress } from 'ethers';
import type { SpvWalletProvisioner } from '../../modules/sponsor-authorization/application/sponsor-authorization.service.js';
import { ATS, HEDERA_TESTNET } from '../execution/hedera-ats-executor.js';

export interface PrivySpvWalletConfig {
  /** SPV management-owner authorization key — PUBLIC part only (SPKI DER, base64). */
  readonly ownerPublicKey: string;
  /** Key quorum holding the SPV runtime-signer authorization public key. */
  readonly runtimeSignerQuorumId: string;
}

const ISSUE_ABI = [
  {
    type: 'function',
    name: 'issueByPartition',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: '_issueData',
        type: 'tuple',
        components: [
          { name: 'partition', type: 'bytes32' },
          { name: 'tokenHolder', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'data', type: 'bytes' },
        ],
      },
    ],
    outputs: [],
  },
];
const GRANT_ABI = [
  {
    type: 'function',
    name: 'grantRole',
    stateMutability: 'nonpayable',
    inputs: [
      { internalType: 'bytes32', name: '_role', type: 'bytes32' },
      { internalType: 'address', name: '_account', type: 'address' },
    ],
    outputs: [{ internalType: 'bool', name: 'success_', type: 'bool' }],
  },
];
const DIVIDEND_ABI = [
  {
    type: 'function',
    name: 'setDividend',
    stateMutability: 'nonpayable',
    inputs: [
      {
        internalType: 'struct IDividendTypes.Dividend',
        name: 'newDividend',
        type: 'tuple',
        components: [
          { internalType: 'uint256', name: 'recordDate', type: 'uint256' },
          { internalType: 'uint256', name: 'executionDate', type: 'uint256' },
          { internalType: 'uint256', name: 'amount', type: 'uint256' },
          { internalType: 'uint8', name: 'amountDecimals', type: 'uint8' },
        ],
      },
    ],
    outputs: [{ internalType: 'uint256', name: 'dividendId_', type: 'uint256' }],
  },
];

/** Refuses to build rules if the ATS package signatures differ from the ABI fragments the probes verified. */
function assertAtsSignatures() {
  const iface = IAsset__factory.createInterface();
  if (
    iface.getFunction('issueByPartition')?.format('sighash') !==
      'issueByPartition((bytes32,address,uint256,bytes))' ||
    iface.getFunction('grantRole')?.format('sighash') !== 'grantRole(bytes32,address)' ||
    iface.getFunction('setDividend')?.format('sighash') !==
      'setDividend((uint256,uint256,uint256,uint8))'
  ) {
    throw new Error('the ATS package signatures differ from the verified ABI fragments');
  }
}

const denyExports = [
  {
    name: 'deny-exportPrivateKey',
    method: 'exportPrivateKey' as const,
    action: 'DENY' as const,
    conditions: [],
  },
  {
    name: 'deny-exportSeedPhrase',
    method: 'exportSeedPhrase' as const,
    action: 'DENY' as const,
    conditions: [],
  },
];

/** Phase 1: the only thing the SPV wallet may sign at creation is a transaction to the ATS Factory on chain 296. */
export function spvDeployRules() {
  return [
    {
      name: 'allow-ats-factory-hedera-testnet',
      method: 'eth_signTransaction' as const,
      action: 'ALLOW' as const,
      conditions: [
        {
          field_source: 'ethereum_transaction' as const,
          field: 'chain_id' as const,
          operator: 'eq' as const,
          value: '296',
        },
        {
          field_source: 'ethereum_transaction' as const,
          field: 'to' as const,
          operator: 'eq' as const,
          value: HEDERA_TESTNET.factory,
        },
      ],
    },
    ...denyExports,
  ];
}

/** Phase 2 (owner-authorized, after deployEquity): issuance + dividend lifecycle, pinned to this equity. */
export function spvEquityRules(equity: string, spv: string) {
  if (!isAddress(equity) || !isAddress(spv)) throw new Error('invalid equity or SPV address');
  assertAtsSignatures();
  const base = [
    { field_source: 'ethereum_transaction', field: 'chain_id', operator: 'eq', value: '296' },
    {
      field_source: 'ethereum_transaction',
      field: 'to',
      operator: 'eq',
      value: getAddress(equity),
    },
  ];
  return [
    {
      name: 'allow-issueByPartition-equity',
      method: 'eth_signTransaction',
      action: 'ALLOW',
      conditions: [
        ...base,
        {
          field_source: 'ethereum_calldata',
          field: 'function_name',
          abi: ISSUE_ABI,
          operator: 'eq',
          value: 'issueByPartition',
        },
        {
          field_source: 'ethereum_calldata',
          field: 'issueByPartition._issueData.partition',
          abi: ISSUE_ABI,
          operator: 'eq',
          value: ATS.defaultPartition,
        },
      ],
    },
    {
      name: 'allow-grantRole-corporate-action-to-spv',
      method: 'eth_signTransaction',
      action: 'ALLOW',
      conditions: [
        ...base,
        {
          field_source: 'ethereum_calldata',
          field: 'function_name',
          abi: GRANT_ABI,
          operator: 'eq',
          value: 'grantRole',
        },
        {
          field_source: 'ethereum_calldata',
          field: 'grantRole._role',
          abi: GRANT_ABI,
          operator: 'eq',
          value: ATS.corporateActionRole,
        },
        {
          field_source: 'ethereum_calldata',
          field: 'grantRole._account',
          abi: GRANT_ABI,
          operator: 'eq',
          value: getAddress(spv),
        },
      ],
    },
    {
      name: 'allow-setDividend-equity',
      method: 'eth_signTransaction',
      action: 'ALLOW',
      conditions: [
        ...base,
        {
          field_source: 'ethereum_calldata',
          field: 'function_name',
          abi: DIVIDEND_ABI,
          operator: 'eq',
          value: 'setDividend',
        },
      ],
    },
  ] as const;
}

export class PrivySpvWalletProvisioner implements SpvWalletProvisioner {
  readonly adapter = 'privy';

  constructor(
    private readonly client: PrivyClient,
    private readonly config: PrivySpvWalletConfig,
  ) {}

  async provision(input: { readonly spvDid: string; readonly resource: string }) {
    const policy = await this.client.policies().create({
      version: '1.0',
      name: `catenor-one-spv-execution-${input.spvDid.slice(-8)}`,
      chain_type: 'ethereum',
      owner: { public_key: this.config.ownerPublicKey },
      rules: spvDeployRules(),
    });
    const created = await this.client.wallets().create({
      chain_type: 'ethereum',
      owner: { public_key: this.config.ownerPublicKey },
      policy_ids: [policy.id],
      additional_signers: [
        { signer_id: this.config.runtimeSignerQuorumId, override_policy_ids: [policy.id] },
      ],
    });
    const wallet = await this.client.wallets().get(created.id);
    const signers = wallet.additional_signers;
    if (
      wallet.chain_type !== 'ethereum' ||
      JSON.stringify(wallet.policy_ids) !== JSON.stringify([policy.id]) ||
      signers.length !== 1 ||
      signers[0]?.signer_id !== this.config.runtimeSignerQuorumId ||
      JSON.stringify(signers[0]?.override_policy_ids) !== JSON.stringify([policy.id])
    ) {
      throw new Error('the Privy SPV wallet read-back does not match the requested controls');
    }
    return {
      walletRef: wallet.id,
      address: getAddress(wallet.address),
      policyRef: policy.id,
      controls: [
        `ALLOW eth_signTransaction iff chain_id = ${HEDERA_TESTNET.chainId} ∧ to = the ATS v8 Factory (${HEDERA_TESTNET.factory})`,
        'DENY exportPrivateKey, exportSeedPhrase; everything else denied by default',
        `after deployEquity (owner-authorized): issueByPartition (default partition), grantRole(ROLE_CORPORATE_ACTION, SPV), setDividend — pinned to the new equity`,
        'policy owned by the SPV management-owner key (outside the runtime); the runtime signer cannot change it',
      ],
    };
  }

  /**
   * Phase 2 — run by the MAINTAINER after deployEquity: adds the equity-pinned rules with the management-owner key
   * (read from its 0600 file by the calling script, never logged). Idempotent by rule name; read-back verified.
   */
  static async addEquityRules(
    client: PrivyClient,
    input: {
      readonly policyId: string;
      readonly equity: string;
      readonly spv: string;
      readonly ownerPrivateKey: string;
    },
  ): Promise<{ added: string[]; rules: string[] }> {
    const rules = spvEquityRules(input.equity, input.spv);
    const before = await client.policies().get(input.policyId);
    const added: string[] = [];
    for (const rule of rules) {
      if (before.rules.some((r) => r.name === rule.name)) continue;
      await client.policies().createRule(input.policyId, {
        ...(rule as unknown as Parameters<ReturnType<PrivyClient['policies']>['createRule']>[1]),
        authorization_context: { authorization_private_keys: [input.ownerPrivateKey] },
      });
      added.push(rule.name);
    }
    const after = await client.policies().get(input.policyId);
    const names = after.rules.map((r) => r.name);
    if (!rules.every((r) => names.includes(r.name))) {
      throw new Error('the SPV policy read-back does not show the equity rules');
    }
    return { added, rules: names };
  }
}
