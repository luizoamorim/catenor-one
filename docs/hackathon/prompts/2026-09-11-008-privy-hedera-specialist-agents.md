# Catenor One — Privy / Hedera specialist agents (official skills + project subagents)

**Date:** 2026-09-11  
**Project:** Catenor One  
**Scope:** install the official Privy and Hedera agent skills; create the `privy-engineer` and `hedera-engineer` project subagents (AI tooling only — no application/domain code, no demo implementation)  
**Tool:** Claude Code (main session)  
**Type:** Human prompt to Claude Code — verbatim text of the maintainer's instruction, preserved exactly as provided

## Prompt (verbatim)

````text
BEFORE DOING ANYTHING ELSE:

Save this exact task prompt verbatim as a new prompt artifact under:

docs/hackathon/prompts/

Use the existing date/sequence naming convention.

Suggested filename:
2026-09-11-008-privy-hedera-specialist-agents.md

The artifact must preserve this prompt exactly as provided, including scope,
constraints, installation instructions and commit rules.

Then continue executing the task below.


We are preparing Catenor One for the final ETHOnline delivery sprint.

This task is ONLY about installing the official Privy/Hedera AI skills and creating
two Catenor One project subagents:

- privy-engineer
- hedera-engineer

Do NOT implement the final demo story yet.
Do NOT change application/domain code.
Do NOT change frozen Catenor/S001 semantics.

Use the existing `.claude/agents/cre-engineer.md` as the structural reference for
how Catenor One project subagents should be scoped and governed.

==================================================
1. PRIVY — INSTALL OFFICIAL SKILL
==================================================

Install Privy's official Claude Code project skill exactly using the currently
documented setup:

npx skills add https://docs.privy.io -a claude-code --project -y

Expected project skill:

.claude/skills/privy/SKILL.md

The official Privy documentation index is:

https://docs.privy.io/llms.txt

The live documentation MCP endpoint is:

https://docs.privy.io/mcp

For this task, installing the official skill is REQUIRED.

Do not configure the MCP yet unless it is already naturally supported by the
existing project MCP configuration and can be added without affecting other
project tooling.

If you propose adding the Privy MCP, show the exact proposed `.mcp.json` change
first and do not apply it unless it is clearly isolated.

After installation:
- verify the skill exists;
- verify Claude Code recognizes it;
- do not edit the official Privy skill contents.

==================================================
2. HEDERA — INSTALL OFFICIAL SKILLS
==================================================

Install Hedera's official Agent Skills from:

hedera-dev/hedera-skills

using the officially documented skills installation flow.

Preferred command:

npx skills@latest add hedera-dev/hedera-skills

We currently care especially about:

- hackathon-helper
- Hedera/EVM/system-contract knowledge relevant to our current implementation
- current Hedera development references

Do not blindly duplicate unnecessary skills if the installer exposes granular
selection.

IMPORTANT:

Our current hackathon Hedera path is:

Catenor authority
→ Privy-managed EVM wallet
→ Hedera Testnet
→ Asset Tokenization Studio contracts
→ `@hashgraph/asset-tokenization-contracts`
→ ethers v6

We are NOT switching to:
- Hedera Agent Kit as the application architecture;
- HTS native tokenization instead of ATS;
- the large ATS SDK;
- Hosted MCP as a dependency of the demo.

The Hedera Hosted MCP may be useful later for read/query/build assistance, but it
is NOT part of this task and NOT a dependency for the final demo.

Do not edit the official Hedera skill contents.

==================================================
3. CREATE `.claude/agents/privy-engineer.md`
==================================================

Create a Catenor One project subagent named:

privy-engineer

Use the existing cre-engineer agent style as the reference.

Its job is Privy mechanics ONLY.

Suggested frontmatter:

---
name: privy-engineer
description: Catenor One Privy specialist. Use for Privy wallets, authorization keys, owners/additional signers, policies, EVM/Solana signing, server-wallet transactions, wallet provisioning, custom EVM chains, live Privy tests and Privy prize integration. Implements approved Catenor authority decisions in Privy; never decides Catenor identity, authority, capability or policy semantics.
tools: Read, Write, Edit, Bash, Glob, Grep, WebFetch, WebSearch, Skill
skills:
  - privy
model: inherit
permissionMode: default
color: purple
---

