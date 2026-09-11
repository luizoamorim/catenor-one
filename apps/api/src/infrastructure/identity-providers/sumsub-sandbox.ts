// Sumsub SANDBOX helpers for the S001 demo (PLAN §20.6). Two parts, both clearly scoped:
//
// 1. `SumsubSandboxOperator` — the OPERATOR's onboarding step, run from the operator's machine (never by the
//    Catenor API, which holds no Sumsub credentials): create the representative applicant (level id-only) with
//    externalUserId = the representative bindingRef, then force its sandbox review with testCompleted. Refuses any
//    non-sandbox token. Sandbox results are entirely synthetic (T0.8): "Sumsub sandbox" wording everywhere.
// 2. `startMockSumsubServer` — a local MOCK Sumsub API (labeled MOCK) for CRE simulation step A: it serves
//    GET /resources/applicants/{id}/one for registered synthetic applicants and verifies the request signature.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';

const SANDBOX_BASE_URL = 'https://api.sumsub.com';

function signature(secret: string, ts: string, method: string, pathWithQuery: string, body = '') {
  return createHmac('sha256', secret)
    .update(ts + method + pathWithQuery + body)
    .digest('hex');
}

export class SumsubSandboxOperator {
  constructor(
    private readonly credentials: { appToken: string; secretKey: string },
    private readonly baseUrl = SANDBOX_BASE_URL,
  ) {
    if (!credentials.appToken.startsWith('sbx:')) {
      throw new Error('REFUSED: not a Sumsub sandbox token (expected prefix "sbx:")');
    }
  }

  private async call(method: 'GET' | 'POST', pathWithQuery: string, body?: unknown) {
    const text = body === undefined ? '' : JSON.stringify(body);
    const ts = String(Math.floor(Date.now() / 1000));
    const response = await fetch(this.baseUrl + pathWithQuery, {
      method,
      headers: {
        Accept: 'application/json',
        'X-App-Token': this.credentials.appToken,
        'X-App-Access-Ts': ts,
        'X-App-Access-Sig': signature(this.credentials.secretKey, ts, method, pathWithQuery, text),
        ...(text ? { 'Content-Type': 'application/json' } : {}),
      },
      body: text || undefined,
    });
    if (!response.ok) {
      throw new Error(`Sumsub sandbox ${method} failed with HTTP ${response.status}`);
    }
    return (await response.json()) as Record<string, unknown>;
  }

  /** Creates a synthetic individual applicant bound to `bindingRef`; returns its applicant ID (private). */
  async createRepresentative(bindingRef: string, levelName = 'id-only'): Promise<string> {
    return this.createIndividual(bindingRef, 'DemoRepresentative', levelName);
  }

  /** Final demo: a synthetic individual INVESTOR applicant bound to `bindingRef` (e.g. lastName DemoInvestorA). */
  async createInvestorApplicant(
    bindingRef: string,
    label: 'A' | 'B',
    levelName = 'id-only',
  ): Promise<string> {
    return this.createIndividual(bindingRef, `DemoInvestor${label}`, levelName);
  }

  private async createIndividual(
    bindingRef: string,
    lastName: string,
    levelName: string,
  ): Promise<string> {
    const applicant = await this.call(
      'POST',
      `/resources/applicants?levelName=${encodeURIComponent(levelName)}`,
      {
        externalUserId: bindingRef,
        fixedInfo: { firstName: 'Catenor', lastName, country: 'GBR' },
      },
    );
    if (typeof applicant.id !== 'string') {
      throw new Error('Sumsub sandbox returned no applicant id');
    }
    return applicant.id;
  }

  /** Forces the sandbox review result (T0.8: works for individuals directly from init). */
  async forceReview(applicantId: string, answer: 'GREEN' | 'RED'): Promise<void> {
    await this.call(
      'POST',
      `/resources/applicants/${encodeURIComponent(applicantId)}/status/testCompleted`,
      answer === 'GREEN'
        ? { reviewAnswer: 'GREEN' }
        : { reviewAnswer: 'RED', reviewRejectType: 'FINAL', rejectLabels: ['SANCTIONS'] },
    );
  }
}

export interface MockSumsubServer {
  readonly baseUrl: string;
  /** Registers a synthetic individual applicant (MOCK) served at /resources/applicants/{id}/one. */
  register(applicantId: string, bindingRef: string, answer: 'GREEN' | 'RED' | 'PENDING'): void;
  readonly requests: { path: string; signatureValid: boolean }[];
  close(): Promise<void>;
}

export async function startMockSumsubServer(options: {
  readonly port: number;
  /** The synthetic secret the simulation env file gives the workflow. */
  readonly secretKey: string;
}): Promise<MockSumsubServer> {
  const applicants = new Map<string, Record<string, unknown>>();
  const requests: { path: string; signatureValid: boolean }[] = [];
  const server = createServer((req, res) => {
    const path = req.url ?? '';
    const ts = String(req.headers['x-app-access-ts'] ?? '');
    const sig = String(req.headers['x-app-access-sig'] ?? '');
    const expected = signature(options.secretKey, ts, req.method ?? 'GET', path);
    const signatureValid =
      sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    requests.push({ path, signatureValid });
    const m = /^\/resources\/applicants\/([^/]+)\/one$/.exec(path);
    const applicant = m ? applicants.get(decodeURIComponent(m[1]!)) : undefined;
    if (req.method !== 'GET' || !signatureValid) {
      return res.writeHead(401, { 'content-type': 'application/json' }).end('{"code":401}');
    }
    if (applicant === undefined) {
      return res.writeHead(404, { 'content-type': 'application/json' }).end('{"code":404}');
    }
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(applicant));
  });
  await new Promise<void>((resolve) => server.listen(options.port, '127.0.0.1', resolve));
  return {
    baseUrl: `http://127.0.0.1:${options.port}`,
    requests,
    register(applicantId, bindingRef, answer) {
      const completed = answer !== 'PENDING';
      applicants.set(applicantId, {
        id: applicantId,
        label: 'MOCK Sumsub — synthetic applicant for simulation',
        externalUserId: bindingRef,
        type: 'individual',
        review: {
          levelName: 'id-only',
          reprocessing: true,
          reviewStatus: completed ? 'completed' : 'pending',
          ...(completed
            ? {
                reviewDate: new Date()
                  .toISOString()
                  .replace('T', ' ')
                  .replace(/\.\d{3}Z$/, '+0000'),
                reviewResult:
                  answer === 'GREEN'
                    ? { reviewAnswer: 'GREEN' }
                    : {
                        reviewAnswer: 'RED',
                        reviewRejectType: 'FINAL',
                        rejectLabels: ['SANCTIONS'],
                      },
              }
            : {}),
        },
      });
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
