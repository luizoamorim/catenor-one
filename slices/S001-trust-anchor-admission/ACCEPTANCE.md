# S001 — Trust Anchor Admission
## Acceptance Criteria

**Project:** Catenor One  
**Protocol baseline:** Catenor Protocol Draft v0.1  
**Slice:** `S001-trust-anchor-admission`  
**Status:** Draft for human approval

---

# 1. Purpose

This document defines the observable behavior required for S001 to be considered complete.

Acceptance criteria are intentionally written from the outside in:

```text
GIVEN
WHEN
THEN
```

Implementation details belong in `PLAN.md`.

Passing unit tests alone is not sufficient.

S001 is complete only when its end-to-end happy path, fail-closed paths, live sponsor integrations, auditability, and privacy requirements are demonstrated.

---

# 2. Acceptance principle

The slice MUST prove:

> A candidate Organization cannot become the Initial Trust Anchor merely by logging in, owning infrastructure, controlling a key, passing one provider check, or signing a self-assertion.

Admission requires the complete configured chain:

```text
Bootstrap Access
        ↓
Trust Domain Bootstrap Configuration
        ↓
Canonical Organization Subject
        ↓
Assertion Key + Proof of Possession
        ↓
Real Confidential Evidence Verification
        ↓
Deterministic Admission Policy
        ↓
Bootstrap Endorsement
        ↓
Admission Record
        ↓
ACTIVE TRUST ANCHOR
```

---

# 3. Priority levels

Each criterion is classified as:

```text
P0 = required for S001 completion / hackathon demo
P1 = required for robust slice completion
P2 = desirable enhancement; may be deferred with explicit documentation
```

No P0 criterion may be silently deferred.

---

# 4. Bootstrap Access Gate

## AC-S001-001 — Authorized bootstrap operator may initiate admission

**Priority:** P0

**GIVEN**

```text
no Initial Trust Anchor exists
AND
the operator is authenticated
AND
the operator email is present in ALLOWED_BOOTSTRAP_EMAILS
```

**WHEN**

the operator requests Initial Trust Anchor Admission

**THEN**

```text
the Admission flow is allowed to start
AND
an Admission session/request may be created
```

**AND**

the access decision MUST NOT itself set any Trust Anchor eligibility fact to true.

---

## AC-S001-002 — Unauthorized email cannot initiate admission

**Priority:** P0

**GIVEN**

```text
no Initial Trust Anchor exists
AND
the operator email is not present in ALLOWED_BOOTSTRAP_EMAILS
```

**WHEN**

the operator attempts to start S001

**THEN**

```text
the request is rejected before Trust Anchor Admission begins
AND
no candidate Trust Anchor is activated
AND
no Admission Record is created
AND
no bootstrap endorsement is created
```

The response SHOULD clearly indicate that bootstrap access is not authorized without exposing the allowlist.

---

## AC-S001-003 — Bootstrap email access does not imply Trust Anchor eligibility

**Priority:** P0

**GIVEN**

an operator is allowed by `ALLOWED_BOOTSTRAP_EMAILS`

**AND**

one required Admission Policy fact is false

**WHEN**

the Admission Policy is evaluated

**THEN**

the result MUST be `DENY`.

The bootstrap access gate MUST NOT bypass the Admission Policy.

---

# 5. Trust Domain Bootstrap

## AC-S001-004 — Accepted Bootstrap Configuration can be loaded

**Priority:** P0

**GIVEN**

a configured Catenor One Trust Domain exists

**WHEN**

S001 starts

**THEN**

the system can resolve a Bootstrap Configuration containing at least:

```text
Trust Domain identifier
Admission Policy identifier/version
Admission Policy commitment/hash
bootstrap verification method
```

---

## AC-S001-005 — Bootstrap policy mismatch fails closed

**Priority:** P0

**GIVEN**

the runtime Admission Policy content does not match the policy commitment in the accepted Bootstrap Configuration

**WHEN**

Admission is evaluated or finalized

**THEN**

```text
Admission MUST NOT complete
AND
no active Trust Anchor is created
```

---

## AC-S001-006 — Candidate cannot bootstrap itself by self-assertion

**Priority:** P0

**GIVEN**

a candidate signs a statement asserting:

```text
"I am a Trust Anchor"
```

**WHEN**

