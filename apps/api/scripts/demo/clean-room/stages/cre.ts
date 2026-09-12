// CRE deployment support (scripts/demo/cre/configure.sh). Generates the DEPLOYED workflow config from the clean-room
// Trust Domain (Bootstrap Configuration hash, the Trust Anchor's issuer key, the pinned investor policies), the HTTP
// trigger's authorized key and the public callback URL — the same config the simulation uses, with
// executionMode DEPLOYED. It never deploys: scripts/demo/cre/deploy.sh --live does, and only the maintainer runs it.
import { createHmac } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Wallet } from 'ethers';
import { CALLBACK_PATH } from '../../../../src/infrastructure/confidential-compute/cre-callback-receiver.js';
import {
  relayPullPath,
  signRelayPull,
  type RelayedDelivery,
} from '../../../../src/infrastructure/confidential-compute/cre-callback-relay.js';
import { authenticateCallback } from '../../../../src/infrastructure/confidential-compute/cre-channel.js';
import { say, type Stage } from '../stage.js';
import { WORKFLOWS, env, need, setRuntime, setState } from '../state.js';

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
    '--relay-url=https://<railway-host> instead: the workflow calls back to the Railway API and the stages pull their results from its relay (docs/deployment/RAILWAY.md)',
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
        DEMO_CRE_RELAY_URL: '',
      });
    }
    const relay = flags.options['relay-url'];
    if (relay !== undefined) {
      if (!/^https:\/\/[^\s/]+\/?$/.test(relay)) {
        throw new Error('--relay-url must be the https origin of the Railway API (no path)');
      }
      const origin = relay.replace(/\/$/, '');
      setState({
        DEMO_CRE_RELAY_URL: origin,
        DEMO_CRE_CALLBACK_PUBLIC_URL: `${origin}${CALLBACK_PATH}`,
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
        throw new Error(
          '--use-deployed needs --workflow-id and --relay-url (or --callback-url) first',
        );
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
      callbackUrl:
        env('DEMO_CRE_CALLBACK_PUBLIC_URL') ||
        'NOT SET (pass --relay-url= or --callback-url=https://…)',
      resultPath: env('DEMO_CRE_RELAY_URL')
        ? 'Railway relay (pulled by the stage runner)'
        : 'local receiver 127.0.0.1:8787',
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

/**
 * Checks, before any CRE execution, that the Railway relay holds the same channel secret K as this instance: posts one
 * probe callback signed exactly like the TEE signs results (callback key from K), pulls it back with the relay key and
 * re-authenticates it locally. Only status codes are printed; the probe is consumed by the pull.
 */
export const creCheckRelay: Stage = {
  id: 'cre-check-relay',
  title: 'Railway CRE relay — shared-secret check (no CRE execution)',
  actor: 'Maintainer',
  operation: 'none (one signed probe callback to the Railway relay, pulled straight back)',
  changes: [
    'nothing persistent: the probe is parked in the relay mailbox and consumed by the pull',
  ],
  sponsors: ['none (Railway API only)'],
  mode: 'LOCAL',
  expected:
    'callback 202 RELAYED → pull 200 → re-authenticated locally: Railway and this instance share K',
  async run(ctx) {
    const base = need('DEMO_CRE_RELAY_URL', 'scripts/demo/cre/configure.sh --relay-url=https://…');
    const keys = ctx.channelKeys;
    const runId = `run:relay-check-${Date.now()}`;
    const body = JSON.stringify({
      v: 1,
      operation: 'RELAY_CHECK',
      runId,
      sessionRef: 'relay-check',
      mode: ctx.creMode,
      status: 'ERROR',
      code: 'RELAY_CHECK',
    });
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const post = await fetch(new URL(CALLBACK_PATH, base), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-catenor-timestamp': timestamp,
        'x-catenor-signature': createHmac('sha256', keys.cb)
          .update(`${timestamp}.${body}`)
          .digest('hex'),
      },
      body,
    });
    const postCode = ((await post.json().catch(() => ({}))) as { code?: string }).code;
    const path = relayPullPath(runId);
    const pullAt = new Date().toISOString();
    const pull = await fetch(new URL(path, base), {
      headers: {
        'x-catenor-timestamp': pullAt,
        'x-catenor-signature': signRelayPull(ctx.relayKey, pullAt, path),
      },
    });
    let reAuthenticated = false;
    if (pull.status === 200) {
      const d = (await pull.json()) as RelayedDelivery;
      reAuthenticated = authenticateCallback(
        keys,
        { timestamp: d.timestamp, signature: d.signature },
        new Uint8Array(Buffer.from(d.body, 'base64')),
        new Date(),
      ).ok;
    }
    const ok = post.status === 202 && pull.status === 200 && reAuthenticated;
    const out = {
      relay: base,
      callback: `${post.status} ${postCode ?? ''}`.trim(),
      pull: pull.status,
      reAuthenticatedLocally: reAuthenticated,
      verdict: ok
        ? 'OK — the Railway relay and this instance share the channel secret K'
        : post.status === 401
          ? 'MISMATCH — Railway CATENOR_INTERNAL_API_TOKEN ≠ workflows/.env CATENOR_INTERNAL_API_TOKEN_VAR'
          : post.status === 503
            ? 'RELAY NOT CONFIGURED on Railway (CATENOR_INTERNAL_API_TOKEN missing)'
            : 'FAILED — see the codes above',
    };
    say('relay check', out);
    if (!ok) process.exitCode = 1;
    return out;
  },
};
