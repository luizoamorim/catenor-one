# S001 — Trust Anchor Admission
## Implementation Plan

**Project:** Catenor One
**Protocol baseline:** Catenor Protocol Draft v0.1 @ `66ef712694acfc987663f5ffa9bcc9d12d1fe80e` (verified against local protocol checkout)
**Slice:** `S001-trust-anchor-admission`
**Status:** Rev 2.1 — APPROVED by the maintainer (2026-09-10) with the final decisions in §33; source-of-truth documents aligned in T0.9 (awaiting maintainer review). No implementation code exists.
**Prepared by:** Claude Code (AI-assisted), from SPEC / ACCEPTANCE / TEST-VECTORS, the architecture baseline, the pinned protocol, maintainer amendments, and current official sponsor/provider documentation (Appendix A).

> `SPEC.md` says what must be true. `ARCHITECTURE.md` says what structure must be obeyed. This `PLAN.md` says how S001 fits that structure. Anything that touches a frozen SPEC decision or protocol shape is listed in §33 and Appendix B; source-of-truth text that must be cleaned up because of Rev 2 is listed in Appendix E.

### Revision history

| Rev | Date | Change |
|---|---|---|
| 1 | 2026-09-10 | initial proposal |
| 2.1 | 2026-09-10 | Rev 2 APPROVED with final decisions: Q1 refined → endorsement binds `verificationMethodCommitment` (full canonical VM); Q2 provider-binding mismatch AC/TV added (AC-075, TV-E11); Q3 bucket not provisioned in S001; evidence-commitment wording corrected (recomputable, not re-openable); T0.9 source-of-truth cleanup applied (AC-076, TV-G06/J07 added; LLM IDs retired) |
| 2 | 2026-09-10 | maintainer amendments: `workflows/identity-confidential` (S001 = first capability); **LLM removed from S001**; 3 Vault secrets; custom ECIES rejected → COMMITMENT_ONLY; provider-binding sequence fixed (`AttachProviderReferences`); Privy signer + sealed context become STOP-gated spikes; CRE quota/timeout wording corrected; Trust Anchor status claims narrowed; `cre-engineer` subagent + official `cre init` scaffolding; P0 Fast Lane; decision register updated |

### Label convention

```text
[REF-IMPL]     Catenor One reference-implementation behavior (not a protocol rule)
[AMENDMENT?]   extends a protocol DRAFT SHAPE → protocol proposal later
[UNCONFIRMED]  official docs did not confirm; a spike/test resolves it
[STOP-GATE]    if the spike fails: STOP and report to the maintainer; no silent substitute
[HUMAN]        requires a maintainer action
[P0]/[P1]/[P2] priority, aligned with ACCEPTANCE.md; P1/P2 never block the P0 Fast Lane
```

---

# 0. P0 FAST LANE

The shortest path to a **real, live** S001. Everything not on this path is P1/P2 and must not block it.

| # | Fast-lane step | Tasks | Gate / note |
|---|---|---|---|
| 1 | minimal monorepo / app foundation | T1.1–T1.4 | after T0.1 + T0.9 |
| 2 | domain primitives required by S001 | T2.1–T2.9 | framework-free |
| 3 | private PostgreSQL state | T3.1–T3.4 | human schema review before migration |
| 4 | Privy operator auth + email allowlist | T4.1–T4.3 | |
| 5 | Organization `did:catenor` + provider bindingRefs | T4.4, T4.5 | bindingRefs issued before applicant IDs |
| 6 | assertion key + Proof of Key Possession | T5.1–T5.4, T6.1–T6.3 | [STOP-GATE] T0.5 Privy spike |
| 7 | Bootstrap Configuration | T7.1–T7.3 | human out-of-band acceptance |
| 8 | `identity-confidential` CRE workflow | T0.6, T0.7, T8.1, T8.2 | official `cre init`; [STOP-GATE] sealed-context crypto |
| 9 | Sumsub deterministic confidential verification | T0.8, T8.3, T8.4 | Sumsub **sandbox** |
| 10 | minimized facts + evidenceCommitment | T8.5, T8.6, T9.1–T9.4 | COMMITMENT_ONLY |
| 11 | Admission Policy ALLOW / DENY | T10.1, T10.2 | |
| 12 | bootstrap endorsement | T11.1, T11.2 | human-initiated |
| 13 | Admission Record + ACTIVE projection | T11.2–T11.4 | |
| 14 | public DID / Trust Anchor verification view | T12.1–T12.3, T13.4 | |
| 15 | minimal product UI | T13.1–T13.3 | |
| 16 | Judge Inspector | T14.1–T14.3 | public read-only |
| 17 | Railway deployment | T15.1–T15.3 | |
| 18 | real CRE deploy | T16.1, T16.2 | private registry; [HUMAN] beta access |
| 19 | real Sumsub sandbox happy path | T16.3 | |
| 20 | live invalid-key DENY | T17.1 | |
| 21 | live evidence/policy DENY if sandbox permits | T17.2 | labeled fixture fallback allowed by TV-L03 |
| 22 | artifacts + provenance | T17.3, T18.1–T18.6 | |

Explicitly **not** on the fast lane: DON-signed report (T8.7/T9.5), audit append-only DB trigger (T3.5), Railway IaC, any encrypted evidence retention, two-person bootstrap quorum, generic SDK work, verifiable status/revocation architecture.

---

# 1. Goal and implementation boundaries

## 1.1 Goal

Make one candidate `ORGANIZATION` Subject the **Initial ACTIVE Trust Anchor** of `trust-domain:catenor-one-demo`, only after:

```text
authenticated + allowlisted bootstrap operator     (application gate, not eligibility)
→ out-of-band accepted Bootstrap Configuration     (hash-pinned)
→ did:catenor + private provider bindingRefs
→ operator attaches Sumsub applicant refs (externalUserId = bindingRef)
→ public DID Document + assertion key (Privy secure signer, spike-gated)
→ Proof of Key Possession                          (eddsa-jcs-2022 over a single-use challenge)
→ DEPLOYED CRE Confidential Workflow identity-confidential / handler trust-anchor-admission
    handlerInTee → Vault secrets → sealed context → HTTPS to Sumsub from inside the TEE
    → provider-binding gate → deterministic normalization → deterministic fact derivation
→ minimized verified facts + salted evidenceCommitment (COMMITMENT_ONLY)
→ deterministic policy:trust-anchor-admission:v1   (packages/policy)
→ bootstrap endorsement                            (separate bootstrap signer, human-initiated)
→ Trust Anchor Admission Record + ACTIVE status projection
→ independent verification of admission provenance + sanitized audit timeline
```

## 1.2 In scope

SPEC §4 (Rev 2; no LLM), implemented across `apps/web`, `apps/api`, `packages/{identity,credentials,policy,authority,audit}`, `workflows/identity-confidential`, Railway (web, api, PostgreSQL; the bucket is not provisioned in S001 — §12), Privy (operator auth + assertion/bootstrap signers), Sumsub sandbox (inside the TEE).

## 1.3 Out of scope

Everything SPEC §4 excludes, plus in Rev 2: any LLM / Anthropic integration; encrypted evidence retention; raw provider-evidence persistence. LLM-inside-TEE remains a **future candidate technique for S002 Subject Continuity** only if unstructured private evidence actually requires semantic interpretation; nothing for it is built in S001.

## 1.4 Hard boundaries

```text
domain packages import no NestJS / Prisma / Privy / Chainlink / Sumsub / cloud SDK
frontend never computes an authoritative ALLOW
Sumsub calls happen ONLY inside handlerInTee (Railway API never holds Sumsub credentials)
Decision object = exact protocol Decision shape (schema has additionalProperties:false)
no fact becomes true from an unsigned mutable row alone (§23, §26)
Catenor never persists raw Sumsub responses, raw PII, or provider evidence snapshots
simulation never reported as deployment; mocks always labeled MOCK; sandbox always labeled "Sumsub sandbox"
```

---

# 2. Current repository impact

## 2.1 Current state (inspected 2026-09-10)

```text
apps/{web,api}, packages/{identity,credentials,authority,policy,audit,sdk}   empty (.gitkeep)
workflows/{credential-recertifier,subject-continuity,distribution}          empty placeholders
contracts/, schemas/, test-vectors/, tests/, scripts/                        empty
artifacts/judges/s001/{README.md, trust-anchor-flow.html}                    static visualization (cleaned in T0.9)
docs/integrations/{CHAINLINK-CRE,PRIVY,ARC}.md                               empty
.agents/skills/chainlink-cre-skill (+ .claude/skills symlink, skills-lock.json)   untracked
.claude/agents/                                                              does not exist yet
```

## 2.2 Proposed additions (inside the existing top-level layout)

```text
package.json, pnpm-workspace.yaml, tsconfig.base.json, .nvmrc, eslint/prettier, .dependency-cruiser.cjs
.env.example                                        names only

.claude/agents/cre-engineer.md                      project subagent (§17.6, T0.6)

packages/audit/        JCS, SHA-256 commitments, audit event model, hash chain
packages/identity/     CatenorDid, SubjectType, Subject, VerificationMethod, Multikey, DidDocument, KeyManagementReference
packages/credentials/  DataIntegrityProof (eddsa-jcs-2022) hashing + verification
packages/policy/       Policy document + hash, VerifiedFact/FactSet, evaluator, Decision
packages/policy/policies/trust-anchor-admission.v1.json
packages/authority/    TrustDomainId, BootstrapConfiguration, KeyPossession*, BootstrapEndorsement,
                       TrustAnchorAdmission aggregate, AdmissionRecord, TrustAnchorStatus, TrustAnchorVerifier

apps/api/              NestJS modular monolith
apps/api/prisma/schema.prisma
apps/api/config/trust-domains/catenor-one-demo.bootstrap.json   [REF-IMPL]

apps/web/              Next.js: product flow + /judge/s001

workflows/                                         CRE project root (project.yaml, secrets.yaml) — created by `cre init`
workflows/identity-confidential/                   ONE cohesive confidential identity workflow
  └── capability: trust-anchor-admission          S001 (first handler)
      (future S002: subject-continuity)

test-vectors/s001/     machine-readable golden vectors shared by packages, api and workflow tests
tests/e2e/             Playwright
scripts/               bootstrap signer/config tooling, offline verifier, artifact sanitizer, secret scanner
artifacts/chainlink/s001/, artifacts/privy/s001/, artifacts/judges/s001/*
```

### Workflow boundary rule (maintainer decision D20)

```text
WORKFLOW = security boundary + cohesive business responsibility + lifecycle/deployment boundary
HANDLER  = specific operation / entry point inside that responsibility
```

`identity-confidential` owns confidential identity-evidence operations. S001 adds `trust-anchor-admission`; S002 is expected to add `subject-continuity` to the same workflow. Not one workflow per slice or micro-function, and not one workflow for all of Catenor One (distribution stays separate). The existing placeholders `workflows/{credential-recertifier,subject-continuity,distribution}` are left untouched in S001; their reconciliation with this rule (and the `ARCHITECTURE.md §12` / `README.md` trees) is listed in Appendix E.2.

## 2.3 Package dependency direction (dependency-cruiser in CI)

```text
packages/audit        → (none)
packages/identity     → (none)
packages/policy       → audit
packages/credentials  → identity, audit
packages/authority    → identity, credentials, policy, audit
apps/api              → packages/*  (+ NestJS, Prisma, Privy, viem only in infrastructure/)
apps/web              → HTTP API only (+ Privy React SDK, @noble/curves for the wrong-key demo)
workflows/*           → CRE SDK + @noble/hashes + @noble/ciphers (sealed context only); never apps/api;
                        shared behavior checked through test-vectors/s001
```

Allowed third-party code in domain packages: pure, vendor-neutral crypto/encoding libs (`@noble/curves`, `@noble/hashes`, `@scure/base`, an RFC 8785 JCS implementation) — approved in D17.

---

# 3. Domain model changes

Framework-free TypeScript. Protocol-shaped objects keep protocol field names (DATA-MODEL-BASELINE §50).

## 3.1 `packages/audit`

| Element | Kind | Notes |
|---|---|---|
| `canonicalize(value)` | function | RFC 8785 JCS → UTF-8 bytes |
| `commit(value)` | function | `0x` + lowercase hex SHA-256 of JCS bytes [REF-IMPL] |
| `Commitment` | VO | `0x[0-9a-f]{64}` |
| `AuditEvent` | VO | protocol working shape `{type, subject?, issuer?, timestamp, requestId}` + sanitized `details` |
| `AuditEventType` | enum | protocol vocabulary + S001 extensions (§25) |
| `chainEvent(prevHash, event)` | function | `eventHash = SHA-256(JCS(event) ‖ prevHash)` [REF-IMPL] |

## 3.2 `packages/identity`

| Element | Kind | Invariants |
|---|---|---|
| `CatenorDid` | VO | `^did:catenor:[0-9a-f]{32}$` (128-bit CSPRNG, lowercase hex) [REF-IMPL, Open A]; `generate(random16Bytes)` — never derived from input data |
| `SubjectType` | enum | `HUMAN / ORGANIZATION / AGENT`; S001 creates `ORGANIZATION` only |
| `SubjectLifecycle` | enum | `ACTIVE / SUSPENDED / DEACTIVATED` |
| `Subject` | entity | internal record, **not** a protocol wire object (DATA-MODEL §6) |
| `VerificationMethodId` | VO | `<did>#assertion-key-<n>` |
| `Multikey` | codec | Ed25519 public key ⇄ `z` + base58btc(`0xed01` ‖ 32 bytes) |
| `VerificationMethod` | VO | `{id, controller, type:"Multikey", publicKeyMultibase}`; `controller == did` |
| `DidDocument` | aggregate | `{id, verificationMethod[], assertionMethod[]}` only; `authorizesAssertion(vmId)` |
| `KeyPurpose` | enum | `CREDENTIAL_ASSERTION / AUTHENTICATION / DELEGATION / RECOVERY / FINANCIAL_EXECUTION` |
| `KeyManagementReference` | entity | `{subject, verificationMethod, signerRef, purpose, status}` — never key material; a public key bound as `CREDENTIAL_ASSERTION` can never also be bound as `FINANCIAL_EXECUTION` |

## 3.3 `packages/credentials`

| Element | Kind | Notes |
|---|---|---|
| `DataIntegrityProof` | VO | `{type:"DataIntegrityProof", cryptosuite:"eddsa-jcs-2022", verificationMethod, proofPurpose, created, challenge?, domain?, proofValue}` |
| `eddsaJcs2022.hashData(document, proofConfig)` | function | `SHA-256(JCS(proofConfig)) ‖ SHA-256(JCS(document))` = 64 bytes (W3C vc-di-eddsa) |
| `eddsaJcs2022.verify(document, proof, publicKey)` | function | pure Ed25519 verify over `hashData` |

Used for the key-possession proof and the bootstrap endorsement. No VC issuance in S001. The whole profile is conditional on the Privy spike (D3).

## 3.4 `packages/policy`

| Element | Kind | Notes |
|---|---|---|
| `PolicyDocument` | VO | canonical JSON (§22), conforms to protocol `policy.schema.json` |
| `policyHash(doc)` | function | `commit(doc)` |
| `FactName` | enum | exactly the 8 SPEC facts |
| `VerifiedFact` | VO | `{name, value: boolean, provenance: {source: "KEY_POSSESSION_VERIFIER" \| "CONFIDENTIAL_VERIFICATION", ref}}` |
| `FactSet` | VO | FactName → VerifiedFact; **unknown names dropped**, never evaluated |
| `evaluate(policy, facts)` | pure function | `PolicyEvaluation {outcome, requirementResults[{claim, status: SATISFIED \| FALSE \| MISSING}]}` |
| `Decision` | VO | exact protocol shape `{policy, subject, action, resource, decision, evaluatedAt, evidenceCommitment}` |