no valid Admission Decision and bootstrap endorsement exist

**THEN**

the candidate MUST NOT become an active Trust Anchor.

---

# 6. Canonical Subject

## AC-S001-007 — Organization receives a canonical Catenor DID

**Priority:** P0

**GIVEN**

an eligible candidate Organization enters S001

**WHEN**

the candidate Subject is created

**THEN**

the system creates a canonical identifier matching:

```text
did:catenor:<opaque-high-entropy-id>
```

**AND**

the Subject type is:

```text
ORGANIZATION
```

---

## AC-S001-008 — DID must not encode identity-provider or PII data

**Priority:** P0

**GIVEN**

the Organization has:

```text
legal name
Sumsub company applicantId
representative applicantId
email
other identity evidence
```

**WHEN**

the Catenor DID is generated

**THEN**

none of those values may be directly encoded or deterministically recoverable from the DID identifier.

---

# 7. DID Document

## AC-S001-009 — Public DID Document resolves

**Priority:** P0

**GIVEN**

the candidate has a canonical Catenor DID and assertion Verification Method

**WHEN**

the public resolver/API is queried for the DID

**THEN**

a DID Document is returned containing the public verification material required by S001.

---

## AC-S001-010 — DID Document exposes no private Admission evidence

**Priority:** P0

**GIVEN**

the candidate has Sumsub references and private Admission evidence

**WHEN**

the public DID Document is resolved

**THEN**

it MUST NOT contain:

```text
Sumsub applicant IDs
raw KYB/KYC data
PII
private provider mappings
private Account Bindings
private keys
raw confidential LLM data
```

---

# 8. Assertion Key

## AC-S001-011 — Dedicated assertion Verification Method exists

**Priority:** P0

**GIVEN**

a candidate DID has been created

**WHEN**

the assertion key is provisioned

**THEN**

the DID Document contains a Verification Method authorized through `assertionMethod`.

---

## AC-S001-012 — Assertion private key is not stored in the operational database

**Priority:** P0

**GIVEN**

the assertion key has been provisioned

**WHEN**

the private PostgreSQL state is inspected

**THEN**

the private key material MUST NOT be present.

The database may store:

```text
verificationMethodId
public verification material
opaque signer/key reference
key status metadata
```

---

## AC-S001-013 — Assertion key is distinct from financial execution authority

**Priority:** P0

**GIVEN**

the Credential Assertion Key exists

**THEN**

the S001 implementation MUST NOT treat the same private-key material as a Financial Execution Key.

S001 does not require a financial execution wallet.

---

# 9. Proof of Key Possession

## AC-S001-014 — Valid proof of key possession succeeds

**Priority:** P0

**GIVEN**

```text
a fresh single-use challenge
bound to the candidate DID
bound to the current Admission operation
```

**AND**

the challenge is signed by the corresponding assertion private key

**WHEN**

the proof is verified

**THEN**

```text
ASSERTION_KEY_POSSESSION_VALID = true
```

---

## AC-S001-015 — Wrong assertion key fails

**Priority:** P0

**GIVEN**

the challenge is signed by a different key

**WHEN**

proof of possession is verified

**THEN**

```text
ASSERTION_KEY_POSSESSION_VALID = false
AND
Admission cannot result in ALLOW
```

---

## AC-S001-016 — Expired challenge fails

**Priority:** P1

**GIVEN**

a challenge has exceeded its configured lifetime

**WHEN**

a valid cryptographic signature for that expired challenge is submitted

**THEN**

proof of possession MUST fail.

---

## AC-S001-017 — Replayed challenge fails

**Priority:** P0

**GIVEN**

a challenge has already been successfully consumed

**WHEN**

the same signed challenge is submitted again

**THEN**

the second attempt MUST be rejected.

---

## AC-S001-018 — Challenge bound to a different DID fails

**Priority:** P1

**GIVEN**

a challenge was created for `did:catenor:A`

**WHEN**

it is submitted as proof for `did:catenor:B`

**THEN**

verification MUST fail.

---

# 10. Sumsub integration

## AC-S001-019 — Live Admission uses real Sumsub verification

**Priority:** P0

**GIVEN**

a real candidate provider reference is available

**WHEN**

the live S001 Admission path is executed

**THEN**

the deployed confidential workflow performs a real request to Sumsub for the required verification state/evidence.

