// CRE deployment support (scripts/demo/cre/configure.sh). Generates the DEPLOYED workflow config from the clean-room
// Trust Domain (Bootstrap Configuration hash, the Trust Anchor's issuer key, the pinned investor policies), the HTTP
// trigger's authorized key and the public callback URL — the same config the simulation uses, with
// executionMode DEPLOYED. It never deploys: scripts/demo/cre/deploy.sh --live does, and only the maintainer runs it.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Wallet } from 'ethers';
import { CALLBACK_PATH } from '../../../../src/infrastructure/confidential-compute/cre-callback-receiver.js';
import { say, type Stage } from '../stage.js';
import { WORKFLOWS, env, setRuntime, setState } from '../state.js';

export const DEPLOY_CONFIG = join(WORKFLOWS, 'identity-confidential/.deploy/config.json');

export const creConfigure: Stage = {
  id: 'cre-configure',
  title: 'Chainlink CRE — deployed workflow configuration (no deployment)',
  actor: 'Maintainer',
  operation:
    'none (generates config + trigger key; records the workflow id / switches the demo to DEPLOYED)',
  changes: [
    'generates the HTTP-trigger key if absent: private key → .catenor-demo/runtime.env (0600), address → state.env (authorizedKeys)',
    '--callback-url=https://… records the PUBLIC URL that forwards to the local receiver (e.g. a tunnel to 127.0.0.1:8787)',
    `writes workflows/identity-confidential/.deploy/config.json (git-ignored) with executionMode DEPLOYED`,
    '--workflow-id=<64 hex> records the deployed workflow id; --use-deployed switches stages to the gateway (DEPLOYED); --use-simulation switches back',
  ],
  sponsors: ['none (local)'],
  mode: 'LOCAL',
  expected:
    'a deployable config; the demo stays SIMULATION until --use-deployed after a real deployment',
  async run(ctx, flags) {
    if (!env('DEMO_CRE_TRIGGER_ADDRESS')) {
      const key = Wallet.createRandom();
      setRuntime({ DEMO_CRE_TRIGGER_PRIVATE_KEY: key.privateKey });
      setState({ DEMO_CRE_TRIGGER_ADDRESS: key.address });
    }
    const callback = flags.options['callback-url'];
    if (callback !== undefined) {
      if (!/^https:\/\/[^\s]+$/.test(callback)) {
        throw new Error('--callback-url must be an https URL');
      }
      setState({
        DEMO_CRE_CALLBACK_PUBLIC_URL: callback.endsWith(CALLBACK_PATH)
          ? callback
          : `${callback.replace(/\/$/, '')}${CALLBACK_PATH}`,
      });
    }
    const workflowId = flags.options['workflow-id'];
    if (workflowId !== undefined) {
      if (!/^(0x)?[0-9a-f]{64}$/i.test(workflowId)) {
        throw new Error('--workflow-id must be 64 hex characters');
      }
      setState({ DEMO_CRE_WORKFLOW_ID: workflowId.replace(/^0x/, '') });
    }
    if (flags.options['use-deployed'] !== undefined) {
      if (!env('DEMO_CRE_WORKFLOW_ID') || !env('DEMO_CRE_CALLBACK_PUBLIC_URL')) {
        throw new Error('--use-deployed needs --workflow-id and --callback-url first');
      }
      setState({ DEMO_CRE_MODE: 'DEPLOYED' });
    }
    if (flags.options['use-simulation'] !== undefined) setState({ DEMO_CRE_MODE: 'SIMULATION' });

    const deployedConfig = {
      ...(await ctx.workflowConfig(
        env('DEMO_CRE_CALLBACK_PUBLIC_URL') ||
          'https://REPLACE-WITH-PUBLIC-CALLBACK/v1/internal/cre/identity-confidential/results',
      )),
      executionMode: 'DEPLOYED',
    };
    mkdirSync(join(WORKFLOWS, 'identity-confidential/.deploy'), { recursive: true });
    writeFileSync(DEPLOY_CONFIG, `${JSON.stringify(deployedConfig, null, 2)}\n`);
    const summary = {
      config: 'workflows/identity-confidential/.deploy/config.json',
      executionMode: 'DEPLOYED',
      callbackUrl: env('DEMO_CRE_CALLBACK_PUBLIC_URL') || 'NOT SET (pass --callback-url=https://…)',
      authorizedKey: env('DEMO_CRE_TRIGGER_ADDRESS'),
      issuerRules: (deployedConfig as { credentialRules?: unknown }).credentialRules
        ? 'Trust Anchor key pinned'
        : 'NOT SET (run stage 11 first)',
      workflowId: env('DEMO_CRE_WORKFLOW_ID') || 'NOT RECORDED',
      demoCreMode: env('DEMO_CRE_MODE') || 'SIMULATION',
    };
    say('CRE deployment configuration', summary);
    return summary;
  },
};
