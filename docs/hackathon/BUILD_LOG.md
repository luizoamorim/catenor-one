# Build Log — Catenor One / ETHOnline 2026

> Human-readable development timeline. Keep entries concise, factual, and commit-linked when possible.

> **Historical note:** Entries covering work performed before the public Catenor Protocol repository was created were reconstructed on 2026-09-09 from contemporaneous design conversations, notes, generated artifacts, and local project structure. They document when the work actually happened; they are not backdated Git commits.

---

## 2026-09-04 — Protocol design begins during ETHOnline

**Context:** ETHOnline was already underway when the protocol-design work began.

**Goal:** Design a reusable identity and authority layer for regulated real-world systems rather than treating a wallet as the identity itself.

Initial design direction:

```text
wallet != identity
        ↓
canonical subject
        ↓
W3C DID foundation
        ↓
credentials / presentations
        ↓
authority / policy
```

Key concepts explored from the beginning:

- canonical identity independent from a wallet;
- W3C DID as the identity foundation;
- W3C Verifiable Credentials / Presentations;
- account bindings;
- privacy-preserving identity evidence;
- Subject Continuity across changing accounts/providers;
- chain-agnostic and offchain-compatible identity.

AI assistance:

- ChatGPT used as an architecture/research/design partner.
- The human maintainer drove the protocol problem definition, challenged assumptions, selected/rejected designs, and continuously refined the model.

Human work:

- protocol thesis;
- RWA identity requirements;
- canonical-subject reasoning;
- privacy and interoperability requirements;
- review and correction of generated architecture.

Repository state:

- the final public Catenor Protocol repository did not yet exist.

---

## 2026-09-05 to 2026-09-07 — Identity, authority, and implementation model expands

The design moved beyond identity alone.

Concepts developed/refined included:

```text
Canonical Subject
Subject Continuity
Account Bindings
Verifiable Credentials
Verifiable Presentations
Relationships
Capabilities
Delegation
Authority Chains
Issuer Authority
Policy Decisions
```

Important separations established:

```text
Relationship != Capability
Signature validity != claim truth
Credential != database row
Policy Decision != execution authorization
```

The implementation model also began separating:

```text
public DID state
private identity state
private credential/evidence storage
secure key management
operational database/index
```

A working repository/scaffold under an earlier project name was used to organize:

- identity documentation;
- authority documentation;
- policy documentation;
- confidential workflows;
- integration notes;
- schemas;
- AI/provenance artifacts;
- application/package structure.

This was still active protocol-design work during the hackathon, not a finished pre-existing implementation.

---

## 2026-09-07 to 2026-09-08 — Working protocol becomes without name

The model expanded to Humans, Organizations, and Agents.

Key decisions included:

- an Agent receives its own canonical identity;
- authority is delegated rather than inherited;
- issuer authority is explicit and scoped;
- `ISSUE_CREDENTIAL` and `AUTHORIZE_ISSUER` are distinct;
- delegated authority cannot exceed delegator authority;
- credential-signing keys and financial-execution keys should be separated;
- sensitive evidence may require confidential computation;
- full private account bindings should not be exposed through the public DID Document.

The working repository structure became the basis for later Catenor One implementation organization, but the protocol itself was still being actively redesigned.

AI assistance:

- ChatGPT used extensively for architecture, documentation, threat reasoning, data-model examples, diagrams, and design review.

Human review:

- the maintainer repeatedly corrected assumptions and froze conceptual decisions before implementation.

---

## 2026-09-08 — Protocol separated from any company-specific identity

**Decision:** The protocol should be open and implementation-neutral.

The design was reworked so that:

```text
company/product
        !=
protocol
```

The canonical protocol name became:

```text
Catenor Protocol
```

The proposed native DID method became:

```text
did:catenor:<opaque-high-entropy-id>
```

Core specification language was made vendor-neutral.

Important rule:

> The Catenor DID belongs to the Subject, not to the company, provider, wallet, or application that first onboarded the Subject.

Protocol documentation was reorganized around:

- canonical decisions;
- data-model baseline;
- conformance;
- terminology;
- core model;
- identity;
- credentials;
- authority;
- policy;
- privacy;
- audit;
- security.

---

## 2026-09-09 — Catenor Protocol Draft v0.1 consolidated and published

The public Catenor Protocol repository was created and the several days of protocol-design work were consolidated into Draft v0.1.

Protocol:

```text
https://github.com/luizoamorim/catenor
https://catenor.xyz
```

Current pinned protocol commit used by Catenor One:

```text
66ef712694acfc987663f5ffa9bcc9d12d1fe80e
```

Important provenance clarification:

> The initial large Catenor Protocol commit represents publication/consolidation of protocol design performed during the hackathon since 2026-09-04. It does not represent the beginning of the design work.

The documentation website was also brought online at:

```text
https://catenor.xyz
```

---

## 2026-09-09 — Project naming

**Decision:** ETHOnline reference implementation named **Catenor One**.

```text
Catenor Protocol
= open protocol / specification

Catenor One
= first reference implementation / ETHOnline project
```

AI assistance:

- ChatGPT used for naming research and reference-implementation framing.

Human decision:

- final project name selected by maintainer.

---

## 2026-09-09 — New implementation scaffold

Created a new `catenor-one` scaffold with:

```text
apps/
packages/
workflows/
contracts/
artifacts/
slices/
docs/
schemas/
test-vectors/
tests/
scripts/
```

Vertical slices created:

```text
S001 Trust Anchor Admission
S002 Sponsor Authorization
S003 Agent Delegation
S004 Investor Identity
S005 Policy Decision
S006 Distribution
S007 Audit
```

No slice implementation is complete yet.

AI assistance:

- ChatGPT proposed the structure using lessons from the earlier experimental scaffold.

Human action:

- maintainer created the tree locally.