A local fixture or mock MUST NOT satisfy this live acceptance criterion.

---

## AC-S001-020 — Sumsub identifiers remain private

**Priority:** P0

**GIVEN**

company and representative applicant references exist

**WHEN**

public API projections, DID Documents, judge-facing public state, and normal logs are inspected

**THEN**

raw provider applicant identifiers MUST NOT be exposed.

---

## AC-S001-021 — Sumsub authentication failure fails closed

**Priority:** P0

**GIVEN**

the deployed workflow cannot authenticate with Sumsub

**WHEN**

required Admission evidence is requested

**THEN**

the workflow MUST NOT produce verified facts that allow Admission.

---

## AC-S001-022 — Sumsub unavailable fails closed

**Priority:** P1

**GIVEN**

Sumsub cannot provide required verification evidence

**WHEN**

S001 attempts Admission

**THEN**

the result MUST remain non-ALLOW.

---

# 11. Chainlink CRE Confidential

## AC-S001-023 — Sensitive verification executes inside handlerInTee

**Priority:** P0

**GIVEN**

the deployed S001 CRE Confidential Workflow is invoked

**WHEN**

sensitive external evidence is processed

**THEN**

the sensitive path executes through:

```text
handlerInTee(...)
```

using the current supported Confidential Workflow runtime.

---

## AC-S001-024 — Vault DON secrets are fetched inside confidential execution

**Priority:** P0

**GIVEN**

the deployed confidential handler starts

**WHEN**

third-party credentials are needed

**THEN**

the handler retrieves the configured secrets from the supported Chainlink secret mechanism.

Baseline:

```text
SUMSUB_APP_TOKEN
SUMSUB_SECRET_KEY
LLM_API_KEY
```

where the LLM is enabled.

---

## AC-S001-025 — Persistent CRE secrets are not exposed in application logs

**Priority:** P0

**WHEN**

simulation logs, deployment logs, Railway logs and judge artifacts are inspected

**THEN**

none may reveal the raw values of CRE secrets.

---

## AC-S001-026 — Raw Sumsub response is not emitted from the TEE

**Priority:** P0

**GIVEN**

Sumsub returns sensitive provider evidence

**WHEN**

the confidential handler completes

**THEN**

the normal workflow output MUST NOT contain the raw sensitive Sumsub response.

---

## AC-S001-027 — Confidential workflow emits minimized facts

**Priority:** P0

**GIVEN**

confidential verification succeeds

**WHEN**

the TEE returns its result

**THEN**

the result contains only the minimized information required by the Admission path, such as:

```text
verified fact values
evidence commitment/reference
non-sensitive workflow/result identifiers
```

---

## AC-S001-028 — Simulation passes before live deployment

**Priority:** P0

**GIVEN**

the S001 CRE workflow implementation exists

**WHEN**

the workflow is tested locally

**THEN**

the documented simulation path succeeds for:

```text
happy path
at least one DENY/failure path
```

---

## AC-S001-029 — CRE Confidential Workflow is deployed for real

**Priority:** P0

**GIVEN**

simulation and tests pass

**WHEN**

S001 is considered hackathon-complete

**THEN**

a real Chainlink CRE Confidential Workflow deployment MUST exist.

Simulation alone MUST NOT satisfy S001.

---

## AC-S001-030 — Live TEE execution is evidenced

**Priority:** P0

**GIVEN**

the deployed workflow exists

**WHEN**

the live demo is executed

**THEN**

the project preserves sanitized judge-verifiable evidence that the real deployed confidential handler executed.

---

# 12. LLM

## AC-S001-031 — LLM cannot directly decide Admission

**Priority:** P0

**GIVEN**

the LLM produces an output recommending or implying approval

**WHEN**

one deterministic required Admission condition is false

**THEN**

the final Admission Decision MUST still be `DENY`.

---

## AC-S001-032 — Sensitive LLM request is made confidentially

**Priority:** P1

**GIVEN**

the LLM is used to inspect sensitive corporate evidence

**WHEN**

the live workflow calls the LLM

**THEN**

the sensitive call SHOULD originate from inside the confidential handler rather than from an ordinary public/backend execution path.

---

## AC-S001-033 — LLM failure never becomes ALLOW

**Priority:** P0

**GIVEN**

the LLM:

```text
times out
returns malformed output
returns an unsupported result
or fails
```

**WHEN**

that output is relevant to a required Admission fact

**THEN**

the system MUST NOT infer that the fact is true.

---

## AC-S001-034 — Mock LLM is clearly marked in non-live environments

**Priority:** P1

**GIVEN**

a local/simulation fixture replaces the LLM

**THEN**

the resulting logs/artifacts MUST identify it as a mock.

---

# 13. Minimum Admission Policy v1

The reference S001 policy requires:

```text
ORGANIZATION_KYB_VERIFIED
ORGANIZATION_STATUS_VALID
ORGANIZATION_AML_CLEAR
AUTHORIZED_REPRESENTATIVE_VERIFIED
REPRESENTATIVE_AUTHORITY_CONFIRMED
ASSERTION_KEY_POSSESSION_VALID
ASSERTION_KEY_PURPOSE_VALID
EVIDENCE_FRESH
```

All required facts must be true for `ALLOW`.

---

## AC-S001-035 — All required facts true returns ALLOW

**Priority:** P0

**GIVEN**

every required fact is verified as true

**WHEN**

`policy:trust-anchor-admission:v1` is evaluated

**THEN**

the result is:

```text
ALLOW
```

---

## AC-S001-036 — Any required fact false returns DENY

**Priority:** P0

**GIVEN**

at least one required fact is explicitly false

**WHEN**

the Admission Policy is evaluated

**THEN**

the result is:

```text
DENY
```

---

## AC-S001-037 — Missing required fact does not return ALLOW

**Priority:** P0

**GIVEN**

one required policy fact has no verified value

**WHEN**

the Admission Policy is evaluated

**THEN**

the result MUST NOT be `ALLOW`.

---

## AC-S001-038 — ERROR does not become ALLOW

**Priority:** P0

**GIVEN**

policy evaluation cannot complete reliably

**WHEN**

an error/indeterminate state occurs

**THEN**

the result MUST NOT silently become `ALLOW`.

---

## AC-S001-039 — Public policy content matches policy commitment

**Priority:** P0

**GIVEN**

a Policy identifier and `policyHash` are included in Admission state

**WHEN**

a verifier canonicalizes/hashes the corresponding published policy according to the chosen Catenor One profile

**THEN**

the resulting commitment MUST match the recorded `policyHash`.

---

# 14. Representative authority

## AC-S001-040 — Verified person without representative authority is insufficient

**Priority:** P0

**GIVEN**

```text
AUTHORIZED_REPRESENTATIVE_VERIFIED = true
```

**AND**

```text
REPRESENTATIVE_AUTHORITY_CONFIRMED = false
```

**WHEN**

Admission is evaluated

**THEN**

the result is `DENY`.

Identity verification alone does not establish authority to act for an Organization.

---

## AC-S001-041 — LLM-only representative authority is insufficient

**Priority:** P0

**GIVEN**

an LLM extracts:

```text
role = director
```

**BUT**

the result cannot be confirmed through the accepted deterministic/evidence path

**WHEN**

`REPRESENTATIVE_AUTHORITY_CONFIRMED` is derived

**THEN**

it MUST NOT be set to true solely because of the LLM output.

---

# 15. Evidence freshness

## AC-S001-042 — Fresh evidence can satisfy policy

**Priority:** P1

**GIVEN**

the required evidence timestamps/status satisfy the configured freshness rule

**WHEN**

freshness is evaluated

**THEN**

```text
EVIDENCE_FRESH = true
```

---

## AC-S001-043 — Stale evidence blocks ALLOW

**Priority:** P0

**GIVEN**

required evidence is older than the configured accepted freshness threshold or is no longer current

**WHEN**

Admission is evaluated

**THEN**

the final result MUST NOT be `ALLOW`.

---

# 16. Bootstrap Endorsement

## AC-S001-044 — ALLOW can receive a valid bootstrap endorsement

**Priority:** P0

**GIVEN**

```text
Admission Policy = ALLOW
```

**AND**

the Bootstrap Configuration is valid

**WHEN**

the Initial Trust Anchor is finalized

**THEN**

a bootstrap endorsement is created that cryptographically binds the required Admission context.

---

## AC-S001-045 — DENY cannot receive successful bootstrap endorsement

**Priority:** P0

**GIVEN**

