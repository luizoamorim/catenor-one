# S001 — Trust Anchor Admission
## Specification

> **Goal:** Establish the first active Trust Anchor of a Catenor Trust Domain through explicit bootstrap trust, real-world evidence verification, proof of key possession, confidential processing, deterministic policy evaluation, and an auditable Admission Record.

**Project:** Catenor One  
**Protocol baseline:** Catenor Protocol Draft v0.1  
**Slice:** `S001-trust-anchor-admission`  
**Status:** Final draft for human approval — Rev 2 amendments applied (2026-09-10, T0.9)  
**Architecture:** Modular Monolith + Vertical Slices + DDD-lite + Clean Architecture boundaries

> **Rev 2 amendment summary (maintainer decisions recorded in `PLAN.md` §33):** no LLM in S001 · exactly 3 persistent CRE secrets (`SUMSUB_APP_TOKEN`, `SUMSUB_SECRET_KEY`, `CATENOR_INTERNAL_API_TOKEN`) · CRE workflow boundary `identity-confidential` with S001 operation/handler `trust-anchor-admission` · HTTPS requests executed from inside `handlerInTee` (not the separate CRE Confidential HTTP capability) · COMMITMENT_ONLY evidence retention, no raw provider evidence persisted, Railway bucket not used by S001 · Catenor-issued provider bindingRefs verified inside the TEE · bootstrap endorsement binds a `verificationMethodCommitment` · Sumsub sandbox for the hackathon · narrower Trust Anchor verification claim (§27). All other frozen S001 semantics are unchanged.

> **Rev 2.3 amendment (maintainer decisions Q4/Q5, `PLAN.md` D31/D32):** explicit **evidence profiles** (§12.3) — the Full Sumsub Sandbox Profile is preferred; if Sumsub Company/KYB entitlement is unavailable, the live path may use the **Hybrid Demo Profile** (company evidence SYNTHETIC MOCK, representative verification REAL Sumsub sandbox), hash-pinned in the Bootstrap Configuration, bound by the bootstrap endorsement and visibly labeled · no universal AML rejection-label deny-list (provider rejection labels are reason codes, not Catenor policy rules). Fact names and `policy:trust-anchor-admission:v1` are unchanged.

> **Phase 0 status (2026-09-10, `PLAN.md` Rev 2.6):** Privy signing spike T0.5 passed with an approved design amendment (Catenor signer boundary; owner/runtime-signer separation; separate Bootstrap Endorsement Key wallet) · CRE runtime spike T0.7 approved — its results are SIMULATION-CONFIRMED only; deployed-TEE behavior is re-checked at the first deployed run. No S001 semantics or fact names changed.

---

# 1. Purpose

A Catenor Trust Domain needs an explicit starting point for authority.

A Subject MUST NOT become a Trust Anchor merely because it deployed the software, controls the database, controls infrastructure, created the first DID, or signed a self-assertion.

Cryptography cannot create initial trust from nothing. S001 therefore defines an explicit bootstrap and admission process:

```text
Trusted Bootstrap Configuration
            │
            ▼
Candidate Organization
            │
            ├── real-world organization evidence
            ├── representative evidence
            └── assertion-key control
            │
            ▼
Chainlink CRE Confidential Verification
            │
            ▼
Verified Facts
            │
            ▼
Admission Policy v1
       ALLOW / DENY
            │
            ▼
Bootstrap Endorsement
            │
            ▼
Trust Anchor Admission Record
            │
            ▼
ACTIVE TRUST ANCHOR
```

---

# 2. Trust semantics

An admitted Trust Anchor does **not** mean Catenor has mathematically proved every real-world statement to be universally true.

It means:

> Within a specific Trust Domain, the Subject satisfied the configured Admission Policy using evidence accepted by that Trust Domain, and that admission can be verified and audited.

Downstream authority can then be traced:

```text
Trust Anchor
    ↓ grants authority
Organization / Sponsor
    ↓ delegates
Agent
    ↓ requests
Action
```

The chain makes the **basis, scope and continuity of trust verifiable**. It does not eliminate the need to define what evidence a Trust Domain accepts.

---

# 3. Primary user story

> As the operator establishing a Catenor Trust Domain, I want an Organization Subject to pass a verifiable Trust Anchor Admission process so that downstream authority begins from an explicit, scoped and auditable root of trust rather than implicit infrastructure ownership.

---

# 4. Scope

S001 includes:

```text
Trust Domain bootstrap configuration
bootstrap admission authority
Canonical Organization Subject
did:catenor
DID Document
Credential Assertion Key
Proof of Key Possession
private Sumsub provider references
private provider bindingRefs (Catenor-issued, used as Sumsub externalUserId)
real Sumsub verification (Sumsub sandbox for the hackathon)
Chainlink CRE Confidential Workflow identity-confidential
S001 operation/handler trust-anchor-admission
handlerInTee execution
Vault DON secrets
HTTPS requests executed from inside handlerInTee (CRE HTTPClient with TeeRuntime)
provider-binding verification inside the TEE
deterministic provider normalization and fact derivation
evidence commitment (COMMITMENT_ONLY retention)
deterministic Admission Policy
Admission Decision
bootstrap endorsement
Trust Anchor Admission Record
Trust Domain activation
Railway PostgreSQL
public/private storage separation
audit events
Trust Anchor verification
CRE simulation for development
real CRE deployment for hackathon completion
```

S001 does **not** implement Sponsor Authorization, Agent Delegation, Investor Subject Continuity, tokenization approval, distribution, financial execution, Arc settlement, multi-anchor governance, or the full future Trust Anchor revocation model.

