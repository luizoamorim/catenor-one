// T3.2 — initial migration on real PostgreSQL (Testcontainers): deploy from empty, catalog, every CHECK,
// immutability triggers, referential actions and DB-level concurrency invariants.
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  GENESIS,
  TD,
  connect,
  did,
  hash,
  inRollback,
  prisma,
  seed,
  startPostgres,
} from './postgres.test-fixtures.js';

const MIGRATIONS = [
  '20260911034806_init',
  '20260911041606_audit_event_append_only',
  '20260911053426_part_b_audit_event_types',
];
const D = did('1');

let container: StartedPostgreSqlContainer;
let url: string;
let db: pg.Client;
let firstDeploy: { code: number; output: string };

beforeAll(async () => {
  container = await startPostgres();
  url = container.getConnectionUri();
  firstDeploy = await prisma(url, ['migrate', 'deploy']);
  db = await connect(url);
  if (firstDeploy.code === 0) await seed(db);
});

afterAll(async () => {
  await db?.end();
  await container?.stop();
});

const rejectsWith = async (client: pg.Client, sql: string, expected: Record<string, unknown>) =>
  expect(client.query(sql)).rejects.toMatchObject(expected);

describe('migration deploy (T3.2)', () => {
  it('`prisma migrate deploy` applies every migration to an empty database', async () => {
    expect(firstDeploy.code, firstDeploy.output).toBe(0);
    for (const name of MIGRATIONS) expect(firstDeploy.output).toContain(name);
    const { rows } = await db.query(
      `SELECT migration_name, finished_at IS NOT NULL AS finished, rolled_back_at IS NULL AS kept
         FROM public._prisma_migrations ORDER BY migration_name`,
    );
    expect(rows).toEqual(
      MIGRATIONS.map((migration_name) => ({ migration_name, finished: true, kept: true })),
    );
  });

  it('a second deploy has nothing to apply and `migrate status` reports the schema up to date', async () => {
    const again = await prisma(url, ['migrate', 'deploy']);
    expect(again.code, again.output).toBe(0);
    expect(again.output).toMatch(/No pending migrations to apply/);
    const status = await prisma(url, ['migrate', 'status']);
    expect(status.code, status.output).toBe(0);
    expect(status.output).toMatch(/Database schema is up to date/);
  });

  it('the deployed database has no drift from schema.prisma', async () => {
    const drift = await prisma(url, [
      'migrate',
      'diff',
      '--from-config-datasource',
      '--to-schema',
      'prisma/schema.prisma',
      '--exit-code',
    ]);
    expect(drift.code, drift.output).toBe(0);
  });
});

describe('catalog', () => {
  it('two Postgres schemas: 8 public and 9 private tables', async () => {
    const { rows } = await db.query(
      `SELECT table_schema, count(*)::int AS n FROM information_schema.tables
        WHERE table_schema LIKE 'catenor_%' GROUP BY table_schema ORDER BY table_schema`,
    );
    expect(rows).toEqual([
      { table_schema: 'catenor_private', n: 9 },
      { table_schema: 'catenor_public', n: 8 },
    ]);
  });

  it('exactly the 39 reviewed CHECK constraints exist', async () => {
    const { rows } = await db.query(
      `SELECT c.conname FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE n.nspname LIKE 'catenor_%' AND c.contype = 'c' ORDER BY c.conname`,
    );
    expect(rows.map((r: { conname: string }) => r.conname)).toEqual(EXPECTED_CHECKS);
  });

  it('exactly the 3 immutability triggers and the 2 audit append-only triggers exist', async () => {
    const { rows } = await db.query(
      `SELECT n.nspname || '.' || c.relname || ':' || t.tgname AS t
         FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname LIKE 'catenor_%' AND NOT t.tgisinternal ORDER BY 1`,
    );
    expect(rows.map((r: { t: string }) => r.t)).toEqual([
      'catenor_private.AuditEvent:AuditEvent_append_only',
      'catenor_private.AuditEvent:AuditEvent_no_truncate',
      'catenor_private.KeyManagementReference:KeyManagementReference_signerRef_immutable',
      'catenor_public.TrustDomainProjection:TrustDomainProjection_initialTrustAnchorDid_set_once',
      'catenor_public.VerificationMethodProjection:VerificationMethodProjection_publicKeyMultibase_immutable',
    ]);
  });

  it('all 14 foreign keys are ON DELETE RESTRICT / ON UPDATE RESTRICT and none crosses public/private', async () => {
    const { rows } = await db.query(
      `SELECT c.conname, c.confdeltype, c.confupdtype, sn.nspname AS src, tn.nspname AS dst
         FROM pg_constraint c
         JOIN pg_class s ON s.oid = c.conrelid JOIN pg_namespace sn ON sn.oid = s.relnamespace
         JOIN pg_class t ON t.oid = c.confrelid JOIN pg_namespace tn ON tn.oid = t.relnamespace
        WHERE c.contype = 'f' AND sn.nspname LIKE 'catenor_%'`,
    );
    expect(rows).toHaveLength(14);
    for (const fk of rows) {
      expect(fk, fk.conname).toMatchObject({ confdeltype: 'r', confupdtype: 'r' });
      expect(fk.src, fk.conname).toBe(fk.dst);
    }
  });
});

