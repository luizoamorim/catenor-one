# Catenor One — Reproducible demo / clean-room runbook

**Date:** 2026-09-11  
**Project:** Catenor One  
**Scope:** canonical root `DEMO.md` walkthrough + numbered `scripts/demo/` clean-room scripts (safe by default, `--live` gated) covering Trust Anchor → Sponsor → SPV → Offering Policy → investors (VC/VP) → tokenization/investment → Distribution Agent → Investor B state change → CRE confidential distribution → Agent execution → verification; CRE deployment preparation; STOP before any new live broadcast  
**Tool:** Claude Code (main session)  
**Type:** Human prompt to Claude Code — verbatim text of the maintainer's instruction, preserved exactly as provided  
**Note:** the maintainer suggested the filename `2026-09-11-011-reproducible-demo-runbook.md`; sequence number 011 was already used (`2026-09-11-011-live-deployequity-authorization.md`), so this artifact takes the next free number, 023, under the same convention.

## Prompt (verbatim)

````text
BEFORE DOING ANYTHING ELSE:

Save this exact prompt verbatim under the existing hackathon prompt convention.

Suggested filename:

docs/hackathon/prompts/2026-09-11-011-reproducible-demo-runbook.md

Then execute the task below.

==================================================
CATENOR ONE — REPRODUCIBLE DEMO / CLEAN-ROOM RUNBOOK
==================================================

We now have the core hackathon path working through multiple verified checkpoints.

The next priority is REPRODUCIBILITY.

A maintainer or judge must be able to start from a fresh environment and manually
walk through the complete Catenor One story without relying on hidden state.

This task is NOT a protocol redesign.

Do NOT weaken or rewrite frozen Catenor semantics.

==================================================
1. PRIMARY DELIVERABLE — DEMO.md
==================================================

Create:

DEMO.md

at the repository root.

This must be the canonical technical walkthrough for:

- maintainers;
- judges;
- teammates preparing the presentation.

It must explain, in order:

1. what is being demonstrated;
2. prerequisites;
3. required external accounts;
4. required environment variables;
5. which values are secrets vs public refs;
6. how to create everything from scratch;
7. how to fund Testnet wallets;
8. how to execute every stage manually;
9. how to inspect evidence after each stage;
10. how to verify Chainlink / Privy / Hedera independently;
11. REAL / SIMULATION / MOCK status;
12. how to run the final guided demo;
13. how to clean/reset only local state without pretending to revert public blockchain state.

Keep it technical and clear.

==================================================
2. WHAT WE ARE TOKENIZING
==================================================

The demo asset is:

Catenor One Demo SPV 001

Conceptually:

synthetic real-world real-estate asset
↓
owned/controlled through an SPV
↓
1,000 tokenized equity-interest units
↓
Hedera ATS equity

We are NOT claiming to tokenize a land deed directly.

The ATS token represents equity interests in the synthetic SPV.

Demo allocation:

Investor A:
600 units

Investor B:
400 units

==================================================
3. CANONICAL AUTHORITY STORY
==================================================

The scripts and DEMO.md MUST explicitly demonstrate Catenor Protocol concepts.

ROOT TRUST ANCHOR
↓
authorizes Sponsor

The Trust Anchor must create/grant the Sponsor:

RELATIONSHIP
plus
SCOPED CAPABILITIES

Sponsor capabilities for the demo:

- TOKENIZE_ASSET
- DEFINE_OFFERING_POLICY
- CREATE_AGENT
- CREATE_DISTRIBUTION
- DELEGATE_DISTRIBUTION_AUTHORITY

Use [REF-IMPL] labels where action vocabulary is not frozen protocol vocabulary.

Do not imply that a Relationship itself grants execution authority.

Preserve:

Relationship != Capability.

==================================================
4. SPONSOR / SPV
==================================================

Create Sponsor from scratch:

Sponsor
├── did:catenor
├── Privy wallet
├── appropriate relationship to the Trust Anchor
└── scoped capabilities listed above

Then Sponsor creates the SPV:

SPV
├── did:catenor
├── Privy EVM wallet
└── SPV execution controls

Sponsor also defines the OFFERING POLICY.

The Offering Policy controls who may invest.

Conceptually it should require the demo investor identity/compliance facts,
using the existing Catenor policy model rather than inventing a new framework.

==================================================
5. INVESTORS — CREATE FROM SCRATCH
==================================================

Create:

Investor A
Investor B

For each:

- create Catenor Subject;
- generate did:catenor;
- create Privy wallet;
- establish private AccountBinding;
- create/use real Sumsub Sandbox applicant evidence;
- derive the appropriate signed Catenor Verifiable Credential(s);
- create a Verifiable Presentation for the Offering Policy evaluation.

Initially BOTH investors must be eligible to invest.

Investor A:
initially valid
remains valid

Investor B:
initially valid
invests successfully
later provider/current identity state becomes invalid

Investor B MUST retain ownership after becoming ineligible.

==================================================
6. VC / VP — MUST BE REAL DEMO CONCEPTS
==================================================

This is important.

Do NOT reduce the investor flow to:

Sumsub GREEN → ALLOW

We need to visibly demonstrate:

Provider evidence
↓
Catenor Verifiable Credential
↓
Investor Verifiable Presentation
↓
Chainlink CRE Confidential evaluation

Use the existing credentials/domain packages and current approved crypto profile.

Inside CRE the demo should verify/evaluate, where supported by the existing model:

- VP holder proof;
- VC signature;
- credential issuer;
- issuer authority;
- credential subject;
- validity window;
- credential status/revocation state;
- current provider evidence;
- reconciliation;
- Offering/Distribution Policy.

Private VC/VP/provider evidence must remain inside the confidential boundary where
the approved architecture requires confidentiality.

Minimum conclusion leaves the boundary.

Do NOT expose raw PII.

If current implementation is missing any piece of this exact sequence:
identify the smallest demo-critical implementation required.
Do not invent fake "VC verified" labels.

==================================================
7. INVESTMENT FLOW
==================================================

Both investors initially pass the Offering Policy.

Then:

Investor A
→ invests / receives 600 ATS units

Investor B
→ invests / receives 400 ATS units

The investment authorization must be traceable to:

Investor VP
+
Offering Policy
+
Catenor decision

Do not expose a generic mint endpoint.

The exact Hedera issuance must remain constrained by the Catenor-authorized
allocation.

==================================================
8. DISTRIBUTION AGENT
==================================================

Sponsor creates the Distribution Agent.

The scripts must visibly create:

Agent Subject
↓
did:catenor
↓
relationship to Sponsor
↓
Privy execution wallet/binding
↓
scoped Capability

The Sponsor must establish the appropriate relationship to the Agent.

If OFFICER_OF is the correct existing relationship in the current Catenor model,
use it.

If OFFICER_OF is not actually supported/frozen for this exact relationship,
do not invent it silently; use the approved relationship term and explain it.

Separately, Sponsor grants:

EXECUTE_DISTRIBUTION
resource = spv:catenor-demo-001

The relationship tells us who the Agent acts for.

The Capability tells us what the Agent may do.

==================================================
9. INVESTOR B STATE CHANGE
==================================================

After both investors own the ATS units:

Investor B's CURRENT identity/compliance state changes.

Use the real Sumsub Sandbox path already supported.

For the demo:

Investor B
→ RED / SANCTIONS / FINAL

Investor B STILL HAS:

- 400 ATS units;
- economic ownership;
- ATS dividend entitlement.

But its current distribution eligibility becomes DENY / HOLD.

==================================================
10. DISTRIBUTION MUST BE COMPUTED INSIDE CRE TEE
==================================================

This is non-negotiable for the final architecture/demo.

Do NOT merely check individual eligibility inside CRE and calculate the real
distribution decision outside.

The confidential workflow must own the sensitive distribution computation.

Input/context conceptually includes:

- revenue event;
- SPV/asset reference;
- holdings/allocation;
- investor VP(s);
- VC(s);
- current credential status;
- real Sumsub Sandbox evidence;
- reconciliation state;
- Distribution Policy;
- any other private facts required.

Inside:

Chainlink CRE Confidential
handlerInTee
↓
verify VP/VC/current evidence
↓
normalize
↓
reconcile
↓
evaluate distribution policy
↓
compute distribution result

For the current demo:

Revenue:
10 HBAR

Holdings:
A = 600 / 60%
B = 400 / 40%

CRE confidential output:

A:
PAY 6 HBAR

B:
HOLD 4 HBAR

Only the minimized executable conclusion / commitments / references may leave
the confidential boundary.

The raw VC/VP/provider evidence must not leave.

Execution remains outside the TEE:

CRE minimized distribution result
↓
Catenor verifies Agent authority
↓
Privy Agent execution policy
↓
execute A only

==================================================
11. CRE IS NOW DEPLOYMENT-ELIGIBLE
==================================================

The maintainer now has access to deploy Chainlink Confidential Workflows.

This changes the priority.