S001 also does **not** include any LLM or other semantic-AI processing, encrypted evidence retention, raw provider-evidence persistence, or use of the Railway private Storage Bucket (which remains part of the wider Catenor One architecture for later slices).

---

# 5. Architecture requirement

S001 MUST obey the Catenor One architecture baseline:

> **Modular Monolith + Vertical Slices + DDD-lite + Clean Architecture boundaries.**

Conceptually:

```text
apps/web
   ↓
apps/api
   ↓
AdmitTrustAnchor use case
   ↓
Catenor domain packages
   ↓
ports
   ↓
infrastructure adapters
```

Provider and sponsor SDKs MUST NOT be imported directly into the Catenor domain packages.

---

# 6. Bootstrap Access Gate

Before the Initial Trust Anchor exists, Catenor One MUST restrict who may initiate the bootstrap Admission flow.

For the hackathon reference implementation, v1 uses an environment-based operator allowlist:

```text
ALLOWED_BOOTSTRAP_EMAILS=
bootstrap.owner@example.com,bootstrap.reviewer@example.com
```

The concrete authenticated email values are deployment configuration and MUST NOT be hardcoded into domain logic.

The gate applies only while establishing the Initial Trust Anchor.

Conceptually:

```text
Authenticated Operator
        ↓
email in ALLOWED_BOOTSTRAP_EMAILS?
        │
    ┌───┴───┐
    │       │
   YES      NO
    │       │
    ▼       ▼
may start  BLOCK
S001       before Admission
```

Requirements:

```text
unauthorized operators MUST NOT initiate Initial Trust Anchor Admission

authorized bootstrap access MUST NOT imply Trust Anchor eligibility

bootstrap access MUST NOT set any Admission Policy fact to true

the candidate MUST still satisfy the complete S001 Admission Policy

the gate MUST NOT replace Sumsub verification, key possession,
confidential verification, policy evaluation or bootstrap endorsement
```

This is a **Catenor One application access-control mechanism**, not a universal Catenor Protocol rule and not evidence that the candidate is trusted.

After the Initial Trust Anchor is successfully activated, the bootstrap access gate may be disabled, retired or replaced by normal Catenor authority-based access control.

A later implementation may replace the environment allowlist with a Privy-managed allowlist/policy or another authenticated access-control adapter after reviewing the current official integration tooling.

---

# 7. Trust Domain Bootstrap Configuration

The Initial Trust Anchor cannot create its own initial trust.

Catenor One therefore starts from an out-of-band accepted Bootstrap Configuration.

Conceptual shape:

```json
{
  "type": "CatenorTrustDomainBootstrapConfiguration",
  "trustDomain": "trust-domain:catenor-one-demo",
  "admissionPolicy": "policy:trust-anchor-admission:v1",
  "admissionPolicyHash": "0x...",
  "bootstrapVerificationMethod": "bootstrap-verification-method:1"
}
```

This is Catenor One reference-implementation behavior, not a frozen universal Catenor Protocol wire format.

The Bootstrap Configuration MUST:

```text
identify the Trust Domain
identify the accepted Admission Policy/version
bind to exact policy content through a hash/commitment
identify the bootstrap admission verification method
be accepted out-of-band before the first Trust Anchor exists
```

In Catenor One, the hash-pinned Bootstrap Configuration also carries the Trust Domain's evidence-acceptance rules — accepted provider/environment, accepted provider verification levels and roles, and the evidence freshness threshold. The initial Catenor One reference/demo value is:

```text
evidenceMaxAgeDays = 180      [REF-IMPL] Catenor One reference value, not a Catenor Protocol rule
```

The bootstrap admission authority is not automatically a Catenor Trust Anchor. Its role is limited to establishing the initial trust boundary for this Trust Domain.

---

# 8. Bootstrap endorsement

For the Initial Trust Anchor, a successful policy result is necessary but not sufficient for activation.

Catenor One MUST create a cryptographic bootstrap endorsement binding at least:

```text
Trust Domain
Bootstrap Configuration commitment
candidate did:catenor
assertion Verification Method commitment (verificationMethodCommitment)
Admission Policy identifier/version
policy commitment/hash
Admission Decision reference or commitment
evidence commitment
admission timestamp / validity context
```

`verificationMethodCommitment` is a commitment to the complete canonical Verification Method used for Admission [REF-IMPL]:

```text
verificationMethodCommitment
= SHA-256(JCS(canonical VerificationMethod {id, controller, type, publicKeyMultibase}))
```

It makes replacement of the public key under the same Verification Method ID detectable during Admission verification.

Only after this endorsement verifies may the candidate become the Initial Active Trust Anchor.

The bootstrap signing authority/key MUST be separate from the candidate Organization's assertion key, and the endorsement step MUST be human-initiated by an authorized bootstrap operator. S001 does not require a two-person rule; a quorum model may be added later.

The exact proof envelope is a PLAN-level reference implementation decision (`PLAN.md` §16).

---

# 9. Canonical Subject

The candidate is an `ORGANIZATION` Subject.

```text
Subject Type: ORGANIZATION
Canonical DID: did:catenor:<opaque-high-entropy-id>
```

The DID identifier:

```text
MUST use cryptographically secure high entropy
MUST be opaque
MUST NOT contain PII
MUST NOT encode company name
MUST NOT encode Sumsub applicant IDs
MUST NOT be derived directly from identity evidence
```

The exact identifier encoding remains a reference-implementation choice until the protocol freezes it.

---

# 10. DID Document and assertion key

The candidate must have resolvable public DID state containing a public Credential Assertion verification method.

Working shape:

```json
{
  "id": "did:catenor:8f0c92...",
  "verificationMethod": [
    {
      "id": "did:catenor:8f0c92...#assertion-key-1",
      "controller": "did:catenor:8f0c92...",
      "type": "Multikey",
      "publicKeyMultibase": "z6Mk..."
    }
  ],
  "assertionMethod": [
    "did:catenor:8f0c92...#assertion-key-1"
  ]
}
```

The DID Document MUST NOT expose private identity evidence, provider IDs, private Account Bindings or private signing keys.

Security invariant:

```text
Credential Assertion Key != Financial Execution Key
```

S001 does not require a financial execution wallet.

After reviewing Privy's current official docs/skill and spike T0.5 (passed with an approved design amendment, `PLAN.md` §13, D1), the Catenor One reference implementation uses a dedicated Privy Ed25519 wallet (Solana) as the Organization's Credential Assertion Key, with a strict policy preventing financial transaction execution, and a completely separate Privy Ed25519 wallet as the Bootstrap Endorsement Key. Signatures verify independently as plain Ed25519; the exact signing-message format and length are enforced by the Catenor signer boundary. This Catenor-managed signing infrastructure is a **reference-implementation choice**: it is not a Catenor Protocol requirement, and the protocol does not require any Trust Anchor to use Privy or to place its key under Catenor-managed custody. No other signer or crypto profile is introduced without approval. The port boundary is kept.

---

# 11. Proof of Key Possession

Admission MUST prove control of the private key corresponding to the public assertion Verification Method.

```text
generate unpredictable challenge
        ↓
bind to candidate DID + Admission operation
        ↓
sign with assertion key
        ↓
resolve public Verification Method
        ↓
verify signature
        ↓
ASSERTION_KEY_POSSESSION_VALID = true
```

The challenge MUST be unpredictable, single-use, time-bounded, bound to the candidate DID, bound to the Admission operation, and resistant to replay.

Key possession proves control of the key. It does not prove organization legitimacy or Trust Anchor eligibility by itself.

---

# 12. Sumsub integration

S001 requires a **real Sumsub integration** for the live hackathon path.

Catenor One may perform applicant creation/onboarding outside the confidential workflow where necessary. At Admission verification time, however, sensitive verification MUST be performed by HTTPS requests executed from inside the TEE (`handlerInTee`).

```text
private provider reference
        ↓
handlerInTee()
        ↓
HTTPS → Sumsub (executed inside the TEE)
        ↓
private provider response
        ↓
provider-binding check / normalize / verify inside TEE
        ↓
minimized verified facts
```

For the hackathon, the live path uses **real Sumsub API calls against the Sumsub sandbox with synthetic Organization / representative data** under the preferred Full Sumsub Sandbox Profile, or — only if Sumsub Company/KYB entitlement is unavailable — the **Hybrid Demo Profile** of §12.3 (company evidence SYNTHETIC MOCK, representative verification REAL Sumsub sandbox). Documentation and the Judge Inspector MUST say "Sumsub sandbox" and MUST NOT imply production KYB of a real company.

The intended reference flow supports at least:

```text
Organization / company applicant reference
Authorized representative / individual applicant reference
```

where the selected Sumsub configuration provides them. Under the Hybrid Demo Profile the Organization / company reference is a SYNTHETIC MOCK fixture reference (§12.3); the representative / individual reference is always a real Sumsub sandbox applicant.

Sumsub `applicantId` values are private operational data. They are not Catenor identifiers and MUST NOT appear in the public DID Document or public logs.

Exact Sumsub endpoints and mappings are PLAN/implementation decisions based on current official documentation and on observed Sumsub sandbox responses.

## 12.1 Provider binding

To prevent applicant substitution, provider applicant references are bound to the candidate through Catenor-issued binding references:

```text
1. authorized operator starts Initial Admission (no applicant IDs yet)
2. Catenor creates the candidate ORGANIZATION Subject, did:catenor and private
   provider bindingRefs for COMPANY and REPRESENTATIVE
3. Catenor returns the bindingRefs to the authenticated operator only
4. operator creates/configures the Sumsub company and representative applicants
   with externalUserId = the matching Catenor bindingRef
   (Hybrid Demo Profile: only the representative applicant exists at Sumsub; the company
   reference is the SYNTHETIC MOCK fixture reference and its binding check is recorded as MOCK)
5. operator attaches the resulting applicant IDs to the Admission session
6. inside handlerInTee: applicant.externalUserId == expected bindingRef (both applicants)
7. only then does confidential provider verification proceed
```

bindingRefs are opaque, not derived from identity data, not the DID, and are PRIVATE operational state: they MUST NOT appear in public DID state, public API projections, the Judge Inspector or normal logs.

If an applicant's `externalUserId` does not match the expected bindingRef, confidential verification MUST NOT establish any of the required facts and Admission MUST NOT result in `ALLOW`.

## 12.2 Representative authority evidence

`REPRESENTATIVE_AUTHORITY_CONFIRMED` is derived from deterministic provider evidence only — for example company ↔ representative linkage, an accepted representative role, representative verification, company verification, and provider-side membership / beneficiary / authority relations where available. Exact field rules are confirmed against real Sumsub sandbox responses. If the provider configuration used cannot provider-verifiably establish the role, the implementation MUST NOT fake certainty: it uses the strongest evidence actually available and documents the limitation (PLAN and Judge Inspector). Under the Hybrid Demo Profile the company ↔ representative linkage comes from SYNTHETIC MOCK company evidence; the evidence class is stated as "SYNTHETIC MOCK linkage + REAL Sumsub sandbox representative verification" and never as provider-verified authority.

## 12.3 Evidence profiles (Rev 2.3, maintainer decision Q4)

