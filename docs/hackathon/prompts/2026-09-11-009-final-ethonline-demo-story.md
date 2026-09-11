# Catenor One — Final ETHOnline 2026 demo story

**Date:** 2026-09-11  
**Project:** Catenor One  
**Scope:** lock the final ETHOnline demo story (pre-seeded state, live actions, sponsor paths, real/simulation/mock matrix, prize mapping, scope cuts); first checkpoint = Privy SPV EVM wallet + policy and Privy → Hedera (eip155:296) compatibility, no broadcast  
**Tool:** Claude Code (main session) with the `privy-engineer`, `hedera-engineer` and `cre-engineer` project subagents  
**Type:** Human prompt to Claude Code — verbatim text of the maintainer's instruction, preserved exactly as provided

## Prompt (verbatim)

````text
BEFORE DOING ANYTHING ELSE:

Save this exact task prompt verbatim as:

docs/hackathon/prompts/2026-09-11-009-final-ethonline-demo-story.md

Use the existing provenance convention.

Then execute the task below.

==================================================
CATENOR ONE — FINAL ETHONLINE 2026 DEMO STORY
HACKATHON DELIVERY MODE
==================================================

We are locking the final ETHOnline demo.

This is a DELIVERY plan, not a protocol redesign.

DO NOT:
- redesign S001;
- change frozen Catenor semantics;
- expand production architecture;
- complete historical phases merely for completeness;
- build generic infrastructure not visible/necessary in the demo.

Use the existing specialist agents:

Main Claude
├── cre-engineer
│   └── Chainlink CRE mechanics
├── privy-engineer
│   └── Privy wallets, policies, signers and execution
└── hedera-engineer
    └── Hedera ATS, testnet and prize evidence

Main Claude retains ownership of:
- Catenor identity semantics;
- authority;
- capabilities;
- policy;
- orchestration;
- final demo story.

==================================================
0. CURRENT FACTS — DO NOT REDISCOVER
==================================================

S001 Trust Anchor Admission already works end-to-end over real PostgreSQL.

Privy:
- real Credential Assertion Key path is LIVE-CONFIRMED;
- dedicated Privy Solana/Ed25519 wallet;
- real signMessage;
- eddsa-jcs-2022 proof verified successfully;
- owner/runtime-signer separation implemented.

CRE:
- Confidential Workflow mechanics passed simulation;
- final claims must distinguish SIMULATION from deployed TEE;
- B1 private-beta enrollment remains open.

Sumsub:
- real Sandbox individual/representative integration was proven previously;
- Company/KYB entitlement is unavailable;
- Hybrid Demo Profile allows:
  company = SYNTHETIC MOCK
  representative = REAL SUMSUB SANDBOX

Hedera:
- ATS direct-contract executor exists;
- @hashgraph/asset-tokenization-contracts@8.0.0;
- ethers v6;
- ATS Factory deployEquity arguments were already validated read-only against testnet;
- current executor can use a raw operator key, but that is NOT the preferred final demo path.

==================================================
1. PRE-SEEDED STATE BEFORE THE MAIN DEMO
==================================================

We do NOT spend main demo time creating the initial Trust Anchor.

Pre-existing:

A. ROOT TRUST ANCHOR
- ACTIVE
- valid S001 admission exists
- auditable in Judge Inspector

B. SPONSOR ORGANIZATION
- already has did:catenor
- identity already exists
- Sponsor has a scoped signed Catenor Capability from the ACTIVE Trust Anchor:

  action: TOKENIZE_ASSET
  resource: spv:catenor-demo-001

We only mention this before tokenization.

Do NOT spend demo time issuing that Capability.

C. INVESTOR A
- did:catenor exists
- Privy wallet/account exists
- identity/evidence prepared

D. INVESTOR B
- did:catenor exists
- Privy wallet/account exists
- identity/evidence prepared

Ideal state:
both investors are initially able to participate,
but Investor B later becomes distribution-ineligible.

IMPORTANT:

Do NOT pre-create:
- SPV execution policy;
- Distribution Agent policy.

Those should be visibly provisioned through Catenor during the demo.

==================================================
2. MAIN DEMO — PART A: TOKENIZE ASSET
==================================================

The Sponsor clicks:

TOKENIZE ASSET

Flow:

