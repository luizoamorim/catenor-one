// 90 CRE execution · 91 Hedera · 92 Privy · 93 Catenor audit + authority · 99 complete demo. All READ-ONLY.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { verifyChain } from '@catenor-one/audit';
import {
  EXECUTE_DISTRIBUTION,
  RELATIONSHIP_PREDICATES,
  SPONSOR_CAPABILITIES,
} from '@catenor-one/authority';
import { verifyProof, type VerifiableCredential } from '@catenor-one/credentials';
import { decodeEd25519Multikey } from '@catenor-one/identity';
import { IAsset__factory } from '@hashgraph/asset-tokenization-contracts';
import { JsonRpcProvider, formatEther } from 'ethers';
import {
  HEDERA_TESTNET,
  asRunner,
} from '../../../../src/infrastructure/execution/hedera-ats-executor.js';
import { agentPolicyMatches } from '../../../../src/infrastructure/key-management/privy-distribution-agent.js';
import { REHEARSAL_EQUITY, DEMO_INVESTORS } from '../../final-demo-config.js';
import { HBAR, RESOURCE, TRUST_DOMAIN, type Context } from '../context.js';
import { say, type Stage } from '../stage.js';
import { ROOT, RUNS_DIR, env } from '../state.js';

const provider = () => new JsonRpcProvider(HEDERA_TESTNET.rpcUrl);
const mirror = async (hash: string) =>
  (await (
    await fetch(`https://testnet.mirrornode.hedera.com/api/v1/contracts/results/${hash}`)
  ).json()) as Record<string, unknown>;

/** The latest sanitized run record of each stage (`.catenor-demo/runs/`). */
function latestRuns(): Record<string, { file: string; record: Record<string, unknown> }> {
  if (!existsSync(RUNS_DIR)) return {};
  const out: Record<string, { file: string; record: Record<string, unknown> }> = {};
  for (const f of readdirSync(RUNS_DIR).sort()) {
    const stage = f.replace(/-\d{4}-\d{2}-\d{2}T.*$/, '');
    out[stage] = {
      file: join(RUNS_DIR, f),
      record: JSON.parse(readFileSync(join(RUNS_DIR, f), 'utf8')) as Record<string, unknown>,
    };
  }
  return out;
}

export const showCreExecution: Stage = {
  id: '90-show-cre-execution',
  title: 'Judge evidence — the most recent Chainlink CRE confidential executions',
  actor: 'Judge / maintainer',
  operation: 'READ-ONLY inspection (never secrets, raw Sumsub responses, PII, private VCs or VPs)',
  changes: ['none'],
  sponsors: ['Chainlink CRE (CLI read-only commands when DEPLOYED)'],
  mode: 'READ-ONLY',
  expected:
    'workflow ref, execution/run ref, operation, status, allowlisted TEE logs, minimized result, commitment',
  async run(ctx) {
    const runs = latestRuns();
    const confidential = [
      '11-admit-root-trust-anchor',
      '42-create-investor-credentials',
      '44-check-offering-eligibility',
      '82-run-confidential-distribution',
    ]
      .filter((s) => runs[s])
      .map((s) => {
        const r = runs[s]!.record as {
          mode?: string;
          ranAt?: string;
          result?: Record<string, unknown>;
          creExecutions?: unknown;
        };
        return {
          stage: s,
          ranAt: r.ranAt,
          creExecutions: r.creExecutions,
          minimizedResult: minimized(s, r.result ?? {}),
          evidenceFile: runs[s]!.file.replace(ROOT, ''),
        };
      });
    say('local confidential executions (sanitized)', confidential);
    let deployed: unknown =
      'CRE mode SIMULATION — `cre workflow simulate` executions; no deployed workflow is claimed';
    if (ctx.creMode === 'DEPLOYED') {
      const cre = env('CRE_BIN') || join(homedir(), '.cre/bin/cre');
      const list = spawnSync(
        cre,
        ['execution', 'list', 'identity-confidential-production', '--limit', '5', '--json'],
        { encoding: 'utf8' },
      );
      deployed =
        list.status === 0 ? safeJson(list.stdout) : { error: 'cre execution list failed (login?)' };
    }
    say('deployed executions', deployed);
    return { mode: ctx.creMode, confidential, deployed };
  },
};

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text.slice(0, 2000);
  }
}

