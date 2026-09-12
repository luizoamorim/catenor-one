// 50 funding · 60 tokenize · 61/62 invest · 63 dividend. Hedera Testnet (chain 296) only. Every stage is a READ-ONLY
// preflight (eth_call / estimateGas / Privy dry signature, discarded) unless --live AND an explicit confirmation.
import { IAsset__factory } from '@hashgraph/asset-tokenization-contracts';
import { JsonRpcProvider, Transaction, formatEther, getAddress, isAddress } from 'ethers';
import {
  CLEAN_ROOM_ASSET,
  HEDERA_TESTNET,
  asRunner,
} from '../../../../src/infrastructure/execution/hedera-ats-executor.js';
import {
  PrivySpvAtsExecutor,
  privyEvmSigningApi,
  type NativeTransferTransaction,
} from '../../../../src/infrastructure/execution/privy-spv-ats-executor.js';
import { PrivySpvWalletProvisioner } from '../../../../src/infrastructure/key-management/privy-spv-wallet.js';
import { AssetTokenizationService } from '../../../../src/modules/asset-tokenization/application/asset-tokenization.service.js';
import { TOKENIZE_ASSET } from '@catenor-one/authority';
import { nodeIds, systemClock } from '../../../../src/infrastructure/runtime/runtime-adapters.js';
import { DEMO_DIVIDEND } from '../../final-demo-config.js';
import { HBAR, RESOURCE, TRUST_DOMAIN, type Context } from '../context.js';
import { p256, readOwnerKey, saveOwnerKey } from '../privy-infra.js';
import { confirmLive, say, type Stage } from '../stage.js';
import { env, need, setRuntime, setState } from '../state.js';

const provider = () => new JsonRpcProvider(HEDERA_TESTNET.rpcUrl);
const isAccount = async (address: string) =>
  (await fetch(`https://testnet.mirrornode.hedera.com/api/v1/accounts/${address}`)).status === 200;

/** Suggested testnet funding per role (HBAR). The SPV must cover gasLimit × gasPrice up front (deploy: 15M gas). */
const FUNDING: { key: string; role: string; hbar: bigint; why: string }[] = [
  {
    key: 'DEMO_SPV_WALLET_ADDRESS',
    role: 'SPV execution wallet',
    hbar: 25n,
    why: 'deployEquity (≈ 7.7 used; 15M-gas reservation ≈ 16.7) + 2 issuances + grantRole + setDividend',
  },
  {
    key: 'DEMO_AGENT_WALLET_ADDRESS',
    role: 'Distribution Agent wallet',
    hbar: 12n,
    why: 'the 6 HBAR payout to Investor A + gas (the demo revenue is paid from this wallet)',
  },
  {
    key: 'DEMO_INVESTOR_A_ADDRESS',
    role: 'Investor A receiving wallet',
    hbar: 1n,
    why: 'account activation (HIP-583 lazy create) so the payout is a normal ≈ 21K-gas transfer',
  },
  {
    key: 'DEMO_INVESTOR_B_ADDRESS',
    role: 'Investor B receiving wallet',
    hbar: 1n,
    why: 'account activation (never paid by the distribution)',
  },
];

function spvExecutor(ctx: Context) {
  return new PrivySpvAtsExecutor(privyEvmSigningApi(ctx.privy), {
    walletId: need('DEMO_SPV_WALLET_ID', '30-create-spv.sh'),
    walletAddress: need('DEMO_SPV_WALLET_ADDRESS', '30-create-spv.sh'),
    runtimeAuthorizationKey: need('DEMO_SPV_RUNTIME_AUTHORIZATION_KEY', '30-create-spv.sh'),
  });
}

async function balances() {
  const p = provider();
  const out = [];
  for (const f of FUNDING) {
    const address = env(f.key);
    if (!address) {
      out.push({
        role: f.role,
        address: '(not created yet)',
        balanceHbar: null,
        suggestedHbar: f.hbar.toString(),
        funded: false,
        why: f.why,
      });
      continue;
    }
    const balance = await p.getBalance(address);
    out.push({
      role: f.role,
      address,
      balanceHbar: formatEther(balance),
      suggestedHbar: f.hbar.toString(),
      funded: balance >= f.hbar * HBAR - HBAR / 2n,
      why: f.why,
    });
  }
  return out;
}

