# Plan — 2026-09-10-005 — S001 Phase 0: cre-engineer, CRE access, CRE runtime spike, Sumsub spike

**Project:** Catenor One  
**Slice:** S001 — Trust Anchor Admission  
**Related prompt:** `docs/hackathon/prompts/2026-09-10-006-s001-phase0-cre-sumsub-spikes.md`  
**Tasks:** T0.2 (CRE access check), T0.6 (`cre-engineer`), T0.7 (CRE runtime spike), T0.8 (Sumsub spike)  
**Status:** Executed and reviewed (2026-09-10) — T0.5, T0.6, T0.7, T0.8 (individual) complete and approved; T0.8b (Sumsub company/KYB) blocked by tenant entitlement; see "Status update" below. Original status at execution time: awaiting maintainer review; T0.8 live run blocked on credentials.  
**Type:** Tooling + technical validation (no production code)

## Constraints

- Privy decision pending (EVM vs Solana assertion key, signing primitive, crypto profile): no Privy spike, no assertion wallet, no change to D1/D3, Ed25519/`eddsa-jcs-2022` assumptions untouched.
- No production S001 code; no `workflows/identity-confidential`; no dependencies installed in the repo; no migrations; no deploy.
- Spikes run in git-ignored `scratch/` with synthetic data and synthetic secret values only.

## Steps and how they were executed

1. **`cre-engineer`** — `.claude/agents/cre-engineer.md` created with `skills: [chainlink-cre-skill]` (Claude Code supports subagent skill preloading; the full skill content is injected at startup — resolves B9). Validation: `claude agents --setting-sources project` lists `cre-engineer`; a fresh headless Claude Code session delegated a no-tools validation prompt to it, and it quoted the preloaded skill's Hard Guardrail #12 verbatim and its own must-not-redefine list. The running IDE session could not invoke it because `.claude/agents/` did not exist when that session started (documented Claude Code behavior: restart needed for a new agents directory), so both spike runs used headless sessions delegating to `cre-engineer`, with deploy/activate/update/pause/delete, `cre secrets`, key linking, login/logout and git writes blocked at the tool-permission layer.
2. **CRE access** — `cre whoami`, `cre account access`, `cre registry list`, `cre account list-key` (outputs redacted). Confidential Workflows docs checked for a programmatic enrollment status.
3. **CRE runtime spike** — run 1: scaffold via `cre init` (`hello-confidential-workflows-ts`), probes for secrets, crypto, sealed context (+5 tamper cases), JCS, salt, time, globals, HTTP, trigger shape, determinism, build. Main-session review found gaps (missing findings file, misattributed registry failure, no production-like limit tests, no timeout tests) → run 2 closed them (private-registry init, production-like limits file, size/call/timeout probes, trigger sizes, log-visibility sources, type-check cause). The main session re-checked the verdicts against the raw simulator output.
4. **Sumsub spike** — documentation verification delegated to a general-purpose subagent (docs.sumsub.com only; no API calls). Harness written in `scratch/sumsub-spike/` from the documented endpoints; it refuses non-sandbox tokens and writes sanitized shapes only. Live run blocked: no sandbox credentials in the environment.

## Outcome

- Findings: `slices/S001-trust-anchor-admission/spikes/T0.7-cre-runtime.md`, `slices/S001-trust-anchor-admission/spikes/T0.8-sumsub-sandbox.md`.
- Sealed input feasibility (simulation): CONFIRMED. Deployed-TEE behavior UNCONFIRMED (B1 open).
- Sumsub: documentation-level results with several PLAN-relevant corrections proposed; live semantics UNCONFIRMED.
- PLAN/TASKS not modified; proposed corrections listed in both findings files for maintainer review.

## Next step (after maintainer approval only)

Maintainer reviews `cre-engineer` and both findings files → decides the proposed PLAN corrections → provides Sumsub sandbox credentials locally → live T0.8 run → Privy decision → P0 Fast Lane.

## Appendix — delegated prompts

- CRE spike run 1 prompt: preserved from `scratch/cre-runtime-spike-prompt.md` (summary): measure, in simulation only, batched secrets, @noble/hashes KATs, AES-256-GCM sealed-context open with 5 tamper cases, JCS, deterministic salt, `runtime.now()`, QuickJS globals, HTTP call count/size/timeout, trigger payload shape/size, determinism, build; STOP and report if AES-GCM/HKDF fails; no fallback.
- CRE spike run 2 prompt (summary): write the missing FINDINGS.md; verify `--deployment-registry private`; production-like limits file tests (5 vs 6 calls, 9 vs 11 KB request, 99 vs 101 KB response, per-request timeout cases); trigger payload sizes; TEE log-visibility sources; type-check cause.
- Sumsub documentation research prompt (summary): answer documented auth, company/individual applicant creation, KYB 2.0 beneficiary linking, `/one` fields, review statuses, rejection labels, `testCompleted`, company checks and mock data, role-verification strength, limits; mark anything not documented as NOT DOCUMENTED.

## Status update (2026-09-10, after maintainer review)

| Item | Outcome |
|---|---|
| T0.6 `cre-engineer` | complete — approved after three corrections (read-only account inspection; `.env` handling rule; simulation never implies deployment) |
| T0.7 CRE runtime spike | complete — findings approved (PLAN D37); results SIMULATION-CONFIRMED only; base64 sealed-context transport = APPROVED DESIGN, NOT YET SIMULATION-CONFIRMED (tested in T8.2; whole sealed path re-checked deployed in T16.2) |
| T0.8 Sumsub (individual) | PASSED — live sandbox run after the maintainer placed credentials locally; normalization decisions D26–D28 |
| T0.8b Sumsub (company/KYB) | blocked by tenant entitlement (B11); Hybrid Demo Profile approved (D31) |
| T0.5 Privy assertion key | PASSED WITH APPROVED DESIGN AMENDMENT (D33–D35), run in a later step of the same day |
| Q7 bootstrap key | approved (D36): separate Bootstrap Endorsement Key wallet with its own management-owner and runtime-signer authorization keys |
| PLAN / TASKS | Rev 2.2 → 2.6 applied; source-of-truth documents aligned (T0.9 ready for its separate commit) |

