# Catenor One — Final demo checkpoint 2: live deployEquity preflight

**Date:** 2026-09-11  
**Project:** Catenor One  
**Scope:** preflight the Privy SPV wallet → Hedera ATS `deployEquity` path; STOP before broadcast for explicit approval; then capture, verify and commit the live transaction and move on to `issueByPartition`  
**Tool:** Claude Code (main session)  
**Type:** Human prompt to Claude Code — verbatim text of the maintainer's instruction, preserved exactly as provided

## Prompt (verbatim)

````text
Checkpoint update — maintainer actions completed.

Since the last checkpoint:

HEDERA FUNDING
- RESOLVED
- SPV Privy EVM wallet funded with 100 HBAR testnet

SUMSUB / CRE WORKFLOW ENV
- RESOLVED
- Sumsub sandbox credentials added locally to workflows/.env
- do not read/print/log secret values

SPV PRIVY RUNTIME CONFIG
- RESOLVED in apps/api/.env
- CATENOR_SPV_RUNTIME_AUTHORIZATION_KEY present
- PRIVY_SPV_OWNER_PUBLIC_KEY present
- PRIVY_SPV_RUNTIME_QUORUM_ID present
- PRIVY_SPV_POLICY_ID present
- PRIVY_SPV_WALLET_ID present
- PRIVY_SPV_WALLET_ADDRESS present

B1
- Chainlink Confidential Workflows enrollment is still open
- therefore CRE remains explicitly SIMULATION, not deployed TEE

Proceed with the next live checkpoint:

1. run the strongest available preflight checks for the current SPV Privy wallet;
2. verify current HBAR balance;
3. verify the exact deployEquity calldata / ATS Factory target;
4. verify the Privy policy still allows exactly the intended Hedera testnet transaction path;
5. prepare the live transaction;
6. STOP immediately before broadcast and show me:
   - wallet address
   - current HBAR balance
   - ATS Factory address
   - estimated gas
   - configured gas limit
   - expected maximum HBAR requirement
   - policy ID
   - exact operation being authorized

Do NOT broadcast until I explicitly approve the live deployEquity transaction.

After the first successful real deployEquity:
- capture the Hedera transaction hash;
- capture the new ATS token/security address;
- verify it on-chain/read-back;
- commit the live Hedera checkpoint separately;
- then move to issueByPartition for Investor A and Investor B.

Do not redesign the demo.
Continue Hackathon Delivery Mode.
````
