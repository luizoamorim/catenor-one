// Test-only harness: a throwaway PostgreSQL (Testcontainers) with the Prisma migrations deployed through the
// real `prisma migrate deploy` CLI. Nothing here touches Railway or any shared database.
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';

/** Pinned image; T15.1 must confirm the Railway PostgreSQL major version matches. */
export const POSTGRES_IMAGE = 'postgres:17.11-alpine';

const API_DIR = fileURLToPath(new URL('../../../../', import.meta.url));
const run = promisify(execFile);

export async function startPostgres(): Promise<StartedPostgreSqlContainer> {
  return new PostgreSqlContainer(POSTGRES_IMAGE).start();
}

/** Runs the Prisma CLI from apps/api against `databaseUrl`; returns the exit code and combined output. */
export async function prisma(
  databaseUrl: string,
  args: readonly string[],
): Promise<{ code: number; output: string }> {
  try {
    const { stdout, stderr } = await run('pnpm', ['exec', 'prisma', ...args], {
      cwd: API_DIR,
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });
    return { code: 0, output: stdout + stderr };
  } catch (error) {
    const e = error as { code?: number; stdout?: string; stderr?: string };
    return { code: e.code ?? 1, output: (e.stdout ?? '') + (e.stderr ?? '') };
  }
}

export async function connect(databaseUrl: string): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  return client;
}

/** Runs `fn` inside a transaction that is always rolled back, so each case starts from the same state. */
export async function inRollback(
  client: pg.Client,
  fn: (client: pg.Client) => Promise<void>,
): Promise<void> {
  await client.query('BEGIN');
  try {
    await fn(client);
  } finally {
    await client.query('ROLLBACK');
  }
}

/** Fixture values that satisfy every format CHECK. */
export const hash = (hexChar: string): string => `0x${hexChar.repeat(64)}`;
export const did = (hexChar: string): string => `did:catenor:${hexChar.repeat(32)}`;
export const TD = 'trust-domain:catenor-one-demo';
export const GENESIS = hash('0');
export const NONCE = 'A'.repeat(43);

/**
 * Seeds one complete, valid S001 state (committed): trust domain, published ALLOW decision, endorsement,
 * Admission Record for did('1') (root not yet set), DID Document + VM, Subject, session, key reference,
 * challenge, run, decision record, trace, provider binding and a genesis audit event.
 */
export async function seed(client: pg.Client): Promise<void> {
  const D = did('1');
  await client.query(`
    INSERT INTO catenor_public."TrustDomainProjection" (id, "bootstrapConfigurationHash") VALUES ('${TD}', '${hash('b')}');
    INSERT INTO catenor_public."DecisionProjection"
      ("decisionRef", policy, subject, action, resource, decision, "evaluatedAt", "evidenceCommitment", "decisionCommitment")
      VALUES ('decision:1', 'policy:trust-anchor-admission:v1', '${D}', 'ADMIT_TRUST_ANCHOR', '${TD}', 'ALLOW',
              '2026-09-09T22:10:00Z', '${hash('e')}', '${hash('d')}');
    INSERT INTO catenor_public."BootstrapEndorsementProjection" (id, "decisionRef", payload)
      VALUES ('endorsement:1', 'decision:1', '{}');
    INSERT INTO catenor_public."TrustAnchorAdmissionRecord"
      (id, "trustDomain", "trustAnchor", "admissionPolicy", "policyHash", decision, "verificationMethod",
       "evidenceCommitment", "createdAt", "decisionRef", "bootstrapEndorsementRef")
      VALUES ('record:1', '${TD}', '${D}', 'policy:trust-anchor-admission:v1', '${hash('a')}', 'ADMIT_TRUST_ANCHOR',
              '${D}#assertion-key-1', '${hash('e')}', '2026-09-10T00:00:02Z', 'decision:1', 'endorsement:1');
    INSERT INTO catenor_public."TrustAnchorStatusProjection" ("trustDomain", did, status, "changedAt")
      VALUES ('${TD}', '${D}', 'ACTIVE', now());
    INSERT INTO catenor_public."DidDocumentProjection" (did, document, lifecycle, "updatedAt")
      VALUES ('${D}', '{}', 'ACTIVE', now());
    INSERT INTO catenor_public."VerificationMethodProjection" (id, did, type, "publicKeyMultibase", relationships, status)
      VALUES ('${D}#assertion-key-1', '${D}', 'Multikey', 'z6MkTestKey1', '{assertionMethod}', 'ACTIVE');
    INSERT INTO catenor_public."PolicyPublication" ("policyId", "canonicalJson", "policyHash")
      VALUES ('policy:trust-anchor-admission:v1', '{}', '${hash('a')}');

    INSERT INTO catenor_private."Subject" (id, did, type, lifecycle) VALUES ('subject:1', '${D}', 'ORGANIZATION', 'ACTIVE');
    INSERT INTO catenor_private."AdmissionSession" (id, "sessionRef", "trustDomain", "subjectId", "operatorRef", "keyPossessionReasons", "updatedAt")
      VALUES ('session:1', 'sref:1', '${TD}', 'subject:1', 'operator-ref', '{}', now());
    INSERT INTO catenor_private."KeyManagementReference" ("verificationMethodId", "subjectId", "signerRef", adapter, purpose, status)
      VALUES ('${D}#assertion-key-1', 'subject:1', 'signer:1', 'fake', 'CREDENTIAL_ASSERTION', 'ACTIVE');
    INSERT INTO catenor_private."KeyPossessionChallenge"
      ("challengeId", "sessionId", subject, "verificationMethod", operation, "trustDomain", nonce, "issuedAt", "expiresAt")
      VALUES ('challenge:1', 'session:1', '${D}', '${D}#assertion-key-1', 'ADMIT_TRUST_ANCHOR', '${TD}', '${NONCE}',
              '2026-09-09T22:00:00Z', '2026-09-09T22:05:00Z');
    INSERT INTO catenor_private."ConfidentialVerificationRun"
      ("runId", "sessionId", attempt, operation, "creWorkflowId", "deadlineAt", "evidenceSources", "updatedAt")
      VALUES ('run:1', 'session:1', 1, 'TRUST_ANCHOR_ADMISSION', 'wf', now(), '{}', now());
    INSERT INTO catenor_private."DecisionRecord"
      ("decisionRef", "sessionId", policy, subject, action, resource, decision, "evaluatedAt", "evidenceCommitment", "decisionCommitment", "policyHash")
      VALUES ('decision:1', 'session:1', 'policy:trust-anchor-admission:v1', '${D}', 'ADMIT_TRUST_ANCHOR', '${TD}', 'ALLOW',
              '2026-09-09T22:10:00Z', '${hash('e')}', '${hash('d')}', '${hash('a')}');
    INSERT INTO catenor_private."DecisionTrace" ("decisionRef", claim, status, "factValue", "provenanceSource", "provenanceRef", reasons)
      VALUES ('decision:1', 'ASSERTION_KEY_POSSESSION_VALID', 'SATISFIED', true, 'KEY_POSSESSION_VERIFIER', 'challenge:1', '{}');
    INSERT INTO catenor_private."ProviderBinding" (id, "subjectId", provider, role, "bindingRef", "updatedAt")
      VALUES ('binding:1', 'subject:1', 'sumsub', 'REPRESENTATIVE', 'cbr-1', now());
    INSERT INTO catenor_private."AuditEvent" (id, "trustDomain", type, timestamp, "prevHash", "eventHash")
      VALUES ('event:1', '${TD}', 'SUBJECT_CREATED', '2026-09-09T22:00:00Z', '${GENESIS}', '${hash('f')}');
  `);
}
