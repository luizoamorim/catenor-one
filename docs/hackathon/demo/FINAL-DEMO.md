# Catenor One — Final ETHOnline 2026 demo

**Status:** LOCKED story (maintainer, 2026-09-11) — delivery plan, not a specification.  
**Source prompt:** `docs/hackathon/prompts/2026-09-11-009-final-ethonline-demo-story.md`  
**Frozen, unchanged:** S001 SPEC / ACCEPTANCE / TEST-VECTORS, Catenor Protocol baseline `66ef712`.

```text
Catenor decides identity + authority.
Privy constrains wallet execution.
Hedera ATS executes only after a Catenor ALLOW.
Chainlink CRE evaluates private evidence (SIMULATION until B1).
```

## 1. Cast and wallets

| Actor | Catenor subject | Wallet (Privy) | Created |
|---|---|---|---|
| Root Trust Anchor | `did:catenor` ORGANIZATION, S001 ACTIVE | Solana Credential Assertion Key (existing S001 wallet) | pre-seeded |
| Sponsor | `did:catenor` ORGANIZATION | own assertion key | pre-seeded |
| SPV `spv:catenor-demo-001` | `did:catenor` ORGANIZATION | SPV EVM execution wallet (pre-seeded, funded) + **SPV execution policy** | wallet pre-seeded; **policy created live, after ALLOW** |
| Distribution Agent | `did:catenor` AGENT | **Agent EVM wallet + Agent policy (narrower)** | **live** (CREATE DISTRIBUTION AGENT) |
| Investor A | `did:catenor` HUMAN | EVM receiving wallet `0x8D726Ab3aD261f03C60D9073F2bf05C9899a7F78` | pre-seeded (2026-09-11) |
| Investor B | `did:catenor` HUMAN | EVM receiving wallet `0x72f94a15A815853B488BCf225ec3cb67eC5ba444` | pre-seeded (2026-09-11) |

Sponsor wallet ≠ SPV wallet ≠ Agent wallet ≠ Investor wallets.

Investor wallets are receiving-only:

- each is owned by its own maintainer-held key;
- there is no runtime signer and no policy, so the Catenor runtime cannot sign with them;
- the `did:catenor` ↔ wallet Account Binding is private and created in the Catenor database at demo time; only the addresses are public.

Credential Assertion Key ≠ Financial Execution Key. Each execution wallet follows the S001 custody pattern (D34/D36):

- the owner is a management-owner P-256 authorization key in maintainer custody, never in the runtime;
- the runtime acts only as an additional signer, scoped by that wallet's policy;
- the runtime creates policies and wallets from public values only.

## 2. Pre-seeded state (not shown being created)

- Root Trust Anchor ACTIVE, with a valid S001 Admission (auditable in the Judge Inspector).
- Sponsor `did:catenor` holding a signed Capability from the Trust Anchor: `TOKENIZE_ASSET` on `spv:catenor-demo-001` [REF-IMPL]. It is only mentioned before tokenization.
- Investor A and Investor B: `did:catenor`, a Privy EVM wallet each, and prepared evidence.
- The SPV EVM execution wallet: pre-created and pre-funded. It is infrastructure, **not Catenor authority** (FD-2 clarification, maintainer 2026-09-11).
- **Not** pre-created: the SPV execution policy for this tokenization and the Distribution Agent policy.

Story: BEFORE, the SPV wallet exists and is funded, but no execution policy for this tokenization exists, so it cannot execute. AFTER the Sponsor's ALLOW, Catenor creates the SPV execution policy through the Privy API (visible in the Privy dashboard) and the Hedera action becomes executable. Catenor authority is what makes the policy-controlled execution capability available.

## 3. Live demo actions

