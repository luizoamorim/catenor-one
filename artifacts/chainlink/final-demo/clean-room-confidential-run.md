# Clean-room run — confidential offering eligibility and confidential distribution (CRE SIMULATION)

**Historical record, superseded.** This run used `cre workflow simulate`, and its SIMULATION label is accurate. The final demo (2026-09-12, instance `c1-202609121659`) ran every confidential operation on the **deployed** Confidential Workflow: see [`deployed-run-c1-202609121659.md`](deployed-run-c1-202609121659.md). Anything below about enrollment (B1) or deployment being open describes the state on this record's date.

**Date:** 2026-09-12 (UTC) · **Instance:** `c1-202609120048` · **Prompt:** `docs/hackathon/prompts/2026-09-11-023-reproducible-demo-runbook.md`  
**Label:** Chainlink CRE **SIMULATION** (`cre workflow simulate`, `handlerInTee`, production-like limits). This is **not**
a deployed Confidential Workflow; see `DEMO.md` §15.  
**Other sponsors in this run:**

- **Privy:** REAL development app — every key, wallet and policy was created fresh by the run.
- **Sumsub:** REAL SANDBOX — synthetic applicants.
- **Company/KYB:** SYNTHETIC MOCK (the S001 admission only).
- **Hedera:** nothing broadcast; the Hedera stages ran as READ-ONLY preflights.

The run started from an empty environment: `scripts/demo/00` → `01` → `10` … `83` → `99`, without `--live`. The
sanitized operator records are private (`.catenor-demo/runs/`, git-ignored). This file keeps only public-safe facts:

- no investor DID;
- no applicant id or bindingRef;
- no VC or VP;
- no Privy ids or keys.

## Authority chain (verified by `93` / `99`)

| Edge | Signed by | Result |
|---|---|---|
| Trust Anchor admitted (S001; CRE run `run:ae463d4d…b31b`, evidence commitment `0xa86e1d11…8cad`) | bootstrap endorsement (Privy) | ALLOW → ACTIVE → TRUST_ANCHOR_VALID |
| Sponsor `AUTHORIZED_SPONSOR_IN` the Trust Domain (Relationship Credential) | Trust Anchor | VALID; grants nothing |
| Sponsor: TOKENIZE_ASSET, DEFINE_OFFERING_POLICY, CREATE_AGENT, CREATE_DISTRIBUTION, DELEGATE_DISTRIBUTION_AUTHORITY on `spv:catenor-demo-001` | Trust Anchor | 5 × ALLOW; the same capability on another resource: DENY `CAPABILITY_MISSING` |
| SPV `SPONSORED_BY` Sponsor; SPV Privy wallet + execution policy created after the TOKENIZE_ASSET ALLOW | Sponsor / Privy | created live (FD-2) |
| Offering `policy:offering-eligibility:v1` (`0xa3326b33…51a2`), 1,000 units | Sponsor | ALLOW |
| Agent created (CREATE_AGENT) → distribution request | — | DENY `CAPABILITY_MISSING` |
| Agent `AGENT_OF` Sponsor (Relationship Credential) → request | Sponsor | still DENY |
| Sponsor → Agent `EXECUTE_DISTRIBUTION` (delegated under CREATE_DISTRIBUTION + DELEGATE_DISTRIBUTION_AUTHORITY) | Sponsor | ALLOW, 3-edge chain |
| Sponsor tries to delegate TOKENIZE_ASSET | — | refused `ACTION_NOT_DELEGABLE`, no signature requested |
| Investor A presents the Agent grant | — | DENY `SUBJECT_MISMATCH` |

## Credentials (stage 42)

The investors' current evidence came from the Sumsub sandbox with a GREEN review. It was checked through CRE
`INVESTOR_ELIGIBILITY`, and every fact came back TRUE. The Trust Anchor then issued a
`CatenorInvestorEligibilityCredential` to each investor (W3C VC 2.0, `eddsa-jcs-2022`, claims
`investorIdentityVerified`, `investorAmlClear`, `evidenceCommitment`).

