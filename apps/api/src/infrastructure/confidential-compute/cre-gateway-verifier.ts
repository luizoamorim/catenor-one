// Confidential verifier for a DEPLOYED identity-confidential workflow (mode DEPLOYED — used only after a real
// Confidential Workflows deployment; until then the demo uses CreSimulationConfidentialVerifier and says SIMULATION).
//
// Same sealed context and same authenticated callback as simulation; only the trigger differs. The HTTP trigger of a
// deployed workflow is invoked through the CRE gateway as JSON-RPC `workflows.execute`, authorized by a JWT signed with
// a key listed in the trigger's `authorizedKeys` (docs.chain.link/cre/guides/workflow/using-triggers/http-trigger/
// triggering-deployed-workflows): header {alg: "ETH", typ: "JWT"}; claims {digest: 0x + SHA-256 of the key-sorted
// JSON-RPC body, iss: signer address, iat, exp ≤ iat + 300, jti}; signature = EIP-191 personal-sign over
// `base64url(header).base64url(claims)`, encoded base64url(r ‖ s ‖ recoveryId), recoveryId ∈ {0, 1}.
// Written from that specification (no reference code copied). The trigger key is a runtime secret, never logged.
import { createHash, randomUUID } from 'node:crypto';
import { canonicalizeToString } from '@catenor-one/audit';
import { Signature, Wallet } from 'ethers';
import { sealContext, type ChannelKeys, type SealableContext } from './cre-channel.js';

/**
 * Gateway for this organization's private-registry workflows (DON family zone-a). The docs page "Triggering Deployed
 * Workflows" lists `https://01.enterprise-gateway.zone-a.cre.chain.link/` for the private registry, but on 2026-09-12
 * that gateway answered "Workflow not found" for two ACTIVE private-registry workflows (one confidential, one plain
 * control workflow). `https://01.gateway.zone-a.cre.chain.link`, the gateway the CRE CLI v1.33.0 itself embeds, accepted
 * the same signed request (HTTP 200, ACCEPTED). Override with `gatewayUrl` (DEMO_CRE_GATEWAY_URL in the demo runner).
 */
export const CRE_PRIVATE_REGISTRY_GATEWAY = 'https://01.gateway.zone-a.cre.chain.link';

export interface CreGatewayOptions {
  readonly keys: ChannelKeys;
  /** 64-hex workflow ID of the deployed workflow (`cre workflow list`). */
  readonly workflowId: string;
  /** secp256k1 private key whose EVM address is in the deployed trigger's authorizedKeys. */
  readonly triggerPrivateKey: string;
  readonly gatewayUrl?: string;
  readonly fetch?: typeof fetch;
  readonly now?: () => Date;
}

const b64url = (bytes: Uint8Array | string) =>
  Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** JWT for one gateway request body (exported for tests and for the invoke script). */
export function gatewayJwt(
  body: string,
  privateKey: string,
  now: Date,
  jti: string = randomUUID(),
): string {
  const wallet = new Wallet(privateKey);
  const iat = Math.floor(now.getTime() / 1000);
  const header = b64url(JSON.stringify({ alg: 'ETH', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({
      digest: `0x${createHash('sha256').update(body, 'utf8').digest('hex')}`,
      iss: wallet.address,
      iat,
      exp: iat + 300,
      jti,
    }),
  );
  const message = `${header}.${claims}`;
  const sig = Signature.from(wallet.signMessageSync(message));
  const bytes = Buffer.concat([
    Buffer.from(sig.r.slice(2), 'hex'),
    Buffer.from(sig.s.slice(2), 'hex'),
    Buffer.from([sig.yParity]),
  ]);
  return `${message}.${b64url(bytes)}`;
}

/** The JSON-RPC body (keys sorted at every level — the digest rule) for one sealed trigger payload. */
export function gatewayRequestBody(
  workflowId: string,
  input: unknown,
  id: string = randomUUID(),
): string {
  return canonicalizeToString({
    jsonrpc: '2.0',
    id,
    method: 'workflows.execute',
    params: { input, workflow: { workflowID: workflowId } },
  });
}

/**
 * The gateway's JSON-RPC error, for diagnosis. Its messages name only public values (the signer address, the workflow
 * ID); the request's sealed payload and JWT are never echoed. Control characters are stripped and the text is capped.
 */
export function gatewayErrorDetail(error?: { code?: number; message?: string }): string {
  if (!error) return 'no JSON-RPC result';
  const message = [...String(error.message ?? '')]
    .map((c) => (c < ' ' || c === '\u007f' ? ' ' : c))
    .join('')
    .slice(0, 300);
  return `${error.code ?? '?'} ${message}`.trim();
}

export class CreGatewayConfidentialVerifier {
  readonly mode = 'DEPLOYED' as const;
  readonly workflowId: string;

  constructor(private readonly options: CreGatewayOptions) {
    if (!/^(0x)?[0-9a-f]{64}$/i.test(options.workflowId)) {
      throw new Error('workflowId must be the 64-hex ID of the deployed workflow');
    }
    this.workflowId = options.workflowId;
  }

  get triggerAddress(): string {
    return new Wallet(this.options.triggerPrivateKey).address;
  }

  async request(input: {
    readonly operation: string;
    readonly runId: string;
    readonly context: SealableContext;
  }): Promise<{ executionId: string }> {
    const payload = sealContext(this.options.keys, input.operation, input.context);
    const body = gatewayRequestBody(this.options.workflowId.replace(/^0x/, ''), payload);
    const jwt = gatewayJwt(
      body,
      this.options.triggerPrivateKey,
      (this.options.now ?? (() => new Date()))(),
    );
    const response = await (this.options.fetch ?? fetch)(
      this.options.gatewayUrl ?? CRE_PRIVATE_REGISTRY_GATEWAY,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${jwt}` },
        body,
      },
    );
    const text = await response.text();
    let parsed: {
      result?: { workflow_execution_id?: string; status?: string };
      error?: { code?: number; message?: string };
    } = {};
    try {
      parsed = JSON.parse(text) as typeof parsed;
    } catch {
      // not JSON-RPC: reported by status below
    }
    if (!response.ok || parsed.error || !parsed.result?.workflow_execution_id) {
      throw new Error(`CRE gateway HTTP ${response.status}: ${gatewayErrorDetail(parsed.error)}`);
    }
    return { executionId: parsed.result.workflow_execution_id };
  }
}
