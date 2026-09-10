# S001 — Trust Anchor Admission
## Specification

> **Goal:** Establish the first active Trust Anchor of a Catenor Trust Domain through explicit bootstrap trust, real-world evidence verification, proof of key possession, confidential processing, deterministic policy evaluation, and an auditable Admission Record.

**Project:** Catenor One  
**Protocol baseline:** Catenor Protocol Draft v0.1  
**Slice:** `S001-trust-anchor-admission`  
**Status:** Final draft for human approval  
**Architecture:** Modular Monolith + Vertical Slices + DDD-lite + Clean Architecture boundaries

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
real Sumsub verification
Chainlink CRE Confidential Workflow
handlerInTee execution
Vault DON secrets
confidential HTTP
auxiliary LLM call inside the TEE
deterministic Admission Policy
Admission Decision
bootstrap endorsement
Trust Anchor Admission Record
Trust Domain activation
Railway PostgreSQL
Railway private Storage Bucket
public/private storage separation
audit events
Trust Anchor verification
CRE simulation for development
real CRE deployment for hackathon completion
```

S001 does **not** implement Sponsor Authorization, Agent Delegation, Investor Subject Continuity, tokenization approval, distribution, financial execution, Arc settlement, multi-anchor governance, or the full future Trust Anchor revocation model.

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

The bootstrap admission authority is not automatically a Catenor Trust Anchor. Its role is limited to establishing the initial trust boundary for this Trust Domain.

---

# 8. Bootstrap endorsement

For the Initial Trust Anchor, a successful policy result is necessary but not sufficient for activation.

Catenor One MUST create a cryptographic bootstrap endorsement binding at least:

```text
Trust Domain
candidate did:catenor
Admission Policy identifier/version
policy commitment/hash
Admission Decision reference or commitment
evidence commitment
admission timestamp / validity context
```

Only after this endorsement verifies may the candidate become the Initial Active Trust Anchor.

The exact proof envelope is a PLAN-level reference implementation decision.

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

Catenor One will evaluate Privy through its current official agent/skill/docs as the reference signing/key-management adapter during PLAN. If the current Privy model is not appropriate for the Credential Assertion Key, S001 may use another secure reference signer while keeping the port boundary and documenting the reason.

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

Catenor One may perform applicant creation/onboarding outside the confidential workflow where necessary. At Admission verification time, however, sensitive verification MUST be performed through confidential HTTP from inside the TEE.

```text
private provider reference
        ↓
handlerInTee()
        ↓
Sumsub confidential HTTPS
        ↓
private provider response
        ↓
normalize / verify inside TEE
        ↓
minimized verified facts
```

The intended reference flow supports at least:

```text
Organization / company applicant reference
Authorized representative / individual applicant reference
```

where the selected Sumsub configuration provides them.

Sumsub `applicantId` values are private operational data. They are not Catenor identifiers and MUST NOT appear in the public DID Document or public logs.

Exact Sumsub endpoints and mappings are PLAN/implementation decisions based on current official documentation.

---

# 13. Chainlink CRE Confidential integration

S001 requires a Chainlink CRE **Confidential Workflow**.

The sensitive path MUST use the current confidential pattern based on:

```text
handlerInTee(...)
TeeRuntime
Vault DON secrets
batched getSecrets()
confidential HTTP
private intermediate values
minimized output
```

Conceptually:

```text
Trigger
   ↓
Workflow DON
   ↓
request TEE execution
   ↓
handlerInTee()
   │
   ├── getSecrets()
   ├── HTTPS → Sumsub
   ├── HTTPS → LLM
   ├── private normalization
   ├── deterministic guardrails
   └── minimized result
   ↓