describe('seed', () => {
  it('a complete valid S001 state satisfies every constraint', async () => {
    const { rows } = await db.query(`SELECT count(*)::int AS n FROM catenor_private."AuditEvent"`);
    expect(rows[0].n).toBe(1);
  });
});

describe('CHECK constraints reject violations (C1–C5)', () => {
  const R = TD;
  const cases: [constraint: string, sql: string][] = [
    // C1 commitment formats
    [
      'PolicyPublication_policyHash_format',
      `UPDATE catenor_public."PolicyPublication" SET "policyHash" = '0xABC'`,
    ],
    [
      'DecisionProjection_evidenceCommitment_format',
      `UPDATE catenor_public."DecisionProjection" SET "evidenceCommitment" = 'nope'`,
    ],
    [
      'DecisionProjection_decisionCommitment_format',
      `UPDATE catenor_public."DecisionProjection" SET "decisionCommitment" = '0x${'A'.repeat(64)}'`,
    ],
    [
      'TrustAnchorAdmissionRecord_policyHash_format',
      `UPDATE catenor_public."TrustAnchorAdmissionRecord" SET "policyHash" = 'x'`,
    ],
    [
      'TrustAnchorAdmissionRecord_evidenceCommitment_format',
      `UPDATE catenor_public."TrustAnchorAdmissionRecord" SET "evidenceCommitment" = 'x'`,
    ],
    [
      'TrustDomainProjection_bootstrapConfigurationHash_format',
      `UPDATE catenor_public."TrustDomainProjection" SET "bootstrapConfigurationHash" = 'x'`,
    ],
    [
      'DecisionRecord_evidenceCommitment_format',
      `UPDATE catenor_private."DecisionRecord" SET "evidenceCommitment" = 'x'`,
    ],
    [
      'DecisionRecord_decisionCommitment_format',
      `UPDATE catenor_private."DecisionRecord" SET "decisionCommitment" = 'x'`,
    ],
    [
      'DecisionRecord_policyHash_format',
      `UPDATE catenor_private."DecisionRecord" SET "policyHash" = 'x'`,
    ],
    [
      'ConfidentialVerificationRun_evidenceCommitment_format',
      `UPDATE catenor_private."ConfidentialVerificationRun" SET "evidenceCommitment" = 'x'`,
    ],
    [
      'ConfidentialVerificationRun_bootstrapConfigHashEcho_format',
      `UPDATE catenor_private."ConfidentialVerificationRun" SET "bootstrapConfigurationHashEcho" = 'x'`,
    ],
    [
      'AuditEvent_prevHash_format',
      `INSERT INTO catenor_private."AuditEvent" (id, "trustDomain", type, timestamp, "prevHash", "eventHash")
         VALUES ('event:x', '${TD}', 'SUBJECT_CREATED', 't', 'x', '${hash('4')}')`,
    ],
    [
      'AuditEvent_eventHash_format',
      `INSERT INTO catenor_private."AuditEvent" (id, "trustDomain", type, timestamp, "prevHash", "eventHash")
         VALUES ('event:x', '${TD}', 'SUBJECT_CREATED', 't', '${hash('f')}', 'x')`,
    ],
    // C2 did:catenor formats
    [
      'DidDocumentProjection_did_format',
      `INSERT INTO catenor_public."DidDocumentProjection" (did, document, lifecycle, "updatedAt")
         VALUES ('did:catenor:alice', '{}', 'ACTIVE', now())`,
    ],
    [
      'VerificationMethodProjection_did_format',
      `INSERT INTO catenor_public."VerificationMethodProjection" (id, did, type, "publicKeyMultibase", relationships, status)
         VALUES ('did:web:x#k', 'did:web:x', 'Multikey', 'z6Mk', '{}', 'ACTIVE')`,
    ],
    [
      'DecisionProjection_subject_format',
      `UPDATE catenor_public."DecisionProjection" SET subject = 'did:web:example.com'`,
    ],
    [
      'TrustAnchorAdmissionRecord_trustAnchor_format',
      `INSERT INTO catenor_public."TrustAnchorAdmissionRecord"
         (id, "trustDomain", "trustAnchor", "admissionPolicy", "policyHash", decision, "verificationMethod",
          "evidenceCommitment", "createdAt", "decisionRef", "bootstrapEndorsementRef")
         VALUES ('record:x', '${R}', 'did:catenor:BAD', 'p', '${hash('a')}', 'ADMIT_TRUST_ANCHOR', 'v',
                 '${hash('e')}', 't', 'decision:x', 'endorsement:x')`,
    ],
    [
      'TrustAnchorStatusProjection_did_format',
      `INSERT INTO catenor_public."TrustAnchorStatusProjection" ("trustDomain", did, status, "changedAt")
         VALUES ('${R}', 'did:catenor:x', 'ACTIVE', now())`,
    ],
    [
      'TrustDomainProjection_initialTrustAnchorDid_format',
      `UPDATE catenor_public."TrustDomainProjection" SET "initialTrustAnchorDid" = 'did:catenor:x'`,
    ],
    ['Subject_did_format', `UPDATE catenor_private."Subject" SET did = 'alice@example.com'`],
    [
      'KeyPossessionChallenge_subject_format',
      `UPDATE catenor_private."KeyPossessionChallenge" SET subject = 'x'`,
    ],
    ['DecisionRecord_subject_format', `UPDATE catenor_private."DecisionRecord" SET subject = 'x'`],
    // C3 trust-domain formats
    [
      'TrustDomainProjection_id_format',
      `INSERT INTO catenor_public."TrustDomainProjection" (id, "bootstrapConfigurationHash")
         VALUES ('Trust-Domain:X', '${hash('b')}')`,
    ],
    [
      'TrustAnchorAdmissionRecord_trustDomain_format',
      `INSERT INTO catenor_public."TrustAnchorAdmissionRecord"
         (id, "trustDomain", "trustAnchor", "admissionPolicy", "policyHash", decision, "verificationMethod",
          "evidenceCommitment", "createdAt", "decisionRef", "bootstrapEndorsementRef")
         VALUES ('record:x', 'catenor-one-demo', '${did('2')}', 'p', '${hash('a')}', 'ADMIT_TRUST_ANCHOR', 'v',
                 '${hash('e')}', 't', 'decision:x', 'endorsement:x')`,
    ],
    [
      'TrustAnchorStatusProjection_trustDomain_format',
      `INSERT INTO catenor_public."TrustAnchorStatusProjection" ("trustDomain", did, status, "changedAt")
         VALUES ('domain', '${did('2')}', 'ACTIVE', now())`,
    ],
    [
      'AdmissionSession_trustDomain_format',
      `UPDATE catenor_private."AdmissionSession" SET "trustDomain" = 'x'`,
    ],
    [
      'KeyPossessionChallenge_trustDomain_format',
      `UPDATE catenor_private."KeyPossessionChallenge" SET "trustDomain" = 'x'`,
    ],
    [
      'AuditEvent_trustDomain_format',
      `INSERT INTO catenor_private."AuditEvent" (id, "trustDomain", type, timestamp, "prevHash", "eventHash")
         VALUES ('event:x', 'x', 'SUBJECT_CREATED', 't', '${hash('f')}', '${hash('4')}')`,
    ],
    // C4 fixed values and bounds
    [
      'TrustAnchorAdmissionRecord_decision_value',
      `UPDATE catenor_public."TrustAnchorAdmissionRecord" SET decision = 'ADMIT_ISSUER'`,
    ],
    [
      'KeyPossessionChallenge_operation_value',
      `UPDATE catenor_private."KeyPossessionChallenge" SET operation = 'OTHER_OPERATION'`,
    ],
    [
      'ConfidentialVerificationRun_attempt_range',
      `UPDATE catenor_private."ConfidentialVerificationRun" SET attempt = 4`,
    ],
    [
      'ConfidentialVerificationRun_attempt_range',
      `UPDATE catenor_private."ConfidentialVerificationRun" SET attempt = 0`,
    ],
    [
      'KeyPossessionChallenge_nonce_format',
      `UPDATE catenor_private."KeyPossessionChallenge" SET nonce = 'opaque-random-nonce-001'`,
    ],
    [
      'VerificationMethodProjection_id_under_did',
      `INSERT INTO catenor_public."VerificationMethodProjection" (id, did, type, "publicKeyMultibase", relationships, status)
         VALUES ('${did('2')}#assertion-key-1', '${D}', 'Multikey', 'z6Mk2', '{}', 'ACTIVE')`,
    ],
    // C5 state consistency
    [
      'DecisionTrace_status_matches_value',
      `UPDATE catenor_private."DecisionTrace" SET "factValue" = false`,
    ],
    [
      'DecisionTrace_status_matches_value',
      `UPDATE catenor_private."DecisionTrace" SET status = 'MISSING', "provenanceSource" = NULL, "provenanceRef" = NULL`,
    ],
    [
      'DecisionTrace_provenance_matches_status',
      `UPDATE catenor_private."DecisionTrace" SET "provenanceRef" = NULL`,
    ],
    [
      'DecisionTrace_provenance_matches_status',
      `INSERT INTO catenor_private."DecisionTrace" ("decisionRef", claim, status, "factValue", "provenanceSource", "provenanceRef", reasons)
         VALUES ('decision:1', 'ASSERTION_KEY_PURPOSE_VALID', 'MISSING', NULL, 'KEY_POSSESSION_VERIFIER', 'challenge:1', '{}')`,
    ],
    [
      'DecisionRecord_errorReason_iff_error',
      `UPDATE catenor_private."DecisionRecord" SET "errorReason" = 'POLICY_INTEGRITY_FAILURE'`,
    ],
    [
      'DecisionRecord_errorReason_iff_error',
      `UPDATE catenor_private."DecisionRecord" SET decision = 'ERROR'`,
    ],
    [
      'KeyPossessionChallenge_consumedAt_iff_consumed',
      `UPDATE catenor_private."KeyPossessionChallenge" SET status = 'CONSUMED'`,
    ],
    [
      'ProviderBinding_externalSubjectId_iff_attached',
      `UPDATE catenor_private."ProviderBinding" SET status = 'ATTACHED_UNVERIFIED'`,
    ],
    [
      'ConfidentialVerificationRun_facts_iff_evidence',
      `UPDATE catenor_private."ConfidentialVerificationRun" SET facts = '[]'`,
    ],
    [
      'ConfidentialVerificationRun_facts_iff_evidence',
      `UPDATE catenor_private."ConfidentialVerificationRun" SET status = 'EVIDENCE_RECEIVED'`,
    ],
    [
      'ConfidentialVerificationRun_facts_iff_evidence',
      `UPDATE catenor_private."ConfidentialVerificationRun" SET status = 'ERROR', "evidenceCommitment" = '${hash('c')}'`,
    ],
  ];

  it.each(cases)('%s', async (constraint, sql) => {
    await inRollback(db, (c) => rejectsWith(c, sql, { code: '23514', constraint }));
  });

  it('every one of the 39 CHECK constraints is exercised by a negative case', () => {
    expect([...new Set(cases.map(([name]) => name))].sort()).toEqual(EXPECTED_CHECKS);
  });

  it('valid state transitions satisfy the consistency CHECKs', async () => {
    await inRollback(db, async (c) => {
      await c.query(
        `UPDATE catenor_private."KeyPossessionChallenge" SET status = 'CONSUMED', "consumedAt" = now()`,
      );
      await c.query(
        `UPDATE catenor_private."ProviderBinding" SET status = 'ATTACHED_UNVERIFIED', "externalSubjectId" = 'applicant-fixture'`,
      );
      await c.query(
        `UPDATE catenor_private."ConfidentialVerificationRun"
            SET status = 'EVIDENCE_RECEIVED', facts = '[]', "evidenceCommitment" = '${hash('c')}'`,
      );
      await c.query(
        `INSERT INTO catenor_private."DecisionTrace" ("decisionRef", claim, status, "factValue", "provenanceSource", "provenanceRef", reasons)
           VALUES ('decision:1', 'ASSERTION_KEY_PURPOSE_VALID', 'MISSING', NULL, NULL, NULL, '{CHALLENGE_EXPIRED}'),
                  ('decision:1', 'ORGANIZATION_AML_CLEAR', 'FALSE', false, 'CONFIDENTIAL_VERIFICATION', 'run:1', '{}')`,
      );
      await c.query(
        `UPDATE catenor_private."DecisionRecord" SET decision = 'ERROR', "errorReason" = 'POLICY_INTEGRITY_FAILURE'`,
      );
    });
  });

  it('enum and uniqueness guards: DENY is unstorable publicly; unknown facts and a 2nd challenge per session are rejected', async () => {
    await inRollback(db, (c) =>
      rejectsWith(c, `UPDATE catenor_public."DecisionProjection" SET decision = 'DENY'`, {
        code: '22P02',
      }),
    );
    await inRollback(db, (c) =>
      rejectsWith(
        c,
        `INSERT INTO catenor_private."DecisionTrace" ("decisionRef", claim, status, "factValue", "provenanceSource", "provenanceRef", reasons)
           VALUES ('decision:1', 'SUPER_TRUSTED_BY_UI', 'SATISFIED', true, 'CONFIDENTIAL_VERIFICATION', 'x', '{}')`,
        { code: '22P02' },
      ),
    );
    await inRollback(db, (c) =>
      rejectsWith(
        c,
        `INSERT INTO catenor_private."KeyPossessionChallenge"
           ("challengeId", "sessionId", subject, "verificationMethod", operation, "trustDomain", nonce, "issuedAt", "expiresAt")
           VALUES ('challenge:2', 'session:1', '${D}', '${D}#assertion-key-1', 'ADMIT_TRUST_ANCHOR', '${TD}', '${'B'.repeat(43)}', 't', 't')`,
        { code: '23505', constraint: 'KeyPossessionChallenge_sessionId_key' },
      ),
    );
  });
});