Sponsor request
↓
Catenor verifies Sponsor Capability:

- issuer is ACTIVE Trust Anchor;
- signature valid;
- subject == Sponsor;
- action == TOKENIZE_ASSET;
- resource == spv:catenor-demo-001;
- not expired/revoked.

↓
ALLOW

ONLY AFTER Catenor ALLOW:

1. create/resolve SPV Catenor subject;
2. provision dedicated Privy EVM wallet for the SPV;
3. create Privy SPV wallet policy via API;
4. attach required policy/signer controls;
5. persist Privy wallet/policy refs;
6. encode Hedera ATS Factory.deployEquity;
7. use the PRIVY-MANAGED SPV EVM WALLET to execute on Hedera Testnet;
8. wait for receipt;
9. persist Hedera tx/token references;
10. mark asset TOKENIZED.

FINAL DEMO PATH:

Catenor authority
↓
Privy SPV wallet + execution policy
↓
Hedera ATS

Do NOT use HEDERA_OPERATOR_EVM_PRIVATE_KEY in the final demo path.

The raw-key executor may remain only as development/test infrastructure.

==================================================
3. PRIVY → HEDERA COMPATIBILITY
==================================================

This is the FIRST technical checkpoint.

Delegate Privy mechanics to privy-engineer.

Confirm, using CURRENT Privy docs/types/runtime behavior, that a Privy-managed EVM
wallet can sign/send the Hedera Testnet transaction over:

chain:
eip155:296

Hedera Testnet JSON-RPC:
https://testnet.hashio.io/api

Before any broadcast:

- provision the SPV EVM wallet;
- provision its policy;
- verify wallet address;
- verify policy attachment;
- encode the already-tested ATS deployEquity call;
- test the transaction path without spending HBAR if possible.

The SPV policy should be as narrow as current Privy predicates practically allow.

Prefer restrictions such as:
- only required transaction method;
- Hedera Testnet chain;
- ATS Factory target if supported cleanly;
- export denied;
- unrelated actions default-denied.

DO NOT INVENT POLICY FEATURES.

If current Privy cannot enforce a desired predicate:
document it honestly and continue with the strongest supported policy.

Do NOT silently fall back to a raw private key.

STOP before the first live Hedera transaction if funding is required and report
the SPV EVM address to the maintainer.

==================================================
4. PRIVY DASHBOARD STORY
==================================================

Privy is a core sponsor integration, not decoration.

We want to show:

BEFORE TOKENIZE:
- Sponsor exists;
- target SPV execution wallet/policy does not yet exist, where practical to show.

AFTER TOKENIZE:
- SPV Privy EVM wallet exists;
- SPV policy exists;
- policy is attached;
- signer/control configuration is visible.

Narrative:

"Catenor verified the Sponsor's authority, then translated that authority into
wallet-level execution controls in Privy before the real asset action executed."

Privy does NOT decide Catenor authority.

Catenor:
identity + authority

Privy:
wallet + signer + execution constraints

==================================================
5. HEDERA — TOKENIZATION OF ANYTHING
==================================================

Delegate Hedera mechanics/prize evidence to hedera-engineer.

Use:

@hashgraph/asset-tokenization-contracts@8.0.0
ethers v6
Hedera Testnet

Do NOT introduce the large ATS SDK.

Target strongest practical demo:

1. ATS configuration / deployEquity;
2. issuance via issueByPartition;
3. at least one meaningful lifecycle/distribution-related operation/evidence.

Preferred:

deployEquity
↓
issueByPartition → Investor A
↓
issueByPartition → Investor B

Issuance is hackathon P0 if achievable without destabilizing the demo.

Do NOT build a full ATS lifecycle.

Record:
- real transaction hash;
- ATS security/token address;
- balances if issuance runs;
- Mirror Node / contract evidence as appropriate.

==================================================
6. PART B — CREATE DISTRIBUTION AGENT LIVE
==================================================

The Distribution Agent should be created LIVE during the demo.

User action:

CREATE DISTRIBUTION AGENT

Flow:

Catenor
↓
creates Subject type AGENT
↓
did:catenor:<agent>
↓
Privy API creates dedicated Agent EVM wallet
↓
Privy API creates narrow Agent policy
↓
Catenor grants signed scoped Capability
↓
Agent becomes usable for distribution