| # | Button / trigger | What happens | Sponsor |
|---|---|---|---|
| 1 | **TOKENIZE ASSET** | Catenor verifies the Sponsor Capability (ACTIVE Trust Anchor issuer, signature, subject, action, resource, expiry/revocation) → ALLOW → SPV subject → **SPV execution policy created via the Privy API and activated for the pre-seeded SPV wallet** → `Factory.deployEquity` signed by the SPV wallet → receipt → asset TOKENIZED | Privy + Hedera |
| 2 | (same flow) | the configured allocations are issued inside the authorized tokenization plan: `issueByPartition` → Investor A, → Investor B | Hedera |
| 3 | **CREATE DISTRIBUTION AGENT** | AGENT subject → Privy Agent EVM wallet + narrower policy → Capability `EXECUTE_DISTRIBUTION` [REF-IMPL] on `spv:catenor-demo-001` | Privy |
| 4 | **SPV REVENUE RECEIVED** (HTTP trigger) | revenue event recorded (in production: PMS, bank webhook, cron, reconciliation) | — |
| 5 | **BLIND DISTRIBUTION (dry run)** | holdings-only plan proposes a payout to A and B. **Nothing is sent.** | — |
| 6 | **CONTROLLED DISTRIBUTION** | Agent capability verified → CRE Confidential workflow evaluates current evidence (real Sumsub sandbox representative) → normalization → reconciliation → policy: A ALLOW, B DENY/HOLD | Chainlink + Sumsub |
| 7 | (same flow) | one real testnet payout/distribution action for **A only**. B is HELD, no transaction. | Hedera + Privy |

Investor B's ineligibility: the preferred source is a current **representative RED** in the real Sumsub sandbox, already proven feasible in T0.8. Fallbacks are stale evidence or a reconciliation mismatch. The story is "Eligibility is not a one-time KYC checkbox."

## 4. REAL / SIMULATION / MOCK

| Label | What |
|---|---|
| **REAL** | PostgreSQL; Privy (wallets, policies, signing); Sumsub **sandbox** representative; Hedera **testnet** transactions once broadcast |
| **SIMULATION** | Chainlink CRE Confidential workflow (`cre workflow simulate`) while B1 enrollment is open. Never "deployed TEE" or "production TEE". |
| **MOCK** | Company/KYB evidence: SYNTHETIC MOCK (Hybrid Demo Profile) |
| **DRY RUN** | The blind distribution. It sends nothing. |

The UI, the Judge Inspector, the README and the submission text use these exact labels.

## 5. Judge Inspector — one timeline

TRUST (Trust Anchor ACTIVE, Sponsor Capability) → TOKENIZATION (authorization result, SPV DID, SPV Privy wallet + policy, Hedera tx hash, ATS token address, balances) → AGENT (DID, wallet, policy, Capability) → INVESTORS (A and B state) → DISTRIBUTION (revenue trigger, blind dry run, CRE run reference, observations, reconciliation, decision, A ALLOW / B DENY-HOLD) → AUDIT (Catenor audit events) → SPONSOR EVIDENCE (Privy ids, HashScan links, CRE simulation output, Sumsub sandbox references without PII).

## 6. Prize mapping

| Sponsor | Target | Demo evidence |
|---|---|---|
| Privy | Best B2B financial product; Best financial flow | Authority-derived provisioning of SPV/Agent wallets and policies; policy-constrained signing; separate custody; DENY → no signature |
| Chainlink | Confidential Workflow | `identity-confidential` `handlerInTee`, private Sumsub response → minimized facts → ALLOW/DENY (SIMULATION) |
| Hedera | Tokenization of Anything | ATS `deployEquity` + `issueByPartition` on testnet from a Privy wallet; distribution action for A only |

`hedera-hackathon-submission-validator` is run before submission. Unrelated prizes are not pursued.

## 7. Sponsor evidence to capture (`artifacts/`)

- `artifacts/privy/final-demo/`:
  - SPV and Agent wallet ids and addresses;
  - policy ids and rules as stored;
  - signer configuration;
  - denial results;
  - dashboard screenshots before and after.
- `artifacts/hedera/final-demo/`:
  - tx hashes and HashScan links (deployEquity, issueByPartition ×2, payout);
  - ATS token address;
  - balances;
  - Mirror Node records.
