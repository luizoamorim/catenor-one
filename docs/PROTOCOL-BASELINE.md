# Catenor One — Protocol Baseline

> **Pins the exact Catenor Protocol version implemented by Catenor One.**

**Implementation:** Catenor One  
**Protocol:** Catenor Protocol  
**Protocol version:** Draft v0.1  
**Protocol repository:** https://github.com/luizoamorim/catenor  
**Protocol website:** https://catenor.xyz  
**Pinned protocol commit:** 2340961992161cf89e09a8b4c17123b9c0714eee  
**Pinned at:** `2026-09-09`

## Pin the exact commit

From the local Catenor Protocol repository:

```bash
git rev-parse HEAD
```

Copy the exact SHA into this file before implementation claims rely on this baseline.

## Authority rule

Catenor One implements Catenor Protocol. It does not redefine it.

If Catenor One code conflicts with the pinned protocol specification:

> **The pinned protocol specification takes precedence.**

The implementation must change, or the protocol must be explicitly amended through the protocol repository.

## Implementation choices vs protocol semantics

Catenor One may choose concrete technologies for identity verification, confidential computation, secure key management, persistence, encrypted evidence storage, execution wallets, settlement, UI, and application architecture.

Those are reference-implementation choices, not universal Catenor Protocol requirements.

## Required semantic invariants

```text
did:catenor identifies the Canonical Subject
PII is not the DID seed
wallet/account != Canonical Subject
private financial Account Bindings remain private by default
public assertion verification material != private financial execution account
Credential Assertion Key != Financial Execution Key
VC signature proves authorship/integrity, not truth
Issuer authority is explicit/scoped
ISSUE_CREDENTIAL != AUTHORIZE_ISSUER
Relationship != Capability
delegated authority <= delegator authority
Trust Anchor authority comes through Admission
Trust is contextual to a Trust Domain
Policy Decision != Execution Authorization
operational database != cryptographic proof
sensitive evidence is minimized and kept private where required
```

## Open protocol items

Catenor One may select concrete experimental behavior for open Draft v0.1 items, but must label it as **Catenor One reference-implementation behavior**.

Examples:

- exact DID identifier encoding;
- authoritative DID-state persistence;
- cryptographic profile;
- credential-status implementation;
- Subject Continuity algorithm;
- Account Control Proof format;
- capability vocabulary;
- final delegation wire format;
- Trust Anchor Admission profile;
- public/shared anchoring;
- policy language;
- audit persistence.

## Updating the baseline

When moving to a newer protocol commit:

1. review the protocol diff;
2. document semantic changes;
3. update this SHA;
4. update affected slices/tests;
5. add a BUILD_LOG entry;
6. commit the baseline change separately when practical.