function minimized(stage: string, result: Record<string, unknown>): unknown {
  switch (stage) {
    case '11-admit-root-trust-anchor':
      return {
        decision: (result['decision'] as { outcome?: string } | undefined)?.outcome,
        confidentialRun: result['confidentialRun'],
      };
    case '42-create-investor-credentials':
      return (
        result['credentials'] as { investor: string; confidentialRun: unknown }[] | undefined
      )?.map((c) => ({ investor: c.investor, confidentialRun: c.confidentialRun }));
    case '44-check-offering-eligibility':
      return {
        confidentialRun: result['confidentialRun'],
        decisions: (
          result['decisions'] as
            { investor: string; decision: unknown; trace: unknown }[] | undefined
        )?.map((d) => ({
          investor: d.investor,
          decision: (d.decision as { decision?: string }).decision,
          trace: d.trace,
        })),
      };
    case '82-run-confidential-distribution':
      return result['plan'];
    default:
      return result;
  }
}

export const verifyHedera: Stage = {
  id: '91-verify-hedera',
  title: 'Independent Hedera verification (public chain data only)',
  actor: 'Judge / anyone',
  operation: 'READ-ONLY: JSON-RPC relay + Mirror Node; no keys',
  changes: ['none'],
  sponsors: ['Hedera Testnet'],
  mode: 'READ-ONLY',
  expected: 'every recorded transaction SUCCESS; holdings and balances as claimed',
  async run(_ctx, flags) {
    const rehearsal = flags.options['rehearsal'] !== undefined || !env('DEMO_EQUITY_ADDRESS');
    const txs: [string, string][] = rehearsal
      ? [
          [
            'deployEquity (rehearsal)',
            '0x8265479fc7236b7b092899b49cfaf0d8d1ecb05e7ce2ff69aeda587e4ad75897',
          ],
          [
            'issueByPartition → Investor A 600',
            '0x9e6c86c4e8d2674f3d49142b14f7c9d194cb025dfa604ee684ad362e034a04bf',
          ],
          [
            'issueByPartition → Investor B 400',
            '0x5ea23774ef08a9046ae2135bfeb243e1bd385d153b8d1d8a703c883d4c8c58f7',
          ],
          [
            'grantRole(ROLE_CORPORATE_ACTION)',
            '0x8b4baf363089b7eb4c225bb8fe202e9ac81aebe2fdfe4f1ffd26a84c102740e7',
          ],
          [
            'setDividend (dividend 1)',
            '0x8ae0c07651a545d8a54092813ab21cbb05c58d130a7b99b6dc11004b712a5bcb',
          ],
          [
            'TESTNET BOOTSTRAP A (not a distribution)',
            '0x40c48ff31c758a566da6a7554c6d593b937bb989aa56a1fc730811c989896e07',
          ],
          [
            'TESTNET BOOTSTRAP B (not a distribution)',
            '0x0260e56f8331571aeb3e2649541439b85ce69b7ec2c8e1eba8b366ac02c4548d',
          ],
          [
            'Agent payout 6 HBAR → Investor A',
            '0x5db611642921708fc1fa88b78ed883acebd5d99316ede4481c141e076be42b88',
          ],
        ]
      : (
          [
            ['deployEquity', env('DEMO_DEPLOY_TX')],
            ['issueByPartition → Investor A', env('DEMO_ISSUE_A_TX')],
            ['issueByPartition → Investor B', env('DEMO_ISSUE_B_TX')],
            ['grantRole(ROLE_CORPORATE_ACTION)', env('DEMO_DIVIDEND_GRANT_TX')],
            ['setDividend', env('DEMO_DIVIDEND_SET_TX')],
            ['Agent payout → Investor A', env('DEMO_PAYOUT_TX')],
          ] as [string, string][]
        ).filter(([, h]) => h);
    const transactions = [];
    for (const [what, hash] of txs) {
      const m = await mirror(hash);
      transactions.push({
        what,
        hash,
        result: m['result'] ?? 'NOT FOUND',
        from: m['from'],
        to: m['to'],
        gasUsed: m['gas_used'],
        hashscan: `${HEDERA_TESTNET.explorer}/transaction/${hash}`,
      });
    }
    say('transactions', transactions);
    const equity = rehearsal ? REHEARSAL_EQUITY : env('DEMO_EQUITY_ADDRESS');
    const holders = rehearsal
      ? { A: DEMO_INVESTORS.A.address, B: DEMO_INVESTORS.B.address }
      : { A: env('DEMO_INVESTOR_A_ADDRESS'), B: env('DEMO_INVESTOR_B_ADDRESS') };
    const asset = IAsset__factory.connect(equity, asRunner(provider()));
    const p = provider();
    const [name, symbol, supply, unitsA, unitsB, hbarA, hbarB] = await Promise.all([
      asset.name(),
      asset.symbol(),
      asset.totalSupply(),
      asset.balanceOf(holders.A),
      asset.balanceOf(holders.B),
      p.getBalance(holders.A),
      p.getBalance(holders.B),
    ]);
    let entitlements: unknown = 'no dividend recorded';
    try {
      const [a, b] = await Promise.all([
        asset.getDividendAmountFor(1n, holders.A),
        asset.getDividendAmountFor(1n, holders.B),
      ]);
      const v = (e: { numerator: bigint; denominator: bigint }) =>
        e.denominator === 0n ? null : Number(e.numerator) / Number(e.denominator);
      entitlements = { dividend: 1, investorA: v(a), investorB: v(b) };
    } catch {
      /* no dividend on this equity */
    }
    const state = {
      equity,
      name,
      symbol,
      totalSupply: supply,
      investorA: { units: unitsA, hbar: formatEther(hbarA) },
      investorB: { units: unitsB, hbar: formatEther(hbarB) },
      entitlements,
    };
    say(rehearsal ? 'rehearsal equity (committed evidence)' : 'clean-room equity', state);
    return {
      source: rehearsal ? 'REHEARSAL (artifacts/hedera/final-demo/)' : 'CLEAN ROOM',
      transactions,
      state,
      allSuccess: transactions.every((t) => t.result === 'SUCCESS'),
    };
  },
};