Outcome profile (D4 approved):

```text
all 8 required facts present and true          → ALLOW
≥1 required fact false                         → DENY
no fact false, ≥1 missing                      → DENY   (frozen policy: "otherwise: DENY")
policy unavailable / hash mismatch / malformed → ERROR  (evaluation refused; never ALLOW)
```

The private trace keeps `FALSE` and `MISSING` distinct; they are never collapsed internally.

## 3.5 `packages/authority`

| Element | Kind | Notes |
|---|---|---|
| `TrustDomainId` | VO | `trust-domain:<slug>` |
| `BootstrapConfiguration` | VO [REF-IMPL] | §16; `bootstrapConfigurationHash = commit(config)` |
| `KeyPossessionChallenge` | entity | §14 |
| `KeyPossessionVerifier` | domain service | produces `ASSERTION_KEY_POSSESSION_VALID`, `ASSERTION_KEY_PURPOSE_VALID` with reasons |
| `BootstrapEndorsement` | VO [REF-IMPL] | §16; binds `verificationMethodCommitment`; `canEndorse(decision)` only on `ALLOW`; `verify(config)` |
| `TrustAnchorAdmission` | aggregate | session state machine (§4.2); no ACTIVE without ALLOW + verified endorsement |
| `TrustAnchorAdmissionRecord` | VO | SPEC §21 shape (D14) |
| `TrustAnchorStatus` | enum | `ACTIVE / SUSPENDED / REVOKED / DEACTIVATED` |
| `TrustAnchorVerifier` | domain service | SPEC §27 checks → `TRUST_ANCHOR_VALID` + per-check results, with the cryptographic/operational split of §26 |

The Bootstrap Access Gate and provider bindingRefs are application-layer concerns, not domain concepts.

---

# 4. Application use cases

Location: `apps/api/src/modules/trust-anchor-admission/application/`. Plain classes depending on ports + domain packages.

## 4.1 Use cases

| # | Use case | Summary | Key ACs |
|---|---|---|---|
| U1 | `CheckBootstrapAccess` | operator identity → allowlist → `{allowed}` (never reveals list) | 001–003 |
| U2 | `StartInitialAdmission` | gate; reject if initial TA exists (`ALREADY_ADMITTED` for same Subject); create/resolve ORGANIZATION Subject + DID; create **private provider bindingRefs** for `COMPANY` and `REPRESENTATIVE`; open session; return `{sessionRef, did, providerSetup:{companyBindingRef, representativeBindingRef}}` **to the authenticated operator only**; audit `SUBJECT_CREATED`, `ADMISSION_REQUESTED`. **Takes no applicant IDs.** | 001, 002, 007, 008, 052 |
| U3 | `AttachProviderReferences` | operator attaches the Sumsub applicant IDs created with those bindingRefs as `externalUserId`; stored privately as `ATTACHED_UNVERIFIED`; re-attachable until a verification run succeeds | 020, 055 |
| U4 | `ProvisionAssertionKey` | `AssertionSigner.createKey` → VM → DID Document projection → `KeyManagementReference`; audit `KEY_ADDED`, `DID_DOCUMENT_CREATED` | 009–013 |
| U5 | `IssueKeyPossessionChallenge` | one challenge per session | 014–018 |
| U6a | `ProveKeyPossessionWithSecureSigner` | normal path: hashData → signer → U6 | 014 |
| U6 | `SubmitKeyPossessionProof` | verify from public DID state only; atomic consume; record key facts; failure → immediate evaluation (DENY), no CRE call (D23) | 014–018 |
| U7 | `RequestConfidentialVerification` | preconditions: key facts true **and** provider refs attached; seal private context; trigger CRE; record run + `creExecutionId` | 019, 023, 028–030 |
| U8 | `RecordConfidentialVerificationResult` | authenticate callback; validate schema + echoes; recompute commitment; on OK: store facts, mark provider bindings `BINDING_VERIFIED`; on `PROVIDER_BINDING_MISMATCH` / ERROR: no facts, audit | 021, 022, 026, 027, 056, 058 |
| U9 | `EvaluateAdmission` | policy integrity vs bootstrap config; FactSet; evaluate; Decision + private trace; audit `POLICY_EVALUATED` (+ `TRUST_ANCHOR_ADMISSION_DENIED`) | 005, 035–040, 043 |
| U10 | `EndorseAndActivateInitialTrustAnchor` | operator-initiated; ALLOW only; endorsement → bootstrap signer → verify → Admission Record → ACTIVE (one transaction); audit `BOOTSTRAP_ENDORSEMENT_CREATED`, `TRUST_ANCHOR_ADMITTED` | 044–051 |
| U11 | `ResolveDid` | public DID Document | 009, 010 |
| U12 | `GetPublicAdmissionState` | minimized record / decision / endorsement / status | 049, 054 |
| U13 | `VerifyTrustAnchor` | `TrustAnchorVerifier` over public projections + pinned config | 063–065 |
| U14 | `GetJudgeAdmissionView` | sanitized timeline, facts (names/values), runtime references | 060–062, 068 |
| U15 | `ExpireStaleVerificationRuns` | runs past deadline → `TIMED_OUT` (non-ALLOW) | 022 |

## 4.2 Provider-binding sequence (maintainer amendment §5)

```text
1 operator → U2 StartInitialAdmission                    (no applicant IDs)
2 Catenor creates Subject + did:catenor + bindingRefs {COMPANY, REPRESENTATIVE}
3 API returns bindingRefs to the authenticated operator only (operator view; never public/judge)
4 operator creates/configures Sumsub company + representative applicants (sandbox) with
  externalUserId = the matching bindingRef, and links the representative to the company
5 operator → U3 AttachProviderReferences {companyApplicantId, representativeApplicantId}
6 inside handlerInTee: provider-binding gate — applicant.externalUserId == expected bindingRef
  for BOTH applicants (+ company.type == "company", representative.type == "individual")
7 only if the gate passes does provider verification continue (fact derivation, further calls)
```

Why step 6 runs inside the TEE: the Railway API deliberately holds no Sumsub credentials, so the only place Catenor can read `externalUserId` is the confidential handler. The gate is the **first deterministic guardrail** of the run and uses the responses of HTTP #1/#2 (no extra call); a mismatch ends the run with `status: ERROR, code: PROVIDER_BINDING_MISMATCH`, no facts, and an audit event. bindingRef format: 128-bit random, lowercase hex with a short prefix (exact allowed charset confirmed in T0.8). bindingRefs are not the DID and are not derived from any identity data.

## 4.3 Admission session state machine (`TrustAnchorAdmission`)

Session progress is a set of guarded preconditions rather than a strict line, because Sumsub setup (4.2 step 4) happens in parallel with key provisioning:

```text
STARTED ── ProvisionKey ──► KEY_PROVISIONED ── challenge/proof ──► KEY_PROOF_VALID | KEY_PROOF_INVALID→DENY
   │
   └── AttachProviderReferences ──► PROVIDER_REFS_ATTACHED (re-attachable until a run succeeds)

KEY_PROOF_VALID ∧ PROVIDER_REFS_ATTACHED ──► VERIFICATION_REQUESTED
   ──► EVIDENCE_RECEIVED | VERIFICATION_FAILED (retryable, ≤3 runs: ERROR, TIMED_OUT, BINDING_MISMATCH)
   ──► DECIDED(ALLOW | DENY | ERROR)
   ──► ALLOW → ENDORSED → ADMITTED        DENY/ERROR → terminal
```

Aggregate rules (unit-tested):

```text
no ADMITTED without Decision.ALLOW + endorsement.verify() == true
failed key proof fixes ASSERTION_KEY_POSSESSION_VALID=false for the session (retry = new session, TV-K02)
no confidential verification after a failed key proof
evidence facts accepted at most once per run; late/duplicate callbacks rejected
terminal states immutable; history auditable
```

`AdmitTrustAnchor` (ARCHITECTURE §8) is realized as this process manager, split at the asynchronous boundaries (Sumsub setup, signature step, CRE callback, endorsement).

---

# 5. Ports

Defined inward; implemented in `apps/api/src/infrastructure/*`. Cross-slice ports in `apps/api/src/shared/application/ports/`.

| Port | Methods (sketch) | S001 adapter |
|---|---|---|
| `OperatorIdentityVerifier` | `verify(accessToken, idToken) → {operatorRef, verifiedEmail}` | Privy |
| `BootstrapOperatorAllowlist` | `isAllowed(email)` | env `ALLOWED_BOOTSTRAP_EMAILS` |
| `BootstrapConfigurationSource` | `load(trustDomain) → {config, hash}` (fails if ≠ pin) | file + env pin |
| `AdmissionPolicySource` | `load(policyId)` | packaged JSON |
| `AssertionSigner` | `createKey({subject, purpose}) → {publicKeyMultibase, signerRef}`; `sign(signerRef, bytes64)` | Privy Ed25519 wallet (spike-gated) |
| `BootstrapEndorsementSigner` | `publicKeyMultibase()`; `sign(bytes64)` | separate Privy Ed25519 wallet |
| `ConfidentialEvidenceVerifier` | `request({operation, runId, sealedContext}) → {creExecutionId}` | CRE HTTP-trigger gateway client |
| `ConfidentialResultAuthenticator` | `authenticate(headers, rawBody) → envelope` | HMAC; [P1] DON report verifier |
| `ContextSealer` | `seal(privateContext, aad) → {nonce, ciphertext}` | AES-256-GCM, HKDF from channel secret |
| `SubjectRegistry` | subjects + private provider bindings/refs | Prisma (private) |
| `DidStateRegistry` | DID Document projection + key refs | Prisma |
| `AdmissionRepository` | session, challenges (atomic consume), runs, decisions, endorsements | Prisma |
| `TrustAnchorRegistry` | admission record + status; single initial root | Prisma |
| `AuditLog` | `append`, `timeline` | Prisma append-only |
| `UnitOfWork`, `Clock`, `RandomSource`, `IdGenerator` | transaction, time, CSPRNG, ULIDs | Prisma / Node `crypto` |

No `EvidenceVault` port is implemented in S001 (COMMITMENT_ONLY, §24); it is introduced by the first slice that retains evidence objects.

---

# 6. Infrastructure adapters

```text
apps/api/src/infrastructure/
├── identity-providers/privy-operator-identity.adapter.ts   @privy-io/node access + identity tokens
├── access-control/env-bootstrap-allowlist.adapter.ts
├── config/file-bootstrap-configuration.adapter.ts
├── key-management/privy-ed25519-signer.adapter.ts           only after T0.5 passes
├── confidential-compute/cre-gateway-trigger.adapter.ts      workflows.execute JSON-RPC + EIP-191 JWT (own code)
├── confidential-compute/cre-result-authenticator.adapter.ts HMAC; [P1] DON report verification (viem)
├── confidential-compute/aes-gcm-context-sealer.adapter.ts
├── persistence/prisma/*
└── observability/redacting-logger.ts                        allowlisted fields only
```

Inside the workflow (also infrastructure), after transforming the official `cre init` scaffold (§17.2):

```text
workflows/identity-confidential/src/
├── main.ts                                   single HTTP trigger → handlerInTee → operation router
├── shared/secrets.ts                         one batched getSecrets
├── shared/keys.ts                            HKDF key schedule (@noble/hashes)
├── shared/sealed-context.ts                  AES-256-GCM open (@noble/ciphers) [STOP-GATE T0.7]
├── shared/callback.ts                        HMAC-authenticated POST to Catenor API
├── shared/safe-log.ts                        enum-coded markers only (TEE logs treated as public)
├── shared/sumsub/client.ts                   HMAC-signed GETs (pure JS)
├── shared/sumsub/normalize.ts                allowlisted fields; unknown fields ignored
└── capabilities/trust-anchor-admission/
    ├── handler.ts                            orchestration for this operation
    ├── binding-gate.ts                       externalUserId == bindingRef
    ├── derive-facts.ts                       deterministic fact derivation
    └── commitment.ts                         salted evidence commitment
```

No Sumsub adapter exists in `apps/api` (SPEC §12). No LLM client exists anywhere in S001.

---

# 7. API surface

Prefix `/v1`. zod DTO validation at the edge; one use case per controller method.

## 7.1 Public (unauthenticated, read-only, projection tables only)

| Method | Route | Returns |
|---|---|---|
| GET | `/v1/dids/{did}` | `200 {didDocument}`; `404`; `410 {didDocumentMetadata:{deactivated:true}}` [REF-IMPL] |
| GET | `/v1/trust-domains/{trustDomainId}` | public bootstrap configuration, `bootstrapConfigurationHash`, initial Trust Anchor DID or `null` |
| GET | `/v1/policies/{policyId}` | canonical policy JSON, `policyHash`, `{canonicalization:"RFC8785", hash:"SHA-256"}` |
| GET | `/v1/trust-domains/{td}/trust-anchors/{did}` | minimized Admission Record, Decision, bootstrap endorsement, status projection |
| GET | `/v1/trust-domains/{td}/trust-anchors/{did}/verification` | `{TRUST_ANCHOR_VALID, checks[], verifiedAt}` (§26 split) |
| GET | `/v1/judge/s001/admissions`, `/{sessionRef}` | sanitized Judge Inspector projection (§9) |

## 7.2 Operator (Privy access + identity token; allowlist per request)

| Method | Route | Use case |
|---|---|---|
| GET | `/v1/operator/bootstrap/access` | U1 |
| POST | `/v1/operator/bootstrap/admissions` | U2 → `{sessionRef, did, providerSetup:{companyBindingRef, representativeBindingRef}}` · `403 BOOTSTRAP_ACCESS_DENIED` · `409 INITIAL_TRUST_ANCHOR_EXISTS` · `200 ALREADY_ADMITTED` |
| GET | `…/{sessionRef}` | operator session view (includes bindingRefs + attachment status; never raw evidence) |
| PUT | `…/{sessionRef}/provider-references` | U3 `{companyApplicantId, representativeApplicantId}` |
| POST | `…/{sessionRef}/assertion-key` | U4 |
| POST | `…/{sessionRef}/key-possession/challenge` | U5 |
| POST | `…/{sessionRef}/key-possession/secure-signer` | U6a → U6 |
| POST | `…/{sessionRef}/key-possession/proof` | U6 with external proof (wrong-key demo) |
| POST | `…/{sessionRef}/confidential-verification` | U7 |
| POST | `…/{sessionRef}/evaluation` | U9 (also automatic when facts complete) |
| POST | `…/{sessionRef}/endorsement` | U10 |

U2 request body (display name optional, private):

```json
{ "trustDomain": "trust-domain:catenor-one-demo",
  "candidate": { "existingDid": null, "displayName": "Organization A" } }
```

## 7.3 Internal (TEE → API)

| Method | Route | Auth |
|---|---|---|
| POST | `/v1/internal/cre/identity-confidential/results` | `X-Catenor-Run`, `X-Catenor-Timestamp`, `X-Catenor-Signature` = HMAC-SHA256(K_cb, run ‖ ts ‖ SHA-256(body)); ±120 s; single use per run |

No TEE→API context-fetch endpoint exists in the approved design. It would only be added after explicit human review if the sealed-context spike fails (§18).

