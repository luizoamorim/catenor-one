# Catenor One — Final demo checkpoint 7: FD-2 clarification, issuance integration, Distribution Agent, CRE + real Sumsub, A/B eligibility

**Date:** 2026-09-11  
**Project:** Catenor One  
**Scope:** clarify FD-2 (policy created after ALLOW for a pre-seeded SPV wallet); plan issuance inside the authorized tokenization orchestration; implement the live CREATE DISTRIBUTION AGENT action (AGENT subject, Privy wallet + narrow policy, scoped Capability); real Sumsub sandbox representative through CRE SIMULATION; Investor A ALLOW / Investor B DENY distribution plan; STOP before any Hedera lifecycle/dividend operation  
**Tool:** Claude Code (main session) with the `privy-engineer` and `cre-engineer` project subagents  
**Type:** Human prompt to Claude Code — verbatim text of the maintainer's instruction, preserved exactly as provided

## Prompt (verbatim)

````text
Rehearsal Hedera configuration + issuance is complete and accepted.

Do NOT perform the dividend/lifecycle operation yet.

We are changing the immediate priority to the distinctive Catenor demo path.

==================================================
1. FD-2 CLARIFICATION
==================================================

For the FINAL RECORDED DEMO, the SPV EVM wallet MAY be pre-created and pre-funded.

We no longer require creating the SPV wallet itself after Sponsor ALLOW.

What MUST happen after Sponsor TOKENIZE_ASSET authorization is:

Sponsor request
↓
Catenor verifies scoped Capability
↓
ALLOW
↓
Catenor creates the SPV EXECUTION POLICY through the Privy API
↓
attaches/activates the required execution controls for the pre-seeded SPV wallet
↓
Hedera execution

This preserves the demo story we want:

BEFORE:
SPV wallet exists and is funded
SPV execution policy for this tokenization does NOT exist

AFTER Sponsor ALLOW:
Privy policy exists and is visible in the dashboard
→ Hedera action becomes executable

Update FINAL-DEMO / TASKS accordingly.

Do not present pre-seeding/funding the wallet as Catenor authority.

Catenor authority causes the policy-controlled execution capability to become available.

==================================================
2. ISSUANCE AUTHORIZATION GAP
==================================================

Do not rebuild the rehearsal issuances.

For the final demo implementation, integrate issuance into the authorized tokenization orchestration:

Sponsor TOKENIZE_ASSET Capability
→ authorize tokenization plan
→ deploy equity
→ issue the configured allocations to Investor A/B

The signer boundary must still validate:
- exact token created by this flow;
- exact investor addresses from the demo allocation;
- exact amounts;
- partition 0x...01.

Do not create a generic mint/issuance API.

Keep the rehearsal scripts as evidence/tests only.

==================================================
3. NEXT PRIMARY FEATURE — DISTRIBUTION AGENT
==================================================

Implement the live CREATE DISTRIBUTION AGENT demo action now.

Flow:

Catenor
→ create Subject type AGENT
→ create did:catenor
→ create dedicated Privy EVM Agent wallet
→ create narrow Privy Agent policy
→ grant signed scoped Catenor Capability

Conceptual capability:

action: EXECUTE_DISTRIBUTION
resource: spv:catenor-demo-001

Use [REF-IMPL] vocabulary if required.

Requirements:

Agent wallet
!= Sponsor wallet
!= SPV wallet
!= Investor A/B wallets

The Agent policy must be visibly narrower than the SPV execution policy.

Use privy-engineer for policy mechanics.

Do not build a generic agent framework.

==================================================
4. CRE + REAL SUMSUB
==================================================

In parallel/next, use cre-engineer to replace the final mock representative path with:

REAL Sumsub Sandbox representative
↓
CRE handlerInTee
↓
SIMULATION
↓
normalized result
↓
reconciliation
↓
policy

Company/KYB remains explicitly SYNTHETIC MOCK.

The final demo must not use the mock Sumsub server if the real Sandbox call is working.

==================================================
5. INVESTOR DISTRIBUTION STATE
==================================================

Prepare:

Investor A
→ eligible/current
→ distribution ALLOW

Investor B
→ initially holds 400 units
→ current evidence/state becomes invalid/stale/RED/mismatched
→ distribution DENY/HOLD

Do NOT remove Investor B's holdings.

This is the point:

ownership != current eligibility to receive a regulated distribution.

==================================================
6. DO NOT START HEDERA DIVIDEND YET
==================================================

First complete:

- live Distribution Agent creation;
- Privy Agent wallet/policy;
- real Sumsub representative through CRE simulation;
- A ALLOW / B DENY distribution plan.

Then STOP.

After that checkpoint we will choose the minimal Hedera ATS lifecycle operation
(dividend preferred, another valid ATS lifecycle operation if dividend becomes too costly).

==================================================
7. COMMITS
==================================================

Keep small checkpoints.

Suggested:

feat(privy): create scoped distribution agent wallet and policy

feat(cre): use real Sumsub sandbox representative in demo checks

feat(distribution): gate investor distribution eligibility with Catenor

docs(hackathon): record distribution checkpoint

Update FINAL-DEMO / TASKS / BUILD_LOG / PROVENANCE.

No secrets.
No push.

STOP when Agent + CRE + A/B eligibility path works and report:

- Agent DID
- Agent Privy wallet
- policy controls
- Capability
- Sumsub REAL result
- CRE SIMULATION evidence
- Investor A result
- Investor B result
- commits/tests
- exact remaining work for Hedera lifecycle.
````