describe('immutability triggers', () => {
  const setRoot = (value: string | null) =>
    `UPDATE catenor_public."TrustDomainProjection" SET "initialTrustAnchorDid" = ${value === null ? 'NULL' : `'${value}'`} WHERE id = '${TD}'`;

  it('initialTrustAnchorDid: NULL → DID is allowed once (and a same-value update is a no-op)', async () => {
    await inRollback(db, async (c) => {
      expect((await c.query(setRoot(D))).rowCount).toBe(1);
      expect((await c.query(setRoot(D))).rowCount).toBe(1);
    });
  });

  it('initialTrustAnchorDid: once set it cannot change', async () => {
    await inRollback(db, async (c) => {
      await c.query(setRoot(D));
      await insertAdmissionRecord(c, TD, did('2'), '2');
      await rejectsWith(c, setRoot(did('2')), {
        code: '23000',
        message: expect.stringContaining('initialTrustAnchorDid is set once'),
      });
    });
  });

  it('initialTrustAnchorDid: once set it cannot return to NULL', async () => {
    await inRollback(db, async (c) => {
      await c.query(setRoot(D));
      await rejectsWith(c, setRoot(null), { code: '23000' });
    });
  });

  it('KeyManagementReference.signerRef cannot change; status and other columns stay updatable', async () => {
    await inRollback(db, (c) =>
      rejectsWith(
        c,
        `UPDATE catenor_private."KeyManagementReference" SET "signerRef" = 'signer:2'`,
        {
          code: '23000',
          message: expect.stringContaining('signerRef is immutable'),
        },
      ),
    );
    await inRollback(db, async (c) => {
      const r = await c.query(
        `UPDATE catenor_private."KeyManagementReference" SET status = 'REVOKED', "signerRef" = 'signer:1'`,
      );
      expect(r.rowCount).toBe(1);
    });
  });

  it('VerificationMethodProjection.publicKeyMultibase cannot change; status stays updatable', async () => {
    await inRollback(db, (c) =>
      rejectsWith(
        c,
        `UPDATE catenor_public."VerificationMethodProjection" SET "publicKeyMultibase" = 'z6MkReplacedKey'`,
        { code: '23000', message: expect.stringContaining('publicKeyMultibase is immutable') },
      ),
    );
    await inRollback(db, async (c) => {
      const r = await c.query(
        `UPDATE catenor_public."VerificationMethodProjection" SET status = 'REVOKED'`,
      );
      expect(r.rowCount).toBe(1);
    });
  });

  it('legitimate status updates remain possible (Trust Anchor status, DID lifecycle, Subject lifecycle)', async () => {
    await inRollback(db, async (c) => {
      for (const sql of [
        `UPDATE catenor_public."TrustAnchorStatusProjection" SET status = 'SUSPENDED', "changedAt" = now()`,
        `UPDATE catenor_public."TrustAnchorStatusProjection" SET status = 'ACTIVE', "changedAt" = now()`,
        `UPDATE catenor_public."DidDocumentProjection" SET lifecycle = 'SUSPENDED', "updatedAt" = now()`,
        `UPDATE catenor_private."Subject" SET lifecycle = 'SUSPENDED'`,
        `UPDATE catenor_public."TrustDomainProjection" SET "bootstrapConfigurationHash" = '${hash('9')}'`,
      ]) {
        expect((await c.query(sql)).rowCount, sql).toBe(1);
      }
    });
  });

  it('key rotation = new key → new Verification Method → new KeyManagementReference', async () => {
    await inRollback(db, async (c) => {
      await c.query(`
        INSERT INTO catenor_public."VerificationMethodProjection" (id, did, type, "publicKeyMultibase", relationships, status)
          VALUES ('${D}#assertion-key-2', '${D}', 'Multikey', 'z6MkTestKey2', '{assertionMethod}', 'ACTIVE');
        INSERT INTO catenor_private."KeyManagementReference" ("verificationMethodId", "subjectId", "signerRef", adapter, purpose, status)
          VALUES ('${D}#assertion-key-2', 'subject:1', 'signer:2', 'fake', 'CREDENTIAL_ASSERTION', 'ACTIVE');
        UPDATE catenor_public."VerificationMethodProjection" SET status = 'REVOKED' WHERE id = '${D}#assertion-key-1';
        UPDATE catenor_private."KeyManagementReference" SET status = 'REVOKED' WHERE "verificationMethodId" = '${D}#assertion-key-1';
      `);
      await rejectsWith(
        c,
        `INSERT INTO catenor_private."KeyManagementReference" ("verificationMethodId", "subjectId", "signerRef", adapter, purpose, status)
           VALUES ('${D}#assertion-key-3', 'subject:1', 'signer:2', 'fake', 'CREDENTIAL_ASSERTION', 'ACTIVE')`,
        { code: '23505', constraint: 'KeyManagementReference_signerRef_key' },
      );
    });
  });
});

