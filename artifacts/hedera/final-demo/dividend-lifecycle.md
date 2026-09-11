# Final demo — LIVE ATS dividend lifecycle (corporate action) on the rehearsal equity, signed by the Privy SPV wallet

**Date:** 2026-09-11  
**Evidence class:** REAL Hedera **Testnet** transactions (chain 296). These are the two transactions the maintainer authorized (prompt `2026-09-11-017`).  
**No payout has been made.** ATS records the corporate action and ownership-based entitlement; it moves no funds.

- Commands: `pnpm --filter @catenor-one/api lifecycle:dividend grant --broadcast`, then `… set --broadcast`, then `… read 1` (read-only).
- Outputs: `dividend-grant-role.json`, `dividend-set.json`, `dividend-entitlements.json`.

## Path (each transaction)

1. READ-ONLY preconditions: expected SPV nonce, role state.
2. READ-ONLY `eth_call` + `eth_estimateGas` from the SPV wallet.
3. Privy `eth_signTransaction` by the SPV runtime-signer key. The SPV policy allows it only through the maintainer-added rules:
   - `allow-grantRole-corporate-action-spv`: chain 296 ∧ equity ∧ `grantRole` ∧ `_role = ROLE_CORPORATE_ACTION` ∧ `_account = SPV`;
   - `allow-setDividend-rehearsal-equity`: chain 296 ∧ equity ∧ `setDividend`.
4. The Catenor signer boundary: the calldata is built from structured terms (role and account fixed; `amountDecimals` pinned to 2, which Privy cannot enforce), and the signed transaction must equal the prepared one.
5. Broadcast through hashio. One attempt, no retry, no raw operator key.

## Transactions

| # | Call | Transaction | Result | Gas used | Cost |
|---|---|---|---|---|---|
| 1 | `grantRole(ROLE_CORPORATE_ACTION 0xa1acfc49…55cd, SPV)` | [`0x8b4baf363089b7eb4c225bb8fe202e9ac81aebe2fdfe4f1ffd26a84c102740e7`](https://hashscan.io/testnet/transaction/0x8b4baf363089b7eb4c225bb8fe202e9ac81aebe2fdfe4f1ffd26a84c102740e7) | SUCCESS (receipt and Mirror Node); `RoleGranted`; SPV `hasRole` → true; nonce 3 → 4 | 179,949 | 0.20694135 HBAR |
| 2 | `setDividend({recordDate 1789159882, executionDate 1789160062, amount 1, amountDecimals 2})` | [`0x8ae0c07651a545d8a54092813ab21cbb05c58d130a7b99b6dc11004b712a5bcb`](https://hashscan.io/testnet/transaction/0x8ae0c07651a545d8a54092813ab21cbb05c58d130a7b99b6dc11004b712a5bcb) | SUCCESS (receipt and Mirror Node); `DividendSet` (corporateActionId `0x…01`, **dividendId 1**); nonce 4 → 5 | 532,107 | 0.61192305 HBAR |

The recordDate and executionDate were set at execution time to now + 120 s and now + 300 s. Gas price was 1,150,000,000,000 weibar; unused gas was refunded. The SPV balance went 91.36830281 → 90.54943841 HBAR.

## Ownership-based entitlement (READ-ONLY, after the record date)

Dividend 1: rate = amount / 10^amountDecimals = 0.01 per unit (decimals 0); `isDisabled` false.

| Holder | Units at the record date | `getDividendAmountFor` | Entitlement |
|---|---|---|---|
| Investor A `0x8D72…7F78` | 600 | 600 / 100 | **6** |
| Investor B `0x72f9…a444` | 400 | 400 / 100 | **4** |
| **Total** | 1,000 | | **10** |

Read at chain time past the record date: `recordDateReached` is true, and `snapshotId` is 0, so the lazy snapshot fallback reads the balances at the record date.

## Demo thesis — ownership ≠ current eligibility

ATS records that Investor B holds 400 units and has an economic entitlement of 4. **It does not decide who is paid.** In CP7, Catenor's controlled plan (`policy:distribution-eligibility:v1`, current evidence via CRE SIMULATION with the REAL Sumsub sandbox) gave:

- **Investor A → ALLOW → PAY 6 HBAR**;
- **Investor B → DENY/HOLD → no payment**.

The Agent payout of 6 HBAR to A is the next, separately authorized step. No signature is ever requested for B.

## Rehearsal-asset timeline (all LIVE, all signed by the Privy SPV wallet)

| Step | Transaction | Cost (HBAR) |
|---|---|---|
| `deployEquity` (configuration) | `0x8265479f…5897` | 7.65768465 |
| `issueByPartition` → A 600 (issuance) | `0x9e6c86c4…04bf` | 0.51599077 |
| `issueByPartition` → B 400 (issuance) | `0x5ea23774…58f7` | 0.45802177 |
| `grantRole(ROLE_CORPORATE_ACTION, SPV)` | `0x8b4baf36…40e7` | 0.20694135 |
| `setDividend` (lifecycle / corporate action, dividend 1) | `0x8ae0c076…5bcb` | 0.61192305 |