export const fundWallets: Stage = {
  id: '50-fund-testnet-wallets',
  title: 'TESTNET BOOTSTRAP FUNDING — not Catenor authority, not a distribution',
  actor: 'Maintainer (faucet) or the optional demo treasury',
  operation: 'none (testnet gas / activation funding)',
  changes: [
    'default: READ-ONLY — lists every clean-room wallet that needs testnet HBAR, the suggested amount and the current balance',
    '--wait: polls until the wallets are funded from the faucet (https://portal.hedera.com/faucet)',
    '--setup-treasury: creates an OPTIONAL Privy testnet treasury wallet (owner key → ~/.catenor-one; policy: chain 296 plain transfers ≤ 30 HBAR)',
    '--live --from-treasury: sends the suggested amounts from the treasury (TESTNET BOOTSTRAP FUNDING; confirmation required)',
  ],
  sponsors: ['Hedera Testnet (JSON-RPC relay + Mirror Node)', 'Privy (optional treasury)'],
  mode: 'READ-ONLY',
  liveMode: 'TESTNET LIVE (spends HBAR)',
  expected:
    'every wallet that exists is funded; funding never touches Catenor authority or the distribution plan',
  async run(ctx, flags) {
    if (flags.options['setup-treasury'] !== undefined) {
      if (env('DEMO_TREASURY_WALLET_ADDRESS')) {
        say('treasury', `already provisioned: ${env('DEMO_TREASURY_WALLET_ADDRESS')}`);
      } else {
        const owner = p256();
        const runtime = p256();
        saveOwnerKey(ctx.instance, 'demo-treasury-owner', owner.privateKey);
        setRuntime({ DEMO_TREASURY_RUNTIME_AUTHORIZATION_KEY: runtime.privateKey });
        const quorum = await ctx.privy.keyQuorums().create({
          public_keys: [runtime.publicKey],
          authorization_threshold: 1,
          display_name: 'catenor-one-clean-room-treasury',
        });
        const policy = await ctx.privy.policies().create({
          version: '1.0',
          name: 'catenor-one-clean-room-testnet-treasury',
          chain_type: 'ethereum',
          owner: { public_key: owner.publicKey },
          rules: [
            {
              name: 'allow-testnet-funding-transfers',
              method: 'eth_signTransaction',
              action: 'ALLOW',
              conditions: [
                {
                  field_source: 'ethereum_transaction',
                  field: 'chain_id',
                  operator: 'eq',
                  value: '296',
                },
                {
                  field_source: 'ethereum_transaction',
                  field: 'value',
                  operator: 'lte',
                  value: `0x${(30n * HBAR).toString(16)}`,
                },
              ],
            },
            {
              name: 'deny-exportPrivateKey',
              method: 'exportPrivateKey',
              action: 'DENY',
              conditions: [],
            },
            {
              name: 'deny-exportSeedPhrase',
              method: 'exportSeedPhrase',
              action: 'DENY',
              conditions: [],
            },
          ],
        });
        const wallet = await ctx.privy.wallets().create({
          chain_type: 'ethereum',
          owner: { public_key: owner.publicKey },
          policy_ids: [policy.id],
          additional_signers: [{ signer_id: quorum.id, override_policy_ids: [policy.id] }],
        });
        setState({
          DEMO_TREASURY_WALLET_ID: wallet.id,
          DEMO_TREASURY_WALLET_ADDRESS: getAddress(wallet.address),
          DEMO_TREASURY_POLICY_ID: policy.id,
        });
        say('treasury (fund it from the faucet, ≥ 45 HBAR)', getAddress(wallet.address));
      }
    }
    let rows = await balances();
    say('wallets', rows);
    if (flags.options['wait'] !== undefined && !flags.live) {
      for (
        let i = 0;
        i < 120 && rows.some((r) => r.address !== '(not created yet)' && !r.funded);
        i++
      ) {
        await new Promise((r) => setTimeout(r, 10_000));
        rows = await balances();
        console.log(
          `  … waiting for faucet funding: ${rows.filter((r) => r.funded).length}/${rows.filter((r) => r.address !== '(not created yet)').length} funded`,
        );
      }
      say('wallets', rows);
    }
    if (!flags.live) {
      return {
        mode: 'READ-ONLY',
        wallets: rows,
        label: 'TESTNET BOOTSTRAP FUNDING (not a distribution)',
      };
    }
    if (flags.options['from-treasury'] === undefined) {
      console.error(
        'REFUSED: --live funding needs --from-treasury (otherwise fund manually from the faucet)',
      );
      process.exit(2);
    }
    const treasury = need(
      'DEMO_TREASURY_WALLET_ADDRESS',
      '50-fund-testnet-wallets.sh --setup-treasury',
    );
    const todo = rows.filter((r) => r.address !== '(not created yet)' && !r.funded);
    await confirmLive(
      this.id,
      `TESTNET BOOTSTRAP FUNDING from ${treasury}: ${todo.map((r) => `${r.suggestedHbar} HBAR → ${r.role} ${r.address}`).join('; ')}`,
    );
    const api = privyEvmSigningApi(ctx.privy);
    const p = provider();
    const sent = [];
    for (const r of todo) {
      const to = getAddress(r.address);
      const value = BigInt(r.suggestedHbar) * HBAR;
      const exists = await isAccount(to);
      const [nonce, gasPrice] = await Promise.all([
        p.getTransactionCount(treasury, 'latest'),
        p.send('eth_gasPrice', []) as Promise<string>,
      ]);
      const tx: NativeTransferTransaction = {
        chain_id: 296,
        to,
        data: '0x',
        value: `0x${value.toString(16)}`,
        nonce,
        gas_limit: exists ? 30_000 : 700_000,
        gas_price: gasPrice,
        type: 0,
      };
      const raw = await api.signTransaction(
        need('DEMO_TREASURY_WALLET_ID', '50 --setup-treasury'),
        tx,
        need('DEMO_TREASURY_RUNTIME_AUTHORIZATION_KEY', '50 --setup-treasury'),
      );
      const signed = Transaction.from(raw);
      if (
        getAddress(signed.from!) !== getAddress(treasury) ||
        getAddress(signed.to!) !== to ||
        signed.value !== value ||
        signed.data !== '0x' ||
        signed.chainId !== 296n
      ) {
        throw new Error(
          'signer boundary: the treasury signature is not the prepared funding transfer',
        );
      }
      const receipt = await (await p.broadcastTransaction(raw)).wait(1, 180_000);
      sent.push({
        role: r.role,
        to,
        hbar: r.suggestedHbar,
        transaction: receipt?.hash,
        status: receipt?.status === 1 ? 'SUCCESS' : 'FAILED',
      });
      say('funded', sent.at(-1));
    }
    return {
      mode: 'TESTNET LIVE',
      label: 'TESTNET BOOTSTRAP FUNDING (not a distribution)',
      transfers: sent,
      wallets: await balances(),
    };
  },
};

