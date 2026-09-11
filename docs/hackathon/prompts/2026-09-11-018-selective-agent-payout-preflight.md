# Catenor One — Final demo checkpoint 10: selective Agent payout preflight

**Date:** 2026-09-11  
**Project:** Catenor One  
**Scope:** resolve and verify the pre-seeded Agent Privy wallet and policy; build the Catenor Agent payout signer boundary; READ-ONLY / dry-signature preflight (A PAY 6 HBAR, B HOLD — no signature, no transaction; negative cases); STOP before the live payout  
**Tool:** Claude Code (main session)  
**Type:** Human prompt to Claude Code — verbatim text of the maintainer's instruction, preserved exactly as provided

## Prompt (verbatim)

````text
Agent maintainer setup is complete.

The pre-seeded Agent Privy EVM wallet is funded with 20 HBAR testnet.

apps/api/.env now contains:

- PRIVY_AGENT_WALLET_ADDRESS
- PRIVY_AGENT_OWNER_PUBLIC_KEY
- PRIVY_AGENT_RUNTIME_QUORUM_ID
- CATENOR_AGENT_RUNTIME_AUTHORIZATION_KEY

Do not read, print or expose those secret values.

Proceed with the selective Agent payout checkpoint.

Requirements:

1. Resolve the pre-seeded Agent wallet and read back its Privy policy.

2. Verify the policy is still exactly the approved narrow execution boundary:
   - chain 296 only;
   - destinations limited to Investor A / Investor B;
   - max 20 HBAR;
   - export denied;
   - unrelated actions default-denied.

3. Build the Catenor Agent payout signer boundary.

For an executable payout it must enforce:

- distribution plan result == PAY;
- chain == 296;
- native HBAR transfer only;
- empty calldata;
- exact recipient equals the privately bound investor account;
- exact amount equals the approved distribution plan;
- no caller-provided arbitrary transaction bytes.

For the current demo:

Investor A
→ decision ALLOW / PAY
→ exact amount 6 HBAR

Investor B
→ decision DENY / HOLD
→ NO Privy signature request
→ NO transaction

4. Run a READ-ONLY / dry-signature preflight.

Prove:

Investor A:
- exact 6 HBAR transaction passes Catenor signer boundary;
- Privy dry signature succeeds;
- signer recovers to the Agent wallet;
- sufficient HBAR exists;
- estimate gas / max cost.

Investor B:
- no payout transaction is constructed;
- no Privy signature is requested;
- Agent nonce remains unchanged.

Negative cases:
- recipient not A/B → DENY;
- amount > 20 HBAR → DENY;
- amount differs from approved plan → rejected before Privy;
- non-empty calldata → rejected before Privy;
- wrong chain → DENY.

5. Do NOT broadcast the 6 HBAR payout yet.

STOP immediately before broadcast and report:

- Agent wallet address;
- current HBAR balance;
- current nonce;
- Privy policy ID and controls;
- Investor A destination;
- exact payout = 6 HBAR;
- estimated gas / HBAR;
- proof that Investor B generated no signature/transaction;
- tests;
- commits.

Do not start Judge Inspector yet.
Do not pay Investor A until I explicitly authorize the single live payout.
````