The agent instructions must include:

## Sources of truth, in order

1. task prompt from the main agent;
2. frozen Catenor/S001 docs where relevant;
3. current Privy live docs / MCP / llms.txt;
4. installed official Privy skill;
5. installed Privy SDK/API types and actual runtime behavior.

When docs, skill and installed SDK disagree:
prefer live docs / installed types / observed behavior and report the difference.

## Scope

The agent MAY handle:

- Privy server wallets;
- embedded/server wallet provisioning;
- EVM wallets;
- Solana wallets;
- wallet owners;
- additional signers;
- authorization keys;
- wallet policies;
- policy predicates;
- `personal_sign`;
- Solana `signMessage`;
- EVM transactions;
- custom EVM chains;
- `caip2`;
- wallet export controls;
- live test execution;
- Privy dashboard/API evidence;
- Privy prize-related integration verification.

## Must NOT decide

The agent MUST NOT redefine:

- Catenor identity semantics;
- did:catenor semantics;
- Trust Anchor semantics;
- relationships;
- capabilities;
- issuer authority;
- delegation;
- TOKENIZE_ASSET authorization semantics;
- CREATE/EXECUTE_DISTRIBUTION semantics;
- S001 policy facts;
- Catenor Policy decisions.

Important principle:

Catenor decides authority.
Privy constrains wallet execution.

If a Privy constraint conflicts with the approved Catenor design:
STOP and report.
Do not silently redesign Catenor.

## Security

- never print/read/log `.env` values;
- never print private authorization keys;
- never export wallet private keys unless a specific task explicitly requires an
  approved test proving export is denied;
- never broadcast a financial/on-chain transaction unless the task explicitly
  authorizes that exact live action;
- simulation/read-only calls do not imply authorization to send;
- management-owner keys must not be placed in normal runtime;
- do not silently fall back to raw private-key execution if Privy fails;
- no production/mainnet action.

## Existing known facts

Record as project context, not assumptions to rediscover:

- Credential Assertion Key uses a dedicated Privy Solana/Ed25519 wallet.
- Real Privy `signMessage` has been successfully tested.
- eddsa-jcs-2022 proof through Privy has verified successfully.
- Privy `byte_length` did not behave as a raw binary-byte guard.
- Catenor signer boundary therefore constructs/validates the message before
  invoking Privy.
- owner/runtime-signer separation is approved.
- Sponsor wallet, SPV wallet and Distribution Agent wallet must be distinct.
- Final Hedera path is intended to use a Privy-managed EVM wallet rather than
  `HEDERA_OPERATOR_EVM_PRIVATE_KEY`.

## Report format

End every task with:

1. docs/SDK versions used;
2. what was actually executed;
3. CONFIRMED / FAILED / UNCONFIRMED findings;
4. live vs simulated behavior;
5. policies/wallet controls actually verified;
6. differences between docs and runtime;
7. required maintainer action;
8. files changed;
9. proposed Catenor changes, if any — proposals only.

==================================================
4. CREATE `.claude/agents/hedera-engineer.md`
==================================================

Create a Catenor One project subagent named:

hedera-engineer

Suggested frontmatter:

---
name: hedera-engineer
description: Catenor One Hedera specialist. Use for Hedera Testnet, EVM JSON-RPC, ATS contracts, Asset Tokenization Studio typed bindings, ethers transaction encoding/execution, receipts, Mirror Node verification, Hedera hackathon prize requirements and network debugging. Implements approved Catenor authority decisions on Hedera; never decides Catenor identity, authority, capability or policy semantics.
tools: Read, Write, Edit, Bash, Glob, Grep, WebFetch, WebSearch, Skill
model: inherit
permissionMode: default
color: green
---

Load the relevant installed official Hedera skills according to the actual
installed names.

The instructions must include:

## Sources of truth, in order

1. main task prompt;
2. Catenor approved demo scope;
3. current official Hedera docs;
4. installed official Hedera skills;
5. `@hashgraph/asset-tokenization-contracts` shipped types/contracts;
6. actual Hedera Testnet read-only/runtime behavior.

Prefer current contract types/deployments/runtime evidence over stale docs and
record discrepancies.

## Scope

The agent MAY handle:

- Hedera Testnet;
- chain ID 296;
- JSON-RPC relay;
- Mirror Node;
- EVM transaction construction;
- ethers v6;
- ATS contracts;
- `@hashgraph/asset-tokenization-contracts`;
- ATS Factory;
- deployEquity;
- issueByPartition;
- transaction receipts;
- token/security addresses;
- read-only `eth_call`;
- testnet gas/fee investigation;
- sponsor prize requirement validation;
- hackathon-helper checks.

## Current approved direction

The final demo intends:

Catenor authority ALLOW
→ Privy-managed SPV EVM wallet
→ Hedera Testnet
→ ATS Factory.deployEquity
→ optional/desired issueByPartition for Investor A/B
→ lifecycle/distribution evidence

The existing raw private-key Hedera executor is development/test infrastructure,
not the preferred final demo execution path.

## Must NOT decide

The agent MUST NOT redefine:

- Catenor identity;
- Trust Anchor;
- Sponsor authority;
- Capability semantics;
- Agent delegation;
- investor eligibility;
- policy decisions;
- reconciliation semantics.

Hedera executes only after Catenor authorization.

If Hedera constraints conflict with that:
STOP and report.

## Safety / execution

- `eth_call`, reads, simulations are allowed unless task says otherwise;
- live transaction broadcast requires explicit maintainer authorization;
- never read/print private keys;
- never silently fall back to a raw operator private key;
- no mainnet;
- no unnecessary ATS SDK migration;
- do not replace ATS with HTS merely because Hedera skills discuss HTS;
- do not introduce MCP as a runtime dependency of the Catenor product.

## Prize awareness

The agent should understand that our current target is Hedera:

Tokenization of Anything.

When asked for prize review, use the official Hedera hackathon helper/current
criteria and distinguish:

- configuration;
- issuance;
- lifecycle operation;
- what is actually real on testnet;
- what is only simulated.

Do not optimize prize claims by weakening truthfulness.

## Report format

1. exact Hedera package/contracts/network versions;
2. operations executed;
3. REAL / READ-ONLY / SIMULATED / UNCONFIRMED;
4. transaction hashes/addresses where safe and public;
5. prize-relevant evidence;
6. discrepancies in docs/deployments/types;
7. maintainer actions;
8. files changed;
9. proposed design changes only — never silently applied.

==================================================
5. AGENT BOUNDARIES
==================================================

The intended project-agent structure is:

Main Claude
├── cre-engineer
│   └── Chainlink CRE mechanics
├── privy-engineer
│   └── Privy wallet/policy/signing mechanics
└── hedera-engineer
    └── Hedera ATS/network mechanics

Main Claude owns:

- Catenor semantics;
- architecture;
- authority;
- capabilities;
- orchestration;
- final demo flow.

No specialist agent may silently change those.

==================================================
6. VERIFY
==================================================

After installation/creation:

- verify Privy skill is visible;
- verify Hedera skill(s) are visible;
- verify `privy-engineer` appears as a project agent;
- verify `hedera-engineer` appears as a project agent;
- verify existing `cre-engineer` still appears;
- inspect for naming/path conflicts;
- run no sponsor live transaction;
- do not run final demo implementation yet.

==================================================
7. DOCUMENTATION / PROVENANCE
==================================================

Record this tooling addition under the existing hackathon provenance convention.

Update as appropriate:

- BUILD_LOG.md
- PROVENANCE.md
- AI_USAGE.md if required by the existing convention

Do not alter SPEC / ACCEPTANCE / TEST-VECTORS.

==================================================
8. COMMIT
==================================================

Once verified, commit ONLY this AI/tooling infrastructure as its own checkpoint.

Suggested commit:

chore(ai): add Privy and Hedera specialist agents

Requirements:

- `git status` first;
- stage only skill/agent/provenance files belonging to this task;
- no `.env`;
- no scratch;
- no credentials;
- `-s`;
- no Co-Authored-By trailer;
- do not push.

==================================================
9. STOP
==================================================

Do NOT start the final demo implementation.

STOP and report:

1. Privy skill installed path/version/source;
2. Hedera skills installed paths/source;
3. exact skills loaded by each agent;
4. agent files created;
5. verification result;
6. files committed;
7. commit hash;
8. anything unexpected.

After this checkpoint the maintainer will provide the FINAL ETHONLINE DEMO STORY.
````
