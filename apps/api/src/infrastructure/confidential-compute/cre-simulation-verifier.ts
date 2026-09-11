// ConfidentialEvidenceVerifier backed by `cre workflow simulate` (mode SIMULATION — never a deployment claim).
// The API seals the private context exactly as for a deployed run (PLAN §18), hands the trigger payload to the
// CRE simulator, and the workflow delivers its result through the authenticated callback (cre-callback-receiver),
// the same path a deployed run uses. When Confidential Workflows deployment is available (B1), a gateway-trigger
// adapter replaces this class; nothing else changes.
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  ConfidentialEvidenceVerifier,
  PrivateVerificationContext,
} from '../../modules/trust-anchor-admission/application/admission.ports.js';
import { sealContext, type ChannelKeys } from './cre-channel.js';

export interface CreSimulationOptions {
  readonly keys: ChannelKeys;
  /** CRE project root (workflows/). */
  readonly projectRoot: string;
  readonly workflowFolder: string;
  readonly target: string;
  /** Env file holding the *_VAR secrets for simulation; consumed by the CRE CLI, never read here. */
  readonly envFile: string;
  /** Public workflow config generated from the pinned Bootstrap Configuration. */
  readonly workflowConfig: Record<string, unknown>;
  readonly limitsFile: string;
  readonly creBinary?: string;
}

export interface SimulationOutcome {
  readonly exitCode: number | null;
  /** The handler's DON-visible return value ({status, code}) as printed by the simulator, if found. */
  readonly handlerResult?: string;
  /** Last lines of simulator output for diagnostics (allowlisted TEE logs only; never persisted). */
  readonly outputTail: string;
}

export class CreSimulationConfidentialVerifier implements ConfidentialEvidenceVerifier {
  readonly mode = 'SIMULATION' as const;
  readonly workflowId = 'identity-confidential (cre workflow simulate)';
  private readonly runs = new Map<string, Promise<SimulationOutcome>>();
  /**
   * Short, git-ignored directory inside the workflow folder: the CLI caps config paths at 97 characters and
   * resolves --config relative to the workflow folder (--http-payload relative to the working directory).
   */
  private readonly dir = '.sim';
  private counter = 0;

  constructor(private readonly options: CreSimulationOptions) {
    mkdirSync(join(options.projectRoot, options.workflowFolder, this.dir), { recursive: true });
  }

  async request(input: {
    operation: 'TRUST_ANCHOR_ADMISSION';
    runId: string;
    context: PrivateVerificationContext;
  }): Promise<{ executionId: string }> {
    const n = `${process.pid}-${++this.counter}`;
    const folder = join(this.options.projectRoot, this.options.workflowFolder, this.dir);
    const payloadFile = `${this.options.workflowFolder}/${this.dir}/${n}.payload.json`; // relative to cwd
    const configFile = `${this.dir}/${n}.config.json`; // relative to the workflow folder
    writeFileSync(
      join(folder, `${n}.payload.json`),
      JSON.stringify(sealContext(this.options.keys, input.operation, input.context)),
    );
    writeFileSync(
      join(folder, `${n}.config.json`),
      JSON.stringify(this.options.workflowConfig, null, 2),
    );
    this.runs.set(input.runId, this.simulate(payloadFile, configFile));
    return { executionId: `SIMULATION:${input.runId}` };
  }

  /** Resolves when the simulator process for `runId` has exited. */
  completion(runId: string): Promise<SimulationOutcome> {
    const run = this.runs.get(runId);
    if (run === undefined) throw new Error(`run ${runId} was not requested`);
    return run;
  }

  dispose(): void {
    rmSync(join(this.options.projectRoot, this.options.workflowFolder, this.dir), {
      recursive: true,
      force: true,
    });
  }

  private simulate(payloadFile: string, configFile: string): Promise<SimulationOutcome> {
    const o = this.options;
    const args = [
      'workflow',
      'simulate',
      o.workflowFolder,
      '--non-interactive',
      '--target',
      o.target,
      '--trigger-index',
      '0',
      '--http-payload',
      payloadFile,
      '--config',
      configFile,
      '--limits',
      o.limitsFile,
      '--env',
      o.envFile,
      '--project-root',
      o.projectRoot,
    ];
    return new Promise((resolve) => {
      const child = spawn(o.creBinary ?? 'cre', args, {
        cwd: o.projectRoot,
        env: { ...process.env, TERM: 'dumb' },
      });
      let output = '';
      child.stdout.on('data', (d: Buffer) => (output += d.toString()));
      child.stderr.on('data', (d: Buffer) => (output += d.toString()));
      child.on('close', (exitCode) => {
        // Only the handler's DON-visible {status, code} is kept — nothing else from the simulator output.
        // The simulator prints it as an escaped JSON string: "{\"status\":\"DELIVERED\",\"code\":\"OK\"}".
        const match =
          /\\?"status\\?"\s*:\s*\\?"(DELIVERED|FAILED|ERROR)\\?"\s*,\s*\\?"code\\?"\s*:\s*\\?"([A-Z0-9_]+)/.exec(
            output,
          );
        resolve({
          exitCode,
          handlerResult: match ? JSON.stringify({ status: match[1], code: match[2] }) : undefined,
          outputTail: output.slice(-3000),
        });
      });
    });
  }
}