describe('audit events are append-only (T3.5, D16)', () => {
  it('INSERT is allowed', async () => {
    await inRollback(db, async (c) => {
      const r = await c.query(
        `INSERT INTO catenor_private."AuditEvent" (id, "trustDomain", type, timestamp, "prevHash", "eventHash")
           VALUES ('event:append', '${TD}', 'ADMISSION_REQUESTED', '2026-09-09T22:00:01Z', '${hash('f')}', '${hash('4')}')`,
      );
      expect(r.rowCount).toBe(1);
    });
  });

  it.each([
    ['UPDATE', `UPDATE catenor_private."AuditEvent" SET "requestId" = 'rewritten'`],
    ['UPDATE', `UPDATE catenor_private."AuditEvent" SET type = type`],
    ['DELETE', `DELETE FROM catenor_private."AuditEvent"`],
    ['TRUNCATE', `TRUNCATE catenor_private."AuditEvent"`],
  ])('%s is rejected (%s)', async (op, sql) => {
    await inRollback(db, (c) =>
      rejectsWith(c, sql, {
        code: '23000',
        message: expect.stringContaining(`AuditEvent is append-only: ${op} is not allowed`),
      }),
    );
  });

  it('the stored event is unchanged after the rejected attempts', async () => {
    const { rows } = await db.query(
      `SELECT id, "requestId", "eventHash" FROM catenor_private."AuditEvent" WHERE id = 'event:1'`,
    );
    expect(rows).toEqual([{ id: 'event:1', requestId: null, eventHash: hash('f') }]);
  });
});