```text
Admission Policy = DENY
```

**WHEN**

the system attempts to finalize the Initial Trust Anchor

**THEN**

no valid bootstrap endorsement authorizing admission may be created.

---

## AC-S001-046 — Invalid bootstrap endorsement blocks activation

**Priority:** P0

**GIVEN**

all Admission Policy requirements are true

**BUT**

the bootstrap endorsement is invalid, mismatched or cannot be verified

**WHEN**

activation is attempted

**THEN**

the candidate MUST NOT become an active Trust Anchor.

---

# 17. Admission Record

## AC-S001-047 — Successful Admission creates one Admission Record

**Priority:** P0

**GIVEN**

```text
Admission Policy = ALLOW
AND
bootstrap endorsement = valid
```

**WHEN**

Admission is finalized

**THEN**

one Trust Anchor Admission Record is created and associated with the candidate DID and Trust Domain.

---

## AC-S001-048 — DENY creates no successful Admission Record

**Priority:** P0

**GIVEN**

Admission Policy returns `DENY`

**WHEN**

the workflow ends

**THEN**

no successful Trust Anchor Admission Record may exist for that attempt.

A denial audit event/decision record may exist.

---

## AC-S001-049 — Admission Record contains minimized public references

**Priority:** P0

**GIVEN**

an Admission succeeds

**WHEN**

the public Admission projection is inspected

**THEN**

it may include:

```text
trustAnchor DID
Trust Domain
Admission Policy ID/version
policy commitment
Decision reference
evidence commitment
bootstrap endorsement reference/proof
createdAt
status
```

and MUST NOT expose raw private evidence.

---

# 18. Trust Anchor activation

## AC-S001-050 — Successful Admission activates the Initial Trust Anchor

**Priority:** P0

**GIVEN**

a valid Admission Record has been created

**WHEN**

the Trust Domain state is finalized

**THEN**

the candidate status for the applicable Trust Domain becomes:

```text
ACTIVE
```

---

## AC-S001-051 — Failed Admission never creates ACTIVE state

**Priority:** P0

**GIVEN**

any required P0 Admission condition fails

**WHEN**

S001 finishes

**THEN**

the candidate MUST NOT be `ACTIVE` as a Trust Anchor.

---

# 19. Idempotency

## AC-S001-052 — Retrying successful Admission does not create duplicate active roots

**Priority:** P1

**GIVEN**

the same canonical Subject is already the active Initial Trust Anchor of the Trust Domain

**WHEN**

the same Admission flow is retried

**THEN**

the system returns the existing state or an explicit equivalent such as:

```text
ALREADY_ADMITTED
```

and does not create another active root for the same canonical Subject.

---

# 20. Railway data architecture

## AC-S001-053 — PostgreSQL is private infrastructure

**Priority:** P0

**GIVEN**

Catenor One runs on Railway

**WHEN**

public/resolvable Catenor state is accessed

**THEN**

users access it through the application Resolver/API.

The PostgreSQL service MUST NOT be intentionally exposed as a public database interface.

---

## AC-S001-054 — Public and private data are logically separated

**Priority:** P0

**GIVEN**

the same Railway PostgreSQL instance supports S001

**THEN**

the implementation distinguishes:

```text
public/resolvable projection
private operational state
```

and public application responses MUST NOT accidentally include private operational columns/objects.

---

## AC-S001-055 — Provider references live in private operational state

**Priority:** P0

**GIVEN**

Sumsub applicant references are stored for the Organization/representative

**WHEN**

the database model is inspected

**THEN**

they are classified and accessed as private operational data.

---

# 21. Evidence Vault

## AC-S001-056 — Raw evidence is not stored as plaintext merely for convenience

**Priority:** P0

**GIVEN**

raw sensitive evidence exists inside the TEE

**WHEN**

evidence retention is attempted

**THEN**

the implementation MUST NOT intentionally pass the raw plaintext response to the normal API solely so it can be persisted.

---

## AC-S001-057 — Encrypted evidence package is used when safely supported

**Priority:** P1

**GIVEN**

the selected deployed CRE pattern safely supports encrypted evidence retention

**WHEN**

evidence is retained

**THEN**

the retained sensitive object is encrypted before crossing the confidential boundary and stored in the Railway private bucket.

---

