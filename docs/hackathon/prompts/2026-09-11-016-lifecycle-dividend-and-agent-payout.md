# Catenor One — Final demo checkpoint 8: ATS dividend lifecycle preflight, lifecycle Privy rules, Agent funding

**Date:** 2026-09-11  
**Project:** Catenor One  
**Scope:** READ-ONLY ATS dividend/corporate-action research and preflight on the rehearsal equity; the narrowest Privy SPV policy rule(s) for the lifecycle functions (maintainer-run owner-key script, dry run first); Agent funding recommendation; STOP before any grantRole / dividend / payout broadcast  
**Tool:** Claude Code (main session) with the `hedera-engineer` and `privy-engineer` project subagents  
**Type:** Human prompt to Claude Code — verbatim text of the maintainer's instruction, preserved exactly as provided

## Prompt (verbatim)

````text
BEFORE EXECUTING:

Save this exact prompt verbatim under the existing hackathon prompt naming convention.

This is the next ETHOnline delivery checkpoint.

==================================================
CHECKPOINT ACCEPTED
==================================================

The current distribution checkpoint is approved.

We now have a meaningful end-to-end differentiated path:

REAL:
- PostgreSQL
- Privy Agent wallet/policy
- Hedera holdings
- Sumsub Sandbox representative evidence

SIMULATION:
- Chainlink CRE Confidential Workflow

MOCK:
- approved company/KYB evidence only where explicitly used

Distribution result:
Investor A → ALLOW / PAY 6 HBAR
Investor B → DENY / HOLD 4 HBAR

Nothing has been paid yet.

==================================================
1. AGENT FUNDING DECISION
==================================================

Do NOT build a gas-sponsor subsystem now.

For the FINAL RECORDED DEMO, the Agent EVM wallet may be pre-created and pre-funded,
just like the SPV wallet.

What should remain live in the demo is:

CREATE DISTRIBUTION AGENT
↓
Catenor creates/resolves AGENT Subject
↓
did:catenor
↓
Catenor provisions/activates the Privy Agent execution policy
↓
Catenor grants the scoped Capability
↓
Agent becomes authorized for distribution

If preserving live wallet creation is trivial and does not introduce a funding
problem, keep it.

Otherwise optimize for reliability:
pre-seeded funded Agent wallet + live policy/identity/capability provisioning.

Do NOT build gas sponsorship before submission.

Use the existing narrow policy constraints:
- chain 296
- only Investor A/B destinations
- max 20 HBAR
- export denied
- default deny

Catenor signer boundary MUST additionally require:
- plain native HBAR transfer;
- empty calldata;
- exact intended recipient;
- exact amount produced by the approved distribution plan.

==================================================
2. HEDERA ATS LIFECYCLE — NEXT
==================================================

Proceed with the rehearsal token's ATS lifecycle operation.

Preferred lifecycle operation:

ATS DIVIDEND / CORPORATE ACTION

Existing rehearsal equity:

0x7aeDA4b6B89dA392Efd88AD0Fcb075e12ab6a418

Current holdings:

Investor A = 600
Investor B = 400
Total = 1,000

Delegate Hedera mechanics to hedera-engineer.

First perform READ-ONLY research/preflight against the actual deployed token:

- determine the exact ATS role required for the dividend operation;
- determine whether any corporate-action initialization is required;
- determine the exact current-contract functions;
- determine the minimum sequence:
  grant required role, if needed
  → create/set dividend
  → read back dividend/corporate-action data

Use the actual
@hashgraph/asset-tokenization-contracts@8.0.0
types and live Testnet behavior.

Do not rely on stale documentation.

==================================================
3. PRIVY POLICY FOR LIFECYCLE
==================================================

Delegate Privy mechanics to privy-engineer.

The SPV Privy wallet remains the execution wallet.

For the rehearsal token, prepare the narrowest possible new policy rule(s) for
the lifecycle functions actually required.

Prefer:

chain 296
+
exact token target
+
exact function_name
+
additional stable calldata restrictions where supported

Do not weaken the current issuance/deploy rules.

Use a maintainer-run management-owner script, following the exact pattern that
worked for the issuance-rule update.

Management owner private key stays outside runtime.

First:
- dry-run policy change;
- read back policy;
- prove unrelated functions remain denied.