| Profile | Company evidence | Representative verification | Status |
|---|---|---|---|
| **Full Sumsub Sandbox Profile** | REAL Sumsub sandbox (company / KYB) | REAL Sumsub sandbox | preferred |
| **Hybrid Demo Profile** | SYNTHETIC MOCK fixture behind the provider-normalization boundary | REAL Sumsub sandbox | allowed only while Sumsub Company/KYB entitlement is unavailable |

In both profiles the Chainlink CRE Confidential Workflow is a REAL deployed workflow and Catenor policy evaluation, bootstrap endorsement and Admission are REAL executions. The representative leg is REAL in every profile.

The Hybrid Demo Profile is permitted only if all of the following hold:

```text
H1  the Bootstrap Configuration explicitly identifies the company evidence source as MOCK
    (evidence profile = HYBRID_DEMO; company evidence source = SYNTHETIC_MOCK)
H2  that configuration remains hash-pinned and is bound by the bootstrap endorsement; any confidential
    result whose evidence profile / sources differ from the pinned configuration is rejected (no facts, no ALLOW)
H3  the Judge Inspector, artifacts and README visibly state:
      "Company evidence: SYNTHETIC MOCK"
      "Representative verification: REAL SUMSUB SANDBOX"
H4  nothing claims "Sumsub verified the organization" or "real Sumsub KYB end-to-end"
H5  real Sumsub Company/KYB remains the preferred adapter and replaces the fixture without changing
    domain or policy semantics when entitlement becomes available
```

The MOCK company fixture is never presented as real Sumsub KYB.

---

# 13. Chainlink CRE Confidential integration

S001 requires a Chainlink CRE **Confidential Workflow**.

## 13.1 Workflow boundary

```text
WORKFLOW = security boundary + cohesive business responsibility + lifecycle/deployment boundary
HANDLER  = specific operation / entry point inside that responsibility
```

S001 contributes the first operation/handler of the cohesive confidential identity workflow:

```text
identity-confidential
└── trust-anchor-admission      (S001)
```

Future confidential identity operations (for example S002 Subject Continuity / identity-provider reconciliation) are expected to be added as further handlers of the same workflow. Catenor One does not create one CRE workflow per slice or micro-function, nor one workflow for all responsibilities. This is implementation architecture only; it does not change S001 protocol semantics.

## 13.2 Confidential pattern

The sensitive path MUST use the current confidential pattern based on:

```text
handlerInTee(...)
TeeRuntime
Vault DON secrets
batched getSecrets()
HTTPS requests executed from inside the TEE (CRE HTTPClient with TeeRuntime)
private intermediate values
minimized output
```

Terminology: **HTTPS requests are executed from inside the confidential TEE boundary.** S001 uses the normal CRE `HTTPClient` with `TeeRuntime`, as in the official Confidential Workflow pattern. It does not use the separate CRE *Confidential HTTP* capability (`ConfidentialHTTPClient`), and Catenor One MUST NOT claim that it does.

Conceptually:

```text
Trigger (opaque run metadata + sealed private context)
   ↓
Workflow DON
   ↓
request TEE execution
   ↓
handlerInTee()  →  operation trust-anchor-admission
   │
   ├── getSecrets()
   ├── open sealed private context
   ├── HTTPS → Sumsub
   ├── provider-binding check
   ├── private normalization
   ├── deterministic fact derivation / guardrails
   ├── evidence commitment
   └── minimized result
   ↓
calling system
```

Secret values, sensitive HTTP response payloads and sensitive intermediate values MUST NOT be deliberately exposed outside the confidential boundary.

The exact trigger mechanism is a PLAN-level decision based on the current deployable CRE model (`PLAN.md` §17–18). The design MUST fit the documented CRE per-execution HTTP request quota conservatively.

---

# 14. Real CRE deployment is mandatory

Simulation is required for development and reproducible tests, but **simulation alone does not complete S001**.

Hackathon Definition of Done requires:

```text
real deployed CRE Confidential Workflow (identity-confidential)
real TEE handler execution (trust-anchor-admission)
real Vault DON secret retrieval
real HTTPS call to Sumsub (sandbox) executed from inside the TEE
real Admission result
```

The preferred deployment registry is the CRE **private** registry; another registry is used only with explicit human approval.

The repository MUST retain sanitized judge-verifiable evidence under `artifacts/chainlink/`, such as deployment identifiers/config, deployment output, simulation output, live execution evidence, minimized results, and negative-path evidence.

Mocks MUST be labeled as mocks and MUST NOT be presented as deployed sponsor integrations.

The official CRE bootcamp/template pattern is a reference for `handlerInTee`, `TeeRuntime`, batched secrets, HTTPS from inside the TEE and deterministic guardrails. Catenor One adopts the pattern, not the liquidation domain logic. The workflow project is created from the official CRE scaffolding (`cre init` with the official TypeScript Confidential Workflow template) rather than hand-written boilerplate.

---

# 15. CRE Vault DON secrets

S001 persistent CRE secrets:

```text
SUMSUB_APP_TOKEN
SUMSUB_SECRET_KEY
CATENOR_INTERNAL_API_TOKEN
```

Count:

```text
3 persistent CRE secrets
```

`CATENOR_INTERNAL_API_TOKEN` is the approved shared root secret for confidential Catenor ↔ TEE transport: sealing the per-admission private context delivered to `handlerInTee` and authenticating the TEE → Catenor API result callback (`PLAN.md` §18–19). It is also held by the Catenor API as a protected deployment secret.

They SHOULD be fetched in a single batched `getSecrets()` call.

No additional long-lived CRE secret may be added without explicit justification and human approval.

