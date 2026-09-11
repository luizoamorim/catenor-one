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
| SPV `spv:catenor-demo-001` | `did:catenor` ORGANIZATION | **SPV EVM execution wallet + SPV policy** | **live, after ALLOW** |
| Distribution Agent | `did:catenor` AGENT | **Agent EVM wallet + Agent policy (narrower)** | **live** |
| Investor A | `did:catenor` HUMAN | EVM wallet | pre-seeded |
| Investor B | `did:catenor` HUMAN | EVM wallet | pre-seeded |

Sponsor wallet ≠ SPV wallet ≠ Agent wallet ≠ Investor wallets. Credential Assertion Key ≠ Financial Execution Key. Each execution wallet follows the S001 custody pattern (D34/D36):

- the owner is a management-owner P-256 authorization key in maintainer custody, never in the runtime;
- the runtime acts only as an additional signer, scoped by that wallet's policy;
- the runtime creates policies and wallets from public values only.

## 2. Pre-seeded state (not shown being created)

- Root Trust Anchor ACTIVE, with a valid S001 Admission (auditable in the Judge Inspector).
- Sponsor `did:catenor` holding a signed Capability from the Trust Anchor: `TOKENIZE_ASSET` on `spv:catenor-demo-001` [REF-IMPL]. It is only mentioned before tokenization.
- Investor A and Investor B: `did:catenor`, a Privy EVM wallet each, and prepared evidence.
- **Not** pre-created: the SPV execution policy and the Distribution Agent policy.

## 3. Live demo actions

| # | Button / trigger | What happens | Sponsor |
|---|---|---|---|
| 1 | **TOKENIZE ASSET** | Catenor verifies the Sponsor Capability (ACTIVE Trust Anchor issuer, signature, subject, action, resource, expiry/revocation) → ALLOW → SPV subject → Privy SPV EVM wallet + SPV policy → `Factory.deployEquity` signed by the SPV wallet → receipt → asset TOKENIZED | Privy + Hedera |
| 2 | (same flow) | `issueByPartition` → Investor A, → Investor B (P0 if stable) | Hedera |
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
- [ ] FD-1 Privy → Hedera compatibility checkpoint: SPV EVM wallet + policy, eip155:296 signing, deployEquity calldata, no broadcast.
- [ ] FD-2 `feat(privy)`: runtime SPV wallet + policy provisioning after ALLOW, with refs persisted.
- [ ] FD-3 `feat(hedera)`: deployEquity signed by the Privy SPV wallet (live tx, maintainer-authorized).
- [ ] FD-4 `feat(hedera)`: issueByPartition to Investor A and B.
- [ ] FD-5 `feat(agent)`: AGENT subject, Agent wallet, narrower policy, `EXECUTE_DISTRIBUTION` Capability.
- [ ] FD-6 `feat(cre)`: real Sumsub sandbox representative in the final path (A GREEN, B RED).
- [ ] FD-7 `feat(distribution)`: revenue trigger, blind dry run, controlled distribution, A executed / B held.
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

1. **Gas for a live-created wallet.** A Privy EVM wallet created after ALLOW holds 0 HBAR, but `deployEquity` costs HBAR. The FD-1 report proposes how to fund it without a raw key.
2. **Resource vocabulary.** `spv:catenor-demo-001` [REF-IMPL] replaces `asset:catenor-one-demo:001` in code, tests and the grant `info` field when FD-2/FD-3 land.
3. **Issuer of the Agent's `EXECUTE_DISTRIBUTION` Capability.** Default: the ACTIVE Trust Anchor, with the same grant mechanism as `TOKENIZE_ASSET`. A delegation chain (Sponsor → Agent) is deferred.