Commit:

- 6dc775705901f9fb904333de0f485c0e656176f6

---

## 2026-09-09 — Spec-driven workflow

Defined:

```text
SPEC
→ PLAN
→ TASKS
→ ACCEPTANCE
→ TEST VECTORS
→ IMPLEMENTATION
→ TEST
→ REVIEW
→ COMMIT
```

AI usage/provenance is treated as a first-class project artifact.

---

## 2026-09-09 — Project-context bootstrap

Created/updated:

```text
README.md
CLAUDE.md
docs/PROTOCOL-BASELINE.md
docs/hackathon/AI_USAGE.md
docs/hackathon/PROVENANCE.md
docs/hackathon/BUILD_LOG.md
docs/hackathon/SUBMISSION_CHECKLIST.md
docs/hackathon/prompts/2026-09-09-001-project-bootstrap.md
docs/hackathon/plans/2026-09-09-001-project-bootstrap.md
slices/README.md
```

Purpose:

- pin protocol authority;
- prevent semantic drift;
- define AI-assistance rules;
- document project provenance;
- establish slice-driven implementation.

Commit:

- 2b60b889a43fce1fcc9a92674c62be182be95a43

---

---

## 2026-09-10 — Catenor One architecture baseline frozen

**Goal:** Define the implementation architecture before writing slice code.

Architecture selected:

```text
Modular Monolith
+
Vertical Slices
+
DDD-lite
+
Clean Architecture boundaries
```

Reference stack/boundaries established:

```text
apps/web
→ Next.js

apps/api
→ NestJS modular monolith

packages/*
→ framework/vendor-independent domain code

Railway
→ application deployment + PostgreSQL
→ private bucket available for later evidence use

Chainlink CRE Confidential
→ confidential verification adapter/workflows

Privy
→ authentication, wallets/signers, execution controls where appropriate

Hedera ATS
→ planned RWA tokenization/compliance/execution layer
```

Key architectural rule:

> Sponsor/provider integrations implement Catenor-defined ports and MUST NOT redefine Catenor domain semantics.

Commit:

```text
1336ac648aa4727022bc9b8501c23dd3e7c74c6e
```

AI assistance:

- ChatGPT used to design/review the architecture baseline and ADR structure.
- Human maintainer selected and approved the final architecture.

---

## 2026-09-10 — S001 Trust Anchor Admission source-of-truth defined

**Goal:** Define S001 completely before implementation.

S001 documentation established:

```text
slices/S001-trust-anchor-admission/
├── SPEC.md
├── ACCEPTANCE.md
├── TEST-VECTORS.md
└── README.md
```

The S001 design includes:

```text
Bootstrap Access Gate
Trust Domain Bootstrap Configuration
ORGANIZATION Canonical Subject
did:catenor
Credential Assertion Key
Proof of Key Possession
real Sumsub sandbox integration
Chainlink CRE Confidential verification
deterministic Admission Policy
bootstrap endorsement
Trust Anchor Admission Record
ACTIVE operational status projection
Trust Anchor verification
```

A technical Judge Inspector prototype was also created under:

```text
artifacts/judges/s001/
```

No production S001 implementation existed at this stage.

AI assistance:

- ChatGPT drafted/reviewed SPEC, acceptance criteria, test vectors, architecture diagrams, and Judge Inspector prototypes.
- Human maintainer reviewed and froze the semantics before implementation planning.

---

## 2026-09-10 — Official Chainlink CRE skill added

**Goal:** Use current sponsor tooling/documentation instead of implementing CRE APIs from model memory.

Installed in project scope:

```text
smartcontractkit/chainlink-agent-skills
└── chainlink-cre-skill
```

Version:

```text
0.0.22
```

Project paths:

```text
.agents/skills/chainlink-cre-skill
.claude/skills/chainlink-cre-skill
```

The `.claude` path is a symlink to the canonical project-local skill.

Relevant reference material includes:

```text
project-scaffolding
confidential-workflows
simulation
workflow-patterns
triggers
http-client
sdk-reference
cli-reference
operations
concepts
```

Decision:

- CRE implementation will use official current documentation/skill guidance.
- Live documentation takes precedence if the installed skill is stale.
- A project-specific `cre-engineer` Claude Code subagent will later load this skill.
- The subagent may implement CRE mechanics but MUST NOT redefine Catenor protocol/application semantics.

No CRE workflow code was created in this step.

Commit:

```text
separate tooling commit; record SHA when available
```

---

## 2026-09-10 — S001 PLAN / TASKS created and human-reviewed

**Goal:** Convert the frozen S001 requirements into a concrete implementation plan without beginning production code.

Claude Code produced:

```text
slices/S001-trust-anchor-admission/PLAN.md
slices/S001-trust-anchor-admission/TASKS.md
```

The first plan mapped every S001 test vector to a concrete verification method/task and surfaced integration blockers before code.

Human review then amended the plan.

Major decisions:

```text
CRE workflow boundary
→ workflows/identity-confidential
→ trust-anchor-admission is the first operation/handler

LLM
→ removed completely from S001

Evidence retention
→ COMMITMENT_ONLY
→ no raw Sumsub provider responses persisted
→ no custom ECIES scheme

Sumsub provider binding
→ Catenor bindingRefs are created before applicant IDs are attached
→ externalUserId mismatch blocks Admission

CRE secrets
→ SUMSUB_APP_TOKEN
→ SUMSUB_SECRET_KEY
→ CATENOR_INTERNAL_API_TOKEN

CRE registry
→ private preferred

Missing required fact
→ DENY
→ private trace distinguishes MISSING from FALSE

Freshness
→ 180-day Catenor One reference value in hash-pinned Bootstrap Configuration

Trust Anchor verification
→ Admission provenance/bootstrap endorsement are cryptographically verifiable
→ current lifecycle status remains an operational projection in S001
```