The S001 Admission Policy is intentionally public and its normal policy parameters are therefore **not** Vault DON secrets.

Dynamic applicant/provider identifiers and bindingRefs are private application data, not long-lived Vault DON credentials.

---

# 16. Deterministic evidence processing (no LLM in S001)

S001 contains **no LLM** and no other semantic-AI component. All eight Admission Policy facts are established by deterministic code:

```text
Sumsub (sandbox)
→ Chainlink CRE Confidential Workflow identity-confidential / trust-anchor-admission
→ handlerInTee
→ provider-binding check
→ deterministic provider normalization
→ deterministic fact derivation
→ minimized verified facts + evidence commitment
→ Catenor Admission Policy
→ ALLOW / DENY
```

S001 requires no LLM secret, no LLM HTTP request, no LLM provider integration and no LLM artifacts.

LLM-inside-TEE is recorded only as a possible future technique for S002 Subject Continuity, if unstructured or ambiguous private evidence actually requires semantic interpretation. It is out of scope for S001 and will be specified, if needed, by that slice.

---

# 17. Minimum Admission Policy v1

Catenor One S001 freezes the following reference policy:

```yaml
id: policy:trust-anchor-admission:v1

action: ADMIT_TRUST_ANCHOR

requires:
  ORGANIZATION_KYB_VERIFIED: true
  ORGANIZATION_STATUS_VALID: true
  ORGANIZATION_AML_CLEAR: true
  AUTHORIZED_REPRESENTATIVE_VERIFIED: true
  REPRESENTATIVE_AUTHORITY_CONFIRMED: true
  ASSERTION_KEY_POSSESSION_VALID: true
  ASSERTION_KEY_PURPOSE_VALID: true
  EVIDENCE_FRESH: true

decision:
  all_required_conditions_true: ALLOW
  otherwise: DENY
```

This is the Catenor One reference policy, not a universal legal definition of Trust Anchor eligibility for every Catenor Trust Domain.

---

# 18. Admission fact provenance

Each security-critical fact must have traceable provenance.

| Fact | Evidence class |
|---|---|
| `ORGANIZATION_KYB_VERIFIED` | real business/KYB verification result |
| `ORGANIZATION_STATUS_VALID` | accepted organization/provider evidence |
| `ORGANIZATION_AML_CLEAR` | accepted AML verification result |
| `AUTHORIZED_REPRESENTATIVE_VERIFIED` | real representative identity verification |
| `REPRESENTATIVE_AUTHORITY_CONFIRMED` | deterministic provider evidence: company ↔ representative linkage, accepted role, representative + company verification (§12.2) |
| `ASSERTION_KEY_POSSESSION_VALID` | cryptographic challenge/signature verification |
| `ASSERTION_KEY_PURPOSE_VALID` | DID Document + assertion-purpose validation |
| `EVIDENCE_FRESH` | provider/evidence timestamps + configured freshness rule (Bootstrap Configuration; 180 days [REF-IMPL]) |

All facts are derived deterministically. The six evidence facts are established inside `handlerInTee` only after the provider-binding check (§12.1) succeeds.

Evidence source (§12.3): under the Hybrid Demo Profile, `ORGANIZATION_KYB_VERIFIED`, `ORGANIZATION_STATUS_VALID`, `ORGANIZATION_AML_CLEAR`, the company part of `EVIDENCE_FRESH` and the linkage part of `REPRESENTATIVE_AUTHORITY_CONFIRMED` are derived from SYNTHETIC MOCK company evidence and MUST be labeled as such; they are never presented as a real business/KYB verification result. `AUTHORIZED_REPRESENTATIVE_VERIFIED` is always derived from REAL Sumsub sandbox evidence. Provider rejection labels (e.g. `SANCTIONS`, `PEP`) are retained only as sanitized reason codes; they are not independent Catenor policy rules.

No fact may become `true` solely because an unsigned mutable application row says so.

---

# 19. Public Admission Policy

The Admission Policy is public and versioned because a verifier should be able to understand the rule used to admit the Trust Anchor.

The system MUST retain:

```text
policy identifier
policy version
canonical policy content
policy hash / commitment
```

The exact canonical serialization/hash algorithm is a PLAN-level reference implementation choice.

Policy evaluation MUST be deterministic, fail closed, distinguish missing evidence from true evidence, and never convert ERROR/INDETERMINATE into ALLOW.

For `policy:trust-anchor-admission:v1`, a missing required fact results in `DENY` (the frozen rule is `otherwise: DENY`). The private evaluation trace MUST still record each requirement as `SATISFIED`, `FALSE` or `MISSING`; `FALSE` and `MISSING` are never collapsed internally.

---

# 20. Admission Decision

Working shape:

```json
{
  "policy": "policy:trust-anchor-admission:v1",
  "subject": "did:catenor:8f0c92...",
  "action": "ADMIT_TRUST_ANCHOR",
  "resource": "trust-domain:catenor-one-demo",
  "decision": "ALLOW",
  "evaluatedAt": "2026-09-09T00:00:00Z",
  "evidenceCommitment": "0x..."
}
```

Minimum terminal outcomes are `ALLOW` and `DENY`.

Optional states such as `INDETERMINATE`, `REQUIRES_REVIEW` and `ERROR` may exist, but none may silently become `ALLOW`.

```text
Catenor Policy Decision != Financial Execution Authorization
```

---

# 21. Trust Anchor Admission Record

A Trust Anchor Admission Record is created only after:

```text
Admission Policy = ALLOW
+
bootstrap endorsement = valid
```

Working shape:

```json
{
  "type": "CatenorTrustAnchorAdmissionRecord",
  "trustDomain": "trust-domain:catenor-one-demo",
  "trustAnchor": "did:catenor:8f0c92...",
  "admissionPolicy": "policy:trust-anchor-admission:v1",
  "policyHash": "0x...",
  "decision": "ADMIT_TRUST_ANCHOR",
  "verificationMethod": "did:catenor:8f0c92...#assertion-key-1",
  "evidenceCommitment": "0x...",
  "createdAt": "2026-09-09T00:00:00Z",
  "decisionRef": "decision:admission:001",
  "bootstrapEndorsementRef": "endorsement:bootstrap:001"
}
```

The exact wire representation remains reference-implementation behavior. `trustDomain` and `bootstrapEndorsementRef` are Catenor One [REF-IMPL] extensions of the protocol's draft Admission Record shape; a protocol amendment proposal will follow separately.

---

# 22. Railway-only application infrastructure

For the hackathon reference implementation, application infrastructure uses Railway only.

```text
Railway
├── apps/web
├── apps/api
└── PostgreSQL
```

The Railway private Storage Bucket remains part of the wider Catenor One architecture for later slices; S001 does not provision or use it.

No AWS infrastructure is required for S001.

External systems:

```text
Chainlink CRE / Vault DON / TEE
Sumsub (sandbox for the hackathon)
Privy (operator authentication; separate assertion and bootstrap signing wallets — spike T0.5 passed)
```

Arc is not part of S001.

---

# 23. PostgreSQL data model

S001 uses **one Railway PostgreSQL instance**.

It is not split into a physically public database and a physically private database.

```text
PRIVATE POSTGRESQL
        │
        ├── public/resolvable projection
        │        ↓
        │   Resolver/API
        │
        └── private operational state
```

The database service itself MUST NOT be made public merely because some Catenor state is publicly resolvable.

Public/resolvable projection may include:

```text
did:catenor
DID Document
public Verification Methods
Trust Anchor status
Admission Policy identifier/hash
minimized Admission Record
evidence commitment
bootstrap endorsement reference/proof where appropriate
```

Private operational state may include:

```text
Canonical Subject record
provider bindingRefs (COMPANY, REPRESENTATIVE)
Sumsub company applicant reference (Hybrid Demo Profile: SYNTHETIC MOCK company reference)
representative applicant reference
Admission session/state
verified fact results and references
evidence commitment + its normalized commitment preimage and provider-response digests (no raw content)
CRE execution references
Decision references
Trust Domain membership/index
audit references
opaque secure-signer references
```

Trust Anchor lifecycle status in the public projection is an operational projection in S001 (§27).

---

# 24. Evidence retention — COMMITMENT_ONLY in S001

S001 uses **COMMITMENT_ONLY** evidence retention. It does not retain encrypted evidence objects and does not implement any custom evidence-encryption scheme.

```text
TEE
→ provider responses remain private inside the confidential boundary
→ provider-binding check, deterministic normalization and fact derivation
→ evidenceCommitment
→ only the minimized result leaves the TEE
```

Catenor stores, in private PostgreSQL state:

```text
provider references and bindingRefs
admission metadata
verified fact results / references
Decision reference
evidenceCommitment
the normalized commitment preimage and provider-response digests (minimum needed to recompute the commitment)
CRE execution reference
```

Catenor MUST NOT store, in any database, bucket, log or artifact:

```text
raw Sumsub responses
raw PII
private provider evidence snapshots
```

The Railway private Storage Bucket remains part of the wider Catenor One architecture for later slices that need retained evidence objects. S001 does not provision or use it.

---

# 25. TEE-to-storage privacy rule

Raw confidential provider responses MUST NOT leave the TEE in plaintext merely so the backend can persist them.

S001 applies the safe model by design:

```text
do not persist any raw provider snapshot
+
persist minimized facts
+
persist the evidence commitment with its normalized preimage and provider-response digests
+
retain private provider references for authorized re-verification with the provider
```

Evidence-commitment semantics:

> The commitment can be recomputed against the retained normalized commitment preimage and provider-response digests. It binds the Admission to what was observed during confidential execution, but does not preserve or reconstruct the raw provider evidence.

Any later slice that retains encrypted evidence MUST use an approved, standard encryption scheme, and its decryption private key MUST NOT be stored in PostgreSQL or inside the same bucket as the encrypted evidence.

---

# 26. Confidential per-admission input

The Catenor API initiates the Admission workflow using a minimal opaque Admission/session reference rather than deliberately placing raw PII in a trigger.

The exact mechanism by which private per-admission context reaches `handlerInTee()` is a PLAN decision based on current official CRE deployment capabilities.

Requirements:

```text
raw PII MUST NOT be placed in public workflow config/trigger fields
Sumsub applicant IDs and bindingRefs MUST NOT appear in plaintext in trigger payloads visible to the Workflow DON
Sumsub applicant IDs MUST NOT appear in public logs
session identifiers SHOULD be opaque
private context MUST use an authenticated/confidential delivery or fetch mechanism
```

Approved S001 mechanism (the required symmetric cryptography was SIMULATION-CONFIRMED in CRE runtime spike T0.7; deployed-TEE behavior is re-checked at the first deployed run):

```text
Catenor API seals the per-admission private context with a key derived from CATENOR_INTERNAL_API_TOKEN
→ HTTP trigger carries only opaque run metadata + ciphertext
→ handlerInTee retrieves CATENOR_INTERNAL_API_TOKEN from Vault DON
→ private context is opened inside the TEE
```

The private context may contain the session reference, expected provider bindingRefs, Sumsub applicant IDs, the Trust Domain reference, and expiry / anti-replay data. If the runtime cannot safely support this, implementation STOPS for human review; a TEE → Catenor API context fetch is a fallback only after explicit human approval, because it changes the HTTP request budget and threat model.