- `artifacts/chainlink/final-demo/`:
  - simulation output labeled SIMULATION;
  - run references and commitments;
  - Sumsub sandbox references, with no PII and no applicant IDs.

## 8. Reuse

The code that stays:

- S001 end to end, including the Privy assertion and bootstrap signers and the CRE `identity-confidential` workflow;
- `packages/authority` capability grant and `authorizeWithCapability`;
- `AssetTokenizationService`, which is ALLOW-gated and has audit events;
- `deployEquityArguments` and the ATS constants;
- the Part B DENY-without-execution checks.

The raw-key `HederaAtsTestnetExecutor` stays as dev/test infrastructure. A Privy-signing executor replaces it on the demo path, and `HEDERA_OPERATOR_EVM_PRIVATE_KEY` is not used by the final demo.

## 9. Delivery tasks (checked only when code + tests / artifacts exist)

- [x] FD-0 Lock story: this file and the prompt artifact.
- [x] FD-1 Privy → Hedera compatibility checkpoint: SPV EVM wallet + policy, eip155:296 signing, deployEquity calldata, no broadcast. Evidence: `artifacts/privy/final-demo/cp1-spv-hedera-compat.md`.
- [ ] FD-2 `feat(privy)`: the SPV execution policy is created after ALLOW, for the pre-seeded SPV wallet, with refs persisted.
  - **DESIRED, NOT SUBMISSION-BLOCKING** (maintainer, CP8 2026-09-11). Live Privy wallet and policy provisioning is shown by CREATE DISTRIBUTION AGENT. If the SPV execution policy stays pre-provisioned in the recording, the demo and docs say so. Management-owner custody is not redesigned for FD-2.
  - **Clarified by the maintainer (2026-09-11):** the SPV EVM wallet MAY be pre-created and pre-funded. What must happen after the Sponsor's TOKENIZE_ASSET ALLOW is:
    1. Catenor creates the SPV EXECUTION POLICY through the Privy API;
    2. Catenor attaches and activates the execution controls for the pre-seeded SPV wallet;
    3. Hedera executes.
  - Pre-seeding and funding the wallet is not Catenor authority.
  - The CP1 wallet with its standing policy and the rehearsal equity are a real rehearsal/checkpoint only.
  - The mechanism for attaching the new policy to the pre-seeded wallet is decided and probed at FD-2. Attaching a policy to an owned wallet needs the wallet owner's authorization, and the owner key is outside the runtime.
- [x] FD-3 `feat(hedera)`: deployEquity signed by the Privy SPV wallet (live tx, maintainer-authorized).
  - LIVE 2026-09-11: tx `0x8265479f…5897`; ATS equity `0x7aeDA4b6B89dA392Efd88AD0Fcb075e12ab6a418`; 7.66 HBAR.
  - Evidence: `artifacts/hedera/final-demo/deploy-equity.md`.
- [ ] FD-4 `feat(hedera)`: issueByPartition to Investor A and B.
  - **Prepared 2026-09-11:** investor wallets provisioned; READ-ONLY simulation accepted; function-level Privy issuance rule CONFIRMED (`artifacts/privy/final-demo/cp4-issuance-policy-probe.md`).
  - The maintainer applied the SPV issuance rule; `preflight:issuance` PASS.
  - **LIVE 2026-09-11, Investor A:** 600 units, tx `0x9e6c86c4…04bf`, 0.516 HBAR; A balance 600, total supply 600. Evidence: `artifacts/hedera/final-demo/issue-investor-a.md`.
  - **LIVE 2026-09-11, Investor B:** 400 units, tx `0x5ea23774…58f7`, 0.458 HBAR; B 400, A 600, total supply 1,000. Evidence: `artifacts/hedera/final-demo/issue-investor-b.md`.
  - Rehearsal-asset issuance is complete. The FD-4 checkbox stays open because of the gap below.
  - **OPEN:** issuance authorization and binding through Catenor.
    - **Final design (maintainer, 2026-09-11):** issuance is integrated into the authorized tokenization orchestration: Sponsor TOKENIZE_ASSET Capability → authorized tokenization plan → deploy equity → issue the configured allocations to Investor A/B.
    - The signer boundary validates the exact token created by this flow, the exact investor addresses from the demo allocation, the exact amounts and partition `0x…01`.
    - No generic mint/issuance API.
    - The rehearsal scripts stay as evidence/tests only.
    - The private Account Binding store now exists (CP7); investor receiving accounts are resolved from it.