The plan also introduced a P0 Fast Lane focused on a real end-to-end hackathon demo before non-critical P1/P2 improvements.

No production code, dependencies, migrations, `cre init`, or deployments were performed during planning.

---

## 2026-09-10 — S001 source-of-truth cleanup completed

**Goal:** Realign SPEC / ACCEPTANCE / TEST-VECTORS with the approved PLAN revision before implementation.

Updated documentation now agrees on:

```text
no LLM in S001
three CRE secrets
identity-confidential workflow boundary
correct provider-binding sequence
provider-binding mismatch failure
COMMITMENT_ONLY retention
verificationMethodCommitment
180-day reference freshness
Sumsub sandbox labeling
narrow Trust Anchor verification claim
```

Removed/retired LLM-specific acceptance criteria and test vectors without renumbering existing identifiers unnecessarily.

Additional test/acceptance coverage was added for:

```text
provider-binding mismatch
Verification Method/public-key replacement detection
```

Result:

```text
S001 source of truth
↔ PLAN
↔ TASKS
```

cross-checked successfully before implementation.

No production code was written.

---

## 2026-09-10 — Execution target updated to Hedera ATS

**Decision:** Hedera Asset Tokenization Studio (ATS) becomes the planned RWA tokenization/compliance/execution layer for Catenor One.

Current integration roles:

```text
Chainlink CRE Confidential
→ private verification/computation

Catenor Protocol / Catenor One
→ canonical identity, authority, delegation, policy decisions

Privy
→ authentication, wallets/signers and execution controls where appropriate

Hedera ATS
→ tokenized real-world asset lifecycle, compliance and execution
```

Arc is no longer the primary hackathon execution/settlement target.

This decision does not change S001.

Future slice direction:

```text
S001 Trust Anchor Admission
S002 Subject Continuity / Identity Provider Reconciliation
S003 Sponsor Authorization
S004 Agent Delegation
S005 Investor Identity & Account Binding
S006 Policy Decision
S007 Hedera Tokenization / Compliance Execution
S008 Audit & Explainability
```

No Hedera integration code existed at the time of this decision.

---

## 2026-09-10 — Subject Continuity promoted to explicit next scenario

**Goal:** Preserve canonical identity when wallets/providers change.

Planned S002:

```text
Existing did:catenor
+
new Identity Verification Provider evidence
↓
identity-confidential
↓
private reconciliation
↓
MATCH | REVIEW | NO_MATCH
```

Reference implementation direction:

- Sumsub + Persona provider reconciliation;
- private provider bindings;
- deterministic matching rules;
- ambiguous evidence → `REVIEW`;
- false-merge avoidance prioritized;
- optional future LLM-in-TEE only if unstructured/ambiguous evidence genuinely requires it.

S002 remains unimplemented while S001 is completed first.

---

## 2026-09-10 — S001 Phase 0: cre-engineer, CRE access check, CRE runtime spike, Sumsub spike

**Goal:** Validate the CRE and Sumsub assumptions S001 depends on, independently of the pending Privy decision.

Work completed:

- Created `.claude/agents/cre-engineer.md` (Catenor One project subagent; preloads the official `chainlink-cre-skill`; CRE-mechanics scope only; must not redefine protocol, identity, authority, delegation, policy, Subject Continuity or S001 semantics). Claude Code recognized it (`claude agents`) and a delegated validation confirmed the skill content is preloaded.
- CRE access (CLI v1.33.0, outputs redacted): logged in; **Deploy Access: Enabled**; registries `private` (Chainlink-hosted) and `onchain:ethereum-mainnet`; no linked owner keys. **Confidential Workflows private-beta enrollment is not visible through any CLI command or documented API** — it still requires written confirmation from Chainlink.
- CRE runtime spike (T0.7), simulation only, run by `cre-engineer` in git-ignored `scratch/`: official `hello-confidential-workflows-ts` scaffold via `cre init`; batched `getSecrets` (3 names), `@noble/hashes` known-answer tests, **AES-256-GCM sealed-context open inside `handlerInTee` with 5/5 tamper cases failing closed**, RFC 8785 JCS, deterministic salt, `runtime.now()`, QuickJS globals, HTTP limits with a production-like limits file (6th call rejected; 10,000-byte request and 100,000-byte response limits enforced), per-request timeout behavior, trigger payload shape.
- Sumsub spike (T0.8): documentation verification completed; a sanitizing sandbox harness was prepared. After the maintainer placed sandbox credentials in a git-ignored local `.env` (never read by the agent), the **live individual-applicant run passed**: auth, level list (`id-only` present; no company level), bindingRef as `externalUserId` echoed and looked up, `testCompleted` GREEN and RED (`SANCTIONS`, `FINAL`) verified. Company/KYB not attempted (entitlement blocker).

Validation:

- Sealed input feasibility **CONFIRMED in simulation**; deployed-TEE behavior remains unconfirmed until a real Confidential Workflows deployment.
- Main session audited both spike transcripts (no forbidden commands; verdicts re-checked against raw simulator output) and corrected two overstated conclusions (timeout cap, registry failure cause).

AI assistance:

- Claude Code main session (orchestration, review, documentation); `cre-engineer` subagent with the official Chainlink skill (spike execution); general-purpose Claude Code subagent (Sumsub documentation research).

Human review:

- Pending at the time: `cre-engineer` file, both findings files, proposed PLAN corrections. *(Update: all reviewed and approved on 2026-09-10 — see "S001 Phase 0 final documentation decisions" below.)*

Artifacts:

```text
.claude/agents/cre-engineer.md
slices/S001-trust-anchor-admission/spikes/T0.7-cre-runtime.md
slices/S001-trust-anchor-admission/spikes/T0.8-sumsub-sandbox.md
docs/hackathon/prompts/2026-09-10-006-s001-phase0-cre-sumsub-spikes.md
docs/hackathon/plans/2026-09-10-005-s001-phase0-cre-sumsub-spikes.md
```

