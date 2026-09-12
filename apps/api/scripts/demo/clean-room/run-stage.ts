// Clean-room stage runner — invoked by scripts/demo/NN-*.sh (never needed directly):
//
//   node --conditions=@catenor-one/source --import tsx scripts/demo/clean-room/run-stage.ts <stage-id> [--live] [--yes] [--key[=value]]
//
// Safe by default: without --live no stage broadcasts a Hedera transaction; with --live a broadcast still needs an
// explicit confirmation (typing the stage id, or CATENOR_DEMO_CONFIRM=<stage-id>). Hedera Testnet (296) only.
import { Context } from './context.js';
import { banner, type Flags, type Stage } from './stage.js';
import { loadEnvironment, writeRun } from './state.js';
import {
  admitTrustAnchor,
  authorizeSponsor,
  createOffering,
  createSponsor,
  createSpv,
  createTrustDomain,
} from './stages/authority.js';
import {
  agentRelationship,
  confidentialDistribution,
  createAgent,
  delegateCapability,
  executeDistribution,
  invalidateInvestorB,
  triggerRevenue,
} from './stages/distribution.js';
import { createDividend, fundWallets, investA, investB, tokenizeSpv } from './stages/hedera.js';
import {
  checkOfferingEligibility,
  createInvestorA,
  createInvestorB,
  createPresentations,
  issueCredentials,
} from './stages/investors.js';
import { creConfigure } from './stages/cre.js';
import { resetLocal, setupEnv } from './stages/setup.js';
import {
  showCreExecution,
  verifyCatenor,
  verifyComplete,
  verifyHedera,
  verifyPrivy,
} from './stages/verify.js';

export const STAGES: readonly Stage[] = [
  setupEnv,
  resetLocal,
  createTrustDomain,
  admitTrustAnchor,
  createSponsor,
  authorizeSponsor,
  createSpv,
  createOffering,
  createInvestorA,
  createInvestorB,
  issueCredentials,
  createPresentations,
  checkOfferingEligibility,
  fundWallets,
  tokenizeSpv,
  investA,
  investB,
  createDividend,
  createAgent,
  agentRelationship,
  delegateCapability,
  invalidateInvestorB,
  triggerRevenue,
  confidentialDistribution,
  executeDistribution,
  showCreExecution,
  verifyHedera,
  verifyPrivy,
  verifyCatenor,
  verifyComplete,
  creConfigure,
];

function parseFlags(argv: readonly string[]): Flags {
  const options: Record<string, string> = {};
  for (const a of argv) {
    const m = /^--([a-z][a-z0-9-]*)(?:=(.*))?$/.exec(a);
    if (m) options[m[1]!] = m[2] ?? '';
  }
  return { live: 'live' in options, yes: 'yes' in options, options };
}

const [id, ...rest] = process.argv.slice(2);
const stage = STAGES.find((s) => s.id === id);
if (!stage) {
  console.error(
    `usage: run-stage.ts <stage-id> [--live] [--yes]\nstages:\n  ${STAGES.map((s) => s.id).join('\n  ')}`,
  );
  process.exit(2);
}
const flags = parseFlags(rest);
loadEnvironment();
const ctx = new Context();
const startedAt = new Date().toISOString();
let ok = false;
let result: Record<string, unknown> = {};
let failure: string | undefined;
try {
  await banner(stage, ctx, flags);
  result = await stage.run.call(stage, ctx, flags);
  ok = true;
} catch (e) {
  failure = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  console.error(`\nFAILED: ${failure}`);
  const reasons = (e as { reasons?: unknown }).reasons;
  if (reasons) console.error(`reasons: ${JSON.stringify(reasons)}`);
} finally {
  const creExecutions = await ctx.creExecutions().catch(() => []);
  if (stage.id !== '02-reset-local-demo') {
    const file = writeRun(stage.id, {
      stage: stage.id,
      title: stage.title,
      mode: flags.live && stage.liveMode ? stage.liveMode : stage.mode,
      ranAt: startedAt,
      ok,
      ...(failure ? { failure } : {}),
      result,
      ...(creExecutions.length ? { creExecutions } : {}),
      labels: {
        cre: `${ctx.creMode}${ctx.creMode === 'SIMULATION' ? ' (cre workflow simulate — not a deployed Confidential Workflow)' : ''}`,
        sumsub: 'REAL SUMSUB SANDBOX (synthetic applicants)',
        companyKyb: 'SYNTHETIC MOCK (S001 admission only)',
        privy: 'REAL (development app)',
        hedera: 'Hedera Testnet (chain 296)',
      },
    });
    console.log(`\nEvidence: ${file}`);
  }
  await ctx.close();
}
process.exit(ok ? 0 : 1);