Use cre-engineer.

First inspect the current installed CRE CLI/docs and determine the exact current
commands.

Prepare reproducible scripts for:

- build;
- secrets/config setup;
- deploy to the approved private registry;
- activate if required;
- invoke;
- inspect execution;
- inspect logs/status;
- verify output.

Do NOT guess CLI syntax.

Use:
cre --help
cre <command> --help
official current Chainlink docs
installed skill
actual SDK/runtime behavior.

The goal is to upgrade the final demo from:

CRE SIMULATION

to:

REAL DEPLOYED CONFIDENTIAL WORKFLOW

ONLY after a real deployment/invocation succeeds.

Until then keep SIMULATION labels.

==================================================
12. CRE LOGS / JUDGE EVIDENCE
==================================================

Create a reproducible command/script that lets a judge inspect the most recent
CRE execution.

The exact implementation depends on the installed CLI.

Suggested script name:

scripts/demo/90-show-cre-execution.sh

It should show only safe information such as:

- workflow/deployment ref;
- execution/run ref;
- operation;
- successful confidential execution status;
- allowlisted logs/events;
- normalized result;
- evidence commitment;
- minimized decision.

Never print:

- secrets;
- raw Sumsub response;
- PII;
- private VC;
- private VP.

DEMO.md should explain how judges independently inspect this.

==================================================
13. REPRODUCIBLE SHELL SCRIPTS
==================================================

Create:

scripts/demo/

Use clear numbered scripts.

Suggested sequence:

00-check-prerequisites.sh
01-setup-env.sh
02-reset-local-demo.sh

10-create-trust-domain.sh
11-admit-root-trust-anchor.sh

20-create-sponsor.sh
21-trust-anchor-authorize-sponsor.sh

30-create-spv.sh
31-create-offering-policy.sh

40-create-investor-a.sh
41-create-investor-b.sh
42-create-investor-credentials.sh
43-create-investor-presentations.sh
44-check-offering-eligibility.sh

50-fund-testnet-wallets.sh

60-tokenize-spv.sh
61-investor-a-invest.sh
62-investor-b-invest.sh
63-create-dividend.sh

70-create-distribution-agent.sh
71-sponsor-establish-agent-relationship.sh
72-sponsor-delegate-distribution-capability.sh

80-invalidate-investor-b.sh
81-trigger-revenue.sh
82-run-confidential-distribution.sh
83-execute-approved-distribution.sh

90-show-cre-execution.sh
91-verify-hedera.sh
92-verify-privy.sh
93-verify-catenor-audit.sh

99-verify-complete-demo.sh

run-all.sh

The exact decomposition may be adjusted to fit the existing codebase, but the
logical stages above must remain visible.

==================================================
14. SCRIPT UX
==================================================

Every script should print before execution:

- STEP;
- actor;
- Catenor operation;
- what is about to change;
- sponsor integration involved;
- whether it is READ-ONLY, LOCAL, TESTNET LIVE or CONFIDENTIAL;
- expected result.

Example:

[Catenor Protocol — Sponsor Authorization]

Issuer:
did:catenor:<root>

Subject:
did:catenor:<sponsor>

Relationship:
...

Capabilities:
TOKENIZE_ASSET
DEFINE_OFFERING_POLICY
CREATE_AGENT
CREATE_DISTRIBUTION
DELEGATE_DISTRIBUTION_AUTHORITY

Expected:
VALID

==================================================
15. ENV AUTOMATION
==================================================

Where values are generated by our own scripts:

AUTO-WRITE them to the correct git-ignored env files.

Do not force the user to copy:

- Privy wallet IDs;
- policy IDs;
- quorum IDs;
- public keys;
- runtime authorization keys;
- generated Catenor IDs;
- created testnet addresses;

by hand if the script can safely write them.

Rules:

management-owner private keys
→ external 0600 files under ~/.catenor-one/
→ never runtime env

runtime keys
→ appropriate git-ignored local env
→ never printed

public refs
→ may be printed and written to env.

External account credentials cannot be generated:

- PRIVY_APP_ID
- PRIVY_APP_SECRET
- SUMSUB_APP_TOKEN
- SUMSUB_SECRET_KEY
- Chainlink account/auth

01-setup-env.sh must validate them without printing them.

==================================================
16. FUNDING FROM ZERO
==================================================

The clean-room flow creates NEW wallets.

Therefore funding must be explicit.

Support two approaches where practical:

A. MANUAL FAUCET
- print every new wallet/address needing Testnet HBAR;
- show exact suggested amount;
- pause/check until funded.