Commit:

```text
f8657a9 (cre-engineer), 60ba490 (spike findings, PLAN/TASKS), this Phase 0 records commit (build log/provenance)
```

Notes:

- Privy spike not run; crypto profile, D1/D3 and the assertion-signer design untouched (Privy decision pending).
- No production S001 code, no repo dependencies, no migrations, no `workflows/identity-confidential`, no deployment.


---

## 2026-09-10 — S001 T0.5 Privy Credential Assertion Key spike (STOP-GATE: partial pass)

Goal: validate a dedicated Privy Solana (Ed25519) wallet as the Credential Assertion Key, with a strict signing-only policy (maintainer decision for this spike; not a protocol decision).

Work completed (Privy development app, synthetic data, `@privy-io/node` 0.34.0, scratch only):

- wallet provisioned server-side with an ephemeral P-256 owner key and a policy; public key taken from the address (no export);
- `signMessage` signatures verified locally as **plain Ed25519 over the raw bytes** (no prefix, no hash);
- denied as expected: signing without an owner signature (401), `signTransaction` (policy_violation), `rawSign` (unsupported for Solana), `exportPrivateKey` and `exportSeedPhrase` (policy_violation), policy removal without an owner signature (401);
- **STOP-GATE:** the policy condition `message.byte_length eq "64"` denied the authorized 64-byte *binary* message; a diagnostic showed the condition works for text messages but not binary input;
- documented limitations: the owner can lift the export DENY; send-transaction denial cannot be shown without funds (simulation runs before policy).

Validation: sanitized outputs leak-checked; no secrets, keys or full IDs recorded.

AI assistance: Claude Code (harness, docs/SDK review, analysis); general-purpose Claude Code subagent (Privy documentation research).

Human review: the maintainer chose option A (Catenor signer boundary) and pursues option C with Privy non-blocking — T0.5 PASSED WITH APPROVED DESIGN AMENDMENT (PLAN D33–D35).

Artifacts: `slices/S001-trust-anchor-admission/spikes/T0.5-privy-assertion-key.md`.

Commit: 60ba490 (findings, PLAN/TASKS); provenance in the Phase 0 records commit.

---

## 2026-09-10 — S001 Phase 0 final documentation decisions

Goal: close the Phase 0 documentation decisions before the first S001 implementation commit.

Decisions recorded (maintainer):

- **Q7 → D36:** the Bootstrap Endorsement Key uses the same Privy owner/runtime-signer pattern as the assertion key, but as a completely separate wallet with its own management-owner and runtime-signer authorization keys and its own `P_BOOTSTRAP` policy. Credential Assertion Key ≠ Bootstrap Endorsement Key; no key reuse.
- **Key terminology (PLAN §13.0):** 2 Catenor Ed25519 signing keys (Credential Assertion Key, Bootstrap Endorsement Key) + 4 Privy P-256 authorization (control) keys. Management-owner authorization keys stay outside the runtime. Catenor-managed custody is a reference-implementation choice, not a protocol requirement. T0.4 renamed "Privy signing-wallet and authorization-key provisioning".
- **T0.6 complete:** `cre-engineer` approved after three corrections.
- **T0.7 complete (D37):** CRE runtime findings approved as reference-implementation details, all **SIMULATION-CONFIRMED** only; B3/B6 simulation-confirmed, B8/B9 resolved; nothing about deployed or production TEE behavior is marked confirmed.
- **Evidence gap recorded:** the T0.7 spike carried the sealed context as hex; the approved base64 transport is APPROVED DESIGN, NOT YET SIMULATION-CONFIRMED — T8.2 tests it in the CRE QuickJS/WASM runtime (no `atob`/`btoa` there) and T16.2 re-checks the whole sealed path in the deployed workflow.

Validation: documentation/traceability cross-check re-run across SPEC, ACCEPTANCE, TEST-VECTORS, PLAN and TASKS (77 acceptance criteria, 67 test vectors, all task/decision references resolved).

AI assistance: Claude Code main session (edits, cross-check).

Human review: approved in the final Phase 0 documentation review (2026-09-10).

Commit: 2772744 (source of truth, T0.9), 60ba490 (PLAN/TASKS + spike findings), f8657a9 (cre-engineer subagent), plus the Phase 0 records commit that contains this entry.

---

## 2026-09-10 — S001 P0 Fast Lane: foundation + framework-free domain packages

Goal: start S001 implementation from the frozen SPEC / ACCEPTANCE / TEST-VECTORS / PLAN / TASKS (Rev 2.6).

Work completed:

- **Phase 1:** pnpm monorepo (TypeScript 6.0.3, Node 24, ESM), ESLint + Prettier, Vitest, dependency-cruiser boundaries (PLAN §2.3), CI workflow, secret-scan stub, `@catenor-one/test-vectors` loader, pinned protocol schemas vendored with hash checks.
- **Phase 2:** `packages/audit` (RFC 8785 JCS, commitments, audit hash chain), `packages/identity` (`did:catenor`, Multikey, minimized DID Document, key purposes), `packages/policy` (Admission Policy v1 + golden hash, evaluator with FALSE ≠ MISSING, protocol Decision), `packages/credentials` (`eddsa-jcs-2022`), `packages/authority` (Bootstrap Configuration with evidence profiles, key possession, bootstrap endorsement with `verificationMethodCommitment`, admission state machine, 12-check Trust Anchor verifier), S001 golden vectors.

Validation (local): `pnpm check` green — 233 tests (18 files), lint, typecheck, build, boundaries (deliberate violations shown to fail), secret scan (negative control shown to fail). The official W3C `eddsa-jcs-2022` vector and all RFC 8785 vectors pass. GitHub Actions has not run yet (nothing pushed).

