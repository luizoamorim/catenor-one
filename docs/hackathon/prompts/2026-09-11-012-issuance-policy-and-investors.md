# Catenor One — Final demo checkpoint 4: issuance policy, investor wallets, issuance preparation

**Date:** 2026-09-11  
**Project:** Catenor One  
**Scope:** live Privy policy-capability probe (function-level restriction for `issueByPartition`), investor A/B Privy EVM wallets, maintainer-run SPV policy update script, read-only issuance preparation; STOP before any issuance broadcast  
**Tool:** Claude Code (main session) with the `privy-engineer` project subagent  
**Type:** Human prompt to Claude Code — verbatim text of the maintainer's instruction, preserved exactly as provided

## Prompt (verbatim)

````text
Decision:

1. ISSUE POLICY

Use the narrowest practical issuance policy.

First delegate a short live policy-capability check to privy-engineer:

Can the current Privy policy system cleanly constrain an Ethereum
eth_signTransaction by:

- chain_id = 296
- target = 0x7aeDA4b6B89dA392Efd88AD0Fcb075e12ab6a418
- calldata/function selector corresponding specifically to issueByPartition

Do not mutate the current policy during the probe.

If function/calldata restriction is cleanly supported:
→ use chain + token target + issueByPartition restriction.

If it is not cleanly supported:
→ use chain 296 + exact token target;
→ Catenor signer boundary MUST independently construct/validate the exact
  issueByPartition calldata before requesting the Privy signature.

Do NOT use a chain-only issuance policy.

2. INVESTORS

Provision two pre-seeded Privy EVM wallets:

Investor A
Investor B

They are receiving accounts for the demo.

Do not add unnecessary execution policies for them yet.
They only need stable EVM addresses and Catenor bindings for issuance.

Keep:

Investor A wallet != Investor B wallet != SPV wallet != Agent wallet.

Persist/publicly record only the safe wallet refs/addresses required by the demo.
No private-key export.

3. POLICY UPDATE

Prepare a maintainer-run script for the SPV management owner to update/replace
the SPV policy with the approved issuance rule.

The management-owner private key must remain outside normal runtime and must not
be printed.

Do not ask me to paste it into chat.

Report the exact command I need to run locally.

4. ISSUANCE PREPARATION

Prepare:

issueByPartition
→ Investor A
issueByPartition
→ Investor B

Use the already-deployed ATS equity:

0x7aeDA4b6B89dA392Efd88AD0Fcb075e12ab6a418

Do read-only simulation / estimate first.

STOP BEFORE broadcasting either issuance transaction.

Report:

- Investor A EVM address
- Investor B EVM address
- selected Privy issuance policy rule
- whether function-level restriction is CONFIRMED or unsupported
- issue amount proposed for each investor
- estimated gas / HBAR for each issuance
- exact maintainer command for the policy update
- tests
- commits

5. FINAL DEMO NOTE

The currently deployed asset is accepted as a real rehearsal/checkpoint asset.

FD-2 remains important for the final recorded demo:
after Sponsor TOKENIZE_ASSET authorization, Catenor should provision the SPV
Privy wallet/policy dynamically rather than relying only on pre-provisioned
execution infrastructure.

Do not lose this requirement.

Do not broadcast issuance yet.
````