describe('referential actions: RESTRICT on delete and on update', () => {
  const restricted: [label: string, sql: string][] = [
    [
      'delete a Decision that an endorsement and record reference',
      `DELETE FROM catenor_public."DecisionProjection"`,
    ],
    [
      'rename a referenced decisionRef',
      `UPDATE catenor_public."DecisionProjection" SET "decisionRef" = 'decision:renamed'`,
    ],
    [
      'delete an Admission Record that a status row references',
      `DELETE FROM catenor_public."TrustAnchorAdmissionRecord"`,
    ],
    [
      'rename a referenced Trust Domain',
      `UPDATE catenor_public."TrustDomainProjection" SET id = 'trust-domain:renamed'`,
    ],
    [
      'delete a DID Document with Verification Methods',
      `DELETE FROM catenor_public."DidDocumentProjection"`,
    ],
    ['delete a Subject with bindings, keys and sessions', `DELETE FROM catenor_private."Subject"`],
    [
      'rename a referenced Subject id',
      `UPDATE catenor_private."Subject" SET id = 'subject:renamed'`,
    ],
    [
      'delete a session with a challenge, runs and a decision',
      `DELETE FROM catenor_private."AdmissionSession"`,
    ],
    ['delete a Decision Record with a trace', `DELETE FROM catenor_private."DecisionRecord"`],
  ];

  it.each(restricted)('%s → rejected (RESTRICT, SQLSTATE 23503)', async (_label, sql) => {
    await inRollback(db, (c) => rejectsWith(c, sql, { code: '23503' }));
  });

  it('the initial root cannot be deleted from under its Trust Domain (no SET NULL, no cascade)', async () => {
    await inRollback(db, async (c) => {
      await c.query(
        `UPDATE catenor_public."TrustDomainProjection" SET "initialTrustAnchorDid" = '${D}'`,
      );
      await c.query(`DELETE FROM catenor_public."TrustAnchorStatusProjection"`);
      await rejectsWith(c, `DELETE FROM catenor_public."TrustAnchorAdmissionRecord"`, {
        code: '23503',
        constraint: 'TrustDomainProjection_id_initialTrustAnchorDid_fkey',
      });
    });
  });

  it('a root that has no Admission Record in that Trust Domain is rejected by the composite FK', async () => {
    await inRollback(db, (c) =>
      rejectsWith(
        c,
        `UPDATE catenor_public."TrustDomainProjection" SET "initialTrustAnchorDid" = '${did('9')}'`,
        { code: '23503', constraint: 'TrustDomainProjection_id_initialTrustAnchorDid_fkey' },
      ),
    );
  });
});