AI assistance: Claude Code (implementation, tests, verification). No subagent was used — the work had no CRE-specific mechanics.

Human review: checkpoint reviewed 2026-09-11 — vendored protocol schemas approved (unmodified copies, hashes/provenance recorded); TypeScript 6.0.3 pin and duplicate-fact rejection approved in principle; key-possession FALSE-vs-MISSING and golden-vector determinism held for maintainer decision (no code change); audit hash-chain encoding kept as Catenor One [REF-IMPL].

T3.1 (proposal only): `apps/api/prisma/schema.prisma` drafted from PLAN §10.1 for maintainer review — Postgres schemas `catenor_public` / `catenor_private` via native `schemas` (validated generally available in Prisma 7.10.0, the latest stable; npm's `latest` tag currently points at 8.0.0-rc.13). Checked with a scratch-only Prisma 7.10.0 install (`validate`, `format`, offline `migrate diff --from-empty`); no Prisma dependency added to the repo, no migration, no database.

Commit: 28474f2 (monorepo foundation + domain packages), plus the docs commit that contains this entry.

## 2026-09-11 — S001 T3.1 review decisions applied (before final schema review)

Goal: apply the maintainer's T3.1 review decisions without creating a migration or installing Prisma in the repo.

Work completed:

- **Key possession (option B):** challenge-level failures give `ASSERTION_KEY_POSSESSION_VALID = false` and no purpose fact (trace MISSING); purpose is `false` only when actually evaluated; infrastructure failures produce no fact. Domain tests updated, policy unchanged.
- **Audit chain [REF-IMPL]:** `trustDomain` is part of the hashed body — `eventHash = SHA-256(JCS(event ∪ {trustDomain}) ‖ prevHash)`; tests show moving an event into another Trust Domain breaks it.
- **Golden vectors:** TEST-ONLY, NON-SECRET Ed25519 keys derived from public labels (`@catenor-one/test-vectors/test-keys`); known-answer test cross-checked with `node:crypto`; two regenerations byte-identical; new dependency-cruiser rule shown to fail on imports from a domain package, an app and a non-vector script.
- **Schema revision 2:** accurate public/private wording (no claim that schemas or missing relations are an access-control boundary); initial root enforced by one column per domain + UNIQUE + composite FK to its Admission Record + conditional set-once update; signer-mapping invariant documented; `ProviderBinding` kept provider-generic (no DB `provider = 'sumsub'`); 37 CHECK constraints drafted for T3.2.

Validation: `pnpm check` green; schema `validate` / `format` clean; offline SQL preview and the CHECK draft applied to a throwaway in-memory PGlite (scratch only, discarded) with every negative probe rejected by the intended constraint.

AI assistance: Claude Code main session.

Human review: maintainer T3.1 review 2026-09-11; final schema review pending.

Commit: 28474f2 (domain changes) and 0c5cb18 (schema revision), plus the docs commit that contains this entry.

## 2026-09-11 — S001 T3.1 approved; T3.2 initial migration on real PostgreSQL

Goal: apply the final T3.1 schema adjustments and create/test the initial migration (no Railway).

Work completed:

- **T3.1 final:** DecisionTrace provenance CHECK and challenge `operation = 'ADMIT_TRUST_ANCHOR'`; immutability triggers for `TrustDomainProjection.initialTrustAnchorDid` (set once from NULL), `KeyManagementReference.signerRef`, `VerificationMethodProjection.publicKeyMultibase`; explicit `onDelete: Restrict` / `onUpdate: Restrict` on all 14 relations; `VerificationMethodProjection.createdAt` (projection metadata only). T3.1 marked complete.
- **T3.2:** `apps/api` persistence scaffold (`package.json`, `prisma.config.ts`, `tsconfig.json`); Prisma / `@prisma/client` / `@prisma/adapter-pg` 7.10.0; migration `20260911034806_init` = `prisma migrate diff --from-empty` DDL + reviewed raw SQL (39 CHECKs, 3 triggers); Testcontainers integration suite (`pnpm test:integration`, `postgres:17.11-alpine`) using the real `prisma migrate deploy`; CI step added.
- Found and fixed while testing (before any database existed outside tests): one CHECK name exceeded PostgreSQL's 63-byte identifier limit (silently truncated) → renamed; the run-result CHECK allowed a non-accepted run to carry facts or a commitment alone → rewritten to "both present when accepted, neither otherwise", the approved intent. Immutability triggers made row-level with a `WHEN (changed)` guard instead of `UPDATE OF column`, which PostgreSQL does not fire for changes made by other BEFORE triggers.

Validation: 78 integration tests green (twice); `pnpm check` green (251 unit tests); no drift between the deployed database and `schema.prisma`.

AI assistance: Claude Code main session.

Human review: T3.1 final review approved 2026-09-11 (maintainer); T3.2 results pending review.

Commit: 0c5cb18 (persistence schema, migration, integration tests), plus the docs commit that contains this entry.

## 2026-09-11 — Hackathon Delivery Mode adopted

Goal: optimize the remaining time until the Sunday ETHOnline deadline for the smallest credible end-to-end demo path.

Decision (maintainer): delivery/execution strategy change only — not an architecture redesign. Protocol semantics, S001 facts, `policy:trust-anchor-admission:v1`, key-purpose separation, evidence rules/profiles and security claims are unchanged. TASKS.md stays the backlog; tasks may be implemented as far as the demo needs and stay unchecked until complete; deferred work is marked `[POST-DEMO]`, never deleted.

Artifacts: `docs/hackathon/plans/2026-09-11-006-ethonline-delivery-fast-lane.md`, `docs/hackathon/prompts/2026-09-11-007-ethonline-delivery-fast-lane.md`, TASKS.md status note.

AI assistance: Claude Code main session (plan and prompt artifacts).

Human review: decision made by the maintainer.

Commit: this docs commit.

## 2026-09-11 — S001 persistence checkpoint: append-only audit + minimum repositories

Goal: close the persistence gap and provide the minimum adapters the S001 vertical path needs (Hackathon Delivery Mode).

Work completed:

- **T3.5:** migration `20260911041606_audit_event_append_only` — `catenor_private.AuditEvent` accepts INSERT only; UPDATE/DELETE rejected by a row trigger, TRUNCATE by a statement trigger (it bypasses row triggers).
- **T3.3 (minimum set):** application-layer persistence ports and Prisma adapters (`@prisma/adapter-pg`) for SubjectRegistry, DidStateRegistry, AdmissionRepository, TrustAnchorRegistry, AuditLog and UnitOfWork; conditional updates for challenge consumption, run results and the initial root; per-Trust-Domain advisory transaction lock for audit appends so the hash chain stays linear.

Validation: `pnpm test:integration` 92/92 on Testcontainers PostgreSQL (84 migration/constraint tests + 8 repository tests incl. K01, D04 and audit-chain concurrency); `pnpm check` green (251 unit tests).

AI assistance: Claude Code main session.

Human review: pending (next checkpoint report).

Commit: 6dd8278 (append-only audit), e6df1c0 (repositories), plus the docs commit that contains this entry.

## 2026-09-11 — S001 vertical path executable (FAKE adapters) + Privy signer adapters

Goal: make the S001 admission executable end to end and connect the first sponsor adapter (Hackathon Delivery Mode).

Work completed:

- **Orchestration (commit 056d5fd):** application service for U2–U10 and U13; the domain aggregate is rebuilt from persisted state for every command; ports for signers (structured input only), confidential verification (result envelope with facts / null = MISSING, echoes, explanatory reconciliation), configuration, policy, clock, ids. Labeled FAKE adapters (noble signers, scripted confidential verifier) — no sponsor call. [REF-IMPL, flagged] a Decision reached without an accepted confidential run commits to the key-possession outcome and run statuses.
- **Privy (commit d37a6d3):** `PrivyAssertionSigner` / `PrivyBootstrapEndorsementSigner` with the D33 signer boundary; maintainer provisioning script (4 P-256 authorization keys, 2 quorums, P_ASSERT / P_BOOTSTRAP, bootstrap wallet; secrets to a 0600 file outside the repo); unit tests; opt-in live test.
- **Part B scope note (proposal):** `docs/hackathon/plans/2026-09-11-007-part-b-authority-hedera-scope-note.md` — awaiting maintainer approval.

Validation: `pnpm check` green (256 unit tests); `pnpm test:integration` 98/98 — happy path to an ACTIVE initial Trust Anchor with TRUST_ANCHOR_VALID (12/12 checks) and a valid audit chain; wrong-key, representative-RED, stale-evidence, binding-mismatch and evidence-source-mismatch paths never ALLOW. Live Privy not run (T0.4 provisioning pending).

AI assistance: Claude Code main session.

Human review: pending (checkpoint report).

Commit: 056d5fd, d37a6d3, plus the docs commit that contains this entry.

## 2026-09-11 — S001 confidential workflow (CRE SIMULATION) + live Privy signing

Goal: replace the FAKE sponsor adapters with the strongest truthful sponsor-backed path (maintainer checkpoint decisions of 2026-09-11).

Work completed:

- **D38 / D39 (commit dd2b9e5):** early-DENY Decisions commit to `catenor-one/local-decision-evidence/v1` [REF-IMPL]; U4 reuses an existing ACTIVE assertion key before creating a wallet (orphan-wallet residual risk documented).
- **CRE (commit 2f886b1):** `workflows/identity-confidential` from the official template via the `cre-engineer` subagent (headless, simulation only, forbidden commands blocked); base64 sealed context SIMULATION-CONFIRMED; the handler is synchronous; Catenor semantics written in the main session and run inside the TEE: MOCK company fixture, signed Sumsub GET, binding gate, N1–N6, §20.4 facts, minimal reconciliation, §23 commitment, HMAC callback. API: sealer, callback authenticator (HMAC, timestamp, commitment recomputation), receiver, simulation verifier, execution-mode label guard.
- **Step A (SIMULATION):** full S001 through a real `cre workflow simulate` run with a local MOCK Sumsub server — ALLOW → ACTIVE → TRUST_ANCHOR_VALID; representative RED → DENY.
- **Privy LIVE (commit 399b606):** T5.2/T5.3 pass on the Privy development app; runtime-signer denials HTTP 401; step A now uses the real Privy signers.

Validation: `pnpm check` green (295 unit tests); `pnpm test:integration` 100/100; `pnpm test:cre-sim` 2/2 (SIMULATION); `pnpm test:privy-live` 2/2 (LIVE, development app).

AI assistance: Claude Code main session; `cre-engineer` project subagent (headless Claude Code session, official `chainlink-cre-skill`) for the scaffold and sealed-context transport.

Human review: pending (checkpoint report).

Commit: dd2b9e5, 2f886b1, 399b606, plus the docs commit that contains this entry.

## 2026-09-11 — Part B scoped capability + labeled demo command

Goal: implement the approved narrow Part B authority path and one command that runs the S001 demo truthfully.

Work completed:

- **Part B (commit c0b3342):** `packages/authority` capability grant (`CatenorOneCapabilityGrant` wrapping one protocol-shaped Capability; [REF-IMPL] `TOKENIZE_ASSET` / `asset:catenor-one-demo:001`), `authorizeWithCapability` (signature, ACTIVE Trust Anchor issuer, subject, action, resource, expiry — fail closed); structured `signCapabilityGrant` on the Privy and FAKE signers; `AssetTokenizationService` (register Org B, grant, request → executor only on ALLOW); four [REF-IMPL] audit event types (migration `20260911053426_part_b_audit_event_types`).
- **Demo command (commit 6a24714):** `pnpm demo:s001` — REAL Privy + REAL Sumsub sandbox representative + CRE SIMULATION + SYNTHETIC MOCK company, labeled per step; refuses FAKE signers or missing Sumsub values; sanitized run record.

Validation: `pnpm check` green (307 unit tests); `pnpm test:integration` 102/102 (Part B: ALLOW executes once; seven DENY paths never invoke the executor; audit chain valid).

Blocked (maintainer actions): Sumsub sandbox values in `workflows/.env` (step B / demo run); Hedera testnet account + ATS asset for the real executor; B1 for CRE deployment.

AI assistance: Claude Code main session; a general-purpose research subagent for current Hedera ATS SDK/testnet facts (in progress at the time of this entry).

Human review: pending (checkpoint report).

Commit: c0b3342, 6a24714, plus the docs commit that contains this entry.

## 2026-09-11 — Part B Hedera ATS testnet executor (ready, not yet executed)

Goal: connect the approved Part B ALLOW to exactly one real Hedera ATS testnet action.

Work completed:

- **Executor (commit d8a3af0):** `HederaAtsTestnetExecutor` sends one `Factory.deployEquity` transaction to the ATS v8 testnet factory. It creates the security token for `asset:catenor-one-demo:001`, uses a synthetic ISIN that passes the factory's checksum, and puts the grant reference in the regulation `info` field.
  - Built on the typechain bindings from `@hashgraph/asset-tokenization-contracts` 8.0.0 with ethers 6.17.0.
  - Refuses any chain other than Hedera testnet (296).
  - The operator key is read from the git-ignored `apps/api/.env` and never printed.
- **Demo:** after an ALLOW, `pnpm demo:s001` now runs Part B:
  1. grant signed with the Trust Anchor's Privy assertion key;
  2. two DENY requests, with the operator nonce read before and after and required to stay unchanged;
  3. Org B's ALLOW sends the one transaction.
- **Opt-in live test:** `pnpm test:hedera-live`. It spends testnet HBAR and is skipped without `CATENOR_HEDERA_LIVE=1` and the key.

Validation:

- `pnpm check` green (318 unit tests).
- Part B integration 2/2.
- Read-only `eth_call` of `deployEquity` with the exact arguments against the live testnet factory returned an equity address.
- **No Hedera transaction has been sent yet.**

Blocked (maintainer action): a Hedera testnet ECDSA account with an EVM alias and about 25 HBAR, with its key as `HEDERA_OPERATOR_EVM_PRIVATE_KEY` in `apps/api/.env`.

AI assistance: Claude Code main session; a general-purpose research subagent for current Hedera ATS packages, addresses and testnet behavior.

Human review: pending.

Commit: d8a3af0, plus the docs commit that contains this entry.

## 2026-09-11 — Privy / Hedera official skills + specialist subagents

Goal: prepare the final delivery sprint with sponsor-specific specialist agents. AI tooling only, no application code.

Work completed:

- Installed the official Privy skill (`privy`) and three official Hedera skills from `hedera-dev/hedera-skills`:
  - `hedera-hackathon-submission-validator` and `hedera-hackathon-prd`, the hackathon-helper plugin;
  - `hts-system-contract`.
- Created the project subagents `privy-engineer` and `hedera-engineer` on the `cre-engineer` pattern:
  - mechanics only;
  - Catenor semantics stay with the main session;
  - no live transaction without explicit maintainer authorization;
  - no secrets read or printed;
  - no silent raw-key fallback.

Validation:

- `claude agents` lists `cre-engineer`, `hedera-engineer` and `privy-engineer`.
- Headless no-tool delegations confirmed that every preloaded skill body is in each agent's context; the quoted headings match the files.
- The subagent `skills:` field resolved by skill directory name. The display names containing spaces ("Hedera Hackathon …") did not preload, so directory names are used.
- `cre-engineer` still preloads `chainlink-cre-skill`.
- No sponsor call or transaction was made.

AI assistance: Claude Code main session.

Human review: pending.

Artifacts: `docs/hackathon/prompts/2026-09-11-008-privy-hedera-specialist-agents.md`.

Commit: the `chore(ai)` commit that contains this entry.

## 2026-09-11 — Final ETHOnline demo story locked

Goal: lock the final demo as a delivery plan, without redesigning S001 or the frozen Catenor semantics.

Work completed:

- Saved the maintainer prompt verbatim: `docs/hackathon/prompts/2026-09-11-009-final-ethonline-demo-story.md`.
- Added `docs/hackathon/demo/FINAL-DEMO.md` with:
  - cast and wallet separation;
  - the pre-seeded state;
  - seven live demo actions;
  - the REAL / SIMULATION / MOCK / DRY RUN matrix;
  - the Judge Inspector timeline;
  - prize mapping;
  - evidence to capture;
  - reuse;
  - delivery tasks FD-0…FD-9;
  - deferred scope;
  - open decisions.
- S001 `TASKS.md` points to FD-0…FD-9. No S001 task was checked.

Validation: documentation only; no code change.

AI assistance: Claude Code main session.

Human review: story provided by the maintainer; FINAL-DEMO.md pending review.

Commit: the `docs(hackathon)` commit that contains this entry.

## 2026-09-11 — Final demo CP1: Privy SPV EVM wallet → Hedera Testnet compatibility (no broadcast)

Goal: FD-1. Confirm that a Privy-managed EVM wallet under a narrow policy can sign the ATS `deployEquity` transaction for Hedera Testnet (eip155:296) before any HBAR is spent.

Work completed:

- **`privy-engineer`** (headless, git writes and `.env` / key-file reads blocked), LIVE on the Privy development app:
  - two new dedicated P-256 authorization keys (SPV management owner, SPV runtime signer), written once to a 0600 file outside the repo;
  - one key quorum;
  - policy `catenor-one-SPV-execution`: ALLOW `eth_signTransaction` only when chain_id 296 AND `to` is the ATS v8 Factory; DENY export; default-deny;
  - one SPV EVM wallet with that policy and the runtime quorum as an override-scoped additional signer.
  - The `deployEquity` calldata, with the SPV address as ATS admin and issuer, was signed; the recovered sender equals the wallet and the chain is 296.
  - Wrong chain, wrong target and plain transfer were denied (400 `policy_violation`); export and policy update with the runtime key were denied (401).
  - Nothing was broadcast.
- **`hedera-engineer`** (READ-ONLY):
  - `deployEquity` estimate 7.40M gas at a 1,160 Gwei-equivalent gas price ≈ 8.6 HBAR;
  - current Hedera docs: unused gas fully refunded;
  - hollow-account (HIP-583) funding and completion flow;
  - `issueByPartition` signature, default partition `0x…01` and `ROLE_ISSUER`;
  - lifecycle options, recommending the ATS dividend corporate action;
  - "Tokenization of Anything" requirements from the ETHGlobal prize page: ATS; issuance + configuration + ≥1 lifecycle operation; Hedera testnet; video ≤5 min; public repo.
- **Main session:**
  - audited both transcripts (one provisioning run created resources; the earlier runs failed on module resolution before generating any key);
  - re-ran a READ-ONLY `eth_call` / `eth_estimateGas` of `deployEquity` with the SPV address as operator: accepted.

Validation: evidence in `artifacts/privy/final-demo/cp1-spv-hedera-compat.md` (Privy ids and keys omitted). `pnpm check` green.

Open, for maintainer decisions (FINAL-DEMO §11):

- gas funding of live-created wallets (proposed: a Privy gas-sponsor wallet);
- how the SPV policy allows `issueByPartition`;
- the lifecycle operation choice.

AI assistance: Claude Code main session; `privy-engineer` and `hedera-engineer` project subagents (first live use).

Human review: pending (CP1 report).

Commit: the `docs(hackathon)` commit that contains this entry.

## 2026-09-11 — Final demo FD-3: first LIVE Hedera ATS transaction, signed by the Privy SPV wallet after a Catenor ALLOW

Goal: the maintainer-authorized single live `Factory.deployEquity` on Hedera Testnet through the full Catenor path, with no raw operator key.

Work completed:

- **Executor and preflight (commit 6397df4):**
  - `PrivySpvAtsExecutor` prepares the exact transaction read-only (eth_call + estimateGas from the SPV address; balance ≥ gasLimit × gasPrice) → Privy `eth_signTransaction` with the SPV runtime-signer key → signer boundary (the signed transaction must equal the prepared one) → hashio broadcast → receipt / EquityDeployed / read-back.
  - `pnpm demo:s001` Part B uses this executor and broadcasts only with `--hedera-live`. The raw-key executor stays dev/test only.
  - Demo resource renamed `spv:catenor-demo-001` [REF-IMPL].
  - `preflight:spv`: 14/14 checks (wallet, exact policy rules, read-only simulation, Privy dry signatures, three policy denials).
- **Dry run** (`pnpm demo:s001`, real Sumsub sandbox representative):
  - S001 ALLOW → ACTIVE → `TRUST_ANCHOR_VALID`;
  - grant, then DENY `SUBJECT_MISMATCH` / `SIGNATURE_INVALID` with the SPV nonce 0 → 0;
  - the exact deployEquity for the real grant is identical to the preflight in from, to, chain, gas estimate, gas limit and max HBAR; only the grant id differs;
  - audit chain valid.
- **Live run** (`pnpm demo:s001 --hedera-live`, the one authorized transaction):
  - tx `0x8265479fc7236b7b092899b49cfaf0d8d1ecb05e7ce2ff69aeda587e4ad75897`: SUCCESS, from the SPV wallet at nonce 0, to the ATS Factory, value 0, gas limit 15M;
  - ATS equity `0x7aeDA4b6B89dA392Efd88AD0Fcb075e12ab6a418` (`0.0.10479921`), "Catenor One Demo Asset 001 (SYNTHETIC)" / `C1DA001` / ISIN `XXCATENOR019`, supply 0 / max 1,000,000, the SPV holds admin + issuer, KYC off;
  - the on-chain regulation `info` carries the real grant id;
  - audit chain `… ASSET_ACTION_AUTHORIZED, ASSET_ACTION_EXECUTED` valid.
- **Verification** (`pnpm --filter @catenor-one/api verify:ats <hash>`, public data only): receipt, decoded on-chain input, token state and roles, and the Mirror Node result agree.
  - Gas used 6,898,815 at 1.11e12 weibar = **7.65768465 HBAR**, which equals the balance change (100 → 92.34231535).
  - Unused gas was refunded.

Validation: `pnpm check` green (329 unit tests); `pnpm test:integration` 102/102.

Not done (next): `issueByPartition` to Investor A / B (the SPV policy does not allow it yet — FINAL-DEMO §11.2); FD-2 runtime creation of the SPV wallet and policy.

AI assistance: Claude Code main session.

Human review: maintainer authorized the live transaction explicitly (prompt 2026-09-11-011); report pending.

Artifacts:

- `artifacts/hedera/final-demo/deploy-equity.md`, `deploy-equity.verify.json`;
- prompts `2026-09-11-010`, `2026-09-11-011`.

Commit: 6397df4, plus the `feat(hedera)` live-checkpoint commit that contains this entry.

## Entry template

```md
## YYYY-MM-DD — Short title

Goal:
Work completed:
Validation:
AI assistance:
Human review:
Artifacts:
Commit:
Notes:
```