export const tokenizeSpv: Stage = {
  id: '60-tokenize-spv',
  title: 'Catenor Protocol → Hedera ATS — tokenization of Catenor One Demo SPV 001',
  actor: 'Sponsor (TOKENIZE_ASSET) → SPV execution wallet',
  operation:
    'TOKENIZE_ASSET authorized by the Trust Anchor grant → ATS Factory.deployEquity (1,000 units offered; equity interests in the SPV)',
  changes: [
    'Catenor: the Sponsor request is authorized against its TOKENIZE_ASSET grant (DENY → no signature, no transaction)',
    '--live: ONE Hedera Testnet transaction deployEquity, signed by the SPV Privy wallet under its policy (≈ 7.7 HBAR)',
    '--live: then the SPV policy is extended (management-owner key, from ~/.catenor-one) with issuance + dividend rules pinned to the new equity',
  ],
  sponsors: ['Privy (SPV wallet + policy)', 'Hedera ATS (testnet)'],
  mode: 'READ-ONLY',
  liveMode: 'TESTNET LIVE (spends HBAR)',
  expected:
    'preflight: ALLOW + exact deployEquity simulated + Privy dry signature; live: equity address + SUCCESS',
  details: () => ({
    Sponsor: env('DEMO_SPONSOR_DID') || '(stage 20)',
    'SPV wallet': env('DEMO_SPV_WALLET_ADDRESS') || '(stage 30)',
    Asset: CLEAN_ROOM_ASSET.name,
  }),
  async run(ctx, flags) {
    const sponsor = need('DEMO_SPONSOR_DID', '20-create-sponsor.sh');
    if (env('DEMO_EQUITY_ADDRESS')) {
      // Already deployed: never deploy again. A record written as the full asset reference
      // (`hedera-testnet:ats-equity:0x…`) is normalized to the address the later stages use, and — with --live — the
      // owner-authorized SPV policy extension is completed if it is missing (Privy only; no HBAR).
      const equity = equityAddressOf(env('DEMO_EQUITY_ADDRESS'));
      if (equity !== env('DEMO_EQUITY_ADDRESS')) {
        setState({ DEMO_EQUITY_ADDRESS: equity, DEMO_EQUITY_REF: env('DEMO_EQUITY_ADDRESS') });
      }
      say(
        'equity',
        `already deployed: ${equity} (tx ${env('DEMO_DEPLOY_TX') || 'unknown'}) — no new deployment`,
      );
      if (!flags.live) {
        return { equity, alreadyDeployed: true, spvPolicyRules: 'unchanged (read-only run)' };
      }
      const rules = await PrivySpvWalletProvisioner.addEquityRules(ctx.privy, {
        policyId: need('DEMO_SPV_POLICY_ID', '30-create-spv.sh'),
        equity,
        spv: need('DEMO_SPV_WALLET_ADDRESS', '30-create-spv.sh'),
        ownerPrivateKey: readOwnerKey(ctx.instance, 'demo_spv-owner'),
      });
      say('SPV policy extended (owner-authorized, pinned to the equity)', rules);
      return { equity, alreadyDeployed: true, spvPolicyRules: rules };
    }
    const grant = await ctx.services.sponsor.sponsorGrant(sponsor, TOKENIZE_ASSET, RESOURCE);
    const authorization = await ctx.services.sponsor.authorizeSponsorAction(
      sponsor,
      TOKENIZE_ASSET,
      RESOURCE,
    );
    say('Catenor authorization', authorization);
    if (authorization.decision !== 'ALLOW' || !grant) return { authorization };
    const executor = spvExecutor(ctx);
    const spvAddress = need('DEMO_SPV_WALLET_ADDRESS', '30-create-spv.sh');
    const [spvBalance, spvIsAccount] = await Promise.all([
      provider().getBalance(spvAddress),
      isAccount(spvAddress),
    ]);
    if (!spvIsAccount || spvBalance === 0n) {
      // The relay cannot simulate from an address that is not yet a Hedera account (HIP-583 lazy create on funding).
      const reason = `the SPV wallet ${spvAddress} holds ${formatEther(spvBalance)} HBAR and is ${spvIsAccount ? '' : 'not yet '}a Hedera account`;
      say('preflight', `BLOCKED: ${reason} — fund it first (50-fund-testnet-wallets.sh)`);
      return { authorization, preflight: 'BLOCKED_UNFUNDED', reason };
    }
    let prepared;
    try {
      prepared = await executor.prepareDeployEquity({
        resource: RESOURCE,
        grantId: grant.id,
        asset: CLEAN_ROOM_ASSET,
      });
    } catch (e) {
      const reason =
        (e as { shortMessage?: string }).shortMessage ?? (e as Error).message.slice(0, 200);
      say('preflight', `BLOCKED: ${reason}`);
      return { authorization, preflight: 'BLOCKED', reason };
    }
    const preflight = {
      from: prepared.from,
      to: prepared.transaction.to,
      chainId: prepared.transaction.chain_id,
      estimatedGas: prepared.estimatedGas,
      gasLimit: prepared.transaction.gas_limit,
      maxHbar: formatEther(prepared.maxCostWeibar),
      simulatedEquity: prepared.simulatedEquityAddress,
    };
    if (!flags.live) {
      await executor.signPrepared(prepared); // Privy dry signature under the SPV policy, discarded
      say('preflight (nothing broadcast)', {
        ...preflight,
        privyDrySignature: 'SIGNED (discarded)',
      });
      return { authorization, preflight, broadcast: false };
    }
    await confirmLive(
      this.id,
      `deployEquity via the ATS Factory from the SPV wallet ${prepared.from} (gas limit ${prepared.transaction.gas_limit}, max ${formatEther(prepared.maxCostWeibar)} HBAR)`,
    );
    const tokenization = new AssetTokenizationService({
      uow: ctx.uow,
      clock: systemClock,
      ids: nodeIds,
      trustDomain: TRUST_DOMAIN,
      assertionSigner: ctx.signers.assertionSigner,
      verifyTrustAnchor: (did) => ctx.services.admission.verifyTrustAnchor(did),
      executor: {
        network: executor.network,
        tokenize: (i) => executor.tokenize({ ...i, asset: CLEAN_ROOM_ASSET }),
      },
    });
    const outcome = await tokenization.requestTokenization({
      requester: sponsor,
      resource: RESOURCE,
      grant,
    });
    if (outcome.decision !== 'ALLOW' || !outcome.assetReference) return { authorization, outcome };
    const equity = equityAddressOf(outcome.assetReference);
    setState({
      DEMO_EQUITY_ADDRESS: equity,
      DEMO_EQUITY_REF: outcome.assetReference,
      DEMO_DEPLOY_TX: outcome.transactionId,
    });
    const rules = await PrivySpvWalletProvisioner.addEquityRules(ctx.privy, {
      policyId: need('DEMO_SPV_POLICY_ID', '30-create-spv.sh'),
      equity,
      spv: need('DEMO_SPV_WALLET_ADDRESS', '30-create-spv.sh'),
      ownerPrivateKey: readOwnerKey(ctx.instance, 'demo_spv-owner'),
    });
    say('tokenized', { ...outcome, spvPolicyRules: rules });
    return { authorization, outcome, spvPolicyRules: rules };
  },
};