export const verifyPrivy: Stage = {
  id: '92-verify-privy',
  title: 'Independent Privy verification — wallets and execution policies as stored by Privy',
  actor: 'Maintainer (Privy app credentials)',
  operation: 'READ-ONLY: wallets().get / policies().get',
  changes: ['none'],
  sponsors: ['Privy'],
  mode: 'READ-ONLY',
  expected:
    'SPV / Agent wallets carry exactly one Catenor-created policy; the runtime signer is override-scoped; exports denied',
  async run(ctx) {
    const out: Record<string, unknown> = {};
    for (const [role, walletKey] of [
      ['SPV', 'DEMO_SPV_WALLET_ID'],
      ['Agent', 'DEMO_AGENT_WALLET_ID'],
      ['Investor A', 'DEMO_INVESTOR_A_WALLET_ID'],
      ['Investor B', 'DEMO_INVESTOR_B_WALLET_ID'],
      ['Treasury', 'DEMO_TREASURY_WALLET_ID'],
    ] as const) {
      const id = env(walletKey);
      if (!id) continue;
      const w = await ctx.privy.wallets().get(id);
      const policies = [];
      for (const pid of w.policy_ids) {
        const p = await ctx.privy.policies().get(pid);
        policies.push({
          id: p.id,
          name: p.name,
          ownerMatchesWallet: p.owner_id === w.owner_id,
          rules: p.rules.map(
            (r) =>
              `${r.action} ${r.method}${r.conditions.length ? ` [${r.conditions.map((c) => `${(c as { field?: string }).field ?? c.field_source} ${(c as { operator?: string }).operator ?? ''}`).join(' ∧ ')}]` : ''}`,
          ),
        });
      }
      out[role] = {
        address: w.address,
        chain: w.chain_type,
        ownerSet: Boolean(w.owner_id),
        additionalSigners: w.additional_signers.map((s) => ({
          overrideScoped: JSON.stringify(s.override_policy_ids) === JSON.stringify(w.policy_ids),
        })),
        policies,
      };
    }
    const agentPolicy = env('DEMO_AGENT_POLICY_ID')
      ? await ctx.privy.policies().get(env('DEMO_AGENT_POLICY_ID'))
      : undefined;
    const agentExact = agentPolicy
      ? agentPolicyMatches(
          agentPolicy.rules,
          [env('DEMO_INVESTOR_A_ADDRESS'), env('DEMO_INVESTOR_B_ADDRESS')],
          20n * HBAR,
        )
      : null;
    say('Privy read-back', out);
    say('Agent policy exactly the approved boundary', agentExact);
    return { wallets: out, agentPolicyExact: agentExact };
  },
};

