# PRE-DEMO TESTNET BOOTSTRAP — investor receiving-account activation (NOT a distribution)

**Date:** 2026-09-11  
**Evidence class:** REAL Hedera **Testnet** transactions (chain 296). These are the two transfers the maintainer authorized (prompt `2026-09-11-021`).

These transfers are **not**:

- a distribution;
- CREATE_DISTRIBUTION;
- a Catenor payout;
- an investor-eligibility decision.

They were made by the standalone script `pnpm --filter @catenor-one/api bootstrap:investors --broadcast A|B`. It uses neither the distribution plan nor the payout signer, and **no Catenor audit event exists for them**.

**Why:** the investor wallets were not yet Hedera accounts. The first transfer to a new EVM address lazily creates the account (HIP-583, ≈ 608K gas). After that, the demo payout is a normal ≈ 23K-gas transfer.

**Path:**

- The pre-seeded Privy Distribution Agent wallet `0x5037705014596A9050A51Bc131c9B55Cf98fFC51` signs with the Agent runtime signer. Its policy was re-verified as exactly the approved boundary.
- Fixed destination, fixed 1 HBAR, empty calldata, gas limit 700,000.
- The signed transaction must equal the built one. One attempt each; no retry; no raw key.

| # | Investor | Transaction | Result | Gas used | Fee | Investor balance | Agent nonce |
|---|---|---|---|---|---|---|---|
| 1 | A `0x8D726Ab3aD261f03C60D9073F2bf05C9899a7F78` | [`0x40c48ff31c758a566da6a7554c6d593b937bb989aa56a1fc730811c989896e07`](https://hashscan.io/testnet/transaction/0x40c48ff31c758a566da6a7554c6d593b937bb989aa56a1fc730811c989896e07) | SUCCESS (receipt and Mirror Node); account created | 607,856 | 0.69295584 HBAR | 0 → **1 HBAR** | 0 → 1 |
| 2 | B `0x72f94a15A815853B488BCf225ec3cb67eC5ba444` | [`0x0260e56f8331571aeb3e2649541439b85ce69b7ec2c8e1eba8b366ac02c4548d`](https://hashscan.io/testnet/transaction/0x0260e56f8331571aeb3e2649541439b85ce69b7ec2c8e1eba8b366ac02c4548d) | SUCCESS (receipt and Mirror Node); account created | 607,856 | 0.69295584 HBAR | 0 → **1 HBAR** | 1 → 2 (see note) |

Agent balance: 100.0 → 98.30704416 → 96.61408832 HBAR, i.e. 2 × (1 HBAR + 0.69295584).

**Note (transaction 2):** the script's immediate post-receipt nonce read returned a stale `1`, so `investor-b-activation.json` shows `agentNonceIncrementedByOne: false`. A READ-ONLY re-read settled it: the relay returned `0x2` three times and Mirror Node reports `ethereum_nonce` 2, with tx 1 at nonce 0 and tx 2 at nonce 1. Each transfer incremented the nonce exactly once, and nothing was retried. The scripts now poll the nonce (bounded, read-only) after a receipt.

## Final-demo baseline (starting balances for the distribution comparison)

| | HBAR | Agent nonce |
|---|---|---|
| Investor A | **1.0** | |
| Investor B | **1.0** | |
| Distribution Agent | 96.61408832 | **2** |

Expected controlled distribution: **A 1 → 7 HBAR (+6 payout); B 1 → 1 HBAR (HOLD, no payout)**; Agent nonce 2 → 3.

`preflight:payout` after the bootstrap: all PASS. The payout gas estimate is **22,828 ≤ 30,000**; balance 96.61 HBAR ≥ max cost 6.036; 0 signature requests for Investor B; nonce unchanged.