Distinct wallets:

Sponsor wallet
!=
SPV wallet
!=
Distribution Agent wallet
!=
Investor wallets

Agent capability should be narrowly scoped, conceptually:

action:
EXECUTE_DISTRIBUTION

resource:
spv:catenor-demo-001

Use a [REF-IMPL] action name if protocol action vocabulary is not frozen.

Preserve:

Relationship != Capability.

==================================================
7. AGENT PRIVY POLICY
==================================================

The Agent's Privy policy should visibly be NARROWER than the SPV policy.

Example story:

SPV wallet
→ SPV/asset execution controls

Distribution Agent wallet
→ distribution-only execution controls

The Agent must NOT be able to:
- administer the SPV;
- alter arbitrary policies;
- perform unrelated asset-management actions.

Use actual supported Privy controls only.

==================================================
8. INVESTORS
==================================================

Avoid building onboarding screens.

Investor A:
- valid identity;
- remains eligible when distribution executes.

Investor B:
- initially able to invest if practical;
- later has a current state causing distribution denial/hold.

Preferred examples:
- stale evidence;
- provider RED;
- reconciliation mismatch;
- expired credential/state.

The story:

"Eligibility is not a one-time KYC checkbox."

==================================================
9. REVENUE EVENT
==================================================

We simulate:

SPV REVENUE RECEIVED

Use a visible HTTP-trigger/button.

Narrative:

In production this could originate from:
- PMS;
- bank webhook;
- scheduled cron;
- reconciliation event.

For ETHOnline:
HTTP trigger is sufficient.

==================================================
10. BLIND DISTRIBUTION VS CONTROLLED DISTRIBUTION
==================================================

Show the problem first.

BLIND DISTRIBUTION — DRY RUN ONLY:

holdings:
Investor A → payout proposed
Investor B → payout proposed

This MUST NOT send an incorrect payment.

Then:

CATENOR-CONTROLLED DISTRIBUTION AGENT

Agent
↓
Chainlink CRE Confidential Workflow
↓
current evidence/state evaluation
↓
normalization
↓
reconciliation
↓
policy

Investor A:
CONSISTENT / eligible
→ ALLOW

Investor B:
invalid/stale/RED/mismatch
→ DENY / HOLD

Final plan:

Investor A
→ executable payout/distribution

Investor B
→ HELD / not paid

==================================================
11. CHAINLINK FINAL DEMO PATH
==================================================

Delegate CRE mechanics to cre-engineer.

For the final demo use:

REAL Sumsub Sandbox representative
↓
Chainlink CRE Confidential workflow
↓
handlerInTee
↓
private provider response processing
↓
normalized facts
↓
reconciliation
↓
ALLOW / DENY

If B1 remains unavailable:

CRE status = SIMULATION

Never claim:
- deployed TEE;
- production TEE.

Simulation is still meaningful sponsor evidence.

Company/KYB evidence remains:

SYNTHETIC MOCK

under the approved Hybrid Demo Profile.

Do NOT use the mock Sumsub server in the final demo if real Sumsub Sandbox
representative integration can be used.

==================================================
12. DISTRIBUTION EXECUTION
==================================================

For the hackathon, prioritize truthful sponsor integration over financial realism.

Preferred outcome:

Investor A ALLOW
→ one real, controlled testnet payout/action if technically safe and prize-useful

Investor B DENY
→ no execution

If a real payout would consume disproportionate implementation time:
- execute an on-chain/testnet distribution-relevant operation for A only;
- show B held;
- document exactly what was and was not executed.

Never send money to an ineligible investor just to demonstrate the naive path.

==================================================
13. JUDGE INSPECTOR
==================================================

Build ONE coherent technical timeline.

TRUST
- Root Trust Anchor ACTIVE
- Sponsor Capability TOKENIZE_ASSET

TOKENIZATION
- Sponsor authorization result
- SPV did:catenor
- SPV Privy wallet
- SPV Privy policy
- Hedera tx hash
- ATS asset/token address
- issued balances if available

AGENT
- Agent did:catenor
- Agent Privy wallet
- Agent Privy policy
- scoped Capability

INVESTORS
- Investor A identity/state
- Investor B identity/state