calling system
```

Secret values, sensitive HTTP response payloads and sensitive intermediate values MUST NOT be deliberately exposed outside the confidential boundary.

The exact trigger mechanism is a PLAN-level decision based on the current deployable CRE model.

---

# 14. Real CRE deployment is mandatory

Simulation is required for development and reproducible tests, but **simulation alone does not complete S001**.

Hackathon Definition of Done requires:

```text
real deployed CRE Confidential Workflow
real TEE handler execution
real Vault DON secret retrieval
real confidential HTTP call to Sumsub
real Admission result
```

If the LLM is enabled in the live path, the deployed workflow SHOULD use a real LLM API as well.

The repository MUST retain sanitized judge-verifiable evidence under `artifacts/chainlink/`, such as deployment identifiers/config, deployment output, simulation output, live execution evidence, minimized results, and negative-path evidence.

Mocks MUST be labeled as mocks and MUST NOT be presented as deployed sponsor integrations.

The official CRE bootcamp/template pattern is a reference for `handlerInTee`, `TeeRuntime`, batched secrets, confidential HTTP and deterministic guardrails. Catenor One adopts the pattern, not the liquidation domain logic.

---

# 15. CRE Vault DON secrets

Baseline persistent third-party secrets:

```text
SUMSUB_APP_TOKEN
SUMSUB_SECRET_KEY
LLM_API_KEY
```

Baseline count:

```text
3 persistent CRE secrets
```

They SHOULD be fetched in a batched `getSecrets()` call when supported.

The S001 Admission Policy is intentionally public and its normal policy parameters are therefore **not** Vault DON secrets.

If PLAN determines that secure transport between Catenor One and the deployed TEE requires another long-lived credential, such as:

```text
CATENOR_INTERNAL_API_TOKEN
```

it may be added explicitly, bringing the persistent CRE secret count to 4. The PLAN MUST document why it is necessary.

Dynamic applicant/provider identifiers are private application data, not long-lived Vault DON credentials.

---

# 16. LLM role

S001 includes an LLM as an **auxiliary confidential component**.

Possible uses:

```text
corporate-evidence extraction
structured normalization assistance
representative/role extraction
human-readable evidence explanation
```

Sensitive LLM calls SHOULD happen from inside the TEE using confidential HTTP.

Critical invariant:

```text
LLM output != verified Admission fact by itself
```

The LLM may propose or extract. Deterministic code MUST hold the security boundary.

Example:

```text
LLM proposes representativeRole = "Director"
                ↓
deterministic validation against accepted evidence
                ↓
REPRESENTATIVE_AUTHORITY_CONFIRMED = true | false
```

An LLM timeout, malformed result or hallucination MUST NOT create an ALLOW condition.

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
| `REPRESENTATIVE_AUTHORITY_CONFIRMED` | accepted business/corporate authority evidence + deterministic validation |
| `ASSERTION_KEY_POSSESSION_VALID` | cryptographic challenge/signature verification |
| `ASSERTION_KEY_PURPOSE_VALID` | DID Document + assertion-purpose validation |
| `EVIDENCE_FRESH` | provider/evidence timestamps + configured freshness rule |

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

The exact wire representation remains reference-implementation behavior.

---

# 22. Railway-only application infrastructure

For the hackathon reference implementation, application infrastructure uses Railway only.

```text
Railway
├── apps/web
├── apps/api
├── PostgreSQL
└── private Storage Bucket
```

No AWS infrastructure is required for S001.

External systems:

```text
Chainlink CRE / Vault DON / TEE
Sumsub
LLM provider
Privy when selected for signing/key management
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
Sumsub company applicant reference
representative applicant reference
Admission session/state
evidence references
Decision references
Trust Domain membership/index
audit references
opaque secure-signer references
```

---

# 24. Railway private Evidence Vault

Sensitive evidence objects SHOULD be stored in the Railway private Storage Bucket as encrypted evidence when the deployed CRE architecture can do so without leaking plaintext outside the confidential boundary.

Examples:

```text
organization evidence snapshot
representative evidence snapshot
corporate authority evidence
provider response snapshot
LLM result where retention is justified
signed sensitive credential artifacts
audit evidence
```

The operational database stores references and metadata rather than large raw evidence blobs.

Conceptually:

```text
Private PostgreSQL
    evidenceId
    objectRef
    evidenceCommitment
        │
        ▼
Railway Private Bucket
    encrypted evidence package
```

---

# 25. TEE-to-storage privacy rule

Raw confidential provider/LLM responses MUST NOT leave the TEE in plaintext merely so the backend can persist them.

Preferred model:

```text
raw evidence inside TEE
        ↓
normalize
        ↓
construct evidence package
        ↓
hash / commitment
        ↓
encrypt before crossing confidential boundary
        ↓
