# Catenor One — Reproducible Demo (clean-room runbook)

> The canonical technical walkthrough of the Catenor One ETHOnline 2026 demo, for maintainers, judges and teammates.
> Every executable step is a numbered script under [`scripts/demo/`](scripts/demo/); the future `/demo` UI is only a
> visual replay of this flow.

Catenor Protocol is the standard (identity, credentials, authority, policy). Catenor One is its reference
implementation. The sponsors are infrastructure: **Chainlink CRE** runs the confidential verification and the
distribution computation, **Privy** holds the keys and enforces wallet execution controls, **Hedera ATS** tokenizes and
records the asset lifecycle, and the **Sumsub sandbox** is the identity provider. Catenor decides; the sponsors execute
within Catenor's decisions.

**Contents**

1. [What is being demonstrated](#1-what-is-being-demonstrated)
2. [Prerequisites](#2-prerequisites)
3. [External accounts](#3-external-accounts)
4. [Environment variables](#4-environment-variables)
5. [Secrets vs public refs](#5-secrets-vs-public-refs)
6. [Create everything from scratch](#6-create-everything-from-scratch)
7. [Fund the testnet wallets](#7-fund-the-testnet-wallets)
8. [Every stage, manually](#8-every-stage-manually)
9. [Inspect the evidence after each stage](#9-inspect-the-evidence-after-each-stage)
10. [Verify Chainlink, Privy and Hedera independently](#10-verify-chainlink-privy-and-hedera-independently)
11. [REAL / SIMULATION / MOCK](#11-real--simulation--mock)
12. [Run the final guided demo](#12-run-the-final-guided-demo)
13. [Reset local state (and what a reset cannot undo)](#13-reset-local-state-and-what-a-reset-cannot-undo)
14. [Judge matrix](#14-judge-matrix)
15. [Chainlink CRE deployment](#15-chainlink-cre-deployment)
16. [Why each step exists](#16-why-each-step-exists)

---

## 1. What is being demonstrated

**Thesis: ownership ≠ current eligibility.** An investor who legally holds tokenized units stays the owner, and ATS
still records its dividend entitlement. A regulated distribution is paid only to holders whose credential is valid
*and* whose current identity/AML evidence is still clean. That check and the distribution arithmetic run inside a
Chainlink CRE Confidential Workflow, so the private evidence never leaves the TEE.

### The asset

```text
synthetic real-world real-estate asset          (SYNTHETIC — no real property)
        ↓ owned/controlled through
Catenor One Demo SPV 001                        (did:catenor SPV Subject, Privy EVM execution wallet)
        ↓ 1,000 equity-interest units
Hedera ATS equity  "Catenor One Demo SPV 001 (SYNTHETIC)" / C1SPV001
```

We do **not** tokenize a land deed. Each ATS unit is an equity interest in the synthetic SPV.
Allocation: **Investor A 600 units, Investor B 400 units.**

### The authority chain

```text
Root Trust Anchor  (admitted by S001: Sumsub sandbox representative + CRE + policy:trust-anchor-admission:v1)
   │ Relationship Credential ── Sponsor AUTHORIZED_SPONSOR_IN trust-domain:catenor-one-demo   [REF-IMPL predicate]
   │ Capability grants ──────── TOKENIZE_ASSET · DEFINE_OFFERING_POLICY · CREATE_AGENT ·
   │                            CREATE_DISTRIBUTION · DELEGATE_DISTRIBUTION_AUTHORITY           [REF-IMPL actions]
   ▼                            (resource spv:catenor-demo-001; each grant signed eddsa-jcs-2022)
Sponsor ── TOKENIZE_ASSET ──────────▶ SPV Subject + Privy execution wallet + policy   (SPV SPONSORED_BY Sponsor)
        ── DEFINE_OFFERING_POLICY ──▶ signed offering pinning policy:offering-eligibility:v1
        ── CREATE_AGENT ────────────▶ Distribution Agent Subject + Privy execution wallet + narrow policy
        ── Relationship Credential ─▶ Agent AGENT_OF Sponsor          (who the Agent acts for)   [REF-IMPL]
        ── delegated grant ─────────▶ Agent EXECUTE_DISTRIBUTION on spv:catenor-demo-001 (what it may do)
                                      valid only because the Sponsor holds CREATE_DISTRIBUTION AND
                                      DELEGATE_DISTRIBUTION_AUTHORITY from the ACTIVE Trust Anchor
```

**Relationship ≠ Capability.** The scripts show it:

- The Agent's distribution request is **DENIED** after creation and still **DENIED** with only the `AGENT_OF`
  relationship.
- It is **ALLOWED** only with the delegated grant.
- Delegating `TOKENIZE_ASSET` is refused as `ACTION_NOT_DELEGABLE` before any signature is requested.

`OFFICER_OF` is the protocol's only relationship example, and it relates a *Human* to an *Organization*. The predicate
vocabulary is an OPEN design item (`specification/authority/01-RELATIONSHIPS.md` §5). Catenor One therefore uses
explicitly labeled [REF-IMPL] predicates and does not invent a frozen term.

### The investor path

```text
Sumsub SANDBOX applicant (synthetic person, externalUserId = private bindingRef)
   ↓ CRE INVESTOR_ELIGIBILITY (confidential): binding gate, normalization, facts, evidence commitment
Catenor Verifiable Credential  CatenorInvestorEligibilityCredential — issued by the Trust Anchor
   {investorIdentityVerified, investorAmlClear, evidenceCommitment}  (W3C VC 2.0, eddsa-jcs-2022, no PII)
   ↓ holder key (the investor's own Ed25519 authentication key — never its money wallet)
Investor Verifiable Presentation  (bound to the verifier's challenge + domain)
   ↓ CRE (inside handlerInTee): 7 named checks + CURRENT Sumsub evidence + reconciliation + policy
Catenor protocol Decision per investor
```

The seven presentation checks are all run inside the TEE and reported by name, never as one "verified" label:

- `PRESENTATION_WELL_FORMED`
- `HOLDER_PROOF_VALID` (signature, `authentication`, holder key, challenge, domain)
- `CREDENTIAL_SIGNATURE_VALID`
- `ISSUER_AUTHORIZED` (issuer, key and credential type pinned by the Trust Domain)
- `SUBJECT_IS_HOLDER`
- `WITHIN_VALIDITY_WINDOW`
- `STATUS_ACTIVE` (an issuer-signed status statement for this credential, fresh)

### The distribution (computed inside CRE)

```text
revenue event 10 HBAR ─▶ Agent requests (delegated authority verified: TA → Sponsor → Agent)
   ─▶ sealed context {revenue, holdings, VPs, status statements, applicant refs, policy pin}
   ─▶ Chainlink CRE Confidential handlerInTee:
        verify VP/VC/status → current Sumsub → normalize → reconcile → policy:distribution-eligibility:v2
        → share = revenue × units / total  → PAY or HOLD per holder
   ─▶ minimized result + evidence commitment (no VC, VP, applicant id or provider data)
   ─▶ Catenor verifies (HMAC callback, commitment, arithmetic, holder set) → one protocol Decision per holder
   ─▶ Agent's Privy wallet (policy: chain 296 ∧ to ∈ {A, B} ∧ ≤ 20 HBAR) pays PAY holders only

Investor A  600 units  60%  → ALLOW → PAY  6 HBAR
Investor B  400 units  40%  → DENY  → HOLD 4 HBAR   (credential still valid; CURRENT review RED / SANCTIONS / FINAL)
```

B still holds its 400 units and its ATS dividend entitlement. It just is not paid now.

---

## 2. Prerequisites

| Tool | Version used | Needed for |
|---|---|---|
| Node.js | ≥ 24 (24.10) | everything |
| pnpm | 10.11 | `pnpm install` (workspace) |
| Docker | running daemon | the local PostgreSQL (stage 01), unless `RAILWAY_DATABASE_PUBLIC_URL` points the runner at the Railway Postgres |
| Bun | 1.4 | the CRE workflow dependencies (`workflows/identity-confidential`) |
| Chainlink CRE CLI | v1.33.0 (`~/.cre/bin/cre`) | CRE simulation / deployment |
| curl | any | reachability checks |
| Railway API or an HTTPS tunnel | optional | only for a **deployed** CRE workflow (public callback URL; `docs/deployment/RAILWAY.md`) |

```bash
pnpm install
(cd workflows/identity-confidential && bun install)
scripts/demo/00-check-prerequisites.sh          # READ-ONLY: tools, dependencies, Hedera Testnet reachability
```

---

## 3. External accounts

| Account | What for | Can a judge skip it? |
|---|---|---|
| **Privy** development app (app id + secret) | every key: assertion keys, holder keys, SPV / Agent / investor wallets, policies, key quorums | yes: use the rehearsal evidence (§10) |
| **Sumsub** sandbox (app token `sbx:…` + secret) | synthetic applicants; the TEE reads their current review | yes |
| **Chainlink CRE** account (`cre login`) | only for a *deployed* Confidential Workflow; simulation needs no login | yes: simulation runs locally |
| **Hedera Testnet** HBAR ([faucet](https://portal.hedera.com/faucet)) | only the `--live` Hedera stages | yes: preflights spend nothing |

Nothing in this demo touches a mainnet.

---

## 4. Environment variables

**Provided by the maintainer** (cannot be generated; validated by `01-setup-env.sh` **without printing them**):

| File (git-ignored) | Variable | Kind |
|---|---|---|
| `apps/api/.env` | `PRIVY_APP_ID` | account id |
| `apps/api/.env` | `PRIVY_APP_SECRET` | **secret** |
| `workflows/.env` | `SUMSUB_APP_TOKEN_VAR` | **secret** (must start with `sbx:`: sandbox only) |
| `workflows/.env` | `SUMSUB_SECRET_KEY_VAR` | **secret** |
| CRE CLI session | `cre login` | account session (deployment only) |

**Generated automatically** by the scripts; nobody copies these by hand:

| Where | Variables | Written by |
|---|---|---|
| `workflows/.env` | `CATENOR_INTERNAL_API_TOKEN_VAR`: CRE ↔ Catenor channel secret (sealing, callback HMAC, commitment salt) | 01, if absent |
| `.catenor-demo/state.env` | `DEMO_INSTANCE` | 01 |
| | `DEMO_ASSERTION_*`, `DEMO_BOOTSTRAP_*` (owner public keys, quorum ids, policy ids, bootstrap wallet id / public key), `DEMO_BOOTSTRAP_CONFIGURATION_HASH` | 10 |
| | `DEMO_TRUST_ANCHOR_DID` | 11 |
| | `DEMO_SPONSOR_DID` | 20 |
| | `DEMO_SPV_*` (owner public key, quorum id, DID, wallet id and address, policy id) | 30 |
| | `DEMO_OFFERING_ID` | 31 |
| | `DEMO_INVESTOR_{A,B}_{DID,ADDRESS,WALLET_ID}` | 40, 41 |
| | `DEMO_AGENT_*` | 70 |
| | `DEMO_TREASURY_*` (optional) | 50 |
| | `DEMO_EQUITY_ADDRESS`, `DEMO_*_TX` | 60–63, 83 (`--live`) |
| | `DEMO_REVENUE_EVENT_ID` | 81 |
| | `DEMO_PLAN_ID` | 82 |
| | `DEMO_CRE_*` (trigger address, callback URL, workflow id, mode) | `cre/configure.sh` |
| `.catenor-demo/runtime.env` (0600) | `DEMO_DATABASE_URL` · `DEMO_{ASSERTION,BOOTSTRAP,SPV,AGENT,TREASURY}_RUNTIME_AUTHORIZATION_KEY` · `DEMO_CRE_TRIGGER_PRIVATE_KEY` | 01, 10, 30, 70, 50, configure |
| `~/.catenor-one/clean-room/<instance>/*.json` (0600, dir 0700) | management-owner private keys: assertion, bootstrap, SPV, Agent, investors A/B, treasury | 10, 30, 40, 41, 70, 50 |

---

## 5. Secrets vs public refs

```text
management-owner private keys  →  ~/.catenor-one/clean-room/<instance>/  (0600, outside the repo, NEVER runtime env)
runtime-signer keys, DB URL,
CRE trigger key                →  .catenor-demo/runtime.env              (0600, never printed)
Privy app secret, Sumsub       →  apps/api/.env, workflows/.env          (maintainer, never printed)
public refs                    →  .catenor-demo/state.env                (DIDs, addresses, Privy ids, public keys, tx hashes)
private operator evidence      →  .catenor-demo/runs/*.json              (sanitized; local only, git-ignored)
```

- A management-owner key can change a wallet's policy, so it never enters the runtime. The runtime holds only a
  runtime-signer key, and that key is scoped by the policy it cannot change.
- The owner keys are read back only by two owner-authorized steps, both run by the maintainer: `60-tokenize-spv.sh
  --live` (it adds the equity-pinned SPV rules) and `50 --setup-treasury`.
- The evidence records contain DIDs and public addresses. They never contain applicant ids, bindingRefs, keys, raw
  provider responses, VCs or VPs. The link between an investor DID and its wallet is a private Account Binding, so
  `.catenor-demo/` is operator-private and is never committed.

---

## 6. Create everything from scratch

A clean room creates a **new** Trust Domain signer infrastructure, a new Trust Anchor, Sponsor, SPV, investors, Agent
and wallets. Previously funded demo wallets are never part of the clean-room identity state.

```bash
scripts/demo/00-check-prerequisites.sh
scripts/demo/01-setup-env.sh          # PostgreSQL (Railway if RAILWAY_DATABASE_PUBLIC_URL is set, else local Docker) + migrations
scripts/demo/run-all.sh               # the whole walkthrough, SAFE: no Hedera broadcast
```

`run-all.sh` without `--live`:

- creates Privy development-app resources, Sumsub **sandbox** applicants and runs CRE simulations, all non-spending;
- runs every Hedera stage as a READ-ONLY preflight;
- stops at the first failing stage.

---

## 7. Fund the testnet wallets

The clean room creates new wallets with 0 HBAR. Funding is **TESTNET BOOTSTRAP FUNDING**: it is never Catenor
authority and never a distribution.

```bash
scripts/demo/50-fund-testnet-wallets.sh           # READ-ONLY: every wallet, current balance, suggested amount
```

| Wallet | Suggested | Why |
|---|---|---|
| SPV execution wallet | 25 HBAR | `deployEquity` ≈ 7.7 HBAR used, but a 15M-gas reservation ≈ 16.7 HBAR must be covered up front; + 2 issuances ≈ 1 + dividend ≈ 0.8 |
| Distribution Agent wallet | 12 HBAR | the 6 HBAR payout + gas (the demo revenue is paid from this wallet) |
| Investor A / Investor B | 1 HBAR each | account activation (HIP-583 lazy create ≈ 0.69 HBAR fee) so the payout is a plain ≈ 21K-gas transfer |

Two ways to fund:

- **A. Manual faucet.** Send the amounts from [portal.hedera.com/faucet](https://portal.hedera.com/faucet) to the
  printed EVM addresses, then run `scripts/demo/50-fund-testnet-wallets.sh --wait`, which polls until they are
  funded.
- **B. Optional demo treasury.**
  - `scripts/demo/50-fund-testnet-wallets.sh --setup-treasury` creates a Privy wallet whose policy allows only chain-296
    transfers of ≤ 30 HBAR.
  - Fund it once from the faucet with at least 45 HBAR.
  - Then run `scripts/demo/50-fund-testnet-wallets.sh --live --from-treasury`, which asks for a typed confirmation.

The Agent wallet exists only after stage 70. `run-all.sh` creates the Agent before the funding stage; if you run the
stages by hand, re-run 50 after 70.

---

## 8. Every stage, manually

Every script prints, **before acting**:

- STEP, actor and Catenor operation;
- what changes;
- the sponsor integration involved;
- the mode (READ-ONLY / LOCAL / SPONSOR LIVE (non-spending) / CONFIDENTIAL (CRE) / TESTNET LIVE);
- the concrete DIDs and addresses;
- the expected result.

A Hedera broadcast needs `--live` **and** a typed confirmation: the stage id, or `CATENOR_DEMO_CONFIRM=<stage id>`
when not interactive. `--yes` never authorizes a broadcast.

| # | Script | What happens | Expected |
|---|---|---|---|
| 00 | `00-check-prerequisites.sh` | tools, deps, relay + Mirror Node reachability | RESULT: OK |
| 01 | `01-setup-env.sh` | credentials check (never printed), channel token, PostgreSQL (Railway or local) + migrations | all PRESENT |
| 02 | `02-reset-local-demo.sh [--yes]` | local reset only (§13) | — |
| 10 | `10-create-trust-domain.sh` | fresh S001 signer infrastructure (Privy: assertion quorum + P_ASSERT, separate bootstrap key); hash-pinned Bootstrap Configuration | configuration hash |
| 11 | `11-admit-root-trust-anchor.sh` | S001 admission: ORGANIZATION did, Privy assertion key, key possession, Sumsub sandbox representative GREEN, **CRE** TRUST_ANCHOR_ADMISSION, policy, bootstrap endorsement | ALLOW → ACTIVE → TRUST_ANCHOR_VALID |
| 20 | `20-create-sponsor.sh` | Sponsor ORGANIZATION did + its own assertion key (Privy Ed25519) | no capability yet |
| 21 | `21-trust-anchor-authorize-sponsor.sh` | TA → Sponsor: relationship + five grants; same capability on another resource DENIED | VALID |
| 30 | `30-create-spv.sh` | Sponsor (TOKENIZE_ASSET) → SPV did + Privy EVM wallet + execution policy created **after** the ALLOW; SPV SPONSORED_BY Sponsor | SPV + wallet (0 HBAR) |
| 31 | `31-create-offering-policy.sh` | Sponsor (DEFINE_OFFERING_POLICY) signs the offering: 1,000 units, `policy:offering-eligibility:v1` pinned by hash | ALLOW |
| 40/41 | `40-create-investor-a.sh`, `41-create-investor-b.sh` | HUMAN did, Privy receiving wallet, private Account Binding, holder key, Sumsub sandbox applicant GREEN (fictional names **Lisa Simpson** = A, **Bart Simpson** = B; `--name="First Last"` to change; the name stays in the sandbox dashboard, never in the DID or a credential) | both currently eligible |
| 42 | `42-create-investor-credentials.sh` | **CRE** INVESTOR_ELIGIBILITY per investor → Trust Anchor-issued VCs | 2 VCs |
| 43 | `43-create-investor-presentations.sh` | holder-signed VPs; local 7-check verification; replay with another challenge fails | 7/7 checks |
| 44 | `44-check-offering-eligibility.sh` | **CRE** OFFERING_ELIGIBILITY (VP/VC/status/current evidence/policy in the TEE) → Decisions | A ALLOW 600 · B ALLOW 400 |
| 50 | `50-fund-testnet-wallets.sh` | §7 | funded |
| 60 | `60-tokenize-spv.sh [--live]` | Sponsor TOKENIZE_ASSET → ATS `deployEquity` by the SPV Privy wallet; then equity-pinned SPV rules (owner key) | equity address |
| 61/62 | `61-investor-a-invest.sh`, `62-investor-b-invest.sh` `[--live]` | the ALLOW Decision (unused, within 1,000) + Sponsor TOKENIZE_ASSET → `issueByPartition` of exactly 600 / 400 to the bound wallet | 600 / 400 units |
| 63 | `63-create-dividend.sh [--live]` | `grantRole(ROLE_CORPORATE_ACTION)` + `setDividend(1, 2 decimals)` | entitlements A 6 / B 4 |
| 70 | `70-create-distribution-agent.sh` | Sponsor (CREATE_AGENT) → AGENT did + Privy wallet (chain 296 ∧ to ∈ {A, B} ∧ ≤ 20 HBAR) | request DENIED (no capability) |
| 71 | `71-sponsor-establish-agent-relationship.sh` | Agent AGENT_OF Sponsor | still DENIED |
| 72 | `72-sponsor-delegate-distribution-capability.sh` | delegated EXECUTE_DISTRIBUTION; TOKENIZE_ASSET delegation refused; wrong requester DENIED | chain VALID |
| 80 | `80-invalidate-investor-b.sh` | Sumsub sandbox: B → RED / SANCTIONS / FINAL | B keeps 400 units + ACTIVE VC |
| 81 | `81-trigger-revenue.sh` | REVENUE_RECEIVED 10 HBAR (demo trigger) | event id |
| 82 | `82-run-confidential-distribution.sh` | **CRE** CONFIDENTIAL_DISTRIBUTION computes shares and PAY/HOLD in the TEE | A PAY 6 · B HOLD 4 |
| 83 | `83-execute-approved-distribution.sh [--live]` | Agent pays PAY holders only (Privy dry signature, or one live transfer) | A 6 HBAR · B nothing, 0 signature requests |
| 90–99 | verification (§10) | READ-ONLY | — |

Holdings in stage 82:

- After a live issuance, they are read from the ATS contract (READ-ONLY `balanceOf`).
- In a non-spending run, they are the Catenor-authorized allocation from the offering Decisions, and the record labels
  it so.

---

## 9. Inspect the evidence after each stage

- Every stage writes `.catenor-demo/runs/<stage>-<time>.json`. Each record holds the mode, the result, and for CRE
  stages the executions: workflow ref, run id, the handler's DON-visible `{status, code}`, and **only** the
  allowlisted TEE log events (`shared/safe-log.ts`), e.g. `operation_routed operation=CONFIDENTIAL_DISTRIBUTION`,
  `distribution_computed status=OK code=OK`, `handler_completed status=DELIVERED code=OK`.
- `scripts/demo/90-show-cre-execution.sh` prints the latest confidential executions and their minimized results.
- `scripts/demo/93-verify-catenor-audit.sh` re-verifies everything from the recorded documents (the database is an
  index, not proof):
  - the audit hash chain;
  - the Trust Anchor (12 checks);
  - the Sponsor relationship and capabilities;
  - the Agent's authority chain;
  - each credential's issuer signature.
- `scripts/demo/99-verify-complete-demo.sh` gives a table of every stage plus the Catenor verification.

---

## 10. Verify Chainlink, Privy and Hedera independently

| Sponsor | Command | Needs |
|---|---|---|
| **Hedera** (committed rehearsal evidence) | `scripts/demo/91-verify-hedera.sh --rehearsal` | nothing but `pnpm install`: public relay + Mirror Node |
| **Hedera** (this clean room, after `--live`) | `scripts/demo/91-verify-hedera.sh` | — |
| **Privy** | `scripts/demo/92-verify-privy.sh` | Privy app credentials |
| **Chainlink CRE** (simulation) | `scripts/demo/90-show-cre-execution.sh` | a local run |
| **Chainlink CRE** (deployed) | `scripts/demo/cre/status.sh [execution-uuid]` | `cre login` |

What each check shows:

- **Hedera, rehearsal.** All eight live rehearsal transactions report SUCCESS: `deployEquity`, issuance of 600 and 400,
  `grantRole`, `setDividend`, two account activations and the 6 HBAR payout. The equity holds A 600 / B 400 with
  entitlements 6 / 4, and A holds 7 HBAR while B holds 1.
- **Hedera, clean room.** Every clean-room transaction, the equity, the holdings and the entitlements. Everything is
  also visible on HashScan (`https://hashscan.io/testnet/transaction/<hash>`).
- **Privy.** The wallets and policies exactly as Privy stores them: the SPV / Agent policy rules, the owner set, the
  runtime signer override-scoped, exports denied. It also checks that the Agent policy is exactly the approved
  boundary.
- **Chainlink CRE, simulation.** Each run's workflow and run id, the handler's `{status, code}`, the allowlisted TEE
  events, the minimized result and the evidence commitment.
- **Chainlink CRE, deployed.** `cre workflow get` plus `cre execution list | status | events | logs`.

Hedera explorer links for the committed rehearsal are listed in
[`artifacts/hedera/final-demo/`](artifacts/hedera/final-demo/).

---

## 11. REAL / SIMULATION / MOCK

| Component | Status |
|---|---|
| Privy (every key and wallet, policies, key quorums, signatures) | **REAL** (development app) |
| Sumsub investor + representative evidence | **REAL SANDBOX** (synthetic applicants; `sbx:` tokens only) |
| Company / KYB evidence (S001 admission only) | **SYNTHETIC MOCK** (Sumsub KYB not entitled) |
| Chainlink CRE Confidential Workflow | **SIMULATION** (`cre workflow simulate`, `handlerInTee`) until a real deployment succeeds; see §15. Never described as a deployed TEE before that. |
| Hedera ATS / Testnet | **REAL** testnet (chain 296): rehearsal evidence committed; clean-room broadcasts only with `--live` |
| Revenue event | **DEMO TRIGGER** (in production: PMS, bank webhook, schedule or reconciliation) |
| Holdings in a non-spending run | **Catenor-authorized allocation** (labeled), not an on-chain read |
| The AC-001–003 bootstrap access gate | **not implemented**: the admission is operator-initiated |

---

## 12. Run the final guided demo

Recommended for the recording, so no financial effect happens twice:

1. **Before recording.** Run `run-all.sh`, fund the wallets (§7), then `60`, `61`, `62`, `63` with `--live`. This is
   the tokenization and investment, each broadcast confirmed.
2. **On camera, live:**
   - `80-invalidate-investor-b.sh` — B turns RED;
   - `81-trigger-revenue.sh`;
   - `82-run-confidential-distribution.sh` — the TEE computes A PAY 6 / B HOLD 4;
   - `83-execute-approved-distribution.sh --live` — one confirmed 6 HBAR transfer to A; zero signature requests for B.
3. **Verification:**
   - `90-show-cre-execution.sh`;
   - `91-verify-hedera.sh` — B still holds 400 units and entitlement 4;
   - `93-verify-catenor-audit.sh`.

The future `/demo` UI replays exactly this flow. It may replay verified public evidence (the rehearsal transactions)
instead of repeating a payout, and it never fakes a sponsor result.

---

## 13. Reset local state (and what a reset cannot undo)

```bash
scripts/demo/02-reset-local-demo.sh          # dry run: lists what would be removed and what stays
scripts/demo/02-reset-local-demo.sh --yes    # removes the local PostgreSQL container + volume; moves state files aside
```

With `RAILWAY_DATABASE_PUBLIC_URL` set, the reset never touches the Railway database; it only prints its Catenor row
count. The audit log is append-only, so a used Railway database is emptied only by recreating it (a maintainer action
in Railway), and stage 01 refuses to start a new instance on a non-empty one.

A reset is **local only**. It cannot and does not pretend to revert:

- **Hedera Testnet:** transactions, tokens, balances and accounts are public and permanent.
- **Privy development app:** the wallets, policies and quorums stay. Their owner keys are kept in
  `~/.catenor-one/clean-room/<instance>/`.
- **Sumsub sandbox:** the synthetic applicants stay.
- **A deployed CRE workflow:** it stays until `scripts/demo/cre/pause.sh --live` (or `--delete --live`).

---

## 14. Judge matrix

| Step | Requires | Network | Cost | Mutates state? | Evidence produced |
|---|---|---|---|---|---|
| 00 prerequisites | tools | Hedera relay / Mirror Node (read) | 0 | no | console |
| 01 setup | Docker, Privy + Sumsub credentials | local | 0 | local DB, env files | `runs/01-*` |
| 10 trust domain | Privy | Privy dev app | 0 | Privy (quorums, policies, wallet) | bootstrap config + hash |
| 11 Trust Anchor | Privy, Sumsub, CRE CLI | Privy, Sumsub sandbox, CRE simulate | 0 | Privy wallet, Sumsub applicant, local DB | Decision, endorsement, CRE run |
| 20–21 Sponsor | Privy | Privy | 0 | Privy wallet, local DB | relationship + 5 grants |
| 30–31 SPV, offering | Privy | Privy | 0 | Privy wallet + policy, local DB | SPV wallet controls, signed offering |
| 40–41 investors | Privy, Sumsub | Privy, Sumsub sandbox | 0 | Privy wallets, Sumsub applicants | DIDs, bindings (private) |
| 42–44 VC / VP / offering | Privy, Sumsub, CRE CLI | Sumsub sandbox, CRE simulate | 0 | local DB | VCs, 7-check VPs, Decisions |
| 50 funding | faucet or treasury | Hedera Testnet | ≈ 39 HBAR moved (fees ≈ 1.4 for 2 activations) | yes (`--live`) | transfer receipts |
| 60 tokenize | funded SPV | Hedera Testnet | ≈ 7.7 HBAR | yes (`--live`) | deploy tx, equity |
| 61–62 invest | equity | Hedera Testnet | ≈ 0.5 HBAR each | yes (`--live`) | issuance txs |
| 63 dividend | equity | Hedera Testnet | ≈ 0.8 HBAR | yes (`--live`) | grantRole + setDividend txs |
| 70–72 Agent | Privy | Privy | 0 | Privy wallet + policy, local DB | authority chain |
| 80 B → RED | Sumsub | Sumsub sandbox | 0 | Sumsub review | review RED |
| 81 revenue | — | local | 0 | local DB | revenue event |
| 82 distribution | Privy, Sumsub, CRE CLI | Sumsub sandbox, CRE simulate | 0 | local DB | TEE plan, Decisions |
| 83 execute | funded Agent | Privy, Hedera Testnet | 6 HBAR + ≈ 0.024 fee | yes (`--live`) | payout tx; 0 requests for B |
| 90–99 verify | — / Privy | read-only | 0 | no | console + records |
| 91 `--rehearsal` | **nothing** | Hedera public read | 0 | no | 8 SUCCESS txs, holdings |

What a judge can run with **no** credentials:

- `00-check-prerequisites.sh`;
- `91-verify-hedera.sh --rehearsal`;
- `pnpm check` (416 unit tests, including the in-TEE verifier's parity tests);
- `pnpm test:integration`, which needs Docker and includes the end-to-end clean-room chain on PostgreSQL.

Needs Privy + Sumsub: stages 10–44, 70–82. Needs CRE deployment access: §15. Needs Testnet HBAR: 50, 60–63, 83 with
`--live`.

---

## 15. Chainlink CRE deployment

**Status: NOT deployed.** The demo is labeled **SIMULATION** until a real deployment and invocation succeed.

Commands, verified against the installed CLI v1.33.0 `--help`. All of them run from `workflows/` with `-R workflows`
and the `production-settings` target, which uses the private registry.

| Step | Script | Command |
|---|---|---|
| build (local) | `scripts/demo/cre/build.sh` | `cre workflow build identity-confidential -T production-settings` |
| config (local) | `scripts/demo/cre/configure.sh --relay-url=https://<railway-host>` (or `--callback-url=https://<tunnel>`) | writes `.deploy/config.json` (DEPLOYED, Trust Anchor key pinned, trigger key in `authorizedKeys`) |
| secrets | `scripts/demo/cre/secrets.sh --live` | `cre secrets create secrets.yaml --secrets-auth browser -T production-settings -e workflows/.env` |
| deploy | `scripts/demo/cre/deploy.sh --live` | `cre workflow deploy identity-confidential -T production-settings --config .deploy/config.json` (starts PAUSED) |
| activate | `scripts/demo/cre/activate.sh --live` | `cre workflow activate identity-confidential -T production-settings` |
| invoke | the stages, after `configure.sh --workflow-id=<id> --use-deployed` | gateway `https://01.gateway.zone-a.cre.chain.link` (the documented `01.enterprise-gateway…` answered "Workflow not found" for this organization's private-registry workflows on 2026-09-12), JSON-RPC `workflows.execute`, JWT `alg: ETH` signed by the `authorizedKeys` key (`cre-gateway-verifier.ts`) |
| inspect | `scripts/demo/cre/status.sh [uuid]` | `cre workflow get …`, `cre execution list identity-confidential-production`, `cre execution status/events/logs <uuid>` |
| pause / delete | `scripts/demo/cre/pause.sh --live [--delete]` | `cre workflow pause|delete identity-confidential -T production-settings` |

**Everything on the deployed workflow, admission included: the order.** The workflow config pins two values that
exist only after certain stages. The Bootstrap Configuration hash comes from stage 10. The Trust Anchor's issuer key
(`credentialRules`) comes from stage 11. So there are two deploys:

1. Run `01` → `10`.
2. `cre/configure.sh --relay-url=https://<railway-host>` (the config has no `credentialRules` yet), then
   `cre/check-relay.sh`, which must show 202 → 200 → re-authenticated.
3. `cre/secrets.sh --live` → `cre/deploy.sh --live` → `cre/activate.sh --live` →
   `cre/configure.sh --workflow-id=<id> --use-deployed`.
4. Stage `11` runs the admission in DEPLOYED mode. Its result arrives through the Railway relay.
5. `cre/configure.sh`: the config now pins the Trust Anchor key. Then `cre/deploy.sh --live` → `cre/activate.sh --live`
   → `cre/configure.sh --workflow-id=<new id>`.
6. Stages `20` … `83`. Investor operations run DEPLOYED. The runner spaces gateway triggers ≥ 61 s apart (the
   `every60s:1` limit), across stages too.

Until the second deploy, investor operations fail closed with `CONFIG_INVALID`.

Blockers, each with its smallest fix:

1. **Confidential Workflows enrollment.** No CLI command shows it: `cre whoami` shows standard deploy access only.
   Chainlink's docs say enrollment is separate. The maintainer has stated access is now granted; the first
   `deploy.sh --live` confirms it.
2. **Public callback URL.** The DON must reach Catenor. Preferred: the Railway API (`docs/deployment/RAILWAY.md`)
   authenticates the callback and relays it to the stages, which pull their own results:
   `configure.sh --relay-url=https://<railway-host>`. Fallback: `ngrok http 8787` (or any HTTPS tunnel) to the local
   receiver while stages run, then `configure.sh --callback-url=https://…`.
3. **Secrets upload.** `secrets.sh --live` (browser auth, private registry).
4. **Rate limit.** The deployed HTTP trigger is limited to `every60s:1`, so space the confidential stages ≥ 60 s apart.
5. **Handler logs.** TEE handler logs are not exported in production. The Catenor callback record (90) is the
   judge-facing result.

---

## 16. Why each step exists

- **Trust Anchor.** Somebody must be the root of trust in a Trust Domain. Its authority comes from an **Admission**:
  evidence checked confidentially plus a deterministic policy and a bootstrap endorsement. Nobody simply declares it.
- **Sponsor.** The organization that brings the asset to market. It is not a Trust Anchor. It gets only the scoped
  capabilities the Trust Anchor grants.
- **Relationship.** Describes a connection ("Agent acts for Sponsor"). It **never** authorizes anything by itself. The
  scripts show a request with only a relationship being DENIED.
- **Capability.** An explicit, signed, scoped permission: subject, action, resource, validity. Delegation needs an
  explicit permission to delegate, and it can only narrow authority, never widen it.
- **Offering Policy.** Who may invest is a published, hash-pinned policy signed by the Sponsor under
  DEFINE_OFFERING_POLICY. The TEE refuses to evaluate any other policy.
- **VC.** A reusable, signed claim ("the Trust Domain verified this investor"). It carries no PII, only booleans and an
  evidence commitment. A valid signature proves authorship, not current truth.
- **VP.** The holder proves, for **this** request (challenge + domain), that it is the credential subject. A replayed
  presentation fails.
- **AccountBinding.** The DID ↔ wallet link is private. Wallets are accounts, not identities. Payouts go only to the
  privately bound account, never to a caller-supplied address.
- **Privy policy.** A second, independent execution control:
  - SPV: only the ATS Factory, then only the equity's issuance and dividend calls;
  - Agent: only the two investor wallets, ≤ 20 HBAR, chain 296.

  Catenor decides; Privy constrains what a signature can do even if Catenor were bypassed.
- **SPV.** The legal wrapper that owns the asset. Investors hold equity interests in it, and its wallet is the ATS
  issuer.
- **Agent.** Automation with its own identity and narrowly delegated authority: it may execute distributions for this
  SPV, and nothing else.
- **CRE confidential distribution.** The sensitive part (credentials, provider evidence, reconciliation, policy, the
  arithmetic) runs inside the TEE. Only the minimized executable conclusion and a commitment leave it.
- **Hedera ATS.** The regulated token and its lifecycle (issuance, dividend) on a public ledger. It records ownership
  and entitlement; it does not decide eligibility.
- **Reconciliation.** Compares what the credential claims with what the provider says now. `MISMATCH` explains why a
  valid credential no longer suffices.
- **PAY vs HOLD.** HOLD is not confiscation. B keeps its units and its entitlement; the payment is withheld until its
  current eligibility is restored.
