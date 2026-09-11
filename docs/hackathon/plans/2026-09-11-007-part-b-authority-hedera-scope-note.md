# Plan — 2026-09-11-007 — Part B scope note: authority-gated Hedera ATS demo action

**Project:** Catenor One  
**Parent plan:** `docs/hackathon/plans/2026-09-11-006-ethonline-delivery-fast-lane.md` (demo definition of done, part B)  
**Status:** **PROPOSAL — awaiting maintainer approval.** No part-B code is written before approval.  
**Protocol basis (pinned 66ef712):** `specification/authority/02-CAPABILITIES.md`, `04-AUTHORITY-CHAINS.md`, `05-TRUST-ANCHORS.md`; `schemas/capability.schema.json`

## Goal

Demonstrate, with one real Hedera ATS testnet action:

1. Catenor authority;
2. an authorization check (authority chain + policy);
3. an authorized tokenized-asset action on Hedera.

A subject without the required authority gets DENY, and nothing executes on Hedera.

## What the protocol already fixes (reused, not redefined)

- **Capability** = `{subject, action, resource, constraints}`: who may perform which action, on which resource, under which constraints. Constraint concepts include amount, time and execution target.
- **Trust Anchor** = the accepted starting point of authority in a Trust Domain; its authority comes from Admission (S001).
- **Authority Chain verification** checks every edge: proof, issuer identity, issuer authority, status, scope, time, resource constraints, policy compatibility. Incomplete chains fail closed.
- **Relationship ≠ Capability; Policy Decision ≠ Execution Authorization.**
- **Open in Draft v0.1:** the canonical Action vocabulary and the Constraint grammar. Part B therefore picks concrete values, labeled **[REF-IMPL]**.

## Proposed minimal story (recommended)

```text
Initial Trust Anchor (Org A, admitted in S001, ACTIVE)
  ↓ grants — Capability signed with Org A's Credential Assertion Key (eddsa-jcs-2022, Privy)
Org B (did:catenor ORGANIZATION; the asset issuer)
  { subject: did(B), action: "ISSUE_ASSET_TOKENS" [REF-IMPL],
    resource: "hedera-ats:testnet:<securityTokenId>" [REF-IMPL],
    constraints: { maxAmount: 1000, validUntil: <T>, executionTarget: "hedera-testnet" } }
  ↓ requests "issue 100 tokens to <holder>" (request signed with Org B's assertion key)
Catenor authorization check
  1 Trust Anchor valid (S001 verifier, 12 checks)
  2 Capability proof verifies against Org A's published assertion Verification Method
  3 grantor = the Trust Anchor; subject = requester; action / resource / time / amount within constraints
  4 policy:asset-action:v1 [REF-IMPL] → ALLOW / DENY (FALSE vs MISSING trace), audit
  ↓ ALLOW only
Hedera ATS testnet: issue/mint 100 tokens (transaction id recorded as artifact)
```

**DENY cases:**

- Org C, which holds no Capability, requests → DENY; no Hedera call.
- Org B requests more than `maxAmount` → DENY; no Hedera call.

**Execution separation:** the Hedera transaction is sent by a Catenor One Hedera testnet operator account only after ALLOW. That account is an execution adapter. It is not Org B's authority, and it is not a Catenor signing key.

## Deliberately out of scope

- Delegation to agents.
- Multi-hop chains beyond Trust Anchor → Org B.
- Capability revocation lists.
- A full ATS lifecycle (transfer restrictions, redemption).
- S002 Subject Continuity.
- A generic capability engine.

## Decisions needed from the maintainer

1. **Approve the story.** The Trust Anchor grants one Capability to Org B, Org B performs one issue/mint. The alternative, where the Trust Anchor itself acts, is simpler but proves less authority semantics.
2. **Approve the [REF-IMPL] names:**
   - action `ISSUE_ASSET_TOKENS`;
   - resource form `hedera-ats:testnet:<id>`;
   - constraints `maxAmount`, `validUntil`, `executionTarget`;
   - policy id `policy:asset-action:v1`.
3. **Org B's identity/authentication for the demo:** Org B is a `did:catenor` Subject with its own Privy assertion wallet and signs its request. It is **not** admitted as a Trust Anchor.
4. **Hedera ATS action:** "issue/mint N tokens of one security token deployed through ATS on testnet". Exact ATS SDK/contract call to be confirmed from current official ATS docs before coding.

## Maintainer actions (blocking the real Hedera step only)

- A Hedera testnet account (operator ID + key) placed in the git-ignored `apps/api/.env`; values are never shared in chat.
- One security token created through ATS on testnet (or confirmation that the adapter should create it), and its token/contract ID.