/** The EVM address inside an asset reference (`hedera-testnet:ats-equity:0x…`) or a bare address, checksummed. */
export function equityAddressOf(reference: string): string {
  const candidate = reference.split(':').pop() ?? '';
  if (!isAddress(candidate)) {
    throw new Error(`not an equity address or asset reference: ${reference}`);
  }
  return getAddress(candidate);
}

function invest(label: 'A' | 'B'): Stage {
  return {
    id: label === 'A' ? '61-investor-a-invest' : '62-investor-b-invest',
    title: `Catenor Protocol → Hedera ATS — Investor ${label} investment (issuance)`,
    actor: `Investor ${label} (subscription) · Sponsor (TOKENIZE_ASSET) · SPV wallet (issuer)`,
    operation:
      'offering ALLOW Decision (VP + Offering Policy, stage 44) + Sponsor TOKENIZE_ASSET → issueByPartition of exactly the approved units',
    changes: [
      `Catenor: Investor ${label}'s ALLOW Decision for this offering, unused, within the offering total; Sponsor TOKENIZE_ASSET ALLOW — no generic mint`,
      `--live: ONE issueByPartition(${label === 'A' ? 600 : 400} units, default partition) to the investor's PRIVATELY bound wallet, signed by the SPV Privy wallet (≈ 0.5 HBAR)`,
    ],
    sponsors: ['Privy (SPV wallet)', 'Hedera ATS (testnet)'],
    mode: 'READ-ONLY',
    liveMode: 'TESTNET LIVE (spends HBAR)',
    expected: `Investor ${label} receives ${label === 'A' ? 600 : 400} ATS units`,
    async run(ctx, flags) {
      const sponsor = need('DEMO_SPONSOR_DID', '20-create-sponsor.sh');
      const offeringId = need('DEMO_OFFERING_ID', '31-create-offering-policy.sh');
      const investor = need(
        `DEMO_INVESTOR_${label}_DID`,
        `4${label === 'A' ? 0 : 1}-create-investor-${label.toLowerCase()}.sh`,
      );
      const auth = await ctx.services.investors.authorizeInvestment({
        sponsor,
        offeringId,
        investor,
      });
      const summary = {
        decisionRef: auth.record.id,
        decision: auth.record.decision.decision,
        policy: auth.record.decision.policy,
        units: auth.units,
        tokenizeGrantId: auth.tokenizeGrantId,
        tokenHolder: 'the investor’s private receiving binding',
      };
      say('Catenor investment authorization', summary);
      const equity = env('DEMO_EQUITY_ADDRESS');
      if (!equity) {
        say(
          'issuance preflight',
          'BLOCKED: no clean-room equity yet — 60-tokenize-spv.sh --live first',
        );
        return { authorization: summary, preflight: 'BLOCKED_NO_EQUITY' };
      }
      const executor = spvExecutor(ctx);
      const prepared = await executor.prepareIssueByPartition({
        equity,
        tokenHolder: auth.tokenHolder,
        amount: auth.units,
      });
      const preflight = {
        to: prepared.transaction.to,
        estimatedGas: prepared.estimatedGas,
        gasLimit: prepared.transaction.gas_limit,
        maxHbar: formatEther(prepared.maxCostWeibar),
        amount: auth.units,
      };
      if (!flags.live) {
        await executor.signPrepared(prepared);
        say('preflight (nothing broadcast)', {
          ...preflight,
          privyDrySignature: 'SIGNED (discarded)',
        });
        return { authorization: summary, preflight, broadcast: false };
      }
      await confirmLive(
        this.id,
        `issueByPartition(${auth.units} units) on ${equity} to Investor ${label}'s bound wallet`,
      );
      const issued = await executor.issueByPartition({
        equity,
        tokenHolder: auth.tokenHolder,
        amount: auth.units,
      });
      await ctx.services.investors.recordInvestmentExecuted({
        investor,
        offeringId,
        decisionRef: auth.record.id,
        units: auth.units,
        asset: equity,
        transactionId: issued.transactionId,
      });
      setState({ [`DEMO_ISSUE_${label}_TX`]: issued.transactionId });
      say('issued', issued);
      return { authorization: summary, issued };
    },
  };
}
export const investA = invest('A');
export const investB = invest('B');

