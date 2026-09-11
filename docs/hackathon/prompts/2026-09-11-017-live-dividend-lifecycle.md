# Catenor One — Final demo checkpoint 9: two authorized live ATS dividend lifecycle transactions

**Date:** 2026-09-11  
**Project:** Catenor One  
**Scope:** exactly TWO Hedera Testnet transactions from the Privy SPV wallet, sequentially — `grantRole(ROLE_CORPORATE_ACTION, SPV)` then `setDividend(now+120 s, now+300 s, 1, 2)` — verify, record, commit; STOP before any Agent payout  
**Tool:** Claude Code (main session)  
**Type:** Human prompt to Claude Code — verbatim text of the maintainer's instruction, preserved exactly as provided

## Prompt (verbatim)

````text
Lifecycle policy update and preflight are PASS.

You are explicitly authorized to execute exactly TWO Hedera Testnet transactions from the existing Privy-managed SPV wallet, sequentially.

CURRENT STATE

SPV:
0x6c6AD33BA7FB4DA58A1b7412706f8ECB10Ba9C93

Equity:
0x7aeDA4b6B89dA392Efd88AD0Fcb075e12ab6a418

Chain:
296

Current SPV nonce:
3

Use ONLY the Privy SPV signer path.
No raw Hedera private-key executor.
No automatic retries.

==================================================
TRANSACTION 1 — GRANT CORPORATE ACTION ROLE
==================================================

Execute:

grantRole(
  ROLE_CORPORATE_ACTION,
  SPV
)

Exact role:
0xa1acfc499025c99f55059195e6276f639d34a18aad7b8121b9192b7f438c55cd

Account:
0x6c6AD33BA7FB4DA58A1b7412706f8ECB10Ba9C93

Gas limit:
500,000

After broadcast:

- wait for SUCCESS receipt;
- verify Mirror Node/public evidence;
- verify SPV now holds ROLE_CORPORATE_ACTION;
- verify nonce moved exactly 3 → 4;
- capture actual gas/HBAR cost.

ONLY if all checks pass, continue to transaction 2.

==================================================
TRANSACTION 2 — SET DIVIDEND
==================================================

Create the dividend using fresh timestamps at execution time:

recordDate:
current time + 120 seconds

executionDate:
current time + 300 seconds

amount:
1

amountDecimals:
2

Meaning:
0.01 per token unit.

Gas limit:
1,000,000

After broadcast:

- wait for SUCCESS receipt;
- verify nonce moved exactly 4 → 5;
- obtain the created dividend/corporate-action id;
- verify getDividend(id);
- after the record date, verify ownership-based entitlement:

Investor A:
600 units
→ entitlement = 6

Investor B:
400 units
→ entitlement = 4

- verify total entitlement = 10;
- capture tx hash, gas/HBAR cost and public Hedera evidence.

IMPORTANT:

The ATS dividend represents ownership-based economic entitlement.

It does NOT determine current Catenor distribution eligibility.

The expected later controlled distribution remains:

Investor A
→ Catenor ALLOW
→ PAY 6 HBAR

Investor B
→ Catenor DENY/HOLD
→ NO PAYMENT

==================================================
AFTER BOTH TRANSACTIONS
==================================================

Update:

- FINAL-DEMO.md
- TASKS.md
- BUILD_LOG.md
- PROVENANCE.md
- public hackathon evidence artifacts

Commit this Hedera lifecycle checkpoint separately.

STOP before any Agent payout.

Report:

1. grantRole tx hash/status/cost;
2. setDividend tx hash/status/cost;
3. dividend id;
4. Investor A entitlement;
5. Investor B entitlement;
6. final SPV nonce;
7. remaining SPV HBAR;
8. commit hash;
9. exact next step for the selective Agent payout.

Do NOT pay Investor A yet.
Do NOT send anything to Investor B.
````
