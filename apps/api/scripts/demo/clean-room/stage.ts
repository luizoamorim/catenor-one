// Clean-room stage framework: every stage prints what it is about to do BEFORE doing it (STEP, actor, Catenor
// operation, what changes, sponsor integration, mode, expected result), gates Hedera broadcasts behind --live plus an
// explicit confirmation, and writes a sanitized evidence record.
import { createInterface } from 'node:readline/promises';
import type { Context } from './context.js';

export type Mode =
  | 'READ-ONLY'
  | 'LOCAL'
  | 'SPONSOR LIVE (non-spending)'
  | 'CONFIDENTIAL (CRE)'
  | 'TESTNET LIVE (spends HBAR)';

export interface Flags {
  readonly live: boolean;
  readonly yes: boolean;
  readonly options: Readonly<Record<string, string>>;
}

export interface Stage {
  readonly id: string;
  readonly title: string;
  readonly actor: string;
  readonly operation: string;
  readonly changes: readonly string[];
  readonly sponsors: readonly string[];
  /** Mode of the default run; `liveMode` when --live is passed (Hedera stages). */
  readonly mode: Mode;
  readonly liveMode?: Mode;
  readonly expected: string;
  /** Concrete values for the banner (DIDs, addresses) — public refs only. */
  details?(
    ctx: Context,
  ):
    | Promise<Record<string, string | readonly string[]>>
    | Record<string, string | readonly string[]>;
  run(ctx: Context, flags: Flags): Promise<Record<string, unknown>>;
}

const line = '─'.repeat(78);

export async function banner(stage: Stage, ctx: Context, flags: Flags): Promise<void> {
  const mode = flags.live && stage.liveMode ? stage.liveMode : stage.mode;
  console.log(`\n${line}\n[${stage.title}]\n${line}`);
  console.log(`STEP:      ${stage.id}`);
  console.log(`Actor:     ${stage.actor}`);
  console.log(`Operation: ${stage.operation}`);
  console.log(`Mode:      ${mode}`);
  console.log(`Sponsors:  ${stage.sponsors.length ? stage.sponsors.join(' · ') : 'none'}`);
  console.log('Changes:');
  for (const c of stage.changes) console.log(`  - ${c}`);
  const details = stage.details ? await stage.details(ctx) : {};
  for (const [k, v] of Object.entries(details)) {
    if (Array.isArray(v)) {
      console.log(`${k}:`);
      for (const item of v) console.log(`  ${item}`);
    } else {
      console.log(`${k}: ${v}`);
    }
  }
  console.log(`Expected:  ${stage.expected}\n${line}`);
}

/**
 * A Hedera broadcast needs --live AND an explicit confirmation: typing the stage id at the prompt, or (non-interactive)
 * CATENOR_DEMO_CONFIRM=<stage id>. `--yes` alone never authorizes a broadcast.
 */
export async function confirmLive(stageId: string, operation: string): Promise<void> {
  console.log(`\nLIVE HEDERA TESTNET OPERATION (chain 296 only — never mainnet):\n  ${operation}`);
  if (process.env['CATENOR_DEMO_CONFIRM'] === stageId) {
    console.log(`Confirmed by CATENOR_DEMO_CONFIRM=${stageId}.`);
    return;
  }
  if (!process.stdin.isTTY) {
    console.error(
      `REFUSED: no confirmation. Re-run interactively, or set CATENOR_DEMO_CONFIRM=${stageId}.`,
    );
    process.exit(3);
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (
    await rl.question(`Type "${stageId}" to broadcast, anything else to stop: `)
  ).trim();
  rl.close();
  if (answer !== stageId) {
    console.error('STOPPED: not confirmed — nothing was broadcast.');
    process.exit(3);
  }
}

export const say = (label: string, value: unknown) =>
  console.log(
    `  ${label}: ${
      typeof value === 'string'
        ? value
        : JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2)
    }`,
  );