describe('concurrency (two connections, committed data)', () => {
  it('single initial root: two racing conditional updates → exactly one root is set', async () => {
    const domain = 'trust-domain:race';
    await db.query(
      `INSERT INTO catenor_public."TrustDomainProjection" (id, "bootstrapConfigurationHash") VALUES ('${domain}', '${hash('b')}')`,
    );
    await insertAdmissionRecord(db, domain, did('2'), 'race-2');
    await insertAdmissionRecord(db, domain, did('3'), 'race-3');
    const claim = (candidate: string) =>
      `UPDATE catenor_public."TrustDomainProjection" SET "initialTrustAnchorDid" = '${candidate}'
        WHERE id = '${domain}' AND "initialTrustAnchorDid" IS NULL`;
    const a = await connect(url);
    const b = await connect(url);
    try {
      await a.query('BEGIN');
      await b.query('BEGIN');
      expect((await a.query(claim(did('2')))).rowCount).toBe(1);
      const racing = b.query(claim(did('3'))); // blocks on A's row lock
      await a.query('COMMIT');
      expect((await racing).rowCount).toBe(0); // re-evaluated after A commits: root no longer NULL
      await b.query('COMMIT');
    } finally {
      await a.end();
      await b.end();
    }
    const { rows } = await db.query(
      `SELECT "initialTrustAnchorDid" AS root FROM catenor_public."TrustDomainProjection" WHERE id = '${domain}'`,
    );
    expect(rows).toEqual([{ root: did('2') }]);
  });

  it('audit chain cannot fork: two racing appends after the same prevHash → exactly one commits', async () => {
    const append = (id: string, eventHash: string) =>
      `INSERT INTO catenor_private."AuditEvent" (id, "trustDomain", type, timestamp, "prevHash", "eventHash")
         VALUES ('${id}', '${TD}', 'ADMISSION_REQUESTED', '2026-09-09T22:00:01Z', '${hash('f')}', '${eventHash}')`;
    const outcomes = await race(append('event:2a', hash('2')), append('event:2b', hash('3')));
    expect(outcomes.filter((o) => o === 'ok')).toHaveLength(1);
    expect(outcomes.filter((o) => o === '23505')).toHaveLength(1);
    const { rows } = await db.query(
      `SELECT count(*)::int AS n FROM catenor_private."AuditEvent" WHERE "prevHash" = '${hash('f')}'`,
    );
    expect(rows[0].n).toBe(1);
    expect(GENESIS).toBe(hash('0'));
  });

  it('single-use challenge: two racing consumes → exactly one wins (TV-S001-D04 at the DB level)', async () => {
    await db.query(`
      INSERT INTO catenor_private."Subject" (id, did, type, lifecycle) VALUES ('subject:race', '${did('4')}', 'ORGANIZATION', 'ACTIVE');
      INSERT INTO catenor_private."AdmissionSession" (id, "sessionRef", "trustDomain", "subjectId", "operatorRef", "keyPossessionReasons", "updatedAt")
        VALUES ('session:race', 'sref:race', '${TD}', 'subject:race', 'operator-ref', '{}', now());
      INSERT INTO catenor_private."KeyPossessionChallenge"
        ("challengeId", "sessionId", subject, "verificationMethod", operation, "trustDomain", nonce, "issuedAt", "expiresAt")
        VALUES ('challenge:race', 'session:race', '${did('4')}', '${did('4')}#assertion-key-1', 'ADMIT_TRUST_ANCHOR', '${TD}', '${'C'.repeat(43)}',
                '2026-09-09T22:00:00Z', '2026-09-09T22:05:00Z');
    `);
    const consume = `UPDATE catenor_private."KeyPossessionChallenge" SET status = 'CONSUMED', "consumedAt" = now()
                      WHERE "challengeId" = 'challenge:race' AND status = 'ISSUED'`;
    const outcomes = await race(consume, consume);
    expect(outcomes.sort()).toEqual(['ok:0', 'ok:1']);
  });

  it('verification-run attempts: two racing inserts of the same attempt → exactly one commits', async () => {
    const insertRun = (runId: string) =>
      `INSERT INTO catenor_private."ConfidentialVerificationRun"
         ("runId", "sessionId", attempt, operation, "creWorkflowId", "deadlineAt", "evidenceSources", "updatedAt")
         VALUES ('${runId}', 'session:1', 2, 'TRUST_ANCHOR_ADMISSION', 'wf', now(), '{}', now())`;
    const outcomes = await race(insertRun('run:2a'), insertRun('run:2b'));
    expect(outcomes.sort()).toEqual(['23505', 'ok']);
  });
});

