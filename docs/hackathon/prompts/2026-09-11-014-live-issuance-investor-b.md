# Catenor One — Final demo checkpoint 6: one authorized live issuance to Investor B

**Date:** 2026-09-11  
**Project:** Catenor One  
**Scope:** exactly ONE live Hedera Testnet `issueByPartition` (Investor B, 400 units) through the Privy SPV signer path on the rehearsal asset; verify, record, commit; STOP before any lifecycle/dividend operation  
**Tool:** Claude Code (main session)  
**Type:** Human prompt to Claude Code — verbatim text of the maintainer's instruction, preserved exactly as provided

## Prompt (verbatim)

````text
Investor A issuance is verified and accepted.

You are explicitly authorized to broadcast exactly ONE live Hedera Testnet issuance for Investor B:

- token: 0x7aeDA4b6B89dA392Efd88AD0Fcb075e12ab6a418
- holder: 0x72f94a15A815853B488BCf225ec3cb67eC5ba444
- amount: 400
- partition: 0x0000000000000000000000000000000000000000000000000000000000000001
- chain: 296
- sender: existing Privy-managed SPV wallet
- gas limit: 1,000,000

Use ONLY the Privy SPV signer path.
No raw Hedera private-key executor.
One attempt only, no automatic retry.

After broadcast:

1. verify receipt SUCCESS;
2. verify Investor B balance = 400;
3. verify Investor A remains 600;
4. verify total supply = 1,000;
5. verify SPV nonce increments exactly once;
6. capture tx hash and public Hedera evidence;
7. update FINAL-DEMO / TASKS / BUILD_LOG / PROVENANCE;
8. commit the Investor B issuance checkpoint separately;
9. STOP.

Do not start the lifecycle/dividend operation yet.

Also preserve these two known final-demo gaps as OPEN:
- FD-2 dynamic SPV wallet/policy provisioning after Sponsor ALLOW;
- issuance authorization/binding through Catenor rather than maintainer-authorized rehearsal scripts.

This issuance is still part of the rehearsal asset path.
````
