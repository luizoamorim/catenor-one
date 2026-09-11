# Catenor One — Final demo checkpoint 11: one authorized live selective Agent payout

**Date:** 2026-09-11  
**Project:** Catenor One  
**Scope:** exactly ONE live Hedera Testnet native payout of 6 HBAR to Investor A from the pre-seeded Privy Distribution Agent wallet, produced from the live Catenor-controlled plan (A ALLOW/PAY, B DENY/HOLD); Investor B gets no transaction and no signature request; verify, record, commit; STOP  
**Tool:** Claude Code (main session)  
**Type:** Human prompt to Claude Code — verbatim text of the maintainer's instruction, preserved exactly as provided

## Prompt (verbatim)

````text
Agent payout preflight is PASS.

You are explicitly authorized to broadcast exactly ONE live Hedera Testnet payout:

Investor A
- recipient: 0x8D726Ab3aD261f03C60D9073F2bf05C9899a7F78
- amount: 6 HBAR
- chain: 296
- sender: pre-seeded Privy-managed Distribution Agent wallet
- agent wallet: 0x5037705014596A9050A51Bc131c9B55Cf98fFC51
- native HBAR transfer only
- data: 0x
- gas limit: 30,000

This transaction MUST be produced from the live Catenor-controlled distribution plan:

Investor A
→ ALLOW / PAY 6 HBAR

Investor B
→ DENY / HOLD 4 HBAR

Requirements:

- use ONLY the Privy Agent runtime signer;
- no raw private key;
- exact recipient must come from A's private account binding;
- exact amount must come from the approved distribution plan;
- empty calldata;
- one broadcast only;
- no automatic retry.

Investor B:
- MUST NOT produce a payout transaction;
- MUST NOT request a Privy signature;
- MUST receive 0 HBAR.

After broadcast:

1. wait for SUCCESS receipt;
2. verify Agent nonce 0 → 1 exactly;
3. verify Agent balance decreases by 6 HBAR + gas;
4. verify Investor A balance increases by exactly 6 HBAR;
5. verify Investor B balance is unchanged;
6. verify zero Privy signature requests for Investor B;
7. capture transaction hash / Mirror Node / HashScan evidence;
8. record CRE SIMULATION + Sumsub REAL decision evidence linking A=ALLOW and B=HOLD;
9. update FINAL-DEMO / TASKS / BUILD_LOG / PROVENANCE;
10. commit this selective payout checkpoint separately;
11. STOP.

Do not start Judge Inspector yet.

Report:
- tx hash
- receipt/status
- actual gas/HBAR cost
- Agent balance before/after
- Investor A balance before/after
- Investor B balance before/after
- Agent nonce
- proof B caused no signature/transaction
- commit hash
- exact remaining demo-critical work
````
