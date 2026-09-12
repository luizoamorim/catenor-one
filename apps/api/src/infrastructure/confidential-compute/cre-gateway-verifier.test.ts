// Deployed-trigger JWT (offline): the token's signer recovers to the authorized key, the digest binds the exact body,
// the recovery byte is 0/1, and the request goes to the gateway with the sealed payload only. Throwaway key; no network.
import { createHash } from 'node:crypto';
import { Signature, Wallet, verifyMessage } from 'ethers';
import { describe, expect, it } from 'vitest';
import { deriveChannelKeys } from './cre-channel.js';
import {
  CRE_PRIVATE_REGISTRY_GATEWAY,
  CreGatewayConfidentialVerifier,
  gatewayJwt,
  gatewayRequestBody,
} from './cre-gateway-verifier.js';

const key = Wallet.createRandom();
const NOW = new Date('2026-09-11T12:00:00Z');
const decode = (part: string) => Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

describe('CRE gateway JWT (alg ETH)', () => {
  it('signs base64url(header).base64url(claims) with EIP-191; digest = SHA-256 of the body', () => {
    const body = gatewayRequestBody('ab'.repeat(32), { v: 1 }, 'req-1');
    const [h, c, s] = gatewayJwt(body, key.privateKey, NOW, 'jti-1').split('.');
    expect(JSON.parse(decode(h!).toString())).toEqual({ alg: 'ETH', typ: 'JWT' });
    const claims = JSON.parse(decode(c!).toString());
    expect(claims).toEqual({
      digest: `0x${createHash('sha256').update(body).digest('hex')}`,
      iss: key.address,
      iat: 1789128000,
      exp: 1789128300,
      jti: 'jti-1',
    });
    const sig = decode(s!);
    expect(sig).toHaveLength(65);
    expect([0, 1]).toContain(sig[64]);
    const recovered = verifyMessage(
      `${h}.${c}`,
      Signature.from({
        r: `0x${sig.subarray(0, 32).toString('hex')}`,
        s: `0x${sig.subarray(32, 64).toString('hex')}`,
        v: 27 + sig[64]!,
      }),
    );
    expect(recovered).toBe(key.address);
  });

  it('the body has sorted keys at every level (the digest rule)', () => {
    expect(gatewayRequestBody('ab'.repeat(32), { z: 1, a: 2 }, 'id')).toBe(
      `{"id":"id","jsonrpc":"2.0","method":"workflows.execute","params":{"input":{"a":2,"z":1},"workflow":{"workflowID":"${'ab'.repeat(32)}"}}}`,
    );
  });

  it('posts one sealed trigger payload to the private-registry gateway and returns the execution id', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const verifier = new CreGatewayConfidentialVerifier({
      keys: deriveChannelKeys('11'.repeat(32)),
      workflowId: 'cd'.repeat(32),
      triggerPrivateKey: key.privateKey,
      now: () => NOW,
      fetch: (async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 'x',
            result: { workflow_execution_id: 'exec-1', status: 'ACCEPTED' },
          }),
        );
      }) as unknown as typeof fetch,
    });
    const out = await verifier.request({
      operation: 'CONFIDENTIAL_DISTRIBUTION',
      runId: 'run:1',
      context: { runId: 'run:1', secretApplicantRef: 'must-be-sealed' },
    });
    expect(out).toEqual({ executionId: 'exec-1' });
    expect(calls[0]!.url).toBe(CRE_PRIVATE_REGISTRY_GATEWAY);
    const body = String(calls[0]!.init.body);
    expect(body).not.toContain('must-be-sealed'); // the context travels sealed (AES-256-GCM)
    expect(JSON.parse(body).params.input).toMatchObject({
      v: 1,
      operation: 'CONFIDENTIAL_DISTRIBUTION',
      runId: 'run:1',
    });
  });

  it('refuses a workflow id that is not 64 hex', () => {
    expect(
      () =>
        new CreGatewayConfidentialVerifier({
          keys: deriveChannelKeys('11'.repeat(32)),
          workflowId: 'identity-confidential',
          triggerPrivateKey: key.privateKey,
        }),
    ).toThrow();
  });
});