## 7.4 Errors

Problem-details `{code, message}` with stable codes (`BOOTSTRAP_ACCESS_DENIED`, `PROVIDER_REFERENCES_MISSING`, `CHALLENGE_EXPIRED`, `CHALLENGE_CONSUMED`, `CHALLENGE_SUBJECT_MISMATCH`, `POLICY_INTEGRITY_FAILURE`, `ENDORSEMENT_INVALID`, `INITIAL_TRUST_ANCHOR_EXISTS`, …). Never include allowlist contents, applicant IDs, bindingRefs (outside the operator view), provider payloads, or secrets.

---

# 8. Frontend / product flow

`apps/web` (Next.js App Router, TypeScript, Tailwind). No CRE/Vault/hash vocabulary in the product flow (AC-069).

```text
/                         landing
/bootstrap                Privy email OTP → access check
  step 1 Organization     "Start" → did:catenor created; shows the two setup references
                          ("use these as External User ID in Sumsub sandbox")
  step 2 Provider setup   paste company + representative applicant IDs → attached
  step 3 Identity key     "Create organization key" → DID Document link
  step 4 Key control      "Prove key control" → ✓ / ✗
  step 5 Verification     "Verify organization (Sumsub sandbox)" → progress → ✓/✗ per requirement
  step 6 Decision         ALLOW / DENY with plain-language reasons
  step 7 Activate         "Endorse and activate" (ALLOW only) → ACTIVE
  step 8 Verify           "Verify Trust Anchor" → TRUE / FALSE
/did/[did]                public DID Document viewer
/trust-anchors/[did]      public admission state + live verification
/judge/s001               Judge Inspector (§9)
```

Rules: UI renders server state only; buttons map 1:1 to operator endpoints; no client-side ALLOW logic; Privy React SDK only for login/tokens; the wrong-key demo generates an ephemeral Ed25519 key in the browser (`@noble/curves`), signs the real challenge, submits via `…/key-possession/proof`, and discards the key; polling (2 s) for run status. Steps 2–4 may be completed in any order before step 5.

---

# 9. Judge Inspector integration

Route `/judge/s001`, backed by `GET /v1/judge/s001/*` (sanitized projection from an allowlisted field set).

| Panel | Content |
|---|---|
| Architecture flow | SPEC flow with live step highlighted |
| Runtime boundary | Railway vs Privy vs CRE TEE; what crossed each boundary; "HTTPS requests are executed from inside the confidential TEE boundary" (not "Confidential HTTP product") |
| Public identity | DID, DID Document, VM, Multikey |
| Key possession | challenge id, expiry, result, verifier checks |
| Confidential verification | workflow `identity-confidential`, operation `trust-anchor-admission`, CRE workflow ID, execution ID (link to CRE UI), run status, provider environment **"Sumsub sandbox — synthetic organization, not production KYB"**, retention mode `COMMITMENT_ONLY`, fact names + true/false |
| Representative authority | which evidence classes established it and the documented limitation from T0.8 (e.g., role declared vs provider-verified under the KYB level used) |
| Policy | id, canonical JSON, hash, requirement table SATISFIED / FALSE / MISSING |
| Decision / endorsement / record | public projections, endorsement verification result |
| Verification | cryptographically verified checks vs operational-projection checks, shown separately (§26) |
| Audit timeline | sanitized events, hash-chain continuity |
| Scenarios | happy / unauthorized email / invalid key / evidence DENY — each linked to a recorded real run and its artifacts |
| Sponsor evidence | links to `artifacts/chainlink/s001`, `artifacts/privy/s001` |

Never shown: applicant IDs, bindingRefs, operator emails, raw provider data. Judges get read-only access; executing scenarios requires an authenticated allowlisted operator.

`artifacts/judges/s001/trust-anchor-flow.html` stays a labeled static visualization; its "visualization only" banner and Rev 2 wording were applied in T0.9.

---

# 10. PostgreSQL / Prisma model

One Railway PostgreSQL, private networking only (internal `DATABASE_URL`; no TCP proxy — §29.3). Two logical classes, separated in code and schema:

```text
catenor_public   — rows the Resolver/API may serialize
catenor_private  — never serialized by public controllers
```

Postgres schemas via Prisma `multiSchema` if supported without preview flags by the pinned Prisma version, otherwise `pub_`/`prv_` prefixes [UNCONFIRMED — decided at T3.1].

## 10.1 Model sketch (final schema reviewed by the maintainer at T3.1)

| Class | Model | Key fields | Constraints |
|---|---|---|---|
| public | `DidDocumentProjection` | `did` PK, `document` JSONB, `lifecycle`, `updatedAt` | built only from `DidDocument` VO |
| public | `VerificationMethodProjection` | `id` PK, `did`, `type`, `publicKeyMultibase`, `relationships[]`, `status` | |
| public | `PolicyPublication` | `policyId` PK, `canonicalJson`, `policyHash` | immutable |
| public | `DecisionProjection` | `decisionRef` PK, 7 protocol Decision fields, `decisionCommitment` | ALLOW only |
| public | `BootstrapEndorsementProjection` | `id` PK, `payload` JSONB (incl. proof) | unique `decisionRef` |
| public | `TrustAnchorAdmissionRecord` | `id` PK, SPEC §21 fields | unique (`trustDomain`, `trustAnchor`) |
| public | `TrustAnchorStatusProjection` | (`trustDomain`, `did`) PK, `status`, `changedAt` | operational projection (§26) |
| public | `TrustDomainProjection` | `id` PK, `bootstrapConfigurationHash`, `initialTrustAnchorDid` UNIQUE NULL | one initial root |
| private | `Subject` | `id`, `did` UNIQUE, `type`, `lifecycle` | |
| private | `ProviderBinding` | `subjectId`, `provider`="sumsub", `role` COMPANY \| REPRESENTATIVE, `bindingRef` UNIQUE, `externalSubjectId` NULL, `status` PENDING_ATTACHMENT \| ATTACHED_UNVERIFIED \| BINDING_VERIFIED \| BINDING_MISMATCH | unique (subjectId, role) |
| private | `KeyManagementReference` | `verificationMethodId` PK, `subjectId`, `signerRef`, `adapter`, `purpose`, `status` | never key material |
| private | `AdmissionSession` | `sessionRef` UNIQUE, `trustDomain`, `subjectId`, `operatorRef`, `state`, flags, timestamps | |
| private | `KeyPossessionChallenge` | `challengeId` PK, bound fields, `nonce`, `issuedAt`, `expiresAt`, `status` | conditional-update consume |
| private | `ConfidentialVerificationRun` | `runId`, `sessionRef`, `operation`, `creWorkflowId`, `creExecutionId`, `status`, `code`, `deadlineAt`, `facts` JSONB, `evidenceCommitment`, `commitmentInputs` JSONB (observedAt, response digests, provider-ref digests — no salt, no content), `providerEnvironment`, `retentionMode`="COMMITMENT_ONLY", `bootstrapConfigurationHashEcho`, `resultAuth` JSONB, `donReport` JSONB (P1) | one accepted result per run |
| private | `DecisionRecord` + `DecisionTrace` | every Decision (ALLOW/DENY/ERROR); requirement statuses FALSE vs MISSING; fact provenance | |
| private | `AuditEvent` | `seq`, `id`, `type`, `subject`, `requestId`, `timestamp`, `details` (sanitized), `prevHash`, `eventHash` | [P1] append-only trigger |

Never stored in PostgreSQL: private keys, Privy app secret, authorization private keys, CRE secrets, raw Sumsub responses, raw PII, provider evidence snapshots, operator email (only `operatorRef` = HMAC-SHA256(`OPERATOR_REF_KEY`, privyUserId)).

Migrations: `prisma migrate deploy` as the Railway pre-deploy command (runs inside the private network). Created only after schema approval (T3.2).

---

# 11. Public resolver projection

```text
write path:  use case → domain VO → projection mapper → catenor_public row (explicit columns)
read path:   public controller → PublicReadModel (catenor_public only) → DTO allowlist
```

Controls (each tested):

```text
public controllers cannot import private repositories (Nest module boundary + dependency-cruiser)
response DTOs are explicit allowlists (no ORM row spreading)
leak-sentinel test: fixtures insert sumsub_company_fixture_001, sumsub_person_fixture_001, both bindingRefs,
  RAW_SECRET_DOCUMENT_VALUE_001, PRIVATE_FIXTURE_123, operator email → crawl every public + judge route →
  assert none appear (TV-C03, I01, I03, E06; AC-010, 020, 054, 062)
DID Document projection regenerated from the VO, never edited in place
DENY Decisions not in catenor_public; the judge projection exposes requirement names/status only
```

Resolution result stays `{didDocument}` (DATA-MODEL §5); `410` deactivation metadata is [REF-IMPL].

---

# 12. Railway private bucket strategy

The Railway private Storage Bucket remains part of the Catenor One architecture (SPEC §22), but **S001 does not write to it** (D13: custom encryption rejected; COMMITMENT_ONLY):

```text
S001 writes     nothing to the bucket; no EvidenceVault adapter; no bucket credentials on apps/api
provisioning    NOT provisioned in S001 (maintainer decision Q3); it stays in the wider architecture
later slices    introduce EvidenceVault + an approved, standard encryption scheme when evidence
                objects actually need retention
```

Confirmed platform facts for later use: buckets are always private, encrypted at rest, S3-compatible (Tigris-backed), no SSE parameters, presigned URLs supported.

---

# 13. Credential / assertion-key strategy

## 13.1 Decision: Privy-backed dedicated Ed25519 signer per Organization — APPROVED PROVISIONALLY (D1)

Implementation is conditional on spike T0.5 [STOP-GATE]. Pattern from Privy's official docs skill, API reference and `@privy-io/node` source (Appendix A.2):

```text
SDK            @privy-io/node (0.34.0 at review; @privy-io/server-auth deprecated)
wallet         privy.wallets().create({ chain_type: "solana", owner_id: <assertion key quorum>, policy_ids: [P_ASSERT] })
               Solana-type = Ed25519; base58 address = 32-byte public key
public key     publicKeyMultibase = "z" + base58btc(0xed01 ‖ base58decode(address))
signerRef      Privy wallet id (private operational metadata)
sign           privy.wallets().solana().signMessage(walletId, { message: base64(64 bytes), authorization_context })
policy P_ASSERT  ALLOW signMessage when message.byte_length eq 64
                 DENY  exportPrivateKey
                 (transaction methods denied by default: no matching ALLOW)
owner          key quorum { CATENOR_ASSERTION_AUTHORIZATION_KEY (P-256) }, threshold 1
custody        generated/used inside Privy's TEE per Privy security docs; Catenor never sees the key
```

Invariant (frozen): **Credential Assertion Key ≠ Financial Execution Key.** The policy permits only 64-byte message signing: no transaction signing, no send, no export (AC-013). The address can still *receive* funds; it can never spend them and is never bound as a financial Account Binding.

## 13.2 Spike T0.5 must prove, before any adapter code

```text
1 a Privy signMessage signature over 64 raw bytes verifies with plain Ed25519 (@noble/curves) against
  the Multikey derived from the wallet address — i.e. no prefix/hash is applied by Privy
2 policy denies: signTransaction, signAndSendTransaction, 32-byte and 65-byte messages, exportPrivateKey
3 authorization-key / key-quorum flow works from a server context
```

If any item fails: **STOP and report**. No other signer, curve, suite or crypto profile is introduced without maintainer approval (the local-key and Sui `raw_sign` options from Rev 1 are no longer pre-approved fallbacks).

## 13.3 Evidence for judges

`artifacts/privy/s001/`: policy JSON, Multikey, a 64-byte signature verified with `@noble/curves`, and a **denied** `signTransaction` attempt against the assertion wallet. Wallet ids redacted.

---

# 14. Proof-of-key-possession strategy

## 14.1 Challenge [REF-IMPL; protocol replay rules are Open C]

```json
{
  "type": "CatenorOneKeyPossessionChallenge",
  "challengeId": "challenge:admission:01J…",
  "subject": "did:catenor:<32hex>",
  "verificationMethod": "did:catenor:<32hex>#assertion-key-1",
  "operation": "ADMIT_TRUST_ANCHOR",
  "trustDomain": "trust-domain:catenor-one-demo",
  "nonce": "<base64url(32 CSPRNG bytes)>",
  "issuedAt": "2026-09-09T22:00:00Z",
  "expiresAt": "2026-09-09T22:05:00Z"
}
```

TTL 5 minutes; one challenge per session.

## 14.2 Proof — W3C `eddsa-jcs-2022` (D3, [REF-IMPL], conditional on T0.5)

```text
proofConfig = {type:"DataIntegrityProof", cryptosuite:"eddsa-jcs-2022", verificationMethod,
               proofPurpose:"assertionMethod", created, challenge: nonce, domain: trustDomain}
hashData    = SHA-256(JCS(proofConfig)) ‖ SHA-256(JCS(challenge))   → 64 bytes → signer
proofValue  = "z" + base58btc(signature)
```

## 14.3 Verification (`KeyPossessionVerifier`; public DID state + server challenge record only)

```text
1 challenge exists, ISSUED                                 else CHALLENGE_UNKNOWN / CONSUMED (D04)
2 now <= expiresAt                                         else CHALLENGE_EXPIRED (D03)
3 challenge.subject == requested DID                       else CHALLENGE_SUBJECT_MISMATCH (D05)
4 operation == ADMIT_TRUST_ANCHOR; trustDomain matches
5 proof.verificationMethod ∈ resolved DID Document         else VERIFICATION_METHOD_MISSING
6 ∈ assertionMethod ∧ KeyManagementReference.purpose == CREDENTIAL_ASSERTION → ASSERTION_KEY_PURPOSE_VALID (D06)
7 proof.challenge == nonce; proof.domain == trustDomain; proofPurpose == assertionMethod
8 Ed25519 verify(hashData, signature, Multikey)            → ASSERTION_KEY_POSSESSION_VALID (D01/D02)
9 atomic consume; losing a race → CHALLENGE_CONSUMED
```

Failure → fact `false` with reason; session evaluates straight to `DENY`, no CRE call (D23).

## 14.4 Meaning in the S001 custodial profile

The secure signer holding the key on behalf of the Organization can sign for the published Verification Method. It does not prove organization legitimacy (SPEC §11), and in S001 does not prove the representative personally holds the key (representative-in-quorum is a later enhancement).

---

# 15. Bootstrap access gate

```text
login         Privy email OTP (@privy-io/react-auth useLoginWithEmail)
per request   Authorization: Bearer <Privy access token>; privy-id-token: <identity token>
server        verifyAccessToken → user_id; identity token → verified email; sub == user_id
allowlist     lowercase(email) ∈ parse(ALLOWED_BOOTSTRAP_EMAILS)
scope         operator bootstrap endpoints only; only while no initial Trust Anchor exists
outputs       {allowed: boolean}; denial reveals nothing about the list
```

Guarantees: the gate result is never an input to `FactSet` (type-level; AC-003, TV-A03); denied attempts create nothing (AC-002, TV-A02); denials are audited as `BOOTSTRAP_ACCESS_DENIED` with `operatorRef` only. Privy's dashboard allowlist only gates new sign-ups and cannot replace the server check.

---

# 16. Bootstrap Configuration + endorsement strategy

## 16.1 Bootstrap Configuration [REF-IMPL; Trust Domain object is OPEN WIRE FORMAT]

`apps/api/config/trust-domains/catenor-one-demo.bootstrap.json`:

```json
{
  "type": "CatenorTrustDomainBootstrapConfiguration",
  "profile": "catenor-one/bootstrap-configuration/v1",
  "trustDomain": "trust-domain:catenor-one-demo",
  "admissionPolicy": "policy:trust-anchor-admission:v1",
  "admissionPolicyHash": "0x<commit(policy)>",
  "bootstrapVerificationMethod": "bootstrap-verification-method:1",
  "bootstrapPublicKeyMultibase": "z6Mk…",
  "commitmentProfile": { "canonicalization": "RFC8785", "hash": "SHA-256", "encoding": "0x-hex" },
  "acceptedEvidence": {
    "profileNote": "[REF-IMPL] Catenor One reference/demo evidence-acceptance rules; not a Catenor Protocol rule",
    "provider": "sumsub",
    "environment": "sandbox",
    "companyLevelNames": ["<confirmed in T0.8>"],
    "representativeLevelNames": ["<confirmed in T0.8>"],
    "authorityRoles": ["<confirmed in T0.8>"],
    "amlRejectLabels": ["<confirmed in T0.8>"],
    "activeRegistryStatuses": ["<confirmed in T0.8>"],
    "evidenceMaxAgeDays": 180
  }
}
```

`evidenceMaxAgeDays: 180` is the approved Catenor One reference/demo value (D5), **[REF-IMPL]**, not a Catenor Protocol rule. All Sumsub-specific values are filled only from spike T0.8 observations — no provider semantics are hardcoded before the spike.

Out-of-band acceptance (human, before any admission):

```text
1 scripts/bootstrap/create-bootstrap-signer.ts → bootstrap Privy wallet (policy P_ASSERT) under a SEPARATE
  authorization key → publicKeyMultibase
2 human fills the config, runs scripts/bootstrap/hash-config.ts, reviews, commits
3 human sets Railway BOOTSTRAP_CONFIGURATION_HASH
4 API refuses admissions if file hash ≠ pin (AC-004/005, TV-B01/B02)
5 the CRE workflow config carries the same hash; the TEE echoes it; mismatch → result rejected
```

## 16.2 Bootstrap endorsement [REF-IMPL proof envelope]

```json
{
  "type": "CatenorOneBootstrapEndorsement",
  "id": "endorsement:bootstrap:01J…",
  "trustDomain": "trust-domain:catenor-one-demo",
  "bootstrapConfigurationHash": "0x…",
  "candidate": "did:catenor:<32hex>",
  "verificationMethod": "did:catenor:<32hex>#assertion-key-1",
  "verificationMethodCommitment": "0x<SHA-256(JCS({id, controller, type, publicKeyMultibase}))>",
  "admissionPolicy": "policy:trust-anchor-admission:v1",
  "policyHash": "0x…",
  "decisionRef": "decision:admission:01J…",
  "decisionCommitment": "0x<commit(Decision)>",
  "evidenceCommitment": "0x…",
  "endorsedAt": "2026-09-10T00:00:00Z",
  "proof": { "type": "DataIntegrityProof", "cryptosuite": "eddsa-jcs-2022",
             "verificationMethod": "bootstrap-verification-method:1",
             "proofPurpose": "assertionMethod", "created": "…", "proofValue": "z…" }
}
```

`verificationMethodCommitment` [REF-IMPL] (maintainer decision Q1, refined): a commitment to the **complete canonical Verification Method** used for Admission, not only the bare public key:

```text
verificationMethodCommitment = 0x + hex(SHA-256(JCS({ id, controller, type, publicKeyMultibase })))
```

It makes replacement of the public key under the same Verification Method ID detectable during activation (TV-G06) and Trust Anchor verification (TV-J07, AC-076).

## 16.3 Endorsement rules (D2 approved)

```text
created only by U10, only when Decision == ALLOW and policy integrity re-verified
human-initiated: an authenticated allowlisted operator clicks "Endorse and activate"
separate bootstrap signing authority: own Privy wallet + own authorization key
  (CATENOR_BOOTSTRAP_AUTHORIZATION_KEY); never the candidate's key
no mandatory two-person rule in S001 (quorum/two-person model is a later enhancement)
verified immediately after signing, in TrustAnchorVerifier, and by the offline verifier script
DENY / ERROR → no endorsement object (AC-045, TV-G02)
```

## 16.4 Admission Record shape (D14 approved)

SPEC §21's `trustDomain` and `bootstrapEndorsementRef` are implemented as **Catenor One [REF-IMPL] extensions** of the protocol DRAFT SHAPE (DATA-MODEL §23); a protocol amendment proposal follows later. No other fields are added.

---

# 17. Chainlink CRE workflow architecture

## 17.1 Confirmed platform facts (live docs + official repos, 2026-09-10; Appendix A.1)

```text
Confidential Workflows   PRIVATE BETA, invite-only, separate from normal deploy access          [HUMAN]
SDK / CLI                @chainlink/cre-sdk (TS) ≥1.18 (1.19.1 at review); cre CLI ≥1.29 (1.32.0 at review)
TEE                      AWS Nitro, us-west-2; one enclave executes each run (single observation)
API                      handlerInTee(trigger, fn(teeRuntime, triggerOutput), tees, hooks?)
                         TeeRuntime: config, now(), log(), getSecrets(), reportFromDon(), usingTheDons()
secrets                  runtime.getSecrets([{id},…]).result() — batched; plaintext only inside the enclave
HTTP inside TEE          regular HTTPClient.sendRequest(teeRuntime, …) executes in the enclave; code can
                         compute HMAC with secret values; payloads stay in the enclave
ConfidentialHTTPClient   separate capability; template-only secrets; no TeeRuntime overload → NOT used (D11a)
HTTP trigger             one HTTP trigger per workflow; returns ACCEPTED asynchronously; no documented
                         programmatic fetch of the return value
logs from TEE            may be forwarded outside the enclave → treated as PUBLIC
binary + config          uploaded to CRE storage → treated as PUBLIC
randomness               no CSPRNG in the TEE (Math.random host-seeded; no crypto.getRandomValues)
crypto libs              @noble/hashes recommended by docs; @noble/ciphers [UNCONFIRMED → T0.7]
network                  HTTPS only, no private addresses, no redirects
```

### Quotas and timeouts — exact official wording (docs.chain.link/cre/service-quotas, updated 2026-05-26)

```text
PerWorkflow.HTTPAction.CallLimit          5 HTTP requests per workflow execution   ← design limit
PerWorkflow.HTTPAction.RequestSizeLimit   10 KB
PerWorkflow.HTTPAction.ResponseSizeLimit  100 KB
PerWorkflow.HTTPAction.ConnectionTimeout  10 s  — time to ESTABLISH an HTTP connection (not total request time)
PerWorkflow.CapabilityCallTimeout         3 min — maximum time for a single capability call
PerWorkflow.ExecutionTimeout              5 min
PerWorkflow.Secrets.CallLimit             5 fetch calls / execution;  WASMSecretsSizeLimit 27 KB
PerWorkflow.WASMConfigSizeLimit           50 KB
PerWorkflow.ExecutionResponseLimit        100 KB
PerWorkflow.HTTPTrigger.RateLimit         1 per 60 s, burst 1
PerWorkflow.ConfidentialHTTP.TimeOut      10 s total — applies to the separate Confidential HTTP capability ONLY
```

The TS SDK reference (`reference/sdk/http-client-ts`) additionally documents a per-request `timeout` field on `HTTPClient` requests: default 5 s, "default maximum" 10 s. Whether that field and cap behave identically for `HTTPClient` calls made with `TeeRuntime` is [UNCONFIRMED] and measured in T0.7. S001 sets an explicit per-request `timeout` within the documented range and does not claim any other total-time limit. The CRE CLI's local `limits.json` shows different values (e.g. 15 calls); S001 designs for the stricter documented 5 unless the real organization/runtime proves otherwise.

### Terminology (D11a confirmed)

The approved statement is: **"HTTPS requests are executed from inside the confidential TEE boundary."** S001 uses the normal CRE `HTTPClient` with `TeeRuntime`, per the official Confidential Workflow pattern. Catenor One must never claim to use the separate *Confidential HTTP* product/API.

## 17.2 Official scaffolding (D20, maintainer amendment §20)

