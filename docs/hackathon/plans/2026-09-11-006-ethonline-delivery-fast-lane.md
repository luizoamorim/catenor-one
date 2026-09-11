# Plan — 2026-09-11-006 — Catenor One — ETHOnline Hackathon Delivery Fast Lane

**Project:** Catenor One  
**Scope:** S001 Trust Anchor Admission vertical path, then one authority-gated Hedera ATS action  
**Related prompt:** `docs/hackathon/prompts/2026-09-11-007-ethonline-delivery-fast-lane.md`  
**Status:** Approved by the maintainer (2026-09-11); in force until the ETHOnline submission  
**Type:** Delivery and execution strategy. **Not** an architecture redesign.

## Context

- The ETHOnline submission deadline is **Sunday**.
- The core engineering foundations are largely in place:
  - Phase 0 research and spikes;
  - framework-free domain packages;
  - RFC 8785 and W3C Data Integrity (`eddsa-jcs-2022`) tests;
  - real Sumsub individual sandbox integration (T0.8);
  - real Privy Ed25519 signing spike (T0.5);
  - PostgreSQL schema, migration and integration tests (T3.1, T3.2).
- The remaining risk is **delivery breadth, integration and demo completion**, not foundations.

## Decision

From now until submission, implementation is optimized for **the smallest credible end-to-end demo path**.

This changes **task prioritization only**. It does **not** change:

- Catenor Protocol semantics;
- the S001 facts or `policy:trust-anchor-admission:v1`;
- Trust Anchor Admission semantics;
- key-purpose separation;
- the public/private evidence rules and COMMITMENT_ONLY retention;
- the approved evidence profiles (Hybrid Demo Profile: company SYNTHETIC MOCK, representative REAL SUMSUB SANDBOX);
- the security claims.

## Rules

- TASKS.md stays the engineering backlog and the traceability source.
- Task order is no longer read as "finish every task of one phase before touching the next".
- A task may be implemented only as far as the demo needs, provided that:
  - the implementation is truthful;
  - unfinished scope stays explicitly **unchecked** (annotated `POST-DEMO` / `DEFERRED` where useful);
  - no fake sponsor integration is presented as real (FAKE, MOCK and SIMULATION are labeled wherever they appear);
  - no frozen semantic is silently weakened.
- SPEC, ACCEPTANCE and TEST-VECTORS stay frozen unless a genuine semantic discrepancy is found.
- **Scope rule of thumb:** if something is neither needed for the demo to execute nor needed to make an important technical claim credible, defer it. Deferred tasks are never deleted.
- Commits stay small and logical after each stable checkpoint. Before every commit:
  - run the relevant tests;
  - inspect the staged files;
  - make sure nothing staged is a `.env` file, `scratch/` content, a secret or a generated credential.
  - No amend or squash; no push without explicit authorization.

## Demo definition of done

**A. Trust Anchor Admission (S001).** The candidate organization goes through this sequence:

1. `did:catenor` Subject.
2. Credential Assertion Key (Privy Ed25519).
3. Proof of key possession.
4. Evidence: REAL Sumsub sandbox representative result, plus SYNTHETIC MOCK company evidence while KYB entitlement is absent (B11).
5. Chainlink CRE confidential evaluation:
   - the real deployed workflow if Confidential Workflows enrollment (B1) is available;
   - otherwise the strongest truthful simulation path, labeled **SIMULATION**.
6. Normalization.
7. Minimal reconciliation.
8. `policy:trust-anchor-admission:v1` returns ALLOW.
9. Bootstrap Authority endorsement.
10. ACTIVE Trust Anchor.

At least one DENY path is also shown.

**B. Authority and asset action.**

- The admitted Trust Anchor holds explicit authority and performs one meaningful RWA action; Hedera ATS testnet is the preferred real target.
- A subject without the required authority receives DENY, and nothing executes on Hedera.
- Part B is outside S001, and no frozen SPEC yet defines its authority semantics. Before it is coded, a **one-page scope note** (which authority, which check, which Hedera action) is written and approved by the maintainer. That note must use Catenor Protocol authority semantics, not invented ones.

**C. Judge visibility.** A minimal Judge Inspector makes these obvious:

- the canonical `did:catenor`;
- the Credential Assertion Key;
- evidence sources with REAL / MOCK / SIMULATION labels;
- the normalized provider result and the reconciliation result;
- the policy facts (FALSE vs MISSING) and ALLOW/DENY;
- the bootstrap endorsement and the Trust Anchor status (labeled operational projection);
- the authority used for the asset action;
- audit events;
- sponsor integration evidence.

No production-grade general-purpose UI is required.