B. OPTIONAL DEMO TREASURY
- if a testnet-only treasury source is configured;
- fund the freshly created wallets automatically;
- clearly label this TESTNET BOOTSTRAP FUNDING;
- never confuse funding with Catenor authority or distribution.

We may use our previously funded demo wallets as testnet funding sources during
development.

Do not make old wallets part of the canonical clean-room identity state.

==================================================
17. DRY-RUN VS LIVE
==================================================

Scripts that can spend HBAR or mutate external Testnet state must default to
SAFE/PREFLIGHT mode.

Require explicit:

--live

or equivalent for the broadcast.

Before live:
print exact operation and ask/require explicit authorization where appropriate.

No accidental payout on run-all.

Consider:

run-all.sh
→ safe full walkthrough/preflight

run-all.sh --live
→ explicit testnet creation path, with clear checkpoints

Do not execute MAINNET.

==================================================
18. JUDGE REPRODUCIBILITY
==================================================

A judge cloning the public repo should be able to understand:

what they can run without external credentials;
what requires Privy;
what requires Sumsub;
what requires Chainlink CRE deployment;
what requires Hedera Testnet funds.

DEMO.md must include a matrix:

STEP
REQUIRES
NETWORK
COST
MUTATES STATE?
EVIDENCE PRODUCED

==================================================
19. STUDY / PRESENTATION SUPPORT
==================================================

DEMO.md should also be useful for us to study.

At the end, include a compact:

"Why this step exists"

for major concepts:

- Trust Anchor;
- Sponsor;
- Relationship;
- Capability;
- Offering Policy;
- VC;
- VP;
- AccountBinding;
- Privy policy;
- SPV;
- Agent;
- CRE confidential distribution;
- Hedera ATS;
- reconciliation;
- PAY vs HOLD.

Do not turn DEMO.md into a textbook; keep explanations concise.

A separate Study Case can be built after delivery.

==================================================
20. FRONTEND RELATIONSHIP
==================================================

Do NOT rebuild the frontend first.

The future `/demo` UI must be a visual orchestration/replay of THIS canonical
manual flow.

The scripts/runbook are the source of truth for executable demo steps.

The frontend may replay previously verified public execution evidence to avoid
duplicate financial effects during the video.

Do not fake sponsor success.

==================================================
21. COMMIT DISCIPLINE
==================================================

Use small commits.

Suggested:

docs(demo): add reproducible Catenor One walkthrough

chore(demo): add environment and prerequisite scripts

feat(demo): script trust and sponsor authority setup

feat(demo): script investor VC VP and offering flow

feat(cre): add reproducible confidential workflow deployment

feat(demo): script tokenization and investment flow

feat(demo): script agent authority and confidential distribution

chore(demo): add verification and inspection commands

docs(hackathon): record clean-room demo checkpoint

Update:
- BUILD_LOG
- PROVENANCE
- AI_USAGE as appropriate
- FINAL-DEMO
- TASKS

Do NOT rewrite frozen S001 source-of-truth unless a real semantic conflict is
found.

Use:
-s
no Co-Authored-By
no push yet.

==================================================
22. EXECUTION / STOP GATES
==================================================

First inspect and reuse existing code aggressively.

Do NOT rewrite already-working integrations.

Priority:

A. DEMO.md
B. scripts wrapping existing proven commands
C. authority chain visibility
D. VC / VP path
E. CRE real deployment
F. clean-room execution

You may implement missing demo-critical pieces.

STOP before any new external LIVE transaction/broadcast that was not already
explicitly authorized.

Do not spend HBAR merely to test the scripts.

==================================================
23. FIRST REPORT
==================================================

Work until the reproducible runbook/scripts are structurally complete and all
non-spending/local/read-only checks possible are passing.

Then STOP and report:

DEMO.md
- sections created

SCRIPTS
- list and status
- which are wrappers over existing code
- which required new implementation

CATENOR AUTHORITY
- Trust Anchor → Sponsor
- Sponsor → Agent
- relationships
- capabilities

INVESTORS
- VC implementation
- VP implementation
- Offering Policy path
- what is REAL vs incomplete

CRE
- current deployment status
- exact current deploy/invoke/log inspection commands
- whether real deployment succeeded
- if not, exact blocker

ENV
- what is generated automatically
- what maintainer still must provide

CLEAN-ROOM
- how far the flow can run from zero without external live broadcasts

TESTS

COMMITS

NEXT MANUAL ACTION

Do NOT start frontend/Judge Inspector in this task.
````
