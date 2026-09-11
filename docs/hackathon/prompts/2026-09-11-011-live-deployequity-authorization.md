# Catenor One — Final demo checkpoint 3: dry run, then one authorized live deployEquity

**Date:** 2026-09-11  
**Project:** Catenor One  
**Scope:** `pnpm demo:s001` dry run (REAL Sumsub sandbox representative); if it passes unchanged, exactly ONE live Hedera Testnet `Factory.deployEquity` signed by the Privy SPV wallet; record, commit, STOP before `issueByPartition`  
**Tool:** Claude Code (main session)  
**Type:** Human prompt to Claude Code — verbatim text of the maintainer's instruction, preserved exactly as provided

## Prompt (verbatim)

````text
CATENOR_INTERNAL_API_TOKEN_VAR is now configured locally.

Proceed with:

1. pnpm demo:s001
   - no Hedera live flag
   - use the REAL Sumsub Sandbox representative path
   - verify the complete S001 + capability + DENY paths
   - confirm the exact final deployEquity transaction is still valid

If and ONLY if that dry run passes without any unexpected semantic/security change, you are explicitly authorized to broadcast exactly ONE live Hedera Testnet transaction:

Factory.deployEquity

using:

- SPV Privy wallet:
  0x6c6AD33BA7FB4DA58A1b7412706f8ECB10Ba9C93

- Hedera Testnet chain 296

- ATS Factory:
  0xd1F118A40f3b02883D35909eF2517e7EDd78379d

- Privy policy:
  a417f2izlkwzvh1e0pl5juh1

- value: 0
- configured gas limit: 15,000,000
- no raw private-key executor
- no issuance yet

The wallet is funded with 100 HBAR testnet.

Do NOT change the gas limit now. The wallet is sufficiently funded and unused gas is refunded.

After successful broadcast:

1. capture transaction hash;
2. capture the deployed ATS equity/token address;
3. verify the contract/token read-back on Hedera;
4. record the actual HBAR cost;
5. update FINAL-DEMO / TASKS / BUILD_LOG / PROVENANCE;
6. commit this live Hedera checkpoint separately;
7. STOP before issueByPartition and report.

If the dry run differs materially from the preflight, DO NOT broadcast. Stop and report.
````