Railway private bucket
```

The exact encryption and upload mechanism MUST be selected during PLAN using current official CRE capabilities/documentation.

If the deployed CRE model cannot retain a historical encrypted snapshot without exposing raw plaintext, S001 MUST prefer:

```text
do not persist the raw snapshot
+
persist minimized facts
+
persist evidence commitment/reference where meaningful
+
retain private provider reference for authorized re-verification
```

over leaking raw evidence.

Any evidence decryption private key MUST NOT be stored in PostgreSQL or inside the same bucket as the encrypted evidence.

---

# 26. Confidential per-admission input

The Catenor API initiates the Admission workflow using a minimal opaque Admission/session reference rather than deliberately placing raw PII in a trigger.

The exact mechanism by which private per-admission context reaches `handlerInTee()` is a PLAN decision based on current official CRE deployment capabilities.

Requirements:

```text
raw PII MUST NOT be placed in public workflow config/trigger fields
Sumsub applicant IDs MUST NOT appear in public logs
session identifiers SHOULD be opaque
private context MUST use an authenticated/confidential delivery or fetch mechanism
```

If a long-lived internal credential is required for this mechanism, it must be explicitly modeled as a Vault DON secret.

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

Failure path includes `TRUST_ANCHOR_ADMISSION_DENIED`.

A verifier must be able to establish:

```text
1. recognized Trust Domain Bootstrap Configuration
2. resolvable candidate DID
3. valid DID Document
4. valid assertion Verification Method
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
```

No failed path may create or activate a Trust Anchor.

---

# 29. Failure behavior

LLM failure MUST NOT create ALLOW.

If LLM use is advisory/explanatory, deterministic Admission may continue without it. If the LLM is used for extraction that is necessary to establish a required fact, inability to deterministically confirm that fact results in DENY or REQUIRES_REVIEW.

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
LLM recommendation != verified fact
missing required evidence != ALLOW
ERROR / unknown != ALLOW
Admission Decision != execution authorization
raw confidential response must not leave TEE in plaintext for persistence
provider references remain private
public Admission output is minimized
logs contain no secrets or raw PII
```

---

# 32. Judge-facing live demo

Happy path should show:

```text
1. Candidate Organization enters Admission.
2. Catenor creates/resolves canonical did:catenor.
3. DID Document and public assertion key are visible.
4. Proof of Key Possession succeeds.
5. DEPLOYED Chainlink CRE Confidential Workflow executes.
6. handlerInTee retrieves Vault DON secrets.
7. TEE performs real confidential Sumsub verification.
8. TEE performs auxiliary confidential LLM call when enabled.
9. Only minimized verified facts leave confidential computation.
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
sanitized Sumsub integration evidence
sanitized LLM live-call evidence when used
evidence commitment / encrypted-object metadata when implemented
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
LLM provider current official docs      → required
Arc                                     → not used in S001
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

Evidence storage
→ Railway private Storage Bucket

Confidential compute
→ Chainlink CRE Confidential

Sensitive handler
→ handlerInTee

CRE completion requirement
→ real deployment required; simulation alone insufficient

Identity evidence provider
→ real Sumsub integration

LLM
→ confidential auxiliary component; never final authority

Admission Policy
→ public, versioned `policy:trust-anchor-admission:v1`

Initial trust
→ Trust Domain Bootstrap Configuration + bootstrap endorsement

Baseline persistent CRE credentials
→ SUMSUB_APP_TOKEN
→ SUMSUB_SECRET_KEY
→ LLM_API_KEY

Arc
→ not part of S001
```

---


Bootstrap access
→ environment allowlist via ALLOWED_BOOTSTRAP_EMAILS for v1
→ application access control only
→ does not imply Trust Anchor eligibility

# 37. Open PLAN decisions

These remain implementation decisions and must be proposed in `PLAN.md` rather than silently invented while coding:

```text
exact did:catenor random identifier encoding
exact crypto suite/profile
exact assertion-key implementation
whether Privy is used for S001 assertion signing after official review
exact CRE trigger type
exact private per-admission context transport into TEE
whether CATENOR_INTERNAL_API_TOKEN is necessary
exact Sumsub endpoints and applicant mapping
exact LLM provider/model and auxiliary task
exact policy canonical serialization/hash algorithm
exact evidence commitment format
exact encrypted evidence-package format
exact TEE → Railway Bucket upload mechanism
exact evidence encryption/decryption key mechanism
exact Prisma schema/table names
exact resolver/API routes
exact bootstrap endorsement proof envelope
exact audit persistence representation
exact frontend flow
```

If an official integration constraint makes a frozen requirement infeasible, implementation MUST stop and surface the incompatibility for human review instead of silently weakening the requirement.

---

# 38. Final principle

> **Trust is not assumed from the chain. Catenor makes the basis, scope and continuity of authority verifiable.**

For S001:

> **Private evidence in. Deterministically verified facts out. Explicit bootstrap trust. Auditable admission.**
