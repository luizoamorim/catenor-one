# Catenor One — Final demo checkpoint 12: testnet bootstrap funding of the investor receiving accounts

**Date:** 2026-09-11  
**Project:** Catenor One  
**Scope:** prepare exactly two maintainer-authorized TESTNET BOOTSTRAP transfers (1 HBAR each to Investor A and Investor B, gas limit 700,000) from the Privy-managed Agent wallet — account activation only, NOT a distribution; STOP before broadcast; after authorization broadcast A and B one at a time, rerun preflight:payout  
**Tool:** Claude Code (main session)  
**Type:** Human prompt to Claude Code — verbatim text of the maintainer's instruction, preserved exactly as provided

## Prompt (verbatim)

````text
Yes. Use the already funded Privy-managed Agent wallet to activate both investor
receiving accounts before the final distribution demo.

This is TESTNET BOOTSTRAP FUNDING, not a distribution.

Prepare exactly two maintainer-authorized setup transactions:

Investor A
- destination: 0x8D726Ab3aD261f03C60D9073F2bf05C9899a7F78
- amount: 1 HBAR
- chain: 296
- gas limit: 700,000

Investor B
- destination: 0x72f94a15A815853B488BCf225ec3cb67eC5ba444
- amount: 1 HBAR
- chain: 296
- gas limit: 700,000

Use ONLY the Privy-managed Agent wallet/runtime signer.
No raw private key.

These transactions are pre-demo account activation/bootstrap only.
They MUST NOT be recorded as CREATE_DISTRIBUTION or payout events.

Before broadcasting:
- confirm the current Agent policy allows both exact destinations and amounts;
- estimate gas for both;
- verify the Agent has sufficient balance;
- STOP and report the two prepared transactions.

After I explicitly authorize them, broadcast A and B one at a time.

Once both investor accounts exist:
- rerun preflight:payout;
- the real 6 HBAR payout to A should return to the low normal transfer gas;
- B must remain HOLD and receive no additional distribution amount.

For final demo balance comparisons, record the 1 HBAR bootstrap balance as the
starting balance for both investors.
````
