# Catenor One — Final demo checkpoint 5: one authorized live issuance to Investor A

**Date:** 2026-09-11  
**Project:** Catenor One  
**Scope:** exactly ONE live Hedera Testnet `issueByPartition` (Investor A, 600 units) through the Privy SPV signer path; verify and record; STOP before Investor B  
**Tool:** Claude Code (main session)  
**Type:** Human prompt to Claude Code — verbatim text of the maintainer's instruction, preserved exactly as provided

## Prompt (verbatim)

````text
Policy update and issuance preflight are complete and PASS.

You are explicitly authorized to broadcast exactly ONE live Hedera Testnet issuance:

Investor A
- token: 0x7aeDA4b6B89dA392Efd88AD0Fcb075e12ab6a418
- holder: 0x8D726Ab3aD261f03C60D9073F2bf05C9899a7F78
- amount: 600
- partition: 0x0000000000000000000000000000000000000000000000000000000000000001
- chain: 296
- sender: existing Privy-managed SPV wallet
- gas limit: 1,000,000

Use ONLY the Privy SPV signer path.
Do not use the raw Hedera private-key executor.

After broadcast:
1. wait for receipt;
2. verify SUCCESS;
3. verify Investor A balance = 600;
4. verify total supply = 600;
5. capture transaction hash;
6. verify SPV nonce increment;
7. record public Hedera evidence;
8. STOP before Investor B.

Do NOT broadcast Investor B yet.
````