export const verifyCatenor: Stage = {
  id: '93-verify-catenor-audit',
  title: 'Catenor verification — audit hash chain, authority chain, credentials',
  actor: 'Judge / maintainer',
  operation:
    'LOCAL READ-ONLY: re-verify signatures and chains from the recorded documents (the DB is an index, not proof)',
  changes: ['none'],
  sponsors: ['none'],
  mode: 'READ-ONLY',
  expected:
    'audit chain valid; Trust Anchor VALID; Sponsor capabilities ALLOW; Agent chain ALLOW; credentials verify',
  async run(ctx) {
    const timeline = await ctx.uow.run((p) => p.audit.timeline(TRUST_DOMAIN));
    const chain = verifyChain(TRUST_DOMAIN, timeline);
    const counts: Record<string, number> = {};
    for (const e of timeline) counts[e.type] = (counts[e.type] ?? 0) + 1;
    const { sponsor: svc, investors, admission } = ctx.services;
    const ta = env('DEMO_TRUST_ANCHOR_DID');
    const sponsor = env('DEMO_SPONSOR_DID');
    const agent = env('DEMO_AGENT_DID');
    const result: Record<string, unknown> = {
      auditChain: chain,
      events: timeline.length,
      eventTypes: counts,
    };
    if (ta) {
      const v = await admission.verifyTrustAnchor(ta);
      result['trustAnchor'] = {
        did: ta,
        TRUST_ANCHOR_VALID: v.TRUST_ANCHOR_VALID,
        failed: v.checks.filter((c) => !c.passed).map((c) => c.id),
      };
    }
    if (sponsor) {
      result['sponsorRelationship'] = (
        await svc.verifyRelationship({
          subject: sponsor,
          predicate: RELATIONSHIP_PREDICATES.AUTHORIZED_SPONSOR_IN,
          object: TRUST_DOMAIN,
        })
      ).verification;
      result['sponsorCapabilities'] = await Promise.all(
        SPONSOR_CAPABILITIES.map(async (a) => ({
          action: a,
          decision: (await svc.authorizeSponsorAction(sponsor, a, RESOURCE)).decision,
        })),
      );
    }
    if (agent && sponsor) {
      result['agentRelationship'] = (
        await svc.verifyRelationship({
          subject: agent,
          predicate: RELATIONSHIP_PREDICATES.AGENT_OF,
          object: sponsor,
        })
      ).verification;
      const grant = await svc.agentGrant(agent, EXECUTE_DISTRIBUTION, RESOURCE);
      const a = await svc.authorizeDelegated({
        requester: agent,
        grant,
        action: EXECUTE_DISTRIBUTION,
        resource: RESOURCE,
      });
      result['agentAuthority'] = { decision: a.decision, reasons: a.reasons, chain: a.chain };
    }
    const credentials = [];
    for (const label of ['A', 'B'] as const) {
      const did = env(`DEMO_INVESTOR_${label}_DID`);
      if (!did) continue;
      const stored = await investors.credentialOf(did);
      if (!stored) continue;
      const vc = stored.document as VerifiableCredential;
      const issuer = await ctx.uow.run(
        async (p) => (await p.didState.resolve(vc.issuer))?.document,
      );
      const vm = issuer?.verificationMethod.find((m) => m.id === vc.proof.verificationMethod);
      const { proof, ...unsecured } = vc;
      const signature = vm
        ? verifyProof(unsecured, proof, decodeEd25519Multikey(vm.publicKeyMultibase))
        : false;
      credentials.push({
        investor: `Investor ${label}`,
        credentialId: vc.id,
        issuer: vc.issuer,
        status: stored.status,
        issuerSignature: signature,
      });
    }
    result['credentials'] = credentials;
    say('Catenor verification', result);
    return result;
  },
};

export const verifyComplete: Stage = {
  id: '99-verify-complete-demo',
  title: 'Complete demo verification',
  actor: 'Judge / maintainer',
  operation: 'READ-ONLY summary of every stage record + the Catenor verification',
  changes: ['none'],
  sponsors: ['none (reads local records; 91/92 query Hedera / Privy)'],
  mode: 'READ-ONLY',
  expected: 'every executed stage has an evidence record; Catenor verification passes',
  async run(ctx) {
    const runs = latestRuns();
    const order = [
      '01-setup-env',
      '10-create-trust-domain',
      '11-admit-root-trust-anchor',
      '20-create-sponsor',
      '21-trust-anchor-authorize-sponsor',
      '30-create-spv',
      '31-create-offering-policy',
      '40-create-investor-a',
      '41-create-investor-b',
      '42-create-investor-credentials',
      '43-create-investor-presentations',
      '44-check-offering-eligibility',
      '50-fund-testnet-wallets',
      '60-tokenize-spv',
      '61-investor-a-invest',
      '62-investor-b-invest',
      '63-create-dividend',
      '70-create-distribution-agent',
      '71-sponsor-establish-agent-relationship',
      '72-sponsor-delegate-distribution-capability',
      '80-invalidate-investor-b',
      '81-trigger-revenue',
      '82-run-confidential-distribution',
      '83-execute-approved-distribution',
    ];
    const table = order.map((s) => {
      const r = runs[s]?.record as { mode?: string; ranAt?: string; ok?: boolean } | undefined;
      return {
        stage: s,
        ran: Boolean(r),
        mode: r?.mode ?? '—',
        ok: r?.ok ?? null,
        at: r?.ranAt ?? '—',
      };
    });
    console.table(table);
    const catenor = await verifyCatenor.run(ctx, { live: false, yes: false, options: {} });
    return { stages: table, catenor };
  },
};

export type { Context };