| Investor | CRE run | Evidence commitment |
|---|---|---|
| A | `run:5bd572aa…28ae` | `0xcef74f29…ed54` |
| B | `run:dc0c506b…5094` | `0xc47f6376…5094` |

## Offering eligibility inside the TEE (stage 44)

One CRE run, `run:d5f1b186…bca6`, with evidence commitment `0x22fbb895…aabe`. Inside `handlerInTee`, each
Verifiable Presentation passed all seven named checks:

- `PRESENTATION_WELL_FORMED`
- `HOLDER_PROOF_VALID`
- `CREDENTIAL_SIGNATURE_VALID`
- `ISSUER_AUTHORIZED`
- `SUBJECT_IS_HOLDER`
- `WITHIN_VALIDITY_WINDOW`
- `STATUS_ACTIVE`

The current Sumsub sandbox review was GREEN and the reconciliation CONSISTENT for both.

| Investor | Units | Decision (`SUBSCRIBE_OFFERING`) |
|---|---|---|
| A | 600 | ALLOW |
| B | 400 | ALLOW |

Allowlisted TEE events:

- `workflow_started`
- `secrets_fetched`
- `context_opened`
- `operation_routed operation=OFFERING_ELIGIBILITY`
- `offering_evaluated status=OK code=OK`
- `handler_completed status=DELIVERED code=OK`

## The distribution, computed inside the TEE (stage 82)

Before this stage, stage 80 changed Investor B's current Sumsub sandbox review to **RED / SANCTIONS / FINAL**. B's
credential stayed ACTIVE and validly signed.

Revenue: 10 HBAR. Holdings: the Catenor-authorized allocation from the offering Decisions (600 / 400), because ATS
issuance was not broadcast in this instance.

One CRE run, `run:263d382b…39d5`, with evidence commitment `0xec184ca3…69d2`:

| Investor | Units | Share (TEE) | Requirement statuses | Presentation checks | Reconciliation | Result |
|---|---|---|---|---|---|---|
| A | 600 | 6 HBAR | all TRUE | 7 / 7 | CONSISTENT | ALLOW → **PAY 6 HBAR** |
| B | 400 | 4 HBAR | identity FALSE, AML FALSE (SANCTIONS, FINAL) | 7 / 7 | MISMATCH | DENY → **HOLD 4 HBAR** |

Allowlisted TEE events:

- `operation_routed operation=CONFIDENTIAL_DISTRIBUTION`
- `distribution_computed status=OK code=OK`
- `handler_completed status=DELIVERED code=OK`

Before recording anything, Catenor checked the TEE result:

- the HMAC-authenticated callback;
- the commitment recomputed from the delivered input;
- that the result answers this request (resource, revenue event, policy hash, holder set);
- the arithmetic (`share = revenue × units / total`, PAY + HOLD ≤ revenue).

It then recorded one protocol Decision `RECEIVE_DISTRIBUTION` per holder.

## Execution (stage 83, no `--live`)

- **Investor A (PAY).** Refused `INSUFFICIENT_AGENT_BALANCE` before any Privy call, because the clean-room Agent
  wallet is not funded yet.
- **Investor B (HOLD).** No transaction was constructed and no signature was requested.
- **Privy signature requests:** none. **Agent nonce:** 0 → 0.

The live equivalent of this last step was executed on the rehearsal assets: tx `0x5db61164…2b88`, 6 HBAR to A only
(`artifacts/hedera/final-demo/selective-payout.md`).

## Audit

51 events, and the hash chain is valid. The Trust Anchor verifies (`TRUST_ANCHOR_VALID`, 0 failed checks), the Sponsor
relationship verifies, the five Sponsor capabilities are ALLOW, the Agent relationship verifies, and the Agent's
delegated chain is ALLOW. Both credentials' issuer signatures verify.
