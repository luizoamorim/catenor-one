# Final demo — LIVE selective controlled distribution: Investor A paid 6 HBAR, Investor B HELD

**Date:** 2026-09-11 (consensus timestamp `1789163937.118711104`)  
**Authorization:** the maintainer authorized exactly this one payout (prompt `2026-09-11-022`).  
**Command:** `pnpm demo:s001 --distribution --agent-payout-live`, one run, one broadcast, no retry. Output: `selective-payout.json`.

| Label | What |
|---|---|
| **REAL** | PostgreSQL; Privy (Agent wallet, policy, runtime-signer signature); **Sumsub SANDBOX** investor applicants (A current review GREEN, B RED `SANCTIONS`/`FINAL`); Hedera **Testnet** |
| **SIMULATION** | Chainlink CRE Confidential Workflow `identity-confidential` `INVESTOR_ELIGIBILITY` (`handlerInTee`, `cre workflow simulate`). **Not** a deployed or production TEE (B1 open). |
| **MOCK** | Company/KYB evidence, used only in the S001 admission (SYNTHETIC MOCK, Hybrid Demo Profile) |

## The live Catenor-controlled plan (recomputed in this run)

- S001: the Trust Anchor is ACTIVE (`TRUST_ANCHOR_VALID`). The Distribution Agent `did:catenor:3e959b7969b9550d6337b8d1ac551a84` holds a Trust Anchor-signed `EXECUTE_DISTRIBUTION` Capability on `spv:catenor-demo-001`. The pre-seeded Agent wallet `0x5037…FC51` was verified `PRE_SEEDED_VERIFIED`.
- Revenue 10 HBAR. The blind DRY RUN (holdings only) proposed A 6 / B 4.

| Holder | ATS units | CRE (SIMULATION) on the Sumsub SANDBOX review | `policy:distribution-eligibility:v1` | Controlled |
|---|---|---|---|---|
| Investor A | 600 | CONSISTENT; identity / AML / fresh all TRUE; commitment `0xae3bcc6e…fe3d` | **ALLOW** (decision `0x9bb87688…7f46`) | **PAY 6 HBAR** |
| Investor B | 400 | MISMATCH; identity FALSE, AML FALSE (`SANCTIONS`, `FINAL`), fresh TRUE; commitment `0xed1688b7…f4a1` | **DENY** (decision `0xb7beaee5…3bb3a`) | **HOLD 4 HBAR** |

The live guard broadcast only because the plan was exactly A ALLOW/PAY 6 and B DENY/HOLD 4, with exactly one PAY payout to A's bound account and empty calldata.

## The payout (REAL, Hedera Testnet)

| | |
|---|---|
| Transaction | [`0x5db611642921708fc1fa88b78ed883acebd5d99316ede4481c141e076be42b88`](https://hashscan.io/testnet/transaction/0x5db611642921708fc1fa88b78ed883acebd5d99316ede4481c141e076be42b88) — receipt **SUCCESS**, Mirror Node **SUCCESS** |
| From → to | Privy Distribution Agent wallet `0x5037705014596A9050A51Bc131c9B55Cf98fFC51` → Investor A's **privately bound** account `0x8D726Ab3aD261f03C60D9073F2bf05C9899a7F78` |
| Value / data / chain | **6 HBAR** (the plan amount) / `0x` / 296 |
| Gas | limit 30,000; estimated 22,828; **used 21,000**; fee **0.02394 HBAR** |
| Signer | Privy `eth_signTransaction` by the Agent runtime-signer key. The Agent policy allows it (chain 296 ∧ to ∈ {A, B} ∧ value ≤ 20 HBAR), and the Catenor signer boundary required exactly the built transaction. No raw key. |

| Balance / state | Before | After | Check |
|---|---|---|---|
| Agent wallet | 96.61408832 HBAR | 90.59014832 HBAR | −6 HBAR − 0.02394 fee ✔ |
| Agent nonce | 2 | 3 | exactly +1 ✔ |
| Investor A | 1.0 HBAR | **7.0 HBAR** | exactly +6 ✔ |
| Investor B | 1.0 HBAR | **1.0 HBAR** | unchanged ✔ |
| Investor B ATS units / dividend 1 entitlement | 400 / 4 | **400 / 4** | retained ✔ |

The 1 HBAR starting balances come from the pre-demo testnet bootstrap (`artifacts/hedera/pre-demo-bootstrap/`), which was not a distribution.

**Investor B caused nothing:**

- no payout transaction was constructed (plan HOLD);
- Privy signature requests in the whole run: **1**, to A's address only; **0 for B**;
- B's balance did not move.

**Catenor audit chain valid.** It includes `DISTRIBUTION_ELIGIBILITY_EVALUATED` ×2 and `DISTRIBUTION_PLAN_CREATED`. The payout is recorded here and in the run record; a dedicated payout audit event type is not yet in the schema.

## Thesis

ATS records Investor B's **economic entitlement** (400 units, dividend entitlement 4; see `dividend-lifecycle.md`). **Current Catenor eligibility** (RED sandbox evidence, confidentially checked) decides that no payout executes for B.

**Ownership ≠ current eligibility.**