STOP before any lifecycle transaction requiring explicit authorization.

Report the exact maintainer command.

==================================================
4. DIVIDEND SEMANTICS FOR THIS DEMO
==================================================

Do NOT use the ATS dividend action itself to decide Investor A vs Investor B
identity eligibility.

Separate the concepts:

ATS / Hedera:
→ records the asset lifecycle / corporate-action entitlement based on token ownership.

Catenor:
→ determines whether current identity/policy permits actual distribution execution.

This is intentional.

Investor B may continue to own 400 units and may have an economic dividend
entitlement represented by the asset lifecycle state.

But:

current eligibility != ownership

Therefore later:

Investor A
→ Catenor ALLOW
→ payment executes

Investor B
→ Catenor DENY/HOLD
→ no payment executes

This separation is part of the demo thesis.

==================================================
5. AFTER DIVIDEND — AGENT PAYOUT
==================================================

After the Hedera lifecycle checkpoint is real and verified, prepare the Agent payout.

Revenue pool:
10 HBAR

Holdings:
A 60% → 6 HBAR
B 40% → 4 HBAR

Blind dry-run:
A → proposed 6
B → proposed 4

Controlled result:
A → ALLOW → execute 6 HBAR
B → DENY/HOLD → execute NOTHING

The Agent must never request a Privy signature for Investor B's held payment.

For the live Agent payout:

- use the Privy-managed Agent EVM wallet;
- use the scoped Agent runtime signer;
- enforce the current policy;
- enforce empty calldata in Catenor signer boundary;
- exact recipient = Investor A bound account;
- exact amount = 6 HBAR;
- chain = 296.

No raw private key.

Before any payout broadcast:
STOP and request explicit maintainer authorization.

==================================================
6. FD-2 DELIVERY DECISION
==================================================

Do NOT let FD-2 block the submission.

We already have real evidence that:

- SPV Privy wallet exists;
- narrow SPV Privy policy exists;
- policy enforced chain/target/function restrictions;
- Privy SPV wallet executed real Hedera deployEquity;
- same wallet executed real issueByPartition.

The final demo should still show meaningful Privy policy provisioning live.

The CREATE DISTRIBUTION AGENT path is sufficient to demonstrate live Privy wallet/policy
provisioning if dynamic SPV policy creation becomes expensive or conflicts with the
approved management-owner custody model.

Therefore:

FD-2 dynamic SPV execution-policy creation after Sponsor ALLOW is now:
DESIRED, NOT SUBMISSION-BLOCKING.

Do not weaken truthfulness in FINAL-DEMO.
If it remains pre-provisioned, say so.

Do NOT spend hours redesigning management-owner custody merely to satisfy FD-2.

==================================================
7. AFTER LIFECYCLE + PAYOUT
==================================================

Once both are complete, priority immediately becomes:

- HTTP revenue trigger;
- Judge Inspector;
- guided demo UI;
- rehearsal;
- submission evidence.

No new architecture.

==================================================
8. COMMITS / DOCS
==================================================

Continue small checkpoints.

Expected:

feat(hedera): execute ATS dividend lifecycle action

feat(distribution): execute Privy Agent payout for eligible investor

docs(hackathon): record lifecycle and controlled payout evidence

Update:
- FINAL-DEMO.md
- TASKS.md
- BUILD_LOG.md
- PROVENANCE.md
- AI_USAGE.md when required

Preserve REAL / SIMULATION / MOCK labels.

No push.
No secrets.
No .env.
No private keys.
Use -s.
No Co-Authored-By.

==================================================
9. STOP CONDITION NOW
==================================================

For the next response:

Complete only the READ-ONLY lifecycle research/preflight and prepare the required
Privy policy update.

Do NOT broadcast:
- grantRole;
- dividend;
- payout.

STOP and report:

HEDERA
- exact lifecycle functions
- required roles
- read-only simulation results
- gas/HBAR estimates

PRIVY
- exact proposed new policy rule(s)
- function-level restrictions confirmed?
- maintainer command

AGENT
- recommended final-demo funding approach
- wallet/address to fund if pre-seeding is chosen
- suggested funding amount

TESTS
COMMITS
NEXT AUTHORIZED ACTION
````