When implementation begins (not before): the `cre-engineer` subagent runs `cre init` with the official TypeScript Confidential Workflow template `hello-confidential-workflows-ts` (exact template identifier/flags confirmed against the installed CLI's `cre init --help`), with explicit private-registry and target configuration, so that:

```text
workflows/project.yaml, workflows/secrets.yaml          CRE project root
workflows/identity-confidential/                        transformed from the official scaffold
  workflow.yaml, config.staging.json, config.production.json, package.json (SDK pinned), src/, test/
```

No baseline CRE boilerplate is hand-written if `cre init` works. Template provenance (repository, commit, license) is recorded in PROVENANCE when used. Reference patterns: official `CRE-Confidential-bootcamp` (one batched `getSecrets`, in-enclave HTTP, deterministic guardrails, small JSON result); liquidation/audit-firewall domain logic is not reused.

## 17.3 Workflow = cohesive boundary; handlers = operations

Because a workflow has a single HTTP trigger, `identity-confidential` exposes one `handlerInTee` entry point that routes on an operation discriminator:

```text
trigger payload   {v:1, operation:"TRUST_ANCHOR_ADMISSION", runId, sealedContext:{nonce, ciphertext}}
router            operation → capabilities/<operation>/handler.ts ; unknown operation → ERROR, no calls
binding           operation and runId are bound as AES-GCM AAD, so a context sealed for one operation
                  cannot be replayed into another
future S002       operation:"SUBJECT_CONTINUITY" → capabilities/subject-continuity (not built in S001)
```

Per-operation guardrails live in the capability (HTTP host allowlist, call budget, output schema). Shared code (`shared/`) is limited to secrets, key schedule, sealed context, callback, Sumsub client/normalizer, safe logging. [UNCONFIRMED] whether the CRE workflow ID changes on redeploy; the API reads `CRE_WORKFLOW_ID` from configuration in any case.

## 17.4 `trust-anchor-admission` handler sequence

```text
0  preHook: HTTP call limit 4, maxSecrets 3, capability restriction CLOSED        (bootcamp pattern)
1  secrets = getSecrets([SUMSUB_APP_TOKEN, SUMSUB_SECRET_KEY, CATENOR_INTERNAL_API_TOKEN])   one batched call
2  keys    = HKDF-SHA256(CATENOR_INTERNAL_API_TOKEN, info = "ctx" | "cb" | "salt")
3  context = AES-256-GCM open(keys.ctx, sealedContext, aad = operation ‖ runId)
             → {sessionRef, runId, trustDomain, subjectDid, companyApplicantId, representativeApplicantId,
                companyBindingRef, representativeBindingRef, notAfter}; expired / mismatch → ERROR
4  HTTP #1  Sumsub GET company applicant (review status + companyInfo/beneficiaries)
   HTTP #2  Sumsub GET representative applicant (review status + membership)
5  PROVIDER-BINDING GATE: externalUserId == bindingRef for both; types company/individual
   → mismatch: callback {status:ERROR, code:PROVIDER_BINDING_MISMATCH}, no facts, stop
6  HTTP #3  Sumsub company registry check — ONLY if T0.8 shows registry status is not available from #1
7  normalize (allowlisted fields; unknown ignored; unparseable → null)
8  facts      = deriveFacts(normalized, config.acceptedEvidence, teeRuntime.now())        (§20.4)
9  commitment = evidenceCommitment(...)                                                     (§23)
10 [P1] report = teeRuntime.reportFromDon(SHA-256(JCS(resultEnvelope)))   (hash only reaches DON nodes)
11 HTTP #4  POST config.callbackUrl  resultEnvelope, HMAC(keys.cb)
12 return {status:"DELIVERED"|"FAILED", code}     (return value is DON-visible: no facts, no PII)
```

## 17.5 HTTP budget (documented limit: 5)

```text
#1 Sumsub company applicant       required
#2 Sumsub representative applicant required
#3 Sumsub company registry check  only if needed (T0.8)
#4 TEE → Catenor API callback     required
headroom                           ≥ 1 request; no request is reserved for an LLM (none exists in S001)
```

Errors at any step → callback `status: ERROR` with a code and **no facts** (fail closed). If the callback fails, the API run times out (U15) → non-ALLOW.

## 17.6 Public workflow config (safe to publish)

```json
{
  "callbackUrl": "https://<api-domain>/v1/internal/cre/identity-confidential/results",
  "sumsubBaseUrl": "https://api.sumsub.com",
  "httpRequestTimeout": "8s",
  "bootstrapConfigurationHash": "0x…",
  "acceptedEvidence": { "...": "identical to the bootstrap configuration" },
  "authorizedTriggerAddress": "0x…"
}
```

## 17.7 Implementation role: `cre-engineer` project subagent (maintainer amendment §19)

Before the first substantial CRE spike or implementation work, T0.6 creates `.claude/agents/cre-engineer.md` — a **Catenor One project subagent, not a Chainlink-provided agent** — for maintainer review.

```text
loads        chainlink-cre-skill (via subagent frontmatter if the installed Claude Code supports skill
             preloading; otherwise its first instruction is to read .agents/skills/chainlink-cre-skill/SKILL.md)
             + instruction to prefer live docs (docs.chain.link/cre/ts/llms-full.txt) where the local skill
             is outdated (§33 B7)
scope        CRE CLI; cre init / official scaffolding; TypeScript QuickJS/WASM compatibility; Confidential
             Workflows; handlerInTee; TeeRuntime; secrets / Vault DON; HTTPClient inside TEE; build;
             simulation; deployment; activation; invocation; execution inspection; CRE debugging;
             CRE security boundaries
must NOT     redefine Catenor Protocol semantics, the Canonical Subject model, Trust Anchor semantics,
redefine     Subject Continuity semantics, the authority / delegation model, policy semantics, or any S001
             SPEC requirement
ownership    the main agent owns protocol/application architecture decisions; cre-engineer implements
             approved decisions in CRE and reports STOP-GATE failures instead of working around them
```

---

# 18. Private input transport into `handlerInTee` (D10 approved; D11 approved conditionally)

Requirement: the Workflow DON must not receive applicant IDs or PII in plaintext (SPEC §26). The HTTP trigger payload is visible to Workflow DON nodes, and CRE documents no encrypted-trigger mechanism.

```text
API (Railway)                                             TEE
─────────────                                             ───
K = CATENOR_INTERNAL_API_TOKEN (sealed Railway var)       K = same value from Vault DON (getSecrets)
k_ctx = HKDF(K, "catenor-one/identity-confidential/ctx/v1")    same derivation
nonce = 12 CSPRNG bytes (API side has a CSPRNG)
ct = AES-256-GCM(k_ctx, nonce, JCS(context), aad = operation ‖ runId)
trigger {v, operation, runId, sealedContext:{nonce, ct}}  ────►  open; check runId, operation, notAfter (≤10 min)
```

Private context contents: `sessionRef`, `trustDomain`, `subjectDid`, Sumsub applicant IDs, expected bindingRefs, `notAfter`. DON nodes and CRE logs see only `operation`, `runId` and ciphertext. Nonces are generated only on the API side (the TEE decrypts; it never encrypts with AES-GCM in S001). The API accepts one result per run.

[STOP-GATE] T0.7 must confirm that `@noble/ciphers` AES-256-GCM (and `@noble/hashes` HKDF/HMAC) run correctly in the CRE QuickJS/WASM runtime inside `handlerInTee`. If not: **STOP and report.** The TEE→API context-fetch fallback changes the HTTP budget and threat model and requires explicit maintainer review first.

Trigger authentication: `workflows.execute` JSON-RPC with a JWT (`alg: ETH`, EIP-191, `digest` over the key-sorted body, `exp ≤ iat + 5 min`, unique `jti`) signed by `CRE_TRIGGER_PRIVATE_KEY` — a dedicated, **unfunded** EVM key used only for trigger authentication. Implemented in-house with `viem`; the official `cre-http-trigger` package (BUSL-1.1) is a behavioral reference only (PROVENANCE note).

---

# 19. CRE secret inventory

## 19.1 Vault DON — baseline S001: 3 persistent secrets

| Secret | Purpose | Also held by |
|---|---|---|
| `SUMSUB_APP_TOKEN` | Sumsub `X-App-Token` (sandbox) | nobody |
| `SUMSUB_SECRET_KEY` | Sumsub request HMAC | nobody |
| `CATENOR_INTERNAL_API_TOKEN` | approved shared root secret: HKDF → context key, callback HMAC key, commitment-salt key | Railway `apps/api` (sealed variable) |

Fetched in one batched `getSecrets` call. `secrets.yaml` maps each name to a `*_VAR` env var (harmless mitigation for a historical CLI substring bug). No additional long-lived CRE secret is added without explicit justification and approval.

## 19.2 Not Vault DON secrets

```text
Admission Policy, acceptedEvidence parameters   public (config + hash)
dynamic applicant IDs, bindingRefs              sealed per run, never long-lived
```

## 19.3 Railway `apps/api` variables (* = sealed)

```text
DATABASE_URL (reference)             ALLOWED_BOOTSTRAP_EMAILS         BOOTSTRAP_CONFIGURATION_HASH
PRIVY_APP_ID / PRIVY_APP_SECRET*     PRIVY_JWT_VERIFICATION_KEY
CATENOR_ASSERTION_AUTHORIZATION_KEY* CATENOR_BOOTSTRAP_AUTHORIZATION_KEY*
CATENOR_INTERNAL_API_TOKEN*          CRE_TRIGGER_PRIVATE_KEY*         CRE_WORKFLOW_ID   CRE_GATEWAY_URL
OPERATOR_REF_KEY*                    ETHEREUM_MAINNET_RPC_URL (P1 report verification only, read-only)
```

---

# 20. Sumsub mapping (D6, D7 approved; exact fields confirmed by T0.8)

Source: current Sumsub docs (Appendix A.3). All calls from the TEE. **Nothing below is hardcoded until T0.8 confirms it against real sandbox responses.**

## 20.1 Authentication (documented)

```text
base URL   https://api.sumsub.com (sandbox vs production selected by the token)
headers    X-App-Token, X-App-Access-Ts (unix seconds), X-App-Access-Sig, Content-Type: application/json
signature  hex(HMAC-SHA256(SUMSUB_SECRET_KEY, ts + METHOD + pathWithQuery + body))   (@noble/hashes)
clock      ±60 s → teeRuntime.now()
errors     4001 / 4003 / 4004 / timeout / 5xx → status ERROR, no facts (AC-021, AC-022, TV-E04/E05)
```

## 20.2 Candidate endpoints (to confirm in T0.8)

| # | Endpoint (documented) | Intended fields |
|---|---|---|
| 1 | `GET /resources/applicants/{companyId}/one` | `type`, `externalUserId`, `review.{reviewStatus, levelName, reviewDate, reviewResult.{reviewAnswer, reviewRejectType, rejectLabels}}`, `info.companyInfo.beneficiaries[].{applicantId, types}` |
| 2 | `GET /resources/applicants/{representativeId}/one` | `type`, `externalUserId`, `review.*`, `memberOf[].applicantId` |
| 3 | `GET /resources/checks/latest?type=COMPANY&applicantId={companyId}` (only if needed) | `checks[].{answer, createdAt}`, `companyCheckInfo.status` |

## 20.3 Spike T0.8 must confirm

```text
company applicant behavior (KYB 2.0 level, type "company", review lifecycle)
representative linking (beneficiary types; memberOf back-reference)
testCompleted support for company AND individual applicants; GREEN and RED (incl. AML labels) behavior
actual field shapes/formats (dates, status strings, label values) and response sizes (< 100 KB)
relevant company-check responses (registry status) and whether call #3 is needed
externalUserId allowed charset for bindingRefs
which representative-role evidence the sandbox/KYB mode actually provides
```

## 20.4 Deterministic fact derivation (target rules; finalized after T0.8)

| Fact | Target rule (any unparseable input → `null` = MISSING) |
|---|---|
| `ORGANIZATION_KYB_VERIFIED` | binding gate passed ∧ company completed ∧ GREEN ∧ `levelName ∈ companyLevelNames` |
| `ORGANIZATION_STATUS_VALID` | registry status ∈ `activeRegistryStatuses` ∧ no inactive-entity reject label (source per T0.8) |
| `ORGANIZATION_AML_CLEAR` | company completed + GREEN ∧ `rejectLabels ∩ amlRejectLabels = ∅` ∧ not on hold |
| `AUTHORIZED_REPRESENTATIVE_VERIFIED` | binding gate passed ∧ representative completed ∧ GREEN ∧ `levelName ∈ representativeLevelNames` |
| `REPRESENTATIVE_AUTHORITY_CONFIRMED` | company ↔ representative linkage (beneficiary with `applicantId` + accepted role ∈ `authorityRoles`) ∧ reverse membership where available ∧ `ORGANIZATION_KYB_VERIFIED` ∧ `AUTHORIZED_REPRESENTATIVE_VERIFIED` |
| `EVIDENCE_FRESH` | `now − reviewDate ≤ evidenceMaxAgeDays` (180, [REF-IMPL]) for company AND representative |

RED (RETRY or FINAL), pending, queued, on hold, awaiting user → `false` (a present, deterministic "not verified").

## 20.5 Representative-authority limitation (D7)

Deterministic provider evidence only. Sumsub documents that roles such as `representative` / `director` are *verified by Sumsub* only under Expert-assisted (Full) KYB; otherwise they are declared data. If the sandbox/KYB mode used cannot provider-verifiably establish the role, S001 does **not** fake certainty: it uses the strongest evidence actually available (e.g., linkage + both applicants GREEN under the accepted level), states the exact evidence class in PLAN (updated after T0.8), and shows the limitation in the Judge Inspector and artifacts.

## 20.6 Demo onboarding and the live DENY case

```text
environment        Sumsub SANDBOX token — real API calls, synthetic Organization / representative data
                   (all docs + Judge Inspector say "Sumsub sandbox"; never implies production KYB)
onboarding         operator creates applicants with externalUserId = Catenor bindingRef (§4.2), links the
                   representative, forces reviews with testCompleted where T0.8 confirms support
happy case         synthetic company + representative, both GREEN
evidence DENY      a second synthetic company forced RED with an AML label, or an inactive-registry mock
                   company — whichever T0.8 confirms (TV-L03 allows a labeled fixture if neither works)
```

---

# 21. LLM role — REMOVED from S001 (D8)

S001 has **no LLM**: no Anthropic/Claude or other provider integration, no LLM secret, no LLM HTTP request, no LLM modes, fields, artifacts, tests, tasks or dependencies. All eight Admission Policy facts are derived deterministically (§14, §20.4).

LLM-inside-TEE remains a **future technique for S002 Subject Continuity**, to be considered only if unstructured or ambiguous private evidence actually requires semantic interpretation; it will be specified in that slice, not here. SPEC / ACCEPTANCE / TEST-VECTORS were aligned in T0.9 (Appendix E): LLM criteria and vectors are retired, not reused.

---

# 22. Admission Policy implementation

`packages/policy/policies/trust-anchor-admission.v1.json` — faithful JSON rendering of SPEC §17, conforming to protocol `policy.schema.json`:

```json
{
  "id": "policy:trust-anchor-admission:v1",
  "action": "ADMIT_TRUST_ANCHOR",
  "requirements": [
    { "claim": "ORGANIZATION_KYB_VERIFIED", "equals": true },
    { "claim": "ORGANIZATION_STATUS_VALID", "equals": true },
    { "claim": "ORGANIZATION_AML_CLEAR", "equals": true },
    { "claim": "AUTHORIZED_REPRESENTATIVE_VERIFIED", "equals": true },
    { "claim": "REPRESENTATIVE_AUTHORITY_CONFIRMED", "equals": true },
    { "claim": "ASSERTION_KEY_POSSESSION_VALID", "equals": true },
    { "claim": "ASSERTION_KEY_PURPOSE_VALID", "equals": true },
    { "claim": "EVIDENCE_FRESH", "equals": true }
  ],
  "decision": { "allRequirementsSatisfied": "ALLOW", "otherwise": "DENY" }
}
```

`policyHash = commit(file)`, computed in CI, recorded in the Bootstrap Configuration, asserted by a test (AC-039).

Evaluation (U9):

```text
1 load policy; recompute hash; must equal bootstrap.admissionPolicyHash   else ERROR (TV-B02)
2 FactSet = key verifier (2 facts) + accepted run result (6 facts); anything else dropped (TV-F11)
3 evaluate() (§3.4) → Decision {policy, subject, action, resource: trustDomain, decision, evaluatedAt, evidenceCommitment}
4 persist DecisionRecord + DecisionTrace (FALSE vs MISSING kept distinct); ALLOW → DecisionProjection
```

---

# 23. Evidence commitment strategy

Computed inside the TEE; **recomputable from Catenor private state** without retaining any provider evidence:

```text
commitmentInput = {
  profile: "catenor-one/evidence-commitment/v1",
  salt,                                   // HMAC-SHA256(HKDF(K,"salt"), runId) — TEE has no CSPRNG
  operation, runId, sessionRef, trustDomain, subject, bootstrapConfigurationHash,
  providerEnvironment: "sandbox", observedAt,
  providerRefDigests: { company: SHA-256(applicantId), representative: SHA-256(applicantId) },
  responseDigests:    { companyApplicant, representativeApplicant, companyCheck? },   // SHA-256 of raw bytes
  facts:              { …6 evidence facts… }
}
evidenceCommitment = 0x + hex(SHA-256(JCS(commitmentInput)))
```

```text
binding    ties Decision / endorsement / record to this exact confidential run, its facts and the exact
           provider responses (by digest) without revealing them
hiding     the 256-bit salt prevents brute-forcing the low-entropy fact set (protocol Commitments §3)
recompute  the callback carries commitmentInput minus salt; the API re-derives the salt from K,
           recomputes the commitment (must match, else the result is rejected) and stores only the
           normalized preimage privately (facts, digests, observedAt, run metadata — no provider content;
           the salt is not stored, it is re-derivable by holders of K)
limits     raw responses are not retained; provider evidence can only be re-obtained by authorized
           re-verification with Sumsub through the private provider references
```

Semantics (maintainer wording correction):

> The commitment can be recomputed against the retained normalized commitment preimage and provider-response digests. It binds the Admission to what was observed during confidential execution, but does not preserve or reconstruct the raw provider evidence.

Only the minimum private data needed for these semantics is retained; the no-raw-evidence rule is not weakened.

---

# 24. Evidence retention strategy — COMMITMENT_ONLY (D13)

The custom `catenor-one/evidence-ecies/v1` scheme is **rejected**; S001 invents no cryptography for evidence retention.

```text
TEE        provider responses remain private in enclave memory
           → deterministic normalization / fact derivation → evidenceCommitment
           → only the minimized result leaves the TEE
Catenor    PostgreSQL private state: provider references + bindings, admission metadata, verified fact
stores     results, commitment inputs (digests only), decision reference, evidenceCommitment, CRE execution
           reference
Catenor    raw Sumsub responses, raw PII, private provider evidence snapshots — in any store, log or artifact
never
bucket     not written in S001 (§12)
```

This is SPEC §25's safe fallback and satisfies AC-056 and AC-058 (P0). AC-057 (P1, encrypted retention) is not implemented in S001, and AC-059 / TV-I05 are vacuously satisfied because no ciphertext or decryption key exists. Appendix E proposes the corresponding source-of-truth wording.

---

# 25. Audit model

## 25.1 Event shape (protocol `audit-event.schema.json`; extra properties allowed)

```json
{ "type": "POLICY_EVALUATED", "subject": "did:catenor:…", "timestamp": "…",
  "requestId": "admission-session:<ref>",
  "details": { "decision": "DENY", "falseRequirements": ["ORGANIZATION_AML_CLEAR"], "missingRequirements": [] },
  "prevHash": "0x…", "eventHash": "0x…" }
```

`details` is built from typed, allowlisted fields per event type — never free-form provider strings, applicant IDs or bindingRefs.

## 25.2 Vocabulary

| Protocol / SPEC §27 | Catenor One extensions [REF-IMPL] |
|---|---|
| `SUBJECT_CREATED`, `KEY_ADDED`, `DID_DOCUMENT_CREATED`, `ADMISSION_REQUESTED`, `KEY_POSSESSION_VERIFIED`, `CONFIDENTIAL_EVIDENCE_VERIFIED`, `POLICY_EVALUATED`, `BOOTSTRAP_ENDORSEMENT_CREATED`, `TRUST_ANCHOR_ADMITTED`, `TRUST_ANCHOR_ADMISSION_DENIED` | `BOOTSTRAP_ACCESS_DENIED`, `PROVIDER_REFERENCES_ATTACHED`, `KEY_POSSESSION_FAILED`, `CONFIDENTIAL_VERIFICATION_REQUESTED`, `CONFIDENTIAL_VERIFICATION_FAILED` (incl. `PROVIDER_BINDING_MISMATCH`), `ADMISSION_ALREADY_ADMITTED` |

## 25.3 Persistence (D16)

```text
append-only AuditEvent table; per-trust-domain hash chain computed in the application (P0)
Postgres trigger rejecting UPDATE/DELETE (P1, T3.5 — off the fast lane)
written in the same transaction as the state change (UnitOfWork)
judge/public timeline = sanitized projection with chain-continuity check
```

The chain makes silent edits detectable; it is not a third-party anchor (Open J remains open).

---

# 26. Trust Anchor verification

## 26.1 What S001 can and cannot prove (maintainer amendment §18)

> **S001 cryptographically verifies Admission provenance and bootstrap endorsement, while current lifecycle status is read from the Catenor One operational status projection.**

S001 does **not** claim that every aspect of current Trust Anchor status is cryptographically proven. A later slice/protocol profile can make status and revocation independently verifiable.

## 26.2 Checks (`TrustAnchorVerifier`, pure; used by U13 and `scripts/verify-trust-anchor.ts`, which relies only on public API responses + the committed bootstrap configuration + its pinned hash)

| # | SPEC §27 check | Implementation | Basis |
|---|---|---|---|
| 1 | recognized Bootstrap Configuration | `commit(config) == pinned BOOTSTRAP_CONFIGURATION_HASH` | CRYPTOGRAPHIC (trust root = out-of-band pin) |
| 2 | resolvable candidate DID | resolver 200, not deactivated | OPERATIONAL |
| 3 | valid DID Document | id match, controller == DID, Multikey decodes, no private fields | STRUCTURAL |
| 4 | valid assertion VM | VM ∈ document ∧ ∈ assertionMethod ∧ `commit({id, controller, type, publicKeyMultibase}) == endorsement.verificationMethodCommitment` | CRYPTOGRAPHIC (complete VM bound by endorsement) |
| 5 | matching Admission Record | exists for (trustDomain, DID) | OPERATIONAL |
| 6 | matching Trust Domain | record.trustDomain == endorsed == config | CRYPTOGRAPHIC |
| 7 | identifiable policy/version | record.admissionPolicy == endorsed == config; policy resolvable | CRYPTOGRAPHIC |
| 8 | matching policy hash | `commit(policy) == record.policyHash == endorsed == config.admissionPolicyHash` | CRYPTOGRAPHIC |
| 9 | successful Decision | Decision(decisionRef).decision == ALLOW; fields match; `commit(Decision) == endorsement.decisionCommitment` | CRYPTOGRAPHIC |
| 10 | valid bootstrap endorsement | Ed25519 verify with `config.bootstrapPublicKeyMultibase`; every endorsed field == record field | CRYPTOGRAPHIC |
| 11 | ACTIVE status | status projection == ACTIVE | OPERATIONAL PROJECTION |
| 12 | non-revoked verification state | VM status ACTIVE ∧ Subject lifecycle ACTIVE | OPERATIONAL PROJECTION |

Output: `{TRUST_ANCHOR_VALID, admissionProvenanceVerified, lifecycleStatusSource: "catenor-one-operational-projection", checks[{id, passed, basis, reason}]}`. `TRUST_ANCHOR_VALID` requires all 12. Tampering with any endorsement-bound field (TV-J02/J03) fails 10 (and 4/6–9 as applicable); a Verification Method key replaced under the same ID (TV-J07) fails 4; a missing endorsement (J04) fails 10; non-ACTIVE status (J05/J06) fails 11. The UI and artifacts present checks 11–12 as operational, per §26.1.

---

# 27. Test-vector mapping

Legend — **U** unit (framework-free) · **A** application (use cases + in-memory fake ports) · **I** integration (real Postgres via Testcontainers or staging, real Privy dev app, workflow unit tests) · **S** CRE simulation · **L** live deployment evidence · **E** end-to-end (Playwright) · **M** manual deployment/config review · **J** Judge Inspector.

Golden inputs live in `test-vectors/s001/*.json`, shared by packages, api and workflow tests.

## A. Bootstrap Access

| TV | Verification | Where / how | Task |
|---|---|---|---|
| A01 | A + E + L | allowlisted email → session + bindingRefs created, no facts set, status not ACTIVE; Playwright; live operator run | T4.3, T4.4, T13.2, T16.3 |
| A02 | A + E + J | outsider → 403; no Subject/session/binding/record/endorsement rows; UI hides list; judge scenario | T4.3, T13.2, T14.2 |
| A03 | A | allowlisted operator + AML=false fact set → DENY; type-level: gate result cannot enter FactSet | T4.3, T10.2 |

## B. Bootstrap Configuration

| TV | Verification | Where / how | Task |
|---|---|---|---|
| B01 | U + A + M | config parse/hash; API boot check with correct pin; manual review of committed config vs Railway pin | T7.1, T7.2, T15.3 |
| B02 | U + A | policy altered / pin mismatch → evaluation ERROR, U10 refuses, no ACTIVE | T7.2, T10.2, T11.2 |
| B03 | U + A | valid self-signed "I am a Trust Anchor" + no Decision/endorsement → activation rejected; no API accepts self-assertions | T2.6, T11.2 |

## C. Canonical Identity

| TV | Verification | Where / how | Task |
|---|---|---|---|
| C01 | U + A | DID regex/length; generator consumes only random bytes; DID excludes legal name / applicant IDs / email; applicant IDs not even present at DID creation (U2 takes none) | T2.2, T4.4 |
| C02 | U + A | same legal name → different DIDs | T2.2, T4.4 |
| C03 | U + I + J | DidDocument VO field allowlist; leak-sentinel crawl of `/v1/dids/*`; judge view | T2.2, T5.4, T14.2 |

## D. Assertion Key / Proof of Possession

| TV | Verification | Where / how | Task |
|---|---|---|---|
| D01 | U + A + I + L | verifier with noble key; U6 with fake signer; real Privy signer (after T0.5); live happy run | T2.7, T6.2, T5.2, T16.3 |
| D02 | U + A + E + L + J | unrelated key → POSSESSION false → DENY, no endorsement/ACTIVE; browser wrong-key demo; live (L02) | T2.7, T6.2, T13.3, T17.1 |
| D03 | U + A | fixed clock 22:06 vs expiresAt 22:05 → false with valid signature | T2.7, T6.2 |
| D04 | U + I | second submission rejected; concurrent double submit on real Postgres → exactly one success | T2.7, T6.3 |
| D05 | U + A | challenge for DID A used for DID B → false | T2.7, T6.2 |
| D06 | U | `#authentication-key-1` not in assertionMethod → PURPOSE false → DENY | T2.7 |

## E. Chainlink CRE (identity-confidential) + Sumsub

| TV | Verification | Where / how | Task |
|---|---|---|---|
| E01 | S + U | `cre workflow simulate identity-confidential … --http-payload fixtures/tta-happy.sealed.json` with MOCK Sumsub → 6 facts true + commitment; `derive-facts` unit tests on the same fixture | T8.4, T8.6 |
| E02 | S + U | AML RED fixture → AML false → DENY at API | T8.4, T8.6 |
| E03 | L | deployed workflow, Sumsub sandbox, Vault secrets → execution ID, sanitized events, minimized result; MOCK rejected by run metadata | T16.2, T16.3 |
| E04 | U + S + I | bad token / secret / signature → ERROR, no facts; simulation with wrong `.env` secret; API never reaches ALLOW | T8.3, T8.6, T9.3 |
| E05 | U + S + A | timeout / 5xx / unparseable → ERROR or null facts; API run TIMED_OUT → never ALLOW | T8.3, T8.6, T9.4 |
| E06 | U + S + I | synthetic response with `PRIVATE_FIXTURE_123` → absent from callback, return value, logs, DB, artifacts | T8.5, T8.6, T17.3 |
| E07 | M + I | `secrets.yaml` lists exactly the 3 names; secret scanner over repo, artifacts, captured logs | T8.1, T17.3 |
| E08 | — | **RETIRED** (T0.9). No test | — |
| E09 | — | **RETIRED** (T0.9). Intent covered by F06 / derive-facts "missing linkage" tests | — |
| E10 | — | **RETIRED** (T0.9). No test | — |
| E11 | U + S + A (+ L P1) | provider-binding mismatch: binding gate unit tests; `tta-binding-mismatch` simulation; U8 stores no facts, binding status MISMATCH, run ERROR, never ALLOW; optional live run | T8.4, T8.6, T9.3, T17.4 |

## F. Admission Policy

| TV | Verification | Task |
|---|---|---|
| F01 | U evaluator → ALLOW; A full flow; E happy path; L live happy | T2.5, T10.2, T13.2, T16.3 |
| F02 | U: KYB false → DENY; U: company RED fixture in derive-facts | T2.5, T8.4 |
| F03 | U: status invalid → DENY; U: inactive-registry fixture | T2.5, T8.4 |
| F04 | U: AML false → DENY; A; S (E02); L (L03) | T2.5, T10.2, T8.6, T17.2 |
| F05 | U: representative unverified → DENY; U: representative RED fixture | T2.5, T8.4 |
| F06 | U: identity true + authority false → DENY; U: missing linkage / non-accepted role fixtures | T2.5, T8.4 |
| F07 | U: possession false → DENY; A/E/L via D02/L02 | T2.5, T6.2, T17.1 |
| F08 | U: purpose false → DENY; via D06 | T2.5, T2.7 |
| F09 | U: stale → DENY; U: reviewDate > 180 days fixture | T2.5, T8.4 |
| F10 | U: missing AML → DENY; trace status MISSING (≠ FALSE) | T2.5 |
| F11 | U: unknown `SUPER_TRUSTED_BY_UI=true` dropped; AML false → DENY | T2.5 |
| F12 | **RETIRED** (T0.9). Its generic intent is covered by F11 plus the callback strict-schema test (unknown fields rejected) in T9.3 | — |

## G. Bootstrap Endorsement

| TV | Verification | Where / how | Task |
|---|---|---|---|
| G01 | U + A + I + L | endorse ALLOW → verify true (noble in U; Privy bootstrap signer in I/L) | T2.6, T11.2, T5.3, T16.3 |
| G02 | U + A | DENY → `canEndorse` false; U10 → 409; no endorsement row | T2.6, T11.2 |
| G03 | U | endorsement for DID A vs record for DID B → false | T2.6 |
| G04 | U | endorsement policyHash vs altered record → false | T2.6 |
| G05 | U | non-bootstrap key signature → false | T2.6 |
| G06 | U + A | VM key replaced under the same ID before activation → `verificationMethodCommitment` mismatch → activation rejected | T2.6, T11.2 |

## H. Admission Record / Activation

| TV | Verification | Where / how | Task |
|---|---|---|---|
| H01 | A + I + L + J | record matches SPEC shape (+ D14 fields); status ACTIVE; public projection snapshot; live artifact | T11.2, T11.3, T16.3, T14.2 |
| H02 | A + I | DENY → no record, status ≠ ACTIVE; DecisionRecord + audit exist | T11.2 |
| H03 | U + A | ALLOW without endorsement → refused | T2.6, T11.2 |

## I. Storage / Privacy

| TV | Verification | Where / how | Task |
|---|---|---|---|
| I01 | I + E | leak-sentinel crawl of every public + judge route (applicant IDs **and bindingRefs**) | T5.4, T12.3, T17.3 |
| I02 | M | Railway review: no Postgres TCP proxy (saved `railway tcp-proxy list`), internal `DATABASE_URL`, public state via API only | T15.2 |
| I03 | I + S | `RAW_SECRET_DOCUMENT_VALUE_001` through simulation → absent from Postgres text columns, logs, callback; no bucket object written | T8.6, T9.3, T17.3 |
| I04 | U + A | retention mode always `COMMITMENT_ONLY`: no bucket write; facts + normalized preimage/digests + provider refs kept; commitment recomputes | T8.5, T9.3 |
| I05 | M | **not applicable to S001**: review confirms no evidence objects / decryption keys exist | T15.2 |
| I06 | I + M | private-key/secret scanner over repo, staging DB dump, logs, `artifacts/` | T17.3 |

## J. Trust Anchor Verification

| TV | Verification | Where / how | Task |
|---|---|---|---|
| J01 | U + A + E + L + J | 12 checks pass; API; offline verifier against live API → true (artifact); UI shows crypto vs operational basis | T2.8, T12.1, T12.3, T16.3 |
| J02 | U + I | mutate `evidenceCommitment` → check 10 fails → false | T2.8, T12.2 |
| J03 | U + I | mutate `policyHash` → checks 8/10 fail → false | T2.8, T12.2 |
| J04 | U | no endorsement → false | T2.8 |
| J05 | U + A | SUSPENDED (test harness only, D21) → false | T2.8, T12.2 |
| J06 | U + A | REVOKED / DEACTIVATED → false | T2.8, T12.2 |
| J07 | U + I | VM key replaced under the same ID after admission → check 4 fails → false | T2.8, T12.2 |

## K. Idempotency / Lifecycle

| TV | Verification | Where / how | Task |
|---|---|---|---|
| K01 | A + I | retry for ACTIVE Subject → `ALREADY_ADMITTED`; concurrent U10 → one root | T11.4 |
| K02 | A + E | DENY session stays auditable; new session for same Subject may ALLOW | T11.4, T13.2 |

## L. Live Hackathon Integration

| TV | Verification | Where / how | Task |
|---|---|---|---|
| L01 | L + E + J | full live run (18 steps incl. bindingRefs + attach): Railway + deployed `identity-confidential` + Privy + Sumsub sandbox | T16.3, T18.1 |
| L02 | L + J | live wrong-key proof → DENY, no endorsement/record/ACTIVE, verification false | T17.1 |
| L03 | L + J (or labeled fixture) | sandbox company forced RED/AML or inactive registry → DENY | T17.2 |

## Coverage of TEST-VECTORS §12–15

```text
§13 automated set   → U/A/I rows above (incl. unknown-input F11, binding mismatch E11, VM key replacement G06/J07)
§14 simulation set  → E01, E02, E04, E05, E06, E11 in T8.6 (3 secrets, sealed context, in-TEE HTTPS mock path)
§15 live set        → T16.3 (L01 + E03 + J01), T17.1 (L02); L03 strongly preferred (T17.2)
```

All 65 vector IDs appear above (A3, B3, C3, D6, E11, F12, G6, H3, I6, J7, K2, L3): 60 active, 4 RETIRED (E08, E09, E10, F12) and 1 not applicable to S001 (I05).

---

# 28. CRE simulation plan

Run from the CRE project root `workflows/`, always non-interactive:

```bash
cre workflow simulate identity-confidential \
  --target staging-settings --non-interactive --trigger-index 0 \
  --http-payload fixtures/<case>.sealed.json
```

| Case | Providers | Expected | AC / TV |
|---|---|---|---|
| tta-happy | MOCK Sumsub (local mock server; localhost only reachable in simulation) | 6 facts true, commitment, callback to local API stub | AC-028, E01 |
| tta-aml-deny | MOCK, company RED + AML label | AML false → DENY at API | AC-028, E02 |
| tta-binding-mismatch | MOCK, wrong `externalUserId` | ERROR `PROVIDER_BINDING_MISMATCH`, no facts | Rev 2 negative |
| tta-auth-fail | MOCK 4003 / wrong `.env` secret | ERROR, no facts | E04 |
| tta-unavailable | MOCK timeout / 5xx | ERROR, no facts | E05 |
| tta-leak | MOCK payload with `PRIVATE_FIXTURE_123`, `RAW_SECRET_DOCUMENT_VALUE_001` | absent from callback / return / logs | E06, I03 |
| tta-unknown-operation | sealed payload with unknown `operation` | ERROR, zero provider calls | router guard |
| tta-sandbox | REAL Sumsub sandbox from the developer machine | real facts; labeled "simulation against Sumsub sandbox" — not deployment evidence | pre-deploy confidence |

`handlerInTee` runs in the local simulator, **not** a real TEE; artifacts say so. `fixtures/seal-context.ts` builds sealed payloads from the local `.env` channel secret. Outputs pass the sanitizer (T18.2) before being saved.

---

# 29. Real CRE deployment plan

## 29.1 Prerequisites [HUMAN] — start immediately

```text
1 cre login; cre whoami → "Deploy Access: Enabled"
2 Confidential Workflows private-beta enrollment (docs.chain.link/cre/account/confidential-workflows-access)
3 PRIVATE registry available to the organization (D9). The Ethereum-mainnet registry is NOT used unless the
  private registry is unavailable AND the maintainer approves.
4 Sumsub sandbox token (read + testCompleted permissions)
```

Real CRE deployment is mandatory for S001 completion; simulation is necessary but not sufficient (AC-029). If enrollment is not granted, the blocker is escalated; nothing is substituted.

## 29.2 Steps

```text
1 cre secrets create workflows/secrets.yaml --target production-settings --secrets-auth=browser   (3 secrets)
2 fill config.production.json (callback URL = Railway API domain, bootstrapConfigurationHash, acceptedEvidence,
  authorizedTriggerAddress)
3 cre workflow deploy identity-confidential --target production-settings --yes      (private registry)
4 cre workflow get identity-confidential --target production-settings    → workflow ID, status
5 set CRE_WORKFLOW_ID + CRE_GATEWAY_URL on Railway apps/api; redeploy
6 smoke run → cre execution status/events <uuid> --json
7 live runs: happy (L01), wrong key (L02; no CRE call), evidence DENY (L03)
8 capture: workflow ID, registry, binary/config URLs, CLI/SDK versions, execution IDs, sanitized
  cre execution JSON, CRE UI screenshots
```

## 29.3 Railway (D19: dashboard configuration)

```text
services   web (apps/web), api (apps/api), Postgres; no bucket in S001 (§12, Q3) — environments staging + production
build      Railpack + pnpm filters; root dirs apps/web, apps/api; watch paths
api        pre-deploy: prisma migrate deploy; healthcheck GET /v1/health
review     no Postgres TCP proxy; sealed variables; settings documented in docs/integrations (railway.json/toml
           deprecated; IaC not needed for S001)
```

## 29.4 Post-live hygiene

Pause (not delete) after judging if quotas require; keep the workflow ID resolvable. Rotate `CATENOR_INTERNAL_API_TOKEN` and the Sumsub token after the event.

---

# 30. Sponsor / judge artifact plan

```text
artifacts/chainlink/s001/
  README.md                      simulation vs deployment separated; workflow identity-confidential / operation trust-anchor-admission
  versions.txt                   cre CLI, @chainlink/cre-sdk, bun, template reference
  simulation-happy.txt, simulation-deny.txt, simulation-negative.txt   (MOCK labeled; simulator ≠ TEE)
  deployment.txt                 workflow ID, private registry, binary/config URLs (sanitized)
  live-happy.json, live-deny-evidence.json   execution IDs, status, sanitized events, minimized result, commitment
  don-report-verification.json   [P1]
  screenshots/

artifacts/privy/s001/
  assertion-signer-evidence.md, policy-assert.json, denied-transaction-attempt.txt, bootstrap-signer-evidence.md

artifacts/judges/s001/
  README.md (updated), trust-anchor-flow.html (labeled visualization)
  bootstrap-configuration.json (+ hash), admission-policy-v1.json (+ hash), did-document.json
  decision-allow.json, decision-deny-*.json, bootstrap-endorsement.json, admission-record.json
  verification-true.json, verification-false-tampered.json   (crypto vs operational basis shown)
  audit-timeline-happy.json, audit-timeline-deny.json
  integrations/sumsub-evidence.md   "Sumsub sandbox — synthetic organization"; endpoints used; no IDs/PII;
                                    representative-authority evidence class + limitation
```

No LLM artifacts exist. Everything passes the sanitizer + secret scanner (T18.2) before commit (TEST-VECTORS §11).

---

# 31. Privacy / security review

## 31.1 Data-flow classification

| Data | May exist | Never |
|---|---|---|
| applicant IDs | private DB, sealed trigger ciphertext, TEE memory | public API, judge view, logs, DON-visible payloads, artifacts |
| bindingRefs | private DB, operator view, Sumsub `externalUserId`, sealed context | public API, judge view, logs, artifacts |
| provider responses | TEE memory only (digests in commitment) | API, DB, bucket, logs |
| operator email | Privy, request-scoped memory | DB, logs, audit |
| CRE secrets | Vault DON, TEE memory; channel secret also sealed Railway var | Git, logs, artifacts |
| assertion / bootstrap private keys | Privy TEE | anywhere else |

## 31.2 Threats and mitigations

| Threat | Mitigation | Residual |
|---|---|---|
| Operational DB tampering | endorsement signature binds record fields + `verificationMethodCommitment`; pinned config; verifier fails | lifecycle status is an operational projection (§26.1) |
| Forged TEE result | HMAC with Vault-derived key, single-use runId, schema + echo checks, commitment recomputation; [P1] DON-signed report | channel secret also on Railway → a compromised API could forge results until the P1 report is in place |
| Applicant substitution | Catenor-issued bindingRef as `externalUserId`, verified inside the TEE before any fact derivation; company ↔ representative cross-link | — |
| Backend signs a bogus endorsement | separate bootstrap authorization key; human-initiated endpoint; audit | fully compromised API holding both keys can endorse — documented hackathon limitation; quorum later |
| Assertion key used as execution key | Privy policy: 64-byte `signMessage` only (artifact: denied transaction) | address can receive funds |
| TEE log leakage | no dynamic logging; `safeLog` enum codes; lint rule | — |
| Public workflow config / DON-visible return | no secrets in config; return `{status, code}`; report carries a hash only | — |
| Challenge replay | single-use conditional update, TTL, DID/VM/operation binding | — |
| Trigger replay / cross-operation replay | JWT exp ≤ 5 min + jti; `notAfter`; AAD = operation ‖ runId; one result per run | CRE rate limit 1/60 s |
| No CSPRNG in TEE | TEE never encrypts; only derives salt via HMAC(HKDF(K), runId); nonces generated by the API | — |
| SSRF from TEE | hosts fixed per capability; preHook call limit | — |
| Public DB exposure | no TCP proxy; internal `DATABASE_URL` | — |
| Secrets in Railway build logs | sealed variables; no echo in build scripts | Railway documents no log redaction |

## 31.3 Claims the demo may make

Only artifact-backed claims: "Sumsub **sandbox** was called over HTTPS from inside a deployed CRE Confidential Workflow (TEE)", "only minimized facts and a commitment left the TEE", "Catenor never stored raw provider data", "admission provenance and bootstrap endorsement are cryptographically verifiable; current lifecycle status comes from the operational projection". Not claimed: production KYB of a real company; downloadable TEE attestation documents; use of the Confidential HTTP product; any LLM involvement.

---

# 32. Implementation sequence

The P0 Fast Lane (§0) is the execution order. Phases:

```text
Phase 0  human gates + subagent + spikes   approvals, CRE access, accounts, keys, cre-engineer subagent,
                                           [STOP-GATE] Privy spike, [STOP-GATE] CRE runtime spike, Sumsub spike,
                                           source-of-truth cleanup
Phase 1  foundation                        pnpm monorepo, TS, lint, Vitest, dependency-cruiser, CI
Phase 2  domain packages                   audit → identity → credentials → policy → authority (+ golden vectors)
Phase 3  persistence                       Prisma schema (human review), repositories, projections
Phase 4  API + access gate + bindings      Privy auth, allowlist, StartInitialAdmission, AttachProviderReferences
Phase 5  key management + DID state        Privy signers, ProvisionAssertionKey, resolver
Phase 6  key possession
Phase 7  bootstrap configuration + policy publication
Phase 8  identity-confidential workflow    cre init scaffold, router, sealed context, Sumsub, binding gate,
                                           facts, commitment, callback, simulation
Phase 9  API ↔ CRE integration
Phase 10 policy evaluation
Phase 11 endorsement + activation
Phase 12 verification
Phase 13 product UI
Phase 14 Judge Inspector
Phase 15 Railway deployment
Phase 16 real CRE deployment + live happy path
Phase 17 live negative paths + privacy scans
Phase 18 artifacts, provenance, docs, ADRs
```

Critical path: **CRE beta access + T0.7 → Phase 8 → Phase 16**. Phases 1–7 and 10–14 proceed in parallel. Local development uses a FAKE `ConfidentialEvidenceVerifier` (labeled FAKE in state and UI) that cannot be selected in production configuration.

---

# 33. Open questions / decisions requiring human approval

## 33.1 Blockers and gates

| ID | Item | Impact | Handling |
|---|---|---|---|
| B1 | CRE Confidential Workflows private beta + deploy access + **private registry** availability [HUMAN] | AC-029/030, TV-E03/L01 impossible without it | **Status 2026-09-10 (maintainer, from Chainlink Labs contact):** deploy access enabled and private registry available; Confidential Workflows enrollment form submitted, org in Chainlink's queue ("todo", typical turnaround ≈24 h). Still open until enrollment is confirmed. Never substitute simulation; mainnet registry only with maintainer approval |
| B2 | Privy Ed25519 signing semantics [STOP-GATE T0.5] | assertion + bootstrap signers, crypto profile D3 | if the spike fails → STOP and report; no silent fallback |
| B3 | `@noble/ciphers` AES-GCM + `@noble/hashes` in CRE QuickJS inside `handlerInTee` [STOP-GATE T0.7] | sealed private context (D11) | if it fails → STOP and report; context-fetch fallback only after maintainer review |
| B4 | Sumsub sandbox semantics (company `testCompleted`, linkage fields, role-verification strength, registry status source) [T0.8] | fact rules §20.4, live DENY case, representative-authority strength | no provider semantics hardcoded before the spike; limitation documented if role is not provider-verified |
| B5 | Source-of-truth documents required the LLM (`LLM_API_KEY`, AC-031–034/041/072, TV-E08–E10/F12, SPEC §16/§36) | implementation would have contradicted the SPEC | **RESOLVED in T0.9** (2026-09-10): Appendix E applied; pending maintainer review of the edits |
| B6 | HTTP budget: documented `HTTPAction.CallLimit` = 5 | design headroom | design uses ≤ 4 (§17.5); per-request `timeout` behavior in TeeRuntime measured in T0.7 |
| B7 | Local `chainlink-cre-skill` outdated in places (HTTP trigger shape, cacheSettings, getSecrets batching, deploy/registry notes) | wrong code if followed blindly | cre-engineer instructed to prefer live docs where they differ; third-party skill not edited |
| B8 | `cre init` template identifier `hello-confidential-workflows-ts` + flags [UNCONFIRMED until CLI installed] | scaffolding step | confirm via `cre init --help` in T0.7/T8.1; report if the template is unavailable instead of hand-writing boilerplate |
| B9 | Claude Code subagent skill preloading [UNCONFIRMED] | cre-engineer setup | T0.6 verifies; fallback = explicit "read SKILL.md first" instruction |
| B10 | Provider-binding errors are detectable only inside a CRE run (API has no Sumsub credentials) | a setup mistake costs one run (rate limit 1/60 s) | acceptable; UI tells the operator to double-check External User IDs before verifying |

## 33.2 Decision register (maintainer amendments of 2026-09-10)

| ID | Decision | Status |
|---|---|---|
| D1 | Privy Ed25519 assertion signer (dedicated per Organization, strict no-transaction policy) | **APPROVED PROVISIONALLY**, pending T0.5 [STOP-GATE]; Credential Assertion Key ≠ Financial Execution Key remains frozen |
| D2 | Separate bootstrap signer; human-initiated endorsement | **APPROVED**; no mandatory two-person rule in S001 |
| D3 | Crypto profile (Ed25519 Multikey, `eddsa-jcs-2022`, RFC 8785 JCS + SHA-256, `0x` commitments, 128-bit hex DID id) | **APPROVED as Catenor One [REF-IMPL]**, conditional on T0.5; not a Catenor Protocol profile |
| D4 | Missing required fact | **APPROVED: DENY**; private trace records MISSING distinctly from FALSE |
| D5 | Freshness + provider acceptance rules in the hash-pinned Bootstrap Configuration | **APPROVED**; `evidenceMaxAgeDays = 180` [REF-IMPL] |
| D6 | Sumsub sandbox as the real integration for the hackathon | **APPROVED** with explicit "Sumsub sandbox" labeling everywhere |
| D7 | Representative authority | **APPROVED conceptually**; deterministic provider evidence only; exact fields confirmed by T0.8; limitation documented if needed |
| D8 | LLM | **REMOVED FROM S001**; no Anthropic integration in this slice |
| D9 | CRE deployment registry | **APPROVED: private registry** |
| D10 | `CATENOR_INTERNAL_API_TOKEN` as channel/root secret | **APPROVED** |
| D11 | Sealed trigger context | **APPROVED CONDITIONALLY**, pending T0.7 [STOP-GATE] |
| D11a | HTTPS via `HTTPClient` inside `handlerInTee` (not the Confidential HTTP product) | **CONFIRMED** |
| D12 | DON-signed result report (`reportFromDon`) | **APPROVED P1**; must not block first real deployment |
| D13 | Custom ECIES evidence retention | **REJECTED**; S001 uses COMMITMENT_ONLY |
| D14 | Admission Record extensions `trustDomain`, `bootstrapEndorsementRef` | **APPROVED as Catenor One [REF-IMPL]**; protocol proposal later |
| D15 | One Initial Trust Anchor per Trust Domain | **APPROVED**; staging/resettable rehearsal environment |
| D16 | Audit hash chain | **APPROVED**; DB append-only trigger remains P1 |
| D17 | Tooling/dependencies | **APPROVED** after removing LLM and evidence-encryption dependencies (Appendix C) |
| D18 | Privy email auth + server-side allowlist | **APPROVED** |
| D19 | Railway dashboard configuration | **APPROVED** |
| D20 | CRE workflow | **AMENDED**: `workflows/identity-confidential`, with `trust-anchor-admission` as the first capability/handler |
| D21 | Lifecycle changes only through the test harness in S001 | **APPROVED** |
| D22 | Public read-only Judge Inspector | **APPROVED** for the hackathon |
| D23 | Failed key proof → immediate DENY, no CRE provider calls | **APPROVED** |
| D24 | ADRs (signer custody; CRE workflow boundary + result transport) | **APPROVED**; written near the end of the slice once proven by implementation |

## 33.3 Final decisions on Rev 2 questions (maintainer, 2026-09-10)

| ID | Question | Decision |
|---|---|---|
| Q1 | Bind the assertion Verification Method in the [REF-IMPL] endorsement | **APPROVED, refined**: bind `verificationMethodCommitment = SHA-256(JCS(canonical VM {id, controller, type, publicKeyMultibase}))`, not only the bare public key (§16.2, §26 check 4; AC-076, TV-G06/J07) |
| Q2 | Provider-binding mismatch negative path | **APPROVED**: AC-S001-075, TV-S001-E11 — mismatch → no required facts established, no ALLOW |
| Q3 | Railway bucket in S001 | **APPROVED: do not provision or use** in S001 (COMMITMENT_ONLY); bucket stays in the wider architecture |
| — | Evidence-commitment wording | **CORRECTED**: recomputable against the retained normalized preimage and provider-response digests; binds what was observed; does not preserve or reconstruct raw provider evidence (§23) |

---

# Appendix A — Official tooling and sources consulted (2026-09-10)

## A.1 Chainlink CRE

Local official skill `smartcontractkit/chainlink-agent-skills/chainlink-cre-skill` (installed under `.agents/skills`), cross-checked against live sources (B7).

```text
https://docs.chain.link/cre/llms.txt ; https://docs.chain.link/cre/ts/llms-full.txt
https://docs.chain.link/cre/service-quotas (updated 2026-05-26; quoted in §17.1)
https://docs.chain.link/cre/reference/sdk/http-client-ts (request timeout field)
https://docs.chain.link/cre/concepts/confidential-workflows
https://docs.chain.link/cre/guides/workflow/using-confidential-workflows/making-workflow-confidential-ts
https://docs.chain.link/cre/reference/sdk/confidential-workflows-client-ts
https://docs.chain.link/cre/account/confidential-workflows-access ; .../deploy-access
https://docs.chain.link/cre/capabilities/confidential-http-ts (to distinguish the separate product)
https://docs.chain.link/cre/concepts/typescript-wasm-runtime
https://docs.chain.link/cre/guides/workflow/secrets ; .../secrets/using-secrets-deployed ; https://docs.chain.link/cre/reference/cli/secrets
https://docs.chain.link/cre/guides/workflow/using-triggers/http-trigger/triggering-deployed-workflows
https://docs.chain.link/cre/guides/operations/deploying-workflows ; .../deploying-to-private-registry-ts
https://docs.chain.link/cre/reference/cli/workflow ; https://docs.chain.link/cre/reference/cli/execution
https://docs.chain.link/cre/guides/workflow/using-http-client/verifying-reports-offchain-ts
https://github.com/smartcontractkit/CRE-Confidential-bootcamp (e041ca1)
https://github.com/smartcontractkit/cre-templates (hello-confidential-workflows, confidential-workflows; d0223f3)
https://github.com/smartcontractkit/cre-sdk-typescript (d366a0f) ; https://github.com/smartcontractkit/cre-cli (44c499d)
https://github.com/smartcontractkit/chainlink-confidential-compute
```

## A.2 Privy

```text
https://docs.privy.io/skill.md (official docs skill; read, not installed)
https://docs.privy.io/api-reference/wallets/create ; .../wallets/solana/sign-message ; .../wallets/raw-sign
https://docs.privy.io/controls/policies/overview ; https://docs.privy.io/api-reference/policies/create
https://docs.privy.io/controls/policies/example-policies/solana
https://docs.privy.io/controls/authorization-keys/owners/types ; https://docs.privy.io/api-reference/key-quorums/create
https://docs.privy.io/security/security-faqs ; https://docs.privy.io/wallets/wallets/export
https://docs.privy.io/authentication/user-authentication/access-tokens ; https://docs.privy.io/user-management/users/identity-tokens
https://docs.privy.io/authentication/user-authentication/login-methods/email
https://docs.privy.io/user-management/users/managing-users/allowlist
https://github.com/privy-io/node-sdk ; https://registry.npmjs.org/@privy-io/node
https://www.w3.org/TR/vc-di-eddsa/
```

## A.3 Sumsub

```text
https://docs.sumsub.com/llms.txt ; https://docs.sumsub.com/reference/authentication
https://github.com/SumSubstance/AppTokenUsageExamples (JS signing example)
https://docs.sumsub.com/reference/create-applicant ; .../link-beneficiary-to-company-kyb-20
https://docs.sumsub.com/docs/verify-businesses ; https://docs.sumsub.com/docs/how-business-verification-works
https://docs.sumsub.com/reference/get-applicant-data ; .../get-applicant-review-status
https://docs.sumsub.com/reference/get-additional-company-check-data ; https://docs.sumsub.com/docs/rejection-labels
https://docs.sumsub.com/reference/simulate-review-response-in-sandbox ; https://docs.sumsub.com/reference/mock-company-data
https://docs.sumsub.com/reference/rate-limits
```

## A.4 Railway

```text
https://docs.railway.com/storage-buckets ; https://docs.railway.com/databases/postgresql ; https://docs.railway.com/cli/tcp-proxy
https://docs.railway.com/networking/private-networking/how-it-works ; https://docs.railway.com/deployments/pre-deploy-command
https://docs.railway.com/variables ; https://docs.railway.com/config-as-code ; https://docs.railway.com/guides/monorepo
https://railpack.com/languages/node ; https://docs.railway.com/observability/logs
```

No LLM provider documentation is required for S001 (D8).

---

# Appendix B — SPEC / protocol deviation register

| Item | Source | Plan behavior | Status |
|---|---|---|---|
| LLM removed | SPEC §4, §13, §16, §36; ACCEPTANCE §12; TV E08–E10 | no LLM in S001 | D8; SPEC/AC/TV aligned in T0.9 |
| "confidential HTTP" wording | SPEC §4, §12, §13, §14 | `HTTPClient` inside `handlerInTee`; never "Confidential HTTP product" | D11a; aligned in T0.9 |
| Vault secret inventory | SPEC §15, §36; AC-024; TV-E07 | `SUMSUB_APP_TOKEN`, `SUMSUB_SECRET_KEY`, `CATENOR_INTERNAL_API_TOKEN` (3) | D8/D10; aligned in T0.9 |
| Evidence retention | SPEC §24–25; AC-057/058/059; TV-I03/I04/I05 | COMMITMENT_ONLY by design | D13; aligned in T0.9 |
| Admission Record extra fields | SPEC §21 vs DATA-MODEL §23 | kept, [REF-IMPL]; protocol proposal later | D14; stated in SPEC §21 |
| Endorsement binds `verificationMethodCommitment` | SPEC §8, PLAN §16.2 (envelope is [REF-IMPL]) | added field | Q1; AC-076, TV-G06/J07 |
| Provider binding | SPEC §12.1 | bindingRefs issued first; verified inside TEE | Q2; AC-075, TV-E11 |
| Freshness rule location | SPEC §18 | Bootstrap Configuration `acceptedEvidence`, 180 days | D5 |
| Trust Anchor status | SPEC §27 item 11–12 | operational projection in S001 (§26.1) | amendment §18 |
| Policy JSON rendering | SPEC §17 YAML | same semantics, protocol schema form | faithful |
| Decision object | protocol schema (`additionalProperties:false`) | exact shape; `decisionCommitment` in endorsement | none |

---

# Appendix C — Dependency inventory (pinned + recorded in PROVENANCE at install time)

| Area | Package | Version at review | Where |
|---|---|---|---|
| CRE | `@chainlink/cre-sdk`, `cre` CLI (via official `cre init` template) | 1.19.1 / 1.32.0 | workflows |
| Privy | `@privy-io/node`, `@privy-io/react-auth` | 0.34.0 / 3.42.0 | api infra / web |
| Crypto | `@noble/curves`, `@noble/hashes`, `@scure/base` | latest at install | packages, web (wrong-key demo), workflow (`@noble/hashes`) |
| Crypto (narrow) | `@noble/ciphers` — AES-256-GCM **only** for opening the sealed trigger context in the TEE | latest at install, [STOP-GATE T0.7] | workflows only (API seals with Node `crypto`; cross-compat test) |
| JCS | RFC 8785 implementation | latest at install | packages/audit, workflows |
| EVM | `viem` (trigger JWT signing; P1 report verification) | latest at install | api infra |
| Validation | `zod` | latest at install | api, workflows |
| Framework | NestJS, Next.js, Prisma, Tailwind | latest stable at install | apps |
| Test | Vitest, Playwright, Testcontainers, dependency-cruiser | latest at install | repo |

Removed in Rev 2: Anthropic/LLM anything; `@aws-sdk/client-s3` (no bucket writes in S001); X25519/ECIES usage.

---

# Appendix D — Architecture review checklist (ARCHITECTURE §18)

```text
preserves pinned protocol baseline             yes — deviations only in Appendix B, each flagged
domain framework/vendor independent            yes — §2.3, enforced by dependency-cruiser
vertically complete                            yes — web → api → domain → ports → adapters → TEE/DB
external systems behind ports                  yes — §5/§6
public/private separated                       yes — §10/§11 + leak-sentinel tests (incl. bindingRefs)
keys purpose-separated                         yes — assertion, bootstrap, trigger, authorization keys distinct
DB = index, not proof                          yes — provenance rests on signatures + pinned config; status is
                                               explicitly an operational projection (§26.1)
negative paths planned                         yes — §27, §28, T17, binding mismatch
sponsor official tooling identified            yes — Appendix A; cre-engineer subagent (§17.7)
judge artifacts planned                        yes — §30
testable independently of future slices        yes — S002 subject-continuity handler not built
```

---

# Appendix E — Source-of-truth cleanup (APPLIED in T0.9, 2026-09-10; kept as a record)

Line numbers refer to the files as of commit `a83d4f6`. All items below were applied in T0.9, with these differences from the original proposal:

```text
TV-S001-F12       retired (not generalized); its intent is covered by TV-S001-F11
TV-S001-E12       not added (optional item); sealed-context replay is covered by T8.2 unit tests
added beyond E.1  AC-S001-076, TV-S001-G06, TV-S001-J07 (verificationMethodCommitment — Q1 refinement)
retired IDs       AC-031, 032, 033, 034, 041; TV-E08, E09, E10, F12 — marked RETIRED, never reused
N/A to S001       AC-057, AC-059, TV-I05
```

## E.1 The three S001 source-of-truth files

### SPEC.md

| Location | Current text | Needed change |
|---|---|---|
| §4 Scope, L101–102 | "confidential HTTP", "auxiliary LLM call inside the TEE" | reword to "HTTPS from inside the TEE (CRE HTTPClient with TeeRuntime)"; delete LLM line |
| §12 Sumsub, L346, L353 | "through confidential HTTP", "Sumsub confidential HTTPS" | same wording fix; optionally add the provider-binding requirement (Catenor bindingRef as `externalUserId`, verified inside the TEE) |
| §13 CRE, L388, L406 | "confidential HTTP" bullet; `├── HTTPS → LLM` branch | reword; delete LLM branch |
| §14, L430, L434, L440 | "real confidential HTTP call to Sumsub"; "If the LLM is enabled … real LLM API"; "confidential HTTP" in bootcamp sentence | reword; delete LLM sentence |
| §15 Vault secrets, L446–470 | baseline `SUMSUB_APP_TOKEN`, `SUMSUB_SECRET_KEY`, `LLM_API_KEY`; optional 4th `CATENOR_INTERNAL_API_TOKEN` | baseline = `SUMSUB_APP_TOKEN`, `SUMSUB_SECRET_KEY`, `CATENOR_INTERNAL_API_TOKEN` (3); state its approved purpose |
| §16 LLM role, L476–511 | whole section | delete, or replace with "No LLM in S001; LLM-in-TEE is a candidate technique for S002 Subject Continuity" |
| §22 Railway, L656 | external systems include "LLM provider" | delete |
| §24 Evidence Vault, L711–740 | bucket examples incl. "LLM result where retention is justified"; encrypted package flow | delete LLM example; state that S001 uses the §25 COMMITMENT_ONLY fallback and does not write evidence to the bucket |
| §25, L746 | "Raw confidential provider/LLM responses" | "Raw confidential provider responses" |
| §28 Required DENY paths | — | [optional] add "provider binding mismatch" |
| §29 Failure behavior, L882–884 | LLM failure paragraphs | delete |
| §31 Invariants, L928 | "LLM recommendation != verified fact" | delete (move to S002 if needed) |
| §32 Demo, L952 | step 8 "TEE performs auxiliary confidential LLM call when enabled" | delete; renumber |
| §33 Artifacts, L985–986 | "sanitized LLM live-call evidence when used"; "encrypted-object metadata when implemented" | delete LLM line; "evidence commitment (COMMITMENT_ONLY)" |
| §34 Tooling, L1003 | "LLM provider current official docs → required" | delete |
| §36 Frozen decisions, L1057–1058, L1066–1069 | "LLM → confidential auxiliary component"; baseline credentials incl. `LLM_API_KEY` | "LLM → not part of S001"; credentials per §15 above; add "CRE workflow → identity-confidential / trust-anchor-admission" if the workflow boundary should be frozen here |
| §36 → §37 boundary, L1076–1081 | "Bootstrap access" block sits outside the code block after `---` | formatting fix: move into the §36 block |
| §37 Open PLAN decisions, L1096, L1099–1101 | "exact LLM provider/model and auxiliary task"; encrypted evidence-package format, TEE → bucket upload, evidence key mechanism | delete LLM line; mark the three evidence items "not applicable to S001 (COMMITMENT_ONLY)" |

### ACCEPTANCE.md

| Location | Current | Needed change |
|---|---|---|
| AC-S001-010, L337 | must-not-contain list includes "raw confidential LLM data" | delete item |
| AC-S001-024, L613–638 | baseline secrets incl. `LLM_API_KEY`; "where the LLM is enabled" | list the 3 Rev 2 secrets; delete qualifier |
| §12 LLM, AC-S001-031 (P0), 032 (P1), 033 (P0), 034 (P1), L758–832 | LLM criteria | retire as "reserved — removed from S001"; AC-031's intent (no non-deterministic input overrides policy) is already covered by AC-036/037 and TV-F11 |
| AC-S001-041 (P0), L982–1004 | LLM-only representative authority | retire; AC-040 + deterministic derivation cover identity ≠ authority |
| AC-S001-057 (P1), L1341–1357 | encrypted evidence package when safely supported | mark "not implemented in S001 — COMMITMENT_ONLY by design (D13)" |
| AC-S001-058 (P0), L1359–1387 | safe fallback | clarify it is the chosen S001 mode (not only a fallback) |
| AC-S001-059 (P1), L1389–1407 | decryption key separation | mark "N/A in S001 — no encrypted evidence retained" |
| AC-S001-063 / 065 | status checks in verification | [optional] note that lifecycle status is an operational projection in S001 (§26.1) |
| AC-S001-072 (P0), L1691–1701 | "LLM integration is truthfully represented" | rewrite generically: mocks labeled; Sumsub sandbox labeled "Sumsub sandbox"; no mock/sandbox presented as production |
| §28 regression list, L1758 | "LLM directly authorizes Trust Anchor Admission" | delete |
| new (proposed) | — | P0 criterion: provider binding mismatch (`externalUserId` ≠ Catenor bindingRef) yields no verified facts and no ALLOW |

### TEST-VECTORS.md

| Location | Current | Needed change |
|---|---|---|
| §9 classification, L223 | "E. Chainlink CRE + Sumsub + LLM" | "E. Chainlink CRE + Sumsub" |
| E header, L600 | same | same |
| TV-S001-E01, L626 | "confidential HTTP path executes" | "HTTPS requests execute from inside handlerInTee" |
| TV-S001-E07, L783–799 | names incl. `LLM_API_KEY` | the 3 Rev 2 names |
| TV-S001-E08, E09, E10, L803–885 | LLM vectors | retire as "reserved — removed from S001" |
| TV-S001-F12, L1095–1108 | `llmRecommendation = "ALLOW"` | retire, or generalize to "untrusted recommendation field cannot override policy" (PLAN currently tests the generic form) |
| TV-S001-I03, L1338–1342 | "If evidence is retained: bucket object = encrypted" | mark N/A in S001 |
| TV-S001-I05, L1371–1381 | encrypted retention key separation | mark N/A in S001 |
| TV-S001-L01, L1612–1613 | step 10 wording; step 11 "optional real LLM confidential call succeeds" | reword step 10; delete step 11; renumber |
| §11 Sanitization, L1728–1731 | lists `LLM_API_KEY` | replace with `CATENOR_INTERNAL_API_TOKEN` |
| §13 Minimum automated set, L1807 | "LLM recommendation cannot override policy" | delete or generalize (as F12) |
| §14 Minimum CRE simulation set, L1833–1834 | "confidential HTTP mock path works", "LLM mock path works if enabled" | "in-TEE HTTPS mock path works"; delete LLM item |
| §15 Minimum live set, L1855 | "A real LLM call is strongly preferred …" | delete |
| new (proposed) | — | TV-S001-E11 provider binding mismatch → no facts, non-ALLOW; [optional] TV-S001-E12 sealed context for another operation/run rejected |

## E.2 Other files affected (also cleaned in T0.9)

| File | Change |
|---|---|
| `slices/S001-trust-anchor-admission/README.md` L20 | "Real Sumsub evidence + auxiliary LLM" → remove LLM |
| `artifacts/judges/s001/README.md` L20 and `trust-anchor-flow.html` (9 LLM mentions) | remove LLM; add "visualization only" banner (T14.3) |
| `docs/architecture/ARCHITECTURE.md` §12, `README.md` repository tree | add `workflows/identity-confidential` and the workflow-boundary rule; mark the empty `subject-continuity` placeholder as superseded (directory itself untouched; reconciled when S002 starts) — ADR to follow (D24) |
