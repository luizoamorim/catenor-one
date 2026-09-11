// Privy execution wallet for the Distribution Agent (final demo FD-5, Catenor One [REF-IMPL]). Created LIVE by the
// CREATE DISTRIBUTION AGENT action, from PUBLIC values only (the same custody pattern as S001 D34/D36 and the SPV):
//   policy + wallet owner = the Agent management-owner P-256 authorization key (maintainer custody, never runtime);
//   runtime access = an additional signer (the Agent runtime-signer key quorum) scoped by this policy.
// The wallet policy is an EXECUTION CONTROL — narrower than the SPV's — never the Catenor authorization:
//   ALLOW eth_signTransaction iff chain_id == 296 ∧ to ∈ {the SPV asset's investor wallets} ∧ value ≤ cap;
//   DENY exportPrivateKey / exportSeedPhrase; everything else default-denied (no ATS contract, no SPV wallet, no other
//   chain). Shapes (`in`, hex `value lte`) confirmed live by privy-engineer, CP7 probe. Privy cannot require empty
//   calldata; the Catenor signer boundary enforces plain transfers when a payout is signed.
import type { PrivyClient } from '@privy-io/node';
import { formatEther, getAddress, isAddress } from 'ethers';
import type { DistributionAgentWalletProvisioner } from '../../modules/distribution/application/distribution.service.js';

export interface PrivyDistributionAgentConfig {
  /** Agent management-owner authorization key — PUBLIC part only (SPKI DER, base64). */
  readonly ownerPublicKey: string;
  /** Key quorum holding the Agent runtime-signer authorization public key. */
  readonly runtimeSignerQuorumId: string;
  /**
   * Final demo (maintainer, CP8): a pre-created, pre-funded Agent wallet. When set, CREATE DISTRIBUTION AGENT resolves
   * this wallet and verifies its stored controls instead of creating a wallet (a new wallet would hold no HBAR).
   */
  readonly preSeededWalletAddress?: string;
}

type Condition = { field_source: string; field?: string; operator: string; value: unknown };
const normalize = (
  rules: readonly {
    name: string;
    method: string;
    action: string;
    conditions: readonly unknown[];
  }[],
) =>
  JSON.stringify(
    rules.map((r) => ({
      name: r.name,
      method: r.method,
      action: r.action,
      conditions: (r.conditions as Condition[]).map((c) => ({
        field_source: c.field_source,
        field: c.field,
        operator: c.operator,
        value: Array.isArray(c.value)
          ? c.value.map((v) => String(v).toLowerCase())
          : String(c.value).toLowerCase(),
      })),
    })),
  );

/** True iff the stored Privy rules are exactly the approved Agent boundary for these recipients and cap. */
export function agentPolicyMatches(
  stored: readonly {
    name: string;
    method: string;
    action: string;
    conditions: readonly unknown[];
  }[],
  recipients: readonly string[],
  maxPayoutWeibar: bigint,
): boolean {
  return normalize(stored) === normalize(agentPolicyRules(recipients, maxPayoutWeibar));
}

export function agentPolicyRules(recipients: readonly string[], maxPayoutWeibar: bigint) {
  if (recipients.length === 0 || !recipients.every((r) => isAddress(r))) {
    throw new Error('the Agent policy needs at least one valid recipient address');
  }
  if (maxPayoutWeibar <= 0n) throw new Error('the Agent policy needs a positive payout cap');
  return [
    {
      name: 'allow-distribution-payout-hedera',
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
          operator: 'in' as const,
          value: recipients.map((r) => getAddress(r)),
        },
        {
          field_source: 'ethereum_transaction' as const,
          field: 'value' as const,
          operator: 'lte' as const,
          value: `0x${maxPayoutWeibar.toString(16)}`,
        },
      ],
    },
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
}

export class PrivyDistributionAgentProvisioner implements DistributionAgentWalletProvisioner {
  readonly adapter = 'privy';

  constructor(
    private readonly client: PrivyClient,
    private readonly config: PrivyDistributionAgentConfig,
  ) {}

  /** Reads PRIVY_AGENT_OWNER_PUBLIC_KEY and PRIVY_AGENT_RUNTIME_QUORUM_ID (public values); undefined if absent. */
  static fromEnv(
    client: PrivyClient,
    env: NodeJS.ProcessEnv = process.env,
  ): PrivyDistributionAgentProvisioner | undefined {
    const ownerPublicKey = env['PRIVY_AGENT_OWNER_PUBLIC_KEY'] ?? '';
    const runtimeSignerQuorumId = env['PRIVY_AGENT_RUNTIME_QUORUM_ID'] ?? '';
    const preSeededWalletAddress = env['PRIVY_AGENT_WALLET_ADDRESS'] ?? '';
    if (!ownerPublicKey || !runtimeSignerQuorumId) return undefined;
    return new PrivyDistributionAgentProvisioner(client, {
      ownerPublicKey,
      runtimeSignerQuorumId,
      ...(preSeededWalletAddress ? { preSeededWalletAddress } : {}),
    });
  }

