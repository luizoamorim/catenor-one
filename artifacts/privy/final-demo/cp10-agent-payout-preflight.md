# Final demo CP10 — Selective Distribution Agent payout: signer boundary + preflight (NOTHING BROADCAST)

**Date:** 2026-09-11  
**Evidence class:**

- LIVE Privy **development** app (wallet/policy read-back, dry signatures that were discarded);
- READ-ONLY Hedera Testnet;
- REAL PostgreSQL / Privy / Sumsub sandbox and **SIMULATION** CRE, in the demo run.

**No payout was broadcast.**

## Pre-seeded Agent wallet (maintainer decision CP8)

| | |
|---|---|
| Agent wallet | `0x5037705014596A9050A51Bc131c9B55Cf98fFC51`. It was created by the Catenor runtime in CP7 and is pre-seeded for the recording. |
| Resolution | At CREATE DISTRIBUTION AGENT Catenor resolves the wallet, reads back its Privy policy and refuses it unless the rules are **exactly** the approved boundary (`PRE_SEEDED_VERIFIED`). |
| Privy policy | `pscfoluh5x9brxv2iwqlb48q`: ALLOW `eth_signTransaction` iff chain 296 ∧ `to` ∈ {Investor A, Investor B} ∧ value ≤ 20 HBAR; DENY exports; default-deny. Owned by the Agent management-owner key (outside the runtime); the runtime signer is scoped by the policy. |
| Balance / nonce at preflight | **0.0 HBAR** (Mirror Node: account not found, never funded on testnet) / nonce 0 |

## Catenor Agent payout signer boundary (`privy-agent-payout-executor.ts`)

The transaction is **built** from the approved controlled plan and the investor's **private** receiving-account binding; the caller cannot supply transaction bytes. The boundary requires:

- plan result == PAY;
- chain == 296;
- native transfer only, with empty calldata;
- recipient == the bound account;
- amount == the plan amount;
- balance ≥ amount + gas limit × gas price.

The Privy-signed transaction must equal the built one before anything is broadcast.

## Results

**Real approved plan** (`pnpm demo:s001 --distribution`, run 2026-09-11T21:10Z): A (600 units, CONSISTENT) ALLOW → PAY 6 HBAR; B (400 units, RED → MISMATCH) DENY → HOLD 4 HBAR.

| Holder | Plan | Catenor payout step | Privy signature requests | Transaction |
|---|---|---|---|---|
| Investor A | PAY 6 HBAR | Built exactly: to `0x8D72…7F78`, value 6 HBAR, data `0x`, chain 296, gas limit 30,000, max cost 6.036 HBAR. In the demo run it was **refused `INSUFFICIENT_AGENT_BALANCE`** (the Agent wallet is unfunded), so no Privy request was made. | 0 in the demo run | none |
| Investor B | HOLD | **No transaction constructed** | **0** | **none** |

The Agent nonce was 0 before and after.

**Standalone preflight** (`pnpm --filter @catenor-one/api preflight:payout`), all PASS:

1. The pre-seeded wallet is resolved and its policy is exactly the approved boundary.
2. Refused by Catenor **before Privy**, with zero signature requests:
   - B (HOLD) → `PLAN_RESULT_NOT_PAY`;
   - 5 HBAR ≠ approved 6 → `AMOUNT_NOT_APPROVED`;
   - calldata `0x12345678` → `CALLDATA_NOT_EMPTY`;
   - recipient ≠ A's bound account → `RECIPIENT_NOT_BOUND_ACCOUNT`.
3. Privy policy (second layer; the Catenor boundary is deliberately bypassed), each DENIED (400):
   - recipient not A/B (the SPV wallet);
   - 21 HBAR (> 20 cap);
   - chain 1.
4. The exact approved payout (A, 6 HBAR) passes the boundary. The **Privy dry signature is SIGNED** and **recovers to `0x5037…FC51`**. Discarded, not broadcast.
5. **BLOCK:** the Agent balance 0.0 HBAR is below the 6.036 HBAR maximum cost, so the live payout needs the wallet funded.
6. Agent nonce unchanged; **0 signature requests to Investor B's address**.
