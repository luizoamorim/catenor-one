# Catenor One — Final demo checkpoint 14: the live selective controlled-distribution payout

**Date:** 2026-09-11  
**Project:** Catenor One  
**Scope:** exactly ONE live Hedera Testnet distribution payout — 6 HBAR to Investor A's bound account from the Privy Distribution Agent wallet — broadcast only if the live recomputed Catenor plan is A ALLOW/PAY 6 and B DENY/HOLD 4; Investor B gets no transaction and no signature request; verify, record, commit; STOP  
**Tool:** Claude Code (main session)  
**Type:** Human prompt to Claude Code — verbatim text of the maintainer's instruction, preserved exactly as provided

## Prompt (verbatim)

````text
Selective payout preflight is PASS and the investor bootstrap baseline is confirmed.

You are explicitly authorized to broadcast exactly ONE live Hedera Testnet distribution payout:

INVESTOR A

Sender:
Privy-managed Distribution Agent wallet
0x5037705014596A9050A51Bc131c9B55Cf98fFC51

Recipient:
Investor A bound account
0x8D726Ab3aD261f03C60D9073F2bf05C9899a7F78

Amount:
6 HBAR

Chain:
296

Data:
0x

Gas limit:
30,000

Current expected baseline:

Agent:
96.61408832 HBAR
nonce 2

Investor A:
1 HBAR

Investor B:
1 HBAR

The live command may be:

pnpm demo:s001 --distribution --agent-payout-live

BUT the transaction may be broadcast ONLY if the live recomputed Catenor distribution plan produces exactly:

Investor A
→ ALLOW / PAY 6 HBAR

Investor B
→ DENY / HOLD 4 HBAR

REQUIREMENTS

- use ONLY the Privy Agent runtime signer;
- no raw private key;
- recipient must come from A's private account binding;
- amount must come from the live approved plan;
- native HBAR transfer only;
- empty calldata;
- chain 296;
- exactly one broadcast;
- no automatic retry.

INVESTOR B IS THE CRITICAL NEGATIVE CASE

Investor B MUST:

- receive no payout transaction;
- cause no Privy signature request;
- remain at exactly 1 HBAR;
- retain the 400 ATS units;
- retain the ATS dividend entitlement of 4;
- remain Catenor DENY / HOLD.

This distinction is essential:

ATS economic entitlement
!=
current Catenor eligibility to execute payout.

AFTER BROADCAST

Verify and record:

1. receipt SUCCESS;
2. Mirror Node / HashScan SUCCESS;
3. Agent nonce 2 → 3 exactly;
4. Agent balance decreases by exactly 6 HBAR + gas;
5. Investor A balance 1 → 7 HBAR exactly;
6. Investor B balance remains 1 → 1 HBAR;
7. zero Privy signature requests for Investor B;
8. exact gas used / HBAR fee;
9. transaction hash;
10. Catenor audit chain remains valid;
11. CRE remains explicitly SIMULATION;
12. Sumsub representative evidence remains REAL SANDBOX.

Account for possible JSON-RPC nonce-read lag by polling briefly after the receipt,
using the same approach already added after the bootstrap finding.
Do not retry the transaction merely because a first nonce read is stale.

DOCUMENTATION / EVIDENCE

Capture this as the selective controlled-distribution checkpoint.

Update:
- FINAL-DEMO.md
- TASKS.md
- BUILD_LOG.md
- PROVENANCE.md
- relevant public evidence artifacts

Create a separate logical commit, signed off with -s, no Co-Authored-By.

STOP after this checkpoint.

Do NOT start Judge Inspector/UI implementation in the same checkpoint.

Report:

- payout tx hash;
- receipt/status;
- fee;
- Agent balance before/after;
- Investor A balance before/after;
- Investor B balance before/after;
- Agent nonce before/after;
- proof Investor B caused zero signature/transaction;
- Catenor A/B decision result;
- CRE/Sumsub evidence classification;
- commit hash;
- remaining demo-critical tasks.
````