## Minimal reconciliation (demo version)

- `VerificationObservation`: provider, applicant/provider reference, `bindingRef`, `observedAt`, provider status/result, evidence reference/source.
- Result: `CONSISTENT` | `MISMATCH` | `STALE` | `INCOMPLETE`.
- It is an **explanatory classification** of the existing binding gate and normalization output (PLAN §4.2, §20.4, §20.8). It is **not** a policy fact and adds or changes no fact:

| Observation | Reconciliation result | Effect under existing semantics |
|---|---|---|
| GREEN, current, binding matches | CONSISTENT | derivation continues; the policy decides |
| RED where valid/current verification is required | MISMATCH | the normalized requirement is `false` → DENY |
| Binding mismatch | MISMATCH | run `ERROR`, no facts (existing gate) → non-ALLOW |
| Older than the configured maximum age | STALE | `EVIDENCE_FRESH = false` → DENY |
| Pending, missing or unparseable | INCOMPLETE | fact `false` or MISSING per the existing rules → DENY |

- This is **not** S002 Subject Continuity (MATCH / REVIEW / NO_MATCH).

## Chainlink reality rule

- `cre-engineer` is used for CRE mechanics only.
- If B1 is granted, the demo deploys and uses the real confidential workflow.
- If not, the demo runs the CRE simulation where needed, labeled **SIMULATION**, and never claims deployed TEE execution.
- Application development does not wait for B1.

## Delivery sequence

| Day | Goal |
|---|---|
| Thursday | executable S001 vertical path |
| Friday | authority + Hedera real demo path |
| Saturday | Judge Inspector / frontend, full rehearsal, bug fixing |
| Sunday | video, README and submission material, ETHGlobal dashboard, screenshots, final sponsor claims — **no new architecture** |

Vertical build order, after the minimum persistence adapters:

1. Application orchestration for one S001 session.
2. Privy assertion signer.
3. Bootstrap Endorsement signer.
4. Sumsub real representative adapter.
5. SYNTHETIC MOCK company adapter.
6. Normalization + minimal reconciliation.
7. Chainlink CRE workflow / integration.
8. Policy execution.
9. Admission persistence / ACTIVE Trust Anchor.
10. One API route or command that runs the flow.
11. One DENY scenario.
12. Minimal Judge Inspector.

## Immediate steps

1. This plan and its prompt artifact (docs commit).
2. **AuditEvent append-only protection** (the approved D16 control, TASKS T3.5): INSERT allowed, UPDATE and DELETE denied on `catenor_private.AuditEvent`; tested on real PostgreSQL. Separate commit `fix(api): enforce append-only S001 audit events`. T3.2 is not expanded otherwise.
3. **T3.3, minimum repositories only:**
   - `SubjectRegistry`: create/find the candidate.
   - `DidStateRegistry`: publish/read the DID Document and Verification Method.
   - `AdmissionRepository`: session; challenge issue/load/conditional consume; verification run; decision + trace; Admission Record.
   - `TrustAnchorRegistry`: establish the initial Trust Anchor; read its status.
   - `AuditLog`: append; timeline.
   - `UnitOfWork`: the critical admission transaction.
   - Prisma stays in infrastructure. Tests cover demo behavior and critical invariants only. Separate commit.
4. Continue into the vertical path without stopping at historical phase boundaries.

## Deferred until after the demo

The tasks stay in TASKS.md, unchecked:

- **P1 hardening:** T8.7 DON report, T9.5 report verifier, T17.4 live binding mismatch, T18.4 ADRs and protocol amendment note.
- **Beyond the demo:**
  - T3.4 public read model — only the reads the demo/judge path uses;
  - T9.4 run-expiry sweep;
  - T11.4 idempotency/retry breadth;
  - T12.2 tamper matrix on the DB;
  - T12.3 offline verifier script;
  - T13.3 wrong-key browser control (unless it is the chosen DENY path);
  - exhaustive lifecycle transitions, generic CRUD or APIs, S002 Subject Continuity.
- **Operator access gate (T4.2/T4.3, AC-001–003):** implemented only if time permits. Until then the demo runs as the maintainer-operator, and the submission must not claim the Privy-verified allowlist gate.

## Stop conditions

Stop only when:

- a maintainer action is required (e.g. T0.4 Privy wallet/authorization-key provisioning, Hedera testnet account, Railway project);
- a sponsor credential or enrollment blocks the next executable step;
- a frozen semantic conflicts with the implementation;
- a meaningful end-to-end checkpoint works and needs human review.

Reports at a stop contain: demo status, commits, tests, next demo-critical step, actual blocker, deferred work.