## AC-S001-058 — Safe fallback if encrypted retention is not supported

**Priority:** P0

**GIVEN**

the current deployed CRE model cannot safely persist a raw encrypted evidence snapshot without exposing plaintext outside the TEE

**WHEN**

S001 is implemented

**THEN**

the implementation MUST prefer:

```text
no raw evidence snapshot
+
minimized verified facts
+
evidence commitment/reference where meaningful
+
private provider reference for authorized re-verification
```

rather than weakening confidentiality.

---

## AC-S001-059 — Evidence decryption key is not stored beside evidence

**Priority:** P1

**GIVEN**

encrypted evidence objects are retained

**THEN**

the private decryption key MUST NOT be stored:

```text
in normal PostgreSQL state
or
inside the same bucket object/package as the ciphertext
```

---

# 22. Auditability

## AC-S001-060 — Happy path creates reconstructable audit history

**Priority:** P0

**GIVEN**

Admission succeeds

**WHEN**

the audit timeline is inspected

**THEN**

the system can reconstruct at least conceptually:

```text
Subject created/resolved
assertion Verification Method created
Admission requested
key possession verified
confidential evidence verified
Policy evaluated
bootstrap endorsement created
Trust Anchor admitted
```

---

## AC-S001-061 — DENY path is auditable

**Priority:** P0

**GIVEN**

Admission fails

**WHEN**

the audit timeline is inspected

**THEN**

the system records enough non-sensitive information to explain which required condition prevented Admission.

---

## AC-S001-062 — Audit output contains no private secrets/PII

**Priority:** P0

**WHEN**

audit events are inspected through normal judge/user-visible interfaces

**THEN**

they MUST NOT expose:

```text
CRE secrets
private keys
raw provider responses
raw PII
private applicant IDs
```

---

# 23. Verify Trust Anchor

## AC-S001-063 — Active admitted Trust Anchor verifies as valid

**Priority:** P0

**GIVEN**

a candidate has successfully completed S001

**WHEN**

the Trust Anchor verification flow is executed

**THEN**

the verifier confirms:

```text
recognized Trust Domain bootstrap
DID resolves
Verification Method exists
Admission Record exists
policy commitment matches
Admission Decision = ALLOW
bootstrap endorsement is valid
Trust Anchor status = ACTIVE
required current status checks pass
```

and returns:

```text
TRUST_ANCHOR_VALID = true
```

---

## AC-S001-064 — Tampered Admission Record fails verification

**Priority:** P0

**GIVEN**

a field cryptographically/semantically bound to the Admission is modified after creation

**WHEN**

the Trust Anchor is verified

**THEN**

the verification result is:

```text
TRUST_ANCHOR_VALID = false
```

---

## AC-S001-065 — Non-active Trust Anchor fails current verification

**Priority:** P1

**GIVEN**

the Trust Anchor status is:

```text
SUSPENDED
REVOKED
DEACTIVATED
```

**WHEN**

current authority is verified

**THEN**

the result MUST NOT be `TRUST_ANCHOR_VALID = true`.

---

# 24. Live judge demo

## AC-S001-066 — Happy path can be demonstrated end-to-end

**Priority:** P0

The live judge flow must demonstrate, directly or through safely exposed technical evidence:

```text
authorized bootstrap operator
Trust Domain bootstrap configuration
canonical did:catenor
public DID Document
assertion key possession
deployed Chainlink CRE workflow
handlerInTee confidential execution
real Sumsub verification
minimized verified facts
deterministic Admission Policy = ALLOW
bootstrap endorsement
Admission Record
ACTIVE Trust Anchor
TRUST_ANCHOR_VALID = true
```

---

## AC-S001-067 — At least one meaningful live DENY path is demonstrated

**Priority:** P0

At least one live failure case must visibly end in:

```text
DENY / invalid
AND
no Admission Record authorizing the root
AND
no ACTIVE Trust Anchor
```

Recommended live path:

```text
invalid assertion-key proof
```

A second evidence/policy DENY path is strongly preferred.

---

# 25. Judge Inspector

## AC-S001-068 — S001 has a technical Judge Inspector

**Priority:** P1

A judge-facing technical view SHOULD explain the complete S001 flow separately from the simplified product UI.

It should expose only sanitized information and may include:

```text
architecture flow
current step
public DID state
verified fact names/results
Policy/version/hash
ALLOW/DENY
Admission Record projection
audit timeline
CRE deployment reference
sponsor integration artifacts
negative-path replay
```

---

## AC-S001-069 — Product UI remains simpler than Judge Inspector

**Priority:** P1

The main end-user product flow SHOULD NOT require users to understand:

```text
Vault DON
handlerInTee
policy hashes
evidence commitments
adapter boundaries
CRE runtime internals
```

Those details belong primarily in technical/judge/developer views.

---

# 26. Sponsor evidence

## AC-S001-070 — Chainlink artifacts are preserved

**Priority:** P0

The repository contains sanitized judge-verifiable Chainlink artifacts under:

```text
artifacts/chainlink/
```

covering at least:

```text
simulation
real deployment
real execution
one failure/negative path where practical
```

---

## AC-S001-071 — Sumsub integration evidence is preserved safely

**Priority:** P1

The repository/demo contains enough sanitized evidence to show that the live path used Sumsub without exposing private user/provider data.

---

## AC-S001-072 — LLM integration is truthfully represented

**Priority:** P0

If the live path uses a real LLM call, the demo/docs may state that.

If only a mock is used in a particular environment, that environment MUST be labeled as mocked.

No mock may be represented as a real sponsor/provider integration.

---

# 27. AI / provenance

## AC-S001-073 — AI-assisted implementation is documented

**Priority:** P0

When ChatGPT, Claude Code, sponsor agents/skills or similar tools materially assist S001:

```text
AI_USAGE
PROVENANCE
BUILD_LOG
prompt/plan artifacts
```

are updated according to project rules.

---

## AC-S001-074 — Sponsor APIs are not implemented from stale model memory when official tooling is available

**Priority:** P0

**GIVEN**

an official current sponsor agent/skill/documentation integration is available

**WHEN**

Chainlink CRE, Privy, Arc or another sponsor-specific adapter is implemented

**THEN**

the implementation process uses that current source before sponsor-specific code is written.

For S001:

```text
Chainlink CRE → required
Privy → required before deciding assertion-key adapter
Arc → not applicable
```

---

# 28. Security regression criteria

The slice automatically fails acceptance if any of the following are observed:

```text
PII-derived did:catenor
private signing key in PostgreSQL
raw CRE secret in Git
raw provider secret in logs
raw confidential Sumsub response emitted publicly
LLM directly authorizes Trust Anchor Admission
bootstrap email alone creates Trust Anchor
self-signed "I am trusted" creates Trust Anchor
DENY creates ACTIVE status
invalid key proof creates ACTIVE status
policy ERROR becomes ALLOW
financial execution key reused as assertion key
```

---

# 29. Minimum P0 demo matrix

The following cases must exist before S001 is considered complete:

| Case | Expected result |
|---|---|
| Authorized operator + all evidence valid | `ALLOW`, endorsed, `ACTIVE` |
| Unauthorized bootstrap email | blocked before Admission |
| Invalid assertion-key proof | `DENY`, no active Trust Anchor |
| Required policy fact false | `DENY`, no active Trust Anchor |
| Missing required fact | non-ALLOW |
| Sumsub/CRE required verification unavailable | non-ALLOW |
| Invalid bootstrap endorsement | no activation |
| Tampered Admission state | `TRUST_ANCHOR_VALID = false` |
| Happy-path Trust Anchor verification | `TRUST_ANCHOR_VALID = true` |

---

# 30. Definition of Done

S001 is DONE only when all applicable P0 criteria pass and evidence exists for the live hackathon path.

In particular:

```text
SPEC approved
ACCEPTANCE approved
TEST-VECTORS approved
PLAN approved
TASKS approved

domain tests pass
application tests pass
negative-path tests pass

CRE simulation passes
CRE Confidential Workflow is deployed for real
live TEE execution is evidenced
real Sumsub call is evidenced

happy path succeeds
required DENY path succeeds

public/private boundaries are preserved
audit history exists
judge artifacts exist
AI/provenance records are current
```

Compilation, a successful HTTP `200`, or a polished UI alone does not satisfy S001.

---

# 31. Final acceptance statement

> **A Trust Anchor is accepted because the verifier can reconstruct why it was admitted under an explicitly bootstrapped Trust Domain — not because the application simply labels it trusted.**