`CATENOR_INTERNAL_API_TOKEN` is the long-lived credential for this mechanism and is modeled as a Vault DON secret (§15).

---

# 27. Audit and verification

S001 must emit sufficient audit history to reconstruct Admission.

Conceptual events:

```text
SUBJECT_CREATED
KEY_ADDED
DID_DOCUMENT_CREATED
ADMISSION_REQUESTED
KEY_POSSESSION_VERIFIED
CONFIDENTIAL_EVIDENCE_VERIFIED
POLICY_EVALUATED
BOOTSTRAP_ENDORSEMENT_CREATED
TRUST_ANCHOR_ADMITTED
```

Failure path includes `TRUST_ANCHOR_ADMISSION_DENIED`, and confidential-verification failures (including provider-binding mismatch) are recorded without exposing applicant IDs, bindingRefs or provider data.

A verifier must be able to establish:

```text
1. recognized Trust Domain Bootstrap Configuration
2. resolvable candidate DID
3. valid DID Document
4. valid assertion Verification Method, matching the endorsed verificationMethodCommitment
5. matching Admission Record
6. matching Trust Domain
7. identifiable Admission Policy/version
8. matching policy hash
9. successful Admission Decision
10. valid bootstrap endorsement
11. ACTIVE Trust Anchor status
12. non-revoked relevant verification state
```

Result:

```text
TRUST_ANCHOR_VALID = true | false
```

Verification claim (S001):

> S001 cryptographically verifies Admission provenance and bootstrap endorsement, while current lifecycle status is read from the Catenor One operational status projection.

Cryptographically verifiable in S001: the Bootstrap Configuration commitment, the Admission Policy commitment, the candidate assertion Verification Method (via `verificationMethodCommitment`), the Admission Decision binding, the bootstrap endorsement, and Admission Record integrity/binding. Items 11–12 (current `ACTIVE` / non-revoked status) come from the operational projection; S001 does not claim they are cryptographically proven. A later slice/protocol profile can make status and revocation independently verifiable.

---

# 28. Required DENY paths

Admission MUST fail closed for at least:

```text
missing organization evidence
organization KYB not verified
organization status invalid
AML not clear
representative identity not verified
representative authority not confirmed
invalid assertion-key signature
expired challenge
challenge replay
DID mismatch
Verification Method missing
wrong key purpose
stale evidence
Admission Policy requirement false
Admission Policy unavailable
policy hash mismatch
invalid bootstrap endorsement
bootstrap configuration mismatch
candidate deactivated
tampered Admission Record
required CRE/Sumsub evidence unavailable
provider binding mismatch (Sumsub externalUserId ≠ Catenor bindingRef)
assertion Verification Method key replaced under the same Verification Method ID
```

No failed path may create or activate a Trust Anchor.

---

# 29. Failure behavior

If a provider applicant's `externalUserId` does not match the expected Catenor bindingRef, the confidential run establishes no facts and Admission MUST NOT result in `ALLOW`.

If Sumsub or required confidential verification is unavailable or malformed:

```text
NO ALLOW
```

TEE execution failure, invalid provider authentication, missing required provider evidence, or malformed provider data must fail closed.

---

# 30. Idempotency and lifecycle compatibility

Repeated requests must not create duplicate active roots.

For an already-active canonical Subject in the same Trust Domain, Catenor One returns the existing Admission state or an explicit `ALREADY_ADMITTED` result.

S001 does not implement full revocation governance but MUST leave room for:

```text
ACTIVE
SUSPENDED
REVOKED
DEACTIVATED
```

A non-active Trust Anchor must not verify as valid for current authority.

---

# 31. Security and privacy invariants

S001 MUST preserve:

```text
PII != DID seed
Sumsub applicantId != DID
Credential Assertion Key != Financial Execution Key
private assertion key never stored in general DB
key possession != Trust Anchor eligibility
authentication != Admission
self-assertion != initial trust
database row != cryptographic Admission proof
provider applicant not bound to the Catenor bindingRef != verified evidence
missing required evidence != ALLOW
ERROR / unknown != ALLOW
Admission Decision != execution authorization
raw confidential response must not leave TEE in plaintext for persistence
raw provider responses are never persisted by Catenor
provider references and bindingRefs remain private
public Admission output is minimized
logs contain no secrets or raw PII
```

---

# 32. Judge-facing live demo

Happy path should show:

```text
1. Candidate Organization enters Admission.
2. Catenor creates/resolves canonical did:catenor and private provider bindingRefs.
3. Operator attaches the Sumsub sandbox applicant references created with those bindingRefs
   (Hybrid Demo Profile: the REAL representative applicant + the SYNTHETIC MOCK company reference).
4. DID Document and public assertion key are visible.
5. Proof of Key Possession succeeds.
6. DEPLOYED Chainlink CRE Confidential Workflow identity-confidential executes the trust-anchor-admission operation.
7. handlerInTee retrieves Vault DON secrets.
8. TEE verifies the provider binding and performs real Sumsub sandbox verification over HTTPS from inside the TEE
   (representative always REAL; company per evidence profile, labeled "Company evidence: SYNTHETIC MOCK" under the Hybrid Demo Profile).
9. Only minimized verified facts and the evidence commitment leave confidential computation.
10. Admission Policy v1 deterministically returns ALLOW.
11. Bootstrap endorsement is created/verified.
12. Admission Record is created.
13. Subject becomes ACTIVE Initial Trust Anchor.
14. Verify Trust Anchor returns true.
15. Audit view explains why without exposing private evidence.
```