/** Runs two statements in two concurrent transactions: A holds its lock while B starts, then A commits. */
async function race(sqlA: string, sqlB: string): Promise<string[]> {
  const a = await connect(url);
  const b = await connect(url);
  const outcome = async (p: Promise<pg.QueryResult>, withCount: boolean) =>
    p.then(
      (r) => (withCount ? `ok:${r.rowCount}` : 'ok'),
      (e: { code: string }) => e.code,
    );
  const withCount = /^\s*UPDATE/.test(sqlA);
  try {
    await a.query('BEGIN');
    await b.query('BEGIN');
    const first = await outcome(a.query(sqlA), withCount);
    const second = outcome(b.query(sqlB), withCount);
    await a.query(first.startsWith('ok') ? 'COMMIT' : 'ROLLBACK');
    const secondResult = await second;
    await b.query(secondResult.startsWith('ok') ? 'COMMIT' : 'ROLLBACK');
    return [first, secondResult];
  } finally {
    await a.end();
    await b.end();
  }
}

async function insertAdmissionRecord(
  client: pg.Client,
  trustDomain: string,
  trustAnchor: string,
  suffix: string,
): Promise<void> {
  await client.query(`
    INSERT INTO catenor_public."DecisionProjection"
      ("decisionRef", policy, subject, action, resource, decision, "evaluatedAt", "evidenceCommitment", "decisionCommitment")
      VALUES ('decision:${suffix}', 'policy:trust-anchor-admission:v1', '${trustAnchor}', 'ADMIT_TRUST_ANCHOR', '${trustDomain}',
              'ALLOW', '2026-09-09T22:10:00Z', '${hash('e')}', '0x${suffix.replace(/[^0-9]/g, '').padStart(64, '7')}');
    INSERT INTO catenor_public."BootstrapEndorsementProjection" (id, "decisionRef", payload)
      VALUES ('endorsement:${suffix}', 'decision:${suffix}', '{}');
    INSERT INTO catenor_public."TrustAnchorAdmissionRecord"
      (id, "trustDomain", "trustAnchor", "admissionPolicy", "policyHash", decision, "verificationMethod",
       "evidenceCommitment", "createdAt", "decisionRef", "bootstrapEndorsementRef")
      VALUES ('record:${suffix}', '${trustDomain}', '${trustAnchor}', 'policy:trust-anchor-admission:v1', '${hash('a')}',
              'ADMIT_TRUST_ANCHOR', '${trustAnchor}#assertion-key-1', '${hash('e')}', '2026-09-10T00:00:02Z',
              'decision:${suffix}', 'endorsement:${suffix}');
  `);
}