- [x] FD-5 `feat(agent)`: AGENT subject, Agent wallet, narrower policy, `EXECUTE_DISTRIBUTION` Capability.
  - LIVE 2026-09-11: Agent `did:catenor:bb5870b9…20f3`, Privy wallet `0x5037…FC51`, policy `to ∈ {A, B} ∧ value ≤ 20 HBAR ∧ chain 296`.
  - The grant is issued by the ACTIVE Trust Anchor.
  - Evidence: `artifacts/privy/final-demo/cp7-distribution-agent.md`.
- [x] FD-6 `feat(cre)`: real Sumsub sandbox evidence through CRE `handlerInTee` (SIMULATION) in the final path (A GREEN, B RED).
  - The new `INVESTOR_ELIGIBILITY` operation of `identity-confidential` gives A CONSISTENT and B MISMATCH (SANCTIONS, FINAL).
  - The S001 representative already used the real sandbox; the mock Sumsub server is not used in the demo.
  - Evidence: `artifacts/chainlink/final-demo/investor-eligibility-simulation.md`.
- [ ] FD-7 `feat(distribution)`: revenue trigger, blind dry run, controlled distribution, A executed / B held.
  - **Done 2026-09-11:**
    - the revenue event (in-script trigger; HTTP button pending, FD-8);
    - the blind DRY RUN (A 6 / B 4 HBAR, nothing sent);
    - the controlled plan: `policy:distribution-eligibility:v1`, A ALLOW → PAY, B DENY → HOLD, with protocol Decisions and the audit chain.
  - **Hedera lifecycle DONE (CP9):** the ATS dividend on the rehearsal equity (dividend id 1) records ownership-based entitlement A 6 / B 4; ATS moves no funds.
  - **Payout signer boundary DONE (CP10):**
    - the transaction is built from the approved plan and the private binding: PAY only, chain 296, plain transfer, empty calldata, exact bound recipient, exact plan amount, balance check;
    - the Privy-signed transaction must equal it;
    - the pre-seeded Agent wallet is verified at CREATE DISTRIBUTION AGENT;
    - preflight: A's exact 6 HBAR payout is dry-signed by Privy and recovers to the Agent wallet; B gets no transaction and no signature request; the negative cases are refused before Privy or denied by the policy.
    - Evidence: `artifacts/privy/final-demo/cp10-agent-payout-preflight.md`.
  - **Pending:** fund the Agent wallet `0x5037…FC51` (it reads 0 HBAR and Mirror Node finds no account), then the maintainer-authorized live payout of 6 HBAR to A (`--agent-payout-live`).
- [ ] FD-8 `feat(web)`: guided demo and Judge Inspector timeline.
- [ ] FD-9 `docs(hackathon)`: evidence, README, submission validator, video.

## 10. Deferred (not built for the demo; open tasks stay open)

- S001 operator gate AC-001–003 and T13.x/T15.x production auth and deployment;
- B1 deployed CRE (T16.x);
- T2.9 and T8.5;
- the T8.6 remainder;
- all `[POST-DEMO]` tasks;
- complete S002 Subject Continuity;
- a generic agent or delegation framework;
- the full ATS lifecycle;
- a generic RWA platform, generic CRUD and future-use abstractions.

## 11. Open decisions (maintainer)

