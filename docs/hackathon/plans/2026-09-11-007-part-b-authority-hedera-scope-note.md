# Plan — 2026-09-11-007 — Part B scope note: authority-gated Hedera ATS demo action

**Project:** Catenor One  
**Parent plan:** `docs/hackathon/plans/2026-09-11-006-ethonline-delivery-fast-lane.md` (demo definition of done, part B)  
**Status:** **APPROVED with narrowed scope (maintainer, 2026-09-11)** — see "Approved scope" below; the original proposal is kept for history.  
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

## Approved scope (maintainer, 2026-09-11) — as implemented (commit c0b3342)

- ACTIVE Trust Anchor → issues ONE signed scoped Capability to Org B: issuer = the active Trust Anchor `did:catenor`;
  subject = Org B `did:catenor`; action `TOKENIZE_ASSET`; resource `asset:catenor-one-demo:001`; explicit `validUntil`.
  All names are Catenor One **[REF-IMPL]**, never presented as frozen Catenor Protocol vocabulary.
- The grant wraps one protocol-shaped Capability `{subject, action, resource, constraints}` inside a signed
  `CatenorOneCapabilityGrant` envelope, signed with the Trust Anchor's existing Credential Assertion Key
  (`eddsa-jcs-2022`, `assertionMethod`) — no key-purpose conflict found.
- Catenor verifies at minimum: signature (issuer assertionMethod key), issuer currently an ACTIVE Trust Anchor (S001 verifier),
  subject = requesting Org B, action, resource, not expired. ALLOW → exactly one Hedera ATS testnet action; any DENY → the
  executor is never invoked.
- Not implemented (out of the approved scope): Sponsor Authorization / Agent Delegation / full Hedera lifecycle; request
  authentication of Org B beyond the subject match (Org B's request is operator-initiated in the demo).

## Execution mapping (implemented, commit d8a3af0) — Catenor One [REF-IMPL]

- `TOKENIZE_ASSET` on `asset:catenor-one-demo:001` → exactly **one** Hedera ATS testnet transaction:
  `Factory.deployEquity` on the ATS v8 testnet factory (`0.0.9213391`, resolver `0.0.9212226`). It creates the ATS
  security token for the demo asset: SYNTHETIC name/symbol and ISIN `XXCATENOR01` + check digit; KYC, identity
  registry, compliance and external lists off; no units issued. The regulation `info` field carries
  `catenor-one:TOKENIZE_ASSET:<resource>:grant:<grantId>`, linking the on-chain token to the authorizing grant.
- Sent by a Catenor One testnet operator account (ECDSA secp256k1 with EVM alias). It is the execution adapter only:
  not Org B's authority, not a Catenor signing key. It holds the token's admin and issuer roles.
- DENY evidence: the operator account nonce is read before and after the DENY requests and must not change.
- Contract bindings: `@hashgraph/asset-tokenization-contracts` 8.0.0 (typechain) with ethers 6.17.0. The ATS SDK was
  not used because it has no server-side private-key wallet mode.
- The exact arguments were checked read-only against the live factory with `eth_call` (2026-09-11). **No transaction
  has been sent yet:** the maintainer must provide the operator account (`HEDERA_OPERATOR_EVM_PRIVATE_KEY` in the
  git-ignored `apps/api/.env`, about 25 testnet HBAR).
- Out of scope, POST-DEMO: issuing units, transfers, redemption, and KYC/compliance modules on the ATS side.