  async provision(input: {
    readonly agentDid: string;
    readonly resource: string;
    readonly recipients: readonly string[];
    readonly maxPayoutWeibar: bigint;
  }) {
    if (this.config.preSeededWalletAddress) return this.resolvePreSeeded(input);
    const rules = agentPolicyRules(input.recipients, input.maxPayoutWeibar);
    const policy = await this.client.policies().create({
      version: '1.0',
      name: `catenor-one-distribution-agent-${input.agentDid.slice(-8)}`,
      chain_type: 'ethereum',
      owner: { public_key: this.config.ownerPublicKey },
      rules,
    });
    const created = await this.client.wallets().create({
      chain_type: 'ethereum',
      owner: { public_key: this.config.ownerPublicKey },
      policy_ids: [policy.id],
      additional_signers: [
        { signer_id: this.config.runtimeSignerQuorumId, override_policy_ids: [policy.id] },
      ],
    });
    // Read back what Privy stored: exactly this policy, and the runtime signer scoped by it.
    const wallet = await this.client.wallets().get(created.id);
    const signers = wallet.additional_signers;
    if (
      wallet.chain_type !== 'ethereum' ||
      JSON.stringify(wallet.policy_ids) !== JSON.stringify([policy.id]) ||
      signers.length !== 1 ||
      signers[0]?.signer_id !== this.config.runtimeSignerQuorumId ||
      JSON.stringify(signers[0]?.override_policy_ids) !== JSON.stringify([policy.id])
    ) {
      throw new Error('the Privy Agent wallet read-back does not match the requested controls');
    }
    return {
      walletRef: wallet.id,
      address: getAddress(wallet.address),
      policyRef: policy.id,
      provisioning: 'CREATED_LIVE' as const,
      controls: [
        // Recipient addresses stay in the Privy policy; the Catenor-side summary does not repeat receiving accounts.
        `ALLOW eth_signTransaction iff chain_id = 296 ∧ to ∈ {the ${input.recipients.length} investor receiving wallets of ${input.resource}} ∧ value ≤ ${formatEther(input.maxPayoutWeibar)} HBAR`,
        'DENY exportPrivateKey, exportSeedPhrase',
        'everything else denied by default (no ATS contract, no SPV wallet, no other chain)',
        'policy owned by the Agent management-owner key (outside the runtime); the runtime signer cannot change it',
      ],
    };
  }

  /** Resolves the pre-seeded Agent wallet and verifies its stored controls are exactly the approved boundary. */
  private async resolvePreSeeded(input: {
    readonly resource: string;
    readonly recipients: readonly string[];
    readonly maxPayoutWeibar: bigint;
  }) {
    const address = getAddress(this.config.preSeededWalletAddress!);
    const found = [];
    for await (const w of this.client.wallets().list({ address, chain_type: 'ethereum' })) {
      found.push(w);
    }
    const wallet = found[0];
    if (found.length !== 1 || !wallet) {
      throw new Error('the pre-seeded Agent wallet was not found in Privy');
    }
    const policyId = wallet.policy_ids[0];
    const signers = wallet.additional_signers;
    if (
      !wallet.owner_id ||
      wallet.policy_ids.length !== 1 ||
      !policyId ||
      signers.length !== 1 ||
      signers[0]?.signer_id !== this.config.runtimeSignerQuorumId ||
      JSON.stringify(signers[0]?.override_policy_ids) !== JSON.stringify([policyId])
    ) {
      throw new Error(
        'the pre-seeded Agent wallet signer/policy attachment is not the approved shape',
      );
    }
    const policy = await this.client.policies().get(policyId);
    if (
      policy.chain_type !== 'ethereum' ||
      policy.owner_id !== wallet.owner_id ||
      !agentPolicyMatches(policy.rules, input.recipients, input.maxPayoutWeibar)
    ) {
      throw new Error(
        'the pre-seeded Agent wallet policy is not exactly the approved execution boundary',
      );
    }
    return {
      walletRef: wallet.id,
      address,
      policyRef: policy.id,
      provisioning: 'PRE_SEEDED_VERIFIED' as const,
      controls: [
        `ALLOW eth_signTransaction iff chain_id = 296 ∧ to ∈ {the ${input.recipients.length} investor receiving wallets of ${input.resource}} ∧ value ≤ ${formatEther(input.maxPayoutWeibar)} HBAR`,
        'DENY exportPrivateKey, exportSeedPhrase',
        'everything else denied by default (no ATS contract, no SPV wallet, no other chain)',
        'policy owned by the Agent management-owner key (outside the runtime); the runtime signer cannot change it',
        'wallet and policy pre-provisioned (funded) before the demo; read back and verified by Catenor at CREATE DISTRIBUTION AGENT',
      ],
    };
  }
}