const EXPECTED_CHECKS = [
  'AdmissionSession_trustDomain_format',
  'AuditEvent_eventHash_format',
  'AuditEvent_prevHash_format',
  'AuditEvent_trustDomain_format',
  'ConfidentialVerificationRun_attempt_range',
  'ConfidentialVerificationRun_bootstrapConfigHashEcho_format',
  'ConfidentialVerificationRun_evidenceCommitment_format',
  'ConfidentialVerificationRun_facts_iff_evidence',
  'DecisionProjection_decisionCommitment_format',
  'DecisionProjection_evidenceCommitment_format',
  'DecisionProjection_subject_format',
  'DecisionRecord_decisionCommitment_format',
  'DecisionRecord_errorReason_iff_error',
  'DecisionRecord_evidenceCommitment_format',
  'DecisionRecord_policyHash_format',
  'DecisionRecord_subject_format',
  'DecisionTrace_provenance_matches_status',
  'DecisionTrace_status_matches_value',
  'DidDocumentProjection_did_format',
  'KeyPossessionChallenge_consumedAt_iff_consumed',
  'KeyPossessionChallenge_nonce_format',
  'KeyPossessionChallenge_operation_value',
  'KeyPossessionChallenge_subject_format',
  'KeyPossessionChallenge_trustDomain_format',
  'PolicyPublication_policyHash_format',
  'ProviderBinding_externalSubjectId_iff_attached',
  'Subject_did_format',
  'TrustAnchorAdmissionRecord_decision_value',
  'TrustAnchorAdmissionRecord_evidenceCommitment_format',
  'TrustAnchorAdmissionRecord_policyHash_format',
  'TrustAnchorAdmissionRecord_trustAnchor_format',
  'TrustAnchorAdmissionRecord_trustDomain_format',
  'TrustAnchorStatusProjection_did_format',
  'TrustAnchorStatusProjection_trustDomain_format',
  'TrustDomainProjection_bootstrapConfigurationHash_format',
  'TrustDomainProjection_id_format',
  'TrustDomainProjection_initialTrustAnchorDid_format',
  'VerificationMethodProjection_did_format',
  'VerificationMethodProjection_id_under_did',
];