export const createDividend: Stage = {
  id: '63-create-dividend',
  title: 'Hedera ATS lifecycle — dividend corporate action (ownership-based entitlement)',
  actor: 'SPV execution wallet',
  operation:
    'grantRole(ROLE_CORPORATE_ACTION, SPV) + setDividend(amount 1, decimals 2) — A 600 → 6, B 400 → 4',
  changes: [
    '--live: TWO Hedera Testnet transactions (≈ 0.2 + 0.6 HBAR), each confirmed separately; ATS records entitlements and moves no funds',
  ],
  sponsors: ['Privy (SPV wallet)', 'Hedera ATS (testnet)'],
  mode: 'READ-ONLY',
  liveMode: 'TESTNET LIVE (spends HBAR)',
  expected:
    'dividend set; entitlements A 6 / B 4 after the record date (Catenor still decides who is PAID)',
  async run(ctx, flags) {
    const equity = env('DEMO_EQUITY_ADDRESS');
    if (!equity || !isAddress(equity)) {
      say('preflight', 'BLOCKED: no clean-room equity yet — 60-tokenize-spv.sh --live first');
      return { preflight: 'BLOCKED_NO_EQUITY' };
    }
    const executor = spvExecutor(ctx);
    const now = BigInt(Math.floor(Date.now() / 1000));
    const terms = {
      recordDate: now + BigInt(DEMO_DIVIDEND.recordDelaySeconds),
      executionDate: now + BigInt(DEMO_DIVIDEND.executionDelaySeconds),
      amount: DEMO_DIVIDEND.amount,
      amountDecimals: DEMO_DIVIDEND.amountDecimals,
    };
    const grant = await executor.prepareCorporateActionRoleGrant(equity);
    if (!flags.live) {
      await executor.signPrepared(grant);
      say('preflight (nothing broadcast)', {
        grantRole: { estimatedGas: grant.estimatedGas, privyDrySignature: 'SIGNED (discarded)' },
        setDividendTerms: terms,
        note: 'setDividend is simulated after grantRole (it needs ROLE_CORPORATE_ACTION)',
      });
      return { preflight: { grantRoleEstimatedGas: grant.estimatedGas, terms }, broadcast: false };
    }
    await confirmLive(this.id, `grantRole(ROLE_CORPORATE_ACTION, SPV) on ${equity}`);
    const t1 = await executor.executePrepared(grant);
    const set = await executor.prepareSetDividend(equity, terms, DEMO_DIVIDEND.amountDecimals);
    await confirmLive(
      this.id,
      `setDividend(recordDate ${terms.recordDate}, executionDate ${terms.executionDate}, amount 1, decimals 2) on ${equity}`,
    );
    const t2 = await executor.executePrepared(set);
    setState({ DEMO_DIVIDEND_GRANT_TX: t1.transactionId, DEMO_DIVIDEND_SET_TX: t2.transactionId });
    say('dividend', { grantRole: t1, setDividend: t2 });
    return { grantRole: t1, setDividend: t2, terms };
  },
};

/** READ-ONLY ATS balances of the clean-room investors (for 80 / 82 / 91). */
export async function atsHoldings(): Promise<{ A: bigint; B: bigint } | undefined> {
  const equity = env('DEMO_EQUITY_ADDRESS');
  if (!equity) return undefined;
  const asset = IAsset__factory.connect(equity, asRunner(provider()));
  return {
    A: await asset.balanceOf(need('DEMO_INVESTOR_A_ADDRESS', '40')),
    B: await asset.balanceOf(need('DEMO_INVESTOR_B_ADDRESS', '41')),
  };
}