1. **Gas for a live-created wallet.** A Privy EVM wallet created after ALLOW holds 0 HBAR.
   - **Current state (2026-09-11):** the maintainer funded the CP1 SPV wallet directly (100 HBAR). The live `deployEquity` used that pre-provisioned wallet.
   - Runtime creation of the SPV wallet and policy after ALLOW (FD-2) and how such a wallet would be funded (e.g. a Privy gas-sponsor wallet) stay open.
   - Measured: `deployEquity` used 6.90M gas = 7.66 HBAR. Unused gas was refunded; the up-front requirement is gasLimit × gasPrice.
2. **`issueByPartition` under the SPV policy.** DECIDED (maintainer, 2026-09-11): the narrowest practical rule.
   - Function-level restriction is CONFIRMED live: chain 296 ∧ to = the equity ∧ function = `issueByPartition` ∧ partition = `0x…01`.
   - It is added by the maintainer-run `add-spv-issuance-rule.mjs` (owner key outside the runtime).
   - A chain-only rule is never used.
   - **Open for FD-2:** a runtime-created SPV policy needs the equity-specific issuance rule after `deployEquity` (the equity address is unknown before). The owner key never enters the runtime, so how that rule is added is decided at FD-2 and not assumed here.
3. **Lifecycle / distribution operation.** DONE on the rehearsal equity (CP9, LIVE 2026-09-11): the ATS dividend corporate action.
   - `grantRole` tx `0x8b4baf36…40e7`;
   - `setDividend` tx `0x8ae0c076…5bcb`, dividend id 1;
   - entitlements A 6 / B 4 / total 10;
   - evidence: `artifacts/hedera/final-demo/dividend-lifecycle.md`.
   - Prepared in CP8:
   - Minimum sequence (READ-ONLY verified; `initializeDividend` was already done by the Factory):
     1. `grantRole(ROLE_CORPORATE_ACTION, SPV)`, about 194K gas, about 0.23 HBAR;
     2. `setDividend({recordDate: now+120 s, executionDate: now+300 s, amount 1, amountDecimals 2})`, gas limit 1M, up to 1.18 HBAR up front;
     3. read-backs `getDividend` / `getDividendFor` / `getDividendAmountFor`, expected after the recordDate: A 600 × 0.01 = 6, B 400 × 0.01 = 4.
   - ATS records ownership-based entitlements and moves no funds. **Catenor alone decides the actual payout**: A PAY, B HOLD, since current eligibility ≠ ownership.
   - SPV Privy rules for it (maintainer-run `add-spv-lifecycle-rules.mjs`): `grantRole` pinned to exactly ROLE_CORPORATE_ACTION → the SPV wallet; `setDividend` pinned by function and target.
   - The `setDividend` terms (incl. `amountDecimals`, which Privy cannot enforce) are built and checked by the Catenor signer boundary.
   - The Agent payout to A only (6 HBAR) follows, after separate authorization.
4. **Resource vocabulary.** DONE: `spv:catenor-demo-001` [REF-IMPL] is used in code, tests and the on-chain grant `info`.
5. **Issuer of the Agent's `EXECUTE_DISTRIBUTION` Capability.** Implemented with the default: the ACTIVE Trust Anchor, same grant mechanism as `TOKENIZE_ASSET` (CP7). A delegation chain (Sponsor → Agent) is deferred.
6. **Agent funding for the recording** (maintainer, CP8): no gas-sponsor subsystem.
   - Recommended: the **pre-seeded, funded Agent wallet** `0x5037705014596A9050A51Bc131c9B55Cf98fFC51`. It was created live by the CP7 run, and its read-back shows exactly the narrow Agent policy with the runtime signer scoped by it.
   - Live in the recording: the AGENT subject and `did:catenor`, a private binding to that wallet, Catenor verifying the Privy controls, and the `EXECUTE_DISTRIBUTION` Capability.
   - Attaching a *new* policy to an existing owned wallet needs the wallet owner's authorization, which never enters the runtime. So with a pre-seeded wallet the Agent policy is pre-provisioned and verified live, and it is labeled that way.
   - The live-creation path (CP7 evidence) stays in the code.