At least one meaningful live negative path must also be demonstrated, preferably invalid key possession and/or a required evidence fact evaluating false.

---

# 33. Required artifacts

S001 should retain sanitized artifacts including:

```text
resolved DID Document
Bootstrap Configuration
Admission Policy v1
policy hash
Admission Decision
Trust Anchor Admission Record
bootstrap endorsement
audit sample
CRE simulation output
CRE deployed workflow identifier/config
real CRE deployment output
real confidential execution evidence
negative-path evidence
sanitized Sumsub integration evidence (labeled "Sumsub sandbox")
evidence-profile labels (Hybrid Demo Profile: "Company evidence: SYNTHETIC MOCK", "Representative verification: REAL SUMSUB SANDBOX")
evidence commitment (COMMITMENT_ONLY retention)
```

Sponsor-specific artifacts belong under the existing `artifacts/` directories.

---

# 34. Official integration tooling rule

Before implementing sponsor/provider-specific code, the implementation agent MUST consult current official tooling/documentation.

For S001:

```text
Chainlink CRE official agent/skill/docs → required
Privy official agent/skill/docs         → required before selecting assertion-key adapter
Sumsub current official API docs        → required
Arc                                     → not used in S001
LLM                                     → not used in S001
```

Integration tooling may determine adapter details. It MUST NOT redefine Catenor domain semantics.

---

# 35. Definition of success

S001 is successful when:

> A candidate Organization becomes the Initial Active Trust Anchor of a Catenor One Trust Domain only after an accepted bootstrap configuration, real-world evidence, assertion-key control, confidential verification and the public Admission Policy have been successfully verified; the resulting root of authority can be independently inspected and audited without exposing the underlying private evidence.

---

# 36. Frozen S001 reference decisions

Unless explicitly changed by the human owner:

```text
Subject type
→ ORGANIZATION

Protocol identifier
→ did:catenor

Architecture
→ Modular Monolith + Vertical Slices + DDD-lite + Clean Architecture boundaries

Application infrastructure
→ Railway only for hackathon reference deployment

Database
→ one Railway PostgreSQL + Prisma

Public state
→ application Resolver/API projection, not public DB access

Evidence retention
→ COMMITMENT_ONLY; raw provider responses never persisted by Catenor
→ Railway private Storage Bucket not provisioned or used by S001

Confidential compute
→ Chainlink CRE Confidential

CRE workflow boundary
→ identity-confidential (cohesive confidential identity workflow)

S001 operation / handler
→ trust-anchor-admission

Sensitive handler
→ handlerInTee (HTTPS requests executed from inside the TEE)

CRE completion requirement
→ real deployment required; simulation alone insufficient

CRE deployment registry
→ private registry (another registry only with human approval)

Identity evidence provider
→ real Sumsub integration (Sumsub sandbox, synthetic data, labeled as sandbox, for the hackathon)

Evidence profile (Rev 2.3)
→ Full Sumsub Sandbox Profile preferred; Hybrid Demo Profile (company SYNTHETIC MOCK, representative REAL Sumsub sandbox)
  only while Company/KYB entitlement is unavailable, hash-pinned, endorsement-bound and labeled (§12.3)

Provider binding
→ Catenor-issued bindingRef = Sumsub externalUserId, verified inside the TEE; mismatch → no facts, no ALLOW

Evidence processing
→ deterministic only; no LLM in S001

Admission Policy
→ public, versioned `policy:trust-anchor-admission:v1`

Initial trust
→ Trust Domain Bootstrap Configuration + bootstrap endorsement (binds verificationMethodCommitment)

Persistent CRE secrets
→ SUMSUB_APP_TOKEN
→ SUMSUB_SECRET_KEY
→ CATENOR_INTERNAL_API_TOKEN

Bootstrap access
→ environment allowlist via ALLOWED_BOOTSTRAP_EMAILS for v1
→ application access control only
→ does not imply Trust Anchor eligibility

Arc
→ not part of S001
```

# 37. Open PLAN decisions

These implementation decisions were proposed and approved in `PLAN.md` Rev 2 (2026-09-10) and updated after the Phase 0 spikes (Rev 2.6). They must not be silently changed while coding:

```text
exact did:catenor random identifier encoding
exact crypto suite/profile                                 (Ed25519 primitive confirmed by T0.5; eddsa-jcs-2022
                                                           interoperability to be tested in implementation — PLAN D3)
exact assertion-key implementation                         (dedicated Privy Solana wallet — T0.5 passed, PLAN D1)
whether Privy is used for S001 assertion signing           (decided: yes — PLAN D1)
exact CRE trigger type
exact private per-admission context transport into TEE    (sealed context — SIMULATION-CONFIRMED in T0.7, PLAN D11/D37)
CATENOR_INTERNAL_API_TOKEN purpose                         (approved: channel/root secret)
exact Sumsub endpoints and applicant mapping               (confirmed against Sumsub sandbox responses)
exact policy canonical serialization/hash algorithm
exact evidence commitment format
exact Prisma schema/table names
exact resolver/API routes
exact bootstrap endorsement proof envelope
exact audit persistence representation
exact frontend flow
encrypted evidence-package format / bucket upload / evidence key mechanism   → not applicable to S001 (COMMITMENT_ONLY)
```

If an official integration constraint makes a frozen requirement infeasible, implementation MUST stop and surface the incompatibility for human review instead of silently weakening the requirement.

---

# 38. Final principle

> **Trust is not assumed from the chain. Catenor makes the basis, scope and continuity of authority verifiable.**

For S001:

> **Private evidence in. Deterministically verified facts out. Explicit bootstrap trust. Auditable admission.**
