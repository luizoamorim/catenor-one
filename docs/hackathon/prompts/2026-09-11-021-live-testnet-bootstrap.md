# Catenor One — Final demo checkpoint 13: two authorized live testnet bootstrap transfers

**Date:** 2026-09-11  
**Project:** Catenor One  
**Scope:** exactly TWO pre-demo testnet account-activation transfers (1 HBAR to Investor A, then 1 HBAR to Investor B, gas limit 700,000) from the Privy Agent wallet — NOT a distribution, NOT CREATE_DISTRIBUTION, NOT a Catenor payout, NOT an eligibility decision; rerun preflight:payout; STOP before the 6 HBAR payout  
**Tool:** Claude Code (main session)  
**Type:** Human prompt to Claude Code — verbatim text of the maintainer's instruction, preserved exactly as provided

## Prompt (verbatim)

````text
Bootstrap funding preflight is approved.

These are PRE-DEMO TESTNET ACCOUNT-ACTIVATION transactions only.

They are NOT:
- a distribution;
- CREATE_DISTRIBUTION;
- a Catenor payout;
- an investor eligibility decision.

You are explicitly authorized to broadcast exactly TWO Hedera Testnet bootstrap transfers from the existing Privy-managed Agent wallet, sequentially.

Agent wallet:
0x5037705014596A9050A51Bc131c9B55Cf98fFC51

Use ONLY the Privy Agent runtime signer.
No raw private key.
No retries.

==================================================
TRANSACTION 1 — ACTIVATE INVESTOR A
==================================================

Destination:
0x8D726Ab3aD261f03C60D9073F2bf05C9899a7F78

Amount:
1 HBAR

Data:
0x

Chain:
296

Gas limit:
700,000

After broadcast:
- wait for SUCCESS;
- verify Mirror Node;
- verify Investor A account now exists;
- verify Investor A balance increased exactly 0 → 1 HBAR;
- verify Agent nonce incremented exactly once;
- capture actual gas/HBAR cost.

ONLY if A succeeds, continue.

==================================================
TRANSACTION 2 — ACTIVATE INVESTOR B
==================================================

Destination:
0x72f94a15A815853B488BCf225ec3cb67eC5ba444

Amount:
1 HBAR

Data:
0x

Chain:
296

Gas limit:
700,000

After broadcast:
- wait for SUCCESS;
- verify Mirror Node;
- verify Investor B account now exists;
- verify Investor B balance increased exactly 0 → 1 HBAR;
- verify Agent nonce incremented exactly once;
- capture actual gas/HBAR cost.

==================================================
AFTER BOTH
==================================================

Run:

pnpm --filter @catenor-one/api preflight:payout

Expected final-demo baseline:

Investor A:
1 HBAR starting balance

Investor B:
1 HBAR starting balance

Agent nonce:
2

Controlled distribution later:

Investor A:
1 → 7 HBAR
(+6 HBAR payout)

Investor B:
1 → 1 HBAR
(HOLD, no payout)

The payout preflight should now show normal native-transfer gas within the authorized 30,000 limit.

Record bootstrap evidence separately from distribution evidence.

Do not create Catenor payout/distribution audit events for these bootstrap transfers.

Update BUILD_LOG / PROVENANCE / FINAL-DEMO only as needed to document the pre-demo setup truthfully.

Commit the bootstrap-funding checkpoint separately.

STOP after rerunning preflight:payout.

Do NOT broadcast the 6 HBAR Investor A payout yet.
````