DISTRIBUTION
- revenue trigger
- blind dry-run
- CRE execution reference
- observations
- reconciliation
- policy decision
- A ALLOW
- B DENY/HOLD

AUDIT
- relevant Catenor audit events

SPONSOR EVIDENCE
- Privy refs
- Hedera refs
- Chainlink simulation evidence
- Sumsub sandbox refs without PII

==================================================
14. REAL / SIMULATION / MOCK
==================================================

The UI and docs must explicitly distinguish:

REAL
- PostgreSQL
- Privy
- Sumsub Sandbox representative
- Hedera Testnet transactions once broadcast

SIMULATION
- Chainlink CRE Confidential if B1 is unavailable

MOCK
- Company/KYB evidence under Hybrid Demo Profile

No ambiguity.

==================================================
15. PRIZE TARGETS
==================================================

We are optimizing primarily for:

PRIVY
- Best B2B financial product
- Best financial flow

CHAINLINK
- Confidential Workflow

HEDERA
- Tokenization of Anything

Use official current prize criteria when reviewing eligibility.

Use:
hedera-hackathon-submission-validator
before final submission.

Do NOT chase unrelated prizes if they require a new architecture.

==================================================
16. SCOPE CUTS
==================================================

DEFER anything not required for:

- final demo;
- prize qualification;
- credible technical claim.

Do NOT build now:

- generic CRUD;
- complete S002 Subject Continuity;
- generalized agent framework;
- full ATS lifecycle;
- generic RWA platform;
- complete production auth;
- production operator gate;
- optional P1/P2 infrastructure;
- broad refactors;
- abstractions for future use.

Keep deferred tasks visible in TASKS.

Do not falsely mark them complete.

==================================================
17. DOCUMENTATION
==================================================

Create a concise final demo plan, NOT a heavy S001-style specification.

Suggested:

docs/hackathon/demo/FINAL-DEMO.md

It should capture:

- pre-seeded state;
- live demo actions;
- real/simulation/mock matrix;
- prize mapping;
- deferred scope;
- exact sponsor evidence to capture.

Update at meaningful checkpoints:

- TASKS.md
- BUILD_LOG.md
- PROVENANCE.md
- AI_USAGE.md where existing convention requires

Do NOT rewrite frozen SPEC / ACCEPTANCE / TEST-VECTORS unless a real semantic
conflict is discovered.

==================================================
18. COMMITS
==================================================

Continue with small logical commits.

Expected checkpoints may include:

docs(hackathon): lock final ETHOnline demo story

feat(privy): provision SPV execution wallet and policy

feat(hedera): execute ATS tokenization with Privy SPV wallet

feat(hedera): issue demo asset to investors

feat(agent): create scoped distribution agent with Privy policy

feat(cre): use real Sumsub sandbox representative

feat(distribution): add confidential eligibility-gated distribution

feat(web): add guided demo and judge inspector

docs(hackathon): finalize ETHOnline submission evidence

Before every commit:

- tests;
- git status;
- inspect staged files;
- no .env;
- no private keys;
- no scratch;
- no secrets;
- use -s;
- no Co-Authored-By;
- do not push unless maintainer explicitly authorizes.

==================================================
19. EXECUTION ORDER NOW
==================================================

FIRST CHECKPOINT:

1. save this prompt verbatim;
2. create concise FINAL-DEMO.md;
3. inspect existing code and identify reusable pieces;
4. delegate Privy→Hedera compatibility mechanics to privy-engineer;
5. consult hedera-engineer for ATS/network constraints and prize evidence;
6. confirm/provision SPV EVM wallet;
7. create SPV Privy policy;
8. confirm eip155:296 execution compatibility;
9. encode the existing deployEquity call;
10. DO NOT broadcast yet if wallet funding is required.

Then STOP.

Report:

DEMO STATUS
- what already works

PRIVY
- SPV wallet provisioned?
- EVM address
- policy created?
- actual controls enforced
- eip155:296 support

HEDERA
- deployEquity calldata ready?
- read-only simulation result
- estimated HBAR required

REUSE
- what existing code stays
- what is being replaced

COMMITS
- hashes/messages

TESTS

NEXT MAINTAINER ACTION
- exactly what I need to do, if anything

BLOCKERS

Do not continue into broad implementation past this first checkpoint without
reporting it.
````
