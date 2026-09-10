# S001 — Trust Anchor Admission
## Tasks

**Status:** Rev 2.1 — approved 2026-09-10 with final decisions (PLAN §33.3). T0.9 applied (awaiting maintainer review). No implementation task is started.
**Rule:** a task is checked only when its code **and** listed tests exist and pass (CLAUDE.md). Live/manual tasks are checked only when the named artifact exists.

Format: **ID — title** · `deps` · `AC` · `TV` · deliverable · done-when.

```text
[FAST]       on the P0 Fast Lane (PLAN §0) — execution order
[P1] / [P2]  never blocks a [FAST] task
[HUMAN]      maintainer action
[SPIKE]      throwaway investigation under scratch/ (git-ignored); result recorded in PLAN/BUILD_LOG; no production code
[STOP-GATE]  failure ⇒ STOP and report to the maintainer; no silent substitute
```

---

## Phase 0 — Human gates, subagent, spikes

- [x] **T0.1 [HUMAN] — Approve PLAN/TASKS Rev 2** · deps: — · approved by the maintainer on 2026-09-10 with final decisions Q1 (refined: `verificationMethodCommitment`), Q2, Q3 and the commitment-wording correction (PLAN §33.3). BUILD_LOG entry still to be written (T18.5).
- [ ] **T0.2 [HUMAN][FAST] — CRE access** · deps: — · AC-029, 030 · `cre login`; `cre whoami` shows deploy access; **Confidential Workflows private-beta enrollment**; **private registry** available · done-when: confirmed in writing (blocker B1). Mainnet registry only with explicit maintainer approval. · **Status 2026-09-10:** deploy access ✓ and private registry ✓ (per maintainer); Confidential Workflows enrollment submitted — in Chainlink's queue ("todo", ≈24 h typical). Open until enrollment is confirmed.
- [ ] **T0.3 [HUMAN][FAST] — Accounts** · deps: — · Sumsub **sandbox** (KYB 2.0 level, KYC level, token with read + testCompleted), Privy app (email login, identity tokens on), Railway project (staging + production, Postgres) · done-when: accounts exist; no secret value in repo/chat.
- [ ] **T0.4 [HUMAN][FAST] — Key ceremonies** · deps: T0.3 · P-256 authorization keys (assertion, bootstrap), CRE trigger EVM key (unfunded, trigger-only), `CATENOR_INTERNAL_API_TOKEN` (32 random bytes), `OPERATOR_REF_KEY` · done-when: public parts recorded; private parts only in Railway sealed vars / Vault DON.
- [ ] **T0.5 [SPIKE][STOP-GATE][FAST] — Privy Ed25519 signing semantics** · deps: T0.3 · AC-011–013 · TV-D01, I06 · per PLAN §13.2: 64-byte `signMessage` verifies as plain Ed25519 with `@noble/curves` against the address-derived Multikey; policy denies `signTransaction`, `signAndSendTransaction`, 32/65-byte messages, `exportPrivateKey`; server-side authorization-key flow works · done-when: all pass → D1/D3 confirmed. **Any failure → STOP and report** (no alternative signer/curve/suite without approval).
- [ ] **T0.6 [FAST] — `cre-engineer` project subagent** · deps: T0.1 · deliverable: `.claude/agents/cre-engineer.md` per PLAN §17.7 (our subagent, not Chainlink's; loads `chainlink-cre-skill`; CRE scope list; must-not-redefine list; prefer live docs where the skill is outdated; STOP-GATE reporting duty); verify whether subagent skill preloading is supported (B9) · done-when: maintainer reviewed the file **before** T0.7.
- [ ] **T0.7 [SPIKE][STOP-GATE][FAST] — CRE Confidential runtime (via cre-engineer)** · deps: T0.2 (login), T0.6 · AC-023, 024 · in `scratch/`: `cre init` with official `hello-confidential-workflows-ts` (confirm identifier/flags, B8); simulate a `handlerInTee` that: batched `getSecrets` (3 names); `@noble/hashes` HMAC/HKDF; `@noble/ciphers` AES-256-GCM **open** of a payload sealed by Node `crypto`; HTTPS `HTTPClient` calls with `TeeRuntime` incl. per-request `timeout` behavior; `runtime.now()`; call-count behavior vs `HTTPAction.CallLimit` · done-when: B3/B6 resolved and recorded. **AES-GCM/HKDF failure → STOP and report** (context-fetch fallback needs maintainer review).
- [ ] **T0.8 [SPIKE][FAST] — Sumsub sandbox semantics** · deps: T0.3 · AC-019 · TV-L03 · per PLAN §20.3: company + representative applicants with `externalUserId` = test bindingRef (allowed charset), linking, `testCompleted` GREEN/RED (incl. AML label) on company and individual, real field shapes/sizes, company-check response, role-evidence strength · done-when: PLAN §20.2/§20.4/§20.5 and Bootstrap Configuration `acceptedEvidence` values updated from observations (sanitized); limitation written if role is not provider-verified.
- [ ] **T0.9 [HUMAN][FAST] — Source-of-truth cleanup** · deps: T0.1 · apply (or amend) PLAN Appendix E.1 to SPEC.md, ACCEPTANCE.md, TEST-VECTORS.md in a separate intentional commit · done-when: no LLM requirement remains in S001 source of truth; secret inventory = 3; COMMITMENT_ONLY reflected; this gates T1.1. · **Status 2026-09-10:** applied (SPEC, ACCEPTANCE, TEST-VECTORS, slice README, judge artifacts, ARCHITECTURE §12, root README tree) — awaiting maintainer review and a separate commit; check only after review.

## Phase 1 — Foundation

- [ ] **T1.1 [FAST] — Monorepo scaffold** · deps: T0.1, T0.9 · root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.nvmrc`, ESLint/Prettier, empty package entrypoints · done-when: `pnpm -r build` + `pnpm -r lint` pass.
- [ ] **T1.2 [FAST] — Test harness** · deps: T1.1 · Vitest workspace; `test-vectors/s001/` + loader · done-when: sample test reads a golden vector.
- [ ] **T1.3 [FAST] — Boundary enforcement** · deps: T1.1 · `.dependency-cruiser.cjs` (PLAN §2.3) · done-when: CI fails on a deliberate violation.
- [ ] **T1.4 [FAST] — CI** · deps: T1.1–T1.3 · lint, typecheck, unit tests, dependency-cruiser, secret-scan stub · done-when: green.
- [ ] **T1.5 [FAST] — Provenance for tooling** · deps: T1.1 · versions/licenses in PROVENANCE.md; BUILD_LOG entry · AC-073.

## Phase 2 — Domain packages (framework-free)

- [ ] **T2.1 [FAST] — `packages/audit`** · deps: T1.2 · RFC 8785 JCS, `commit()`, `Commitment`, audit event model, `chainEvent()` · tests: JCS vectors, commitment goldens, chain tamper detection · AC-039, 060.
- [ ] **T2.2 [FAST] — `packages/identity`** · deps: T1.2 · `CatenorDid` (from 16 random bytes only), `SubjectType`, `Subject`, `VerificationMethodId`, `Multikey`, `VerificationMethod`, `DidDocument`, `KeyPurpose`, `KeyManagementReference` · tests: TV-C01, C02, C03; Multikey round-trip; assertion/financial purpose collision rejected · AC-007–013.
- [ ] **T2.3 [FAST] — `packages/credentials` eddsa-jcs-2022** · deps: T2.1, T2.2, T0.5 · `DataIntegrityProof`, `hashData()` (64 bytes), `verify()` · tests: W3C vc-di-eddsa vectors where published + own goldens; tampering → false.
- [ ] **T2.4 [FAST] — `packages/policy` document + hash** · deps: T2.1 · `trust-anchor-admission.v1.json`; schema check vs protocol `policy.schema.json`; `policyHash()` · tests: golden hash; faithful-to-SPEC test · AC-039.
- [ ] **T2.5 [FAST] — `packages/policy` evaluator + Decision** · deps: T2.4 · `FactName`, `VerifiedFact`, `FactSet` (drops unknown), `evaluate()` (missing → DENY, trace MISSING ≠ FALSE), `Decision` validated against protocol `decision.schema.json` · tests: TV-F01–F11 (F12 retired), ERROR on integrity failure · AC-035–038, 040, 043.
- [ ] **T2.6 [FAST] — `packages/authority` bootstrap / endorsement / aggregate / record** · deps: T2.3, T2.5 · `TrustDomainId`, `BootstrapConfiguration` + hash, `BootstrapEndorsement` (incl. `verificationMethodCommitment` = SHA-256(JCS(canonical VM {id, controller, type, publicKeyMultibase}))), `TrustAnchorAdmission` state machine (PLAN §4.3), `TrustAnchorAdmissionRecord` (D14 fields), `TrustAnchorStatus` · tests: TV-B03, G01–G06, H03; illegal transitions · AC-005, 006, 044–046, 050, 051, 076.
- [ ] **T2.7 [FAST] — `packages/authority` key possession** · deps: T2.3, T2.2 · challenge + verifier (PLAN §14.3 steps 1–8) · tests: TV-D01–D06 with fixed clock + noble keys · AC-014–018.
- [ ] **T2.8 [FAST] — `packages/authority` TrustAnchorVerifier** · deps: T2.6 · 12 checks with `basis` CRYPTOGRAPHIC / STRUCTURAL / OPERATIONAL (PLAN §26) · tests: TV-J01–J07; tampered-field matrix incl. VM key replacement under the same ID · AC-063–065, 076.
- [ ] **T2.9 [FAST] — Golden vectors** · deps: T2.1–T2.8 · `test-vectors/s001/*.json` (policy hash, DID doc, challenge + proof, endorsement, record, fact sets, commitment inputs) regenerated by script; consumed by api + workflow tests.

## Phase 3 — Persistence

- [ ] **T3.1 [FAST] — Prisma schema** · deps: T2.6 · models PLAN §10.1 (incl. `ProviderBinding`; no evidence-object model); multiSchema vs prefixes decided from installed Prisma docs; **maintainer schema review** · AC-012, 053–055.
- [ ] **T3.2 [FAST] — Initial migration** · deps: T3.1 + approval · unique `initialTrustAnchorDid` · done-when: `prisma migrate deploy` on Testcontainers Postgres.
- [ ] **T3.3 [FAST] — Repositories** · deps: T3.2 · `SubjectRegistry` (incl. bindings), `DidStateRegistry`, `AdmissionRepository` (conditional challenge consume), `TrustAnchorRegistry`, `AuditLog` (app-computed hash chain), `UnitOfWork` · integration tests incl. concurrency (TV-D04, K01).
- [ ] **T3.4 [FAST] — Public read model** · deps: T3.3 · public-only reads + explicit DTO allowlists · AC-054.
- [ ] **T3.5 [P1] — Audit append-only DB trigger** · deps: T3.2 · raw SQL trigger rejecting UPDATE/DELETE + test (D16).

## Phase 4 — API skeleton, access gate, provider bindings

- [ ] **T4.1 [FAST] — NestJS app + module** · deps: T1.1, T3.3 · module, zod pipe, problem-details, `/v1/health`, redacting logger · AC-025, 062.
- [ ] **T4.2 [FAST] — Privy operator identity adapter** · deps: T4.1, T0.3 · access-token verify + identity-token verified email; `operatorRef` HMAC · integration test vs Privy dev app · AC-001.
- [ ] **T4.3 [FAST] — Allowlist gate (U1)** · deps: T4.2 · env parser; guard; `BOOTSTRAP_ACCESS_DENIED` audit without email · application tests TV-A01–A03 (nothing created on denial) · AC-001–003.
- [ ] **T4.4 [FAST] — U2 StartInitialAdmission** · deps: T4.3 · Subject + DID + **bindingRefs {COMPANY, REPRESENTATIVE}** (random, prefix/charset per T0.8); returns `providerSetup` to the operator only; **no applicant IDs accepted**; `409 INITIAL_TRUST_ANCHOR_EXISTS` · tests TV-C01, C02; bindingRefs absent from public/judge routes · AC-007, 008.
- [ ] **T4.5 [FAST] — U3 AttachProviderReferences** · deps: T4.4 · `PUT …/provider-references`; private storage `ATTACHED_UNVERIFIED`; re-attach allowed until a run succeeds; audit `PROVIDER_REFERENCES_ATTACHED` (no IDs in details) · application tests incl. U7 refusing to run without attached refs · AC-020, 055.

## Phase 5 — Key management and DID state

- [ ] **T5.1 [FAST] — Signer ports + noble fakes** · deps: T4.1.
- [ ] **T5.2 [FAST] — Privy Ed25519 assertion signer adapter** · deps: T5.1, **T0.5 passed** · wallet + policy + key-quorum owner; Multikey from address; 64-byte guard · integration: create → sign → noble verify; `signTransaction` denied (artifact) · AC-011–013 · TV-D01, I06.
- [ ] **T5.3 [FAST] — Bootstrap signer + setup script** · deps: T5.2 · separate wallet + authorization key; `scripts/bootstrap/create-bootstrap-signer.ts` · integration: sign endorsement bytes, verify with config key · TV-G01.
- [ ] **T5.4 [FAST] — U4 ProvisionAssertionKey + U11 resolver** · deps: T5.2, T3.4 · DID Document projection; `KeyManagementReference`; audit; `GET /v1/dids/{did}` (200/404/410) · tests: application + leak-sentinel crawl · AC-009–012 · TV-C03, I01.

## Phase 6 — Proof of key possession

- [ ] **T6.1 [FAST] — U5 challenge** · deps: T5.4 · CSPRNG nonce, 5-min TTL, one per session.
- [ ] **T6.2 [FAST] — U6a + U6 proof paths** · deps: T6.1, T2.7 · shared verifier; failure → immediate DENY evaluation, no CRE call (D23) · tests TV-D01–D03, D05 · AC-014–018.
- [ ] **T6.3 [FAST] — Atomic consumption** · deps: T6.2, T3.3 · race test on Postgres · TV-D04 · AC-017.

## Phase 7 — Bootstrap Configuration and policy publication

- [ ] **T7.1 [FAST] — Bootstrap config file + tooling** · deps: T5.3, T2.6, T0.8 · `apps/api/config/trust-domains/catenor-one-demo.bootstrap.json` (`acceptedEvidence` from T0.8; `evidenceMaxAgeDays: 180` [REF-IMPL]); `scripts/bootstrap/hash-config.ts` · TV-B01 · AC-004.
- [ ] **T7.2 [FAST] — Integrity checks + public endpoints** · deps: T7.1 · refuse admissions on pin/policy mismatch; `GET /v1/trust-domains/{id}`, `GET /v1/policies/{id}` · TV-B01, B02 · AC-004, 005, 039.
- [ ] **T7.3 [HUMAN][FAST] — Out-of-band acceptance** · deps: T7.1 · maintainer reviews + commits config, sets Railway pin · done-when: commit SHA + pin in BUILD_LOG.

## Phase 8 — `workflows/identity-confidential` (executed by `cre-engineer`)

- [ ] **T8.1 [FAST] — Official scaffold → identity-confidential** · deps: T0.7 · `cre init` (`hello-confidential-workflows-ts`, private registry, explicit targets) so `workflows/` is the CRE project root; transform to `workflows/identity-confidential` with `main.ts` single HTTP trigger → `handlerInTee` → operation router (`TRUST_ANCHOR_ADMISSION`; unknown → ERROR, zero calls); `secrets.yaml` with the **3** names (`*_VAR`); `shared/safe-log.ts` + lint rule; public configs reviewed for zero secrets; template provenance recorded · TV-E07 · AC-024, 025. No hand-written baseline boilerplate.
- [ ] **T8.2 [FAST] — Key schedule + sealed context** · deps: T8.1 · HKDF (`ctx`, `cb`, `salt`); AES-256-GCM open with `aad = operation ‖ runId`, `notAfter`; `fixtures/seal-context.ts`; cross-compat test with Node `crypto` sealing · tests: wrong key / other operation / other runId / expired → ERROR.
- [ ] **T8.3 [FAST] — Sumsub client + normalizer** · deps: T8.1, T0.8 · pure-JS HMAC signing; calls #1/#2 (+#3 only if T0.8 requires); allowlisted normalization; error mapping → ERROR · unit tests on sanitized recorded shapes · TV-E04, E05 · AC-021, 022.
- [ ] **T8.4 [FAST] — Provider-binding gate + fact derivation** · deps: T8.3 · `binding-gate.ts` (externalUserId == bindingRef, types) runs before any derivation; `derive-facts.ts` per PLAN §20.4 as finalized by T0.8; freshness via `runtime.now()` (180 days); null = MISSING · unit tests: happy, AML RED, inactive registry, on hold, stale, missing linkage, non-accepted role, **binding mismatch** · TV-E01, E02, E11, F02–F06, F09 · AC-040, 042, 043, 075.
- [ ] **T8.5 [FAST] — Evidence commitment** · deps: T8.4, T2.9 · `commitmentInput` per PLAN §23 (salt via HMAC(HKDF(K), runId); response + provider-ref digests); identical bytes to `test-vectors/s001` goldens · TV-E06, I04 · AC-026, 027, 056, 058.
- [ ] **T8.6 [FAST] — Callback + handler wiring + simulation suite** · deps: T8.2–T8.5 · HMAC callback (≤ 10 KB), return `{status, code}` only, preHook (4 calls, 3 secrets, CLOSED); MOCK Sumsub server; run all PLAN §28 cases non-interactively; sanitized outputs saved · TV-E01, E02, E04–E06, E11, I03 + unknown operation · AC-028, 075.
- [ ] **T8.7 [P1] — DON-signed result report** · deps: T8.6, first live run (T16.3) · `reportFromDon` over SHA-256 of the result envelope; included in callback; must not block T16.

## Phase 9 — API ↔ CRE integration

- [ ] **T9.1 [FAST] — CRE gateway trigger + context sealer** · deps: T8.6, T4.1 · `workflows.execute` JSON-RPC; EIP-191 JWT (own code, BUSL reference noted in PROVENANCE); AES-256-GCM sealing (Node `crypto`) · unit tests on JWT digest/claims + seal/open golden.
- [ ] **T9.2 [FAST] — U7 RequestConfidentialVerification** · deps: T9.1, T6.2, T4.5 · preconditions: key facts true ∧ refs attached; run + deadline; audit · tests: refuses after failed key proof or without refs · AC-023.
- [ ] **T9.3 [FAST] — Callback endpoint + U8** · deps: T9.2 · HMAC/timestamp/single-use; strict schema (unknown fields rejected — TV-F11 intent); echo checks (operation, runId, config hash, freshness); **commitment recomputation** against the normalized preimage + digests (store only those; never raw content); OK → facts + `BINDING_VERIFIED`; `PROVIDER_BINDING_MISMATCH`/ERROR → no facts · tests: forged/replayed/late/duplicate/mismatched callbacks rejected; SQL scan for sentinels · TV-E04, E11, I03, I04 · AC-021, 026, 027, 056, 058, 075.
- [ ] **T9.4 [FAST] — U15 run expiry** · deps: T9.2 · deadline sweep → TIMED_OUT → non-ALLOW · TV-E05 · AC-022.
- [ ] **T9.5 [P1] — DON report verifier** · deps: T8.7, T9.3 · offchain verification per CRE docs (viem).

## Phase 10 — Policy evaluation

- [ ] **T10.1 [FAST] — Policy/config sources** · deps: T7.2 · integrity re-check at evaluation time.
- [ ] **T10.2 [FAST] — U9 EvaluateAdmission** · deps: T10.1, T9.3, T6.2 · FactSet with provenance; Decision + trace (FALSE vs MISSING); ALLOW → public projection; audit · tests TV-A03, B02, F01–F11 (representative), gate-cannot-set-facts · AC-003, 005, 035–040, 048, 061.

## Phase 11 — Endorsement, Admission Record, activation

- [ ] **T11.1 [FAST] — Endorsement builder** · deps: T2.6, T5.3 · payload incl. `decisionCommitment` and `verificationMethodCommitment` (Q1) · AC-044, 076.
- [ ] **T11.2 [FAST] — U10 EndorseAndActivateInitialTrustAnchor** · deps: T11.1, T10.2 · ALLOW-only; human-initiated; sign → verify → record → ACTIVE in one transaction; no mandatory two-person rule · tests TV-B02, B03, G01, G02, G06, H01–H03 · AC-044–051, 076.
- [ ] **T11.3 [FAST] — Public admission projection** · deps: T11.2 · `GET /v1/trust-domains/{td}/trust-anchors/{did}` · snapshot test · TV-H01 · AC-049.
- [ ] **T11.4 [FAST] — Idempotency + retries** · deps: T11.2 · `ALREADY_ADMITTED`; concurrent activation → one root; new session after DENY · TV-K01, K02 · AC-052.

## Phase 12 — Trust Anchor verification

- [ ] **T12.1 [FAST] — U13 VerifyTrustAnchor** · deps: T2.8, T11.3 · endpoint with per-check `basis`; wording per PLAN §26.1.
- [ ] **T12.2 [FAST] — Tamper/lifecycle integration tests** · deps: T12.1 · DB mutations (evidenceCommitment, policyHash, endorsement, VM key replaced under the same ID) and status via test harness only (D21) · TV-J02, J03, J05, J06, J07 · AC-064, 065, 076.
- [ ] **T12.3 [FAST] — Offline verifier script** · deps: T12.1 · `scripts/verify-trust-anchor.ts` (public API + committed config + pin only) · TV-J01, I01 · AC-063.

## Phase 13 — Product UI (`apps/web`)

- [ ] **T13.1 [FAST] — Next.js scaffold + Privy login** · deps: T4.2.
- [ ] **T13.2 [FAST] — Bootstrap wizard** · deps: T13.1, T11.2, T12.1 · steps 1–8 (PLAN §8) incl. provider-setup step showing bindingRefs to the operator; "Sumsub sandbox" wording; server-state only · Playwright E2E with FAKE verifier (labeled) · TV-A01, A02, F01, K02 · AC-066, 069.
- [ ] **T13.3 [FAST] — Wrong-key demo control** · deps: T13.2 · ephemeral browser key; external proof · E2E TV-D02 · AC-015, 067.
- [ ] **T13.4 [FAST] — Public pages** · deps: T13.1, T5.4, T11.3 · `/did/[did]`, `/trust-anchors/[did]` (crypto vs operational checks shown) · AC-009, 063.

## Phase 14 — Judge Inspector

- [ ] **T14.1 [FAST] — Judge projection endpoints** · deps: T10.2, T11.3, T3.4 · allowlisted fields; leak-sentinel crawl incl. bindingRefs · AC-062, 068.
- [ ] **T14.2 [FAST] — `/judge/s001` UI** · deps: T14.1, T13.1 · panels PLAN §9: "Sumsub sandbox — synthetic organization, not production KYB"; representative-authority evidence class + limitation; COMMITMENT_ONLY; "HTTPS requests are executed from inside the confidential TEE boundary"; lifecycle status labeled operational projection · TV-A02, C03, H01, L01–L03 (display) · AC-066–068.
- [ ] **T14.3 [FAST] — Clean static visualization** · deps: — · `artifacts/judges/s001/trust-anchor-flow.html` + README: "visualization only" banner; remove LLM references (PLAN Appendix E.2) · AC-072. · **Status:** banner + Rev 2 wording applied in T0.9; remaining: link to the live `/judge/s001` once T14.2 exists.

## Phase 15 — Railway deployment

- [ ] **T15.1 [FAST] — Services** · deps: T13.2, T3.2 · web + api (root dirs, watch paths, Railpack + pnpm filters), pre-deploy `prisma migrate deploy`, health check; dashboard configuration (D19); staging then production.
- [ ] **T15.2 [FAST][HUMAN + agent] — Infrastructure review** · deps: T15.1 · no Postgres TCP proxy (saved output); internal `DATABASE_URL`; sealed variables; no evidence objects/keys exist (TV-I05 vacuous) · TV-I02, I05 · AC-053.
- [ ] **T15.3 [FAST] — Config pin + env** · deps: T7.3, T15.1 · pin, allowlist, Privy vars; boot check passes · TV-B01.

## Phase 16 — Real CRE deployment and live happy path

- [ ] **T16.1 [HUMAN][FAST] — Vault secrets** · deps: T0.2, T0.4, T8.6 · `cre secrets create workflows/secrets.yaml --target production-settings --secrets-auth=browser` · done-when: `cre secrets list` shows exactly the 3 names (redacted output).
- [ ] **T16.2 [FAST] — Deploy identity-confidential (private registry)** · deps: T16.1, T15.3 · `cre workflow deploy identity-confidential --target production-settings`; record workflow ID, registry, binary/config URLs, versions; set `CRE_WORKFLOW_ID` on Railway · artifact `artifacts/chainlink/s001/deployment.txt` · AC-029 · TV-E03.
- [ ] **T16.3 [FAST] — Live happy path** · deps: T16.2, T0.8 · operator → DID + bindingRefs → Sumsub sandbox setup → attach refs → Privy key proof → deployed TEE (Vault secrets, binding gate, Sumsub sandbox) → ALLOW → endorsement → ACTIVE → verify TRUE (API + offline script) · artifacts `live-happy.json` + judge files · TV-L01, E03, A01, D01, F01, G01, H01, J01 · AC-019, 023, 024, 030, 066, 070.

## Phase 17 — Live negative paths and privacy scans

- [ ] **T17.1 [FAST] — Live invalid-key DENY** · deps: T15.3, T5.4 (can run before T16.3 on a separate session) · wrong-key control → DENY, no endorsement/record/ACTIVE, verification false · TV-L02, D02 · AC-015, 067.
- [ ] **T17.2 [FAST] — Live evidence DENY (if sandbox permits)** · deps: T16.2, T0.8 · sandbox company forced RED/AML or inactive registry → DENY; otherwise labeled fixture DENY per TV-L03 · artifact `live-deny-evidence.json` · TV-L03, F04 · AC-036, 067.
- [ ] **T17.3 [FAST] — Privacy/secret scans** · deps: T16.3 · sentinel crawl (applicant IDs, bindingRefs, raw fixtures, emails) of public/judge routes; SQL text scan (staging); secret scanner over repo + `artifacts/` + captured logs (values from env, never committed); private-key pattern scan · TV-E06, E07, I01, I03, I06 · AC-010, 020, 025, 062; ACCEPTANCE §28 list.
- [ ] **T17.4 [P1] — Live provider-binding mismatch** · deps: T16.2 · attach an applicant with a wrong `externalUserId` → run ERROR, no facts, non-ALLOW (recorded) · TV-E11 · AC-075.

## Phase 18 — Artifacts, provenance, documentation

- [ ] **T18.1 [FAST] — Assemble artifacts** · deps: T16.3, T17.1, T17.2 · layout PLAN §30; READMEs distinguish MOCK / simulation / live and say "Sumsub sandbox" · AC-070–072.
- [ ] **T18.2 [FAST] — Sanitizer** · deps: — (used from T8.6 on) · `scripts/artifacts/sanitize.ts` (applicant IDs, bindingRefs, wallet IDs, emails, tokens) + CI check on `artifacts/`.
- [ ] **T18.3 [FAST] — Integration docs** · deps: T16.3 · `docs/integrations/CHAINLINK-CRE.md` (identity-confidential boundary rule, quotas as documented), `PRIVY.md`, Sumsub section (sandbox) — spike results included.
- [ ] **T18.4 [P1] — ADRs + protocol amendment note** · deps: T16.3 · ADR-0007 signer custody; ADR-0008 CRE workflow boundary (`identity-confidential`) + result transport/provenance; ARCHITECTURE §12 / README tree reconciliation (Appendix E.2); Admission Record amendment draft for the protocol repo (D14) · AC-073.
- [ ] **T18.5 [FAST] — Provenance + AI logs** · deps: each phase · BUILD_LOG per phase; AI_USAGE (Claude Code, cre-engineer subagent, official CRE skill, Privy docs skill); PROVENANCE (SDK versions, `cre init` template, BUSL note); prompt artifact for the planning sessions · AC-073, 074.
- [ ] **T18.6 [FAST] — Definition-of-Done audit** · deps: all [FAST] · ACCEPTANCE §29 matrix + §30 DoD; every P0 AC → evidence link; failures reported, not hidden.

---

## Traceability — P0 acceptance criteria → tasks

| AC | Tasks |
|---|---|
| 001–003 | T4.3, T10.2, T13.2 |
| 004–006 | T7.1, T7.2, T2.6, T11.2 |
| 007–008 | T2.2, T4.4 |
| 009–010 | T5.4, T13.4, T17.3 |
| 011–013 | T0.5, T2.2, T5.2 |
| 014, 015, 017 | T2.7, T6.2, T6.3, T13.3, T17.1 |
| 019–021 | T0.8, T4.5, T8.3, T9.3, T16.3, T17.3 |
| 023–030 | T0.7, T8.1–T8.6, T16.1–T16.3 |
| 031, 033, 041 | RETIRED (T0.9) — no tasks |
| 075 | T4.4, T4.5, T8.4, T8.6, T9.3, T17.4 |
| 076 | T2.6, T2.8, T11.1, T11.2, T12.2 |
| 035–040, 043 | T2.4, T2.5, T8.4, T10.2 |
| 044–051 | T2.6, T11.1–T11.3 |
| 053–056, 058 | T3.1, T3.4, T8.5, T9.3, T15.2 |
| 060–064 | T2.1, T10.2, T12.1–T12.3, T14.1 |
| 066, 067 | T13.2, T16.3, T17.1, T17.2 |
| 070, 072–074 | T18.1, T14.3, T18.5, T0.5–T0.8 |

P1 criteria: 016, 018 (T2.7, T6.2) · 022 (T9.4) · 042 (T8.4) · 052 (T11.4) · 065 (T12.2) · 068, 069 (T14.2, T13.2) · 071 (T18.1). AC-032 and AC-034 RETIRED (T0.9). AC-057 and AC-059 not applicable to S001 (COMMITMENT_ONLY, D13).
