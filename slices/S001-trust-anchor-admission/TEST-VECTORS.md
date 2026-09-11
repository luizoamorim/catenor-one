# S001 — Trust Anchor Admission
## Test Vectors

**Project:** Catenor One  
**Protocol baseline:** Catenor Protocol Draft v0.1  
**Slice:** `S001-trust-anchor-admission`  
**Status:** Draft for human approval — Rev 2 amendments applied (2026-09-10, T0.9)

> **Rev 2:** retired vectors keep their IDs as `RETIRED` (never reused): TV-S001-E08, E09, E10, F12. TV-S001-I05 is not applicable to S001 (COMMITMENT_ONLY). New vectors: TV-S001-E11 (provider-binding mismatch), TV-S001-G06 and TV-S001-J07 (Verification Method key replacement under the same ID).

> **Rev 2.3 (maintainer decision Q4, `PLAN.md` D31):** evidence profiles (SPEC §12.3). Live vectors run under the preferred Full Sumsub Sandbox Profile or, only while Sumsub Company/KYB entitlement is unavailable, the Hybrid Demo Profile (company evidence SYNTHETIC MOCK, representative verification REAL Sumsub sandbox). New vectors: TV-S001-B04 (evidence-source mismatch), TV-S001-L04 (Hybrid Demo Profile labeling).

---

# 1. Purpose

This document defines concrete, reproducible test vectors for S001.

Each vector specifies:

```text
preconditions
input
expected verified facts
expected policy result
expected side effects
expected public/private artifacts
```

The vectors are designed to be implementation-independent.

Exact API routes, database table names, crypto profile, and sponsor SDK calls belong in `PLAN.md`.

---

# 2. Test identities and constants

Unless a vector overrides them, use the following fixture values.

## Trust Domain

```text
TRUST_DOMAIN_ID
= trust-domain:catenor-one-demo
```

## Admission Policy

```text
POLICY_ID
= policy:trust-anchor-admission:v1
```

Conceptual policy content:

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
```

The exact canonical serialization and resulting `policyHash` are implementation decisions.

Fixtures may use:

```text
POLICY_HASH
= 0xpolicyhash_demo_v1
```

until PLAN freezes the hashing profile.

---

# 3. Bootstrap operator fixtures

```text
AUTHORIZED_OPERATOR_EMAIL
= bootstrap.owner@example.com

SECOND_AUTHORIZED_OPERATOR_EMAIL
= bootstrap.reviewer@example.com

UNAUTHORIZED_OPERATOR_EMAIL
= outsider@example.com
```

Environment fixture:

```text
ALLOWED_BOOTSTRAP_EMAILS=
bootstrap.owner@example.com,bootstrap.reviewer@example.com
```

---

# 4. Candidate fixtures

## Candidate Organization

```text
displayName
= Organization A

subjectType
= ORGANIZATION
```

Example canonical DID fixture:

```text
CANDIDATE_DID
= did:catenor:8f0c92d7e5f04e40a41faee32e5e180b
```

This value is fixture-only.

The implementation MUST generate the actual identifier using the selected cryptographically secure random profile.

---

# 5. Sumsub fixtures

Private provider references:

```text
COMPANY_APPLICANT_ID
= sumsub_company_fixture_001

REPRESENTATIVE_APPLICANT_ID
= sumsub_person_fixture_001
```

These values are PRIVATE application fixtures.

They MUST NOT appear in public DID state or normal public logs.

Catenor-issued provider binding references (fixture values; the implementation generates opaque random values in the charset confirmed against the Sumsub sandbox):

```text
COMPANY_BINDING_REF
= catenor-binding-fixture-company-001

REPRESENTATIVE_BINDING_REF
= catenor-binding-fixture-representative-001
```

Expected binding for the happy path:

```text
company applicant externalUserId        = COMPANY_BINDING_REF
representative applicant externalUserId = REPRESENTATIVE_BINDING_REF
```

bindingRefs are PRIVATE operational state and follow the same exposure rules as applicant IDs.

Live vectors use the **Sumsub sandbox** with synthetic Organization / representative data. Under the Hybrid Demo Profile (SPEC §12.3) the company reference is the SYNTHETIC MOCK fixture reference instead of a Sumsub applicant:

```text
COMPANY_APPLICANT_ID (Hybrid Demo Profile)
= mock:company-fixture:MOCK_COMPANY_ACTIVE_GREEN
```

The representative reference is always a real Sumsub sandbox applicant in live vectors.

---

# 6. Assertion-key fixtures

Conceptual verification method:

```text
VERIFICATION_METHOD_ID
= did:catenor:8f0c92d7e5f04e40a41faee32e5e180b#assertion-key-1
```

Example public key fixture:

```text
PUBLIC_KEY
= z6MkFixtureAssertionPublicKey001
```

Example signer reference:

```text
SIGNER_REF
= signer:fixture:assertion-key-1
```

`SIGNER_REF` is private operational metadata.

Verification Method commitment bound by the bootstrap endorsement [REF-IMPL]:

```text
VERIFICATION_METHOD_COMMITMENT
= SHA-256(JCS({
    "id": "did:catenor:8f0c92d7e5f04e40a41faee32e5e180b#assertion-key-1",
    "controller": "did:catenor:8f0c92d7e5f04e40a41faee32e5e180b",
    "type": "Multikey",
    "publicKeyMultibase": "z6MkFixtureAssertionPublicKey001"
  }))
```

The concrete hex value is produced by the golden-vector generator once PLAN freezes the encoding.

Private key material MUST NOT be stored in these vectors or committed to the repository.

---

# 7. Challenge fixtures

Valid conceptual challenge:

```json
{
  "challengeId": "challenge:admission:001",
  "subject": "did:catenor:8f0c92d7e5f04e40a41faee32e5e180b",
  "operation": "ADMIT_TRUST_ANCHOR",
  "trustDomain": "trust-domain:catenor-one-demo",
  "nonce": "opaque-random-nonce-001",
  "issuedAt": "2026-09-09T22:00:00Z",
  "expiresAt": "2026-09-09T22:05:00Z"
}
```

Exact signed payload canonicalization is a PLAN decision.

---

# 8. Verified-facts fixture

Canonical happy-path fact set:

```json
{
  "ORGANIZATION_KYB_VERIFIED": true,
  "ORGANIZATION_STATUS_VALID": true,
  "ORGANIZATION_AML_CLEAR": true,
  "AUTHORIZED_REPRESENTATIVE_VERIFIED": true,
  "REPRESENTATIVE_AUTHORITY_CONFIRMED": true,
  "ASSERTION_KEY_POSSESSION_VALID": true,
  "ASSERTION_KEY_PURPOSE_VALID": true,
  "EVIDENCE_FRESH": true
}
```

---

# 9. Test-vector classification

Vectors are grouped into:

```text
A. Bootstrap Access
B. Bootstrap Configuration
C. Canonical Identity
D. Assertion Key / Proof of Possession
E. Chainlink CRE (identity-confidential) + Sumsub
F. Admission Policy
G. Bootstrap Endorsement
H. Admission Record / Activation
I. Storage / Privacy
J. Trust Anchor Verification
K. Idempotency / Lifecycle
L. Live Hackathon Integration
```

---

# A. Bootstrap Access

## TV-S001-A01 — Authorized bootstrap operator

**Purpose:** Confirm that an allowed operator may start S001.

### Input

```text
operatorEmail = bootstrap.owner@example.com
Initial Trust Anchor exists = false
```

### Expected

```text
bootstrapAccessAllowed = true
Admission session may be created
Trust Anchor eligibility remains unevaluated
```

### Must NOT happen

```text
Trust Anchor becomes ACTIVE
Admission Policy auto-ALLOW
```

---

## TV-S001-A02 — Unauthorized bootstrap operator

### Input

```text
operatorEmail = outsider@example.com
Initial Trust Anchor exists = false
```

### Expected

```text
bootstrapAccessAllowed = false
Admission flow does not start
```

### Expected side effects

```text
no Admission Record
no bootstrap endorsement
no active Trust Anchor
```

---

## TV-S001-A03 — Authorized email with invalid evidence

### Input

```text
operatorEmail = bootstrap.owner@example.com

verified facts:
ORGANIZATION_AML_CLEAR = false
all other required facts = true
```

### Expected

```text
bootstrapAccessAllowed = true
Admission Policy = DENY
Trust Anchor status != ACTIVE
```

This proves:

```text
bootstrap access != Trust Anchor eligibility
```

---

# B. Bootstrap Configuration

## TV-S001-B01 — Valid Bootstrap Configuration

### Input

```json
{
  "trustDomain": "trust-domain:catenor-one-demo",
  "admissionPolicy": "policy:trust-anchor-admission:v1",
  "policyHash": "0xpolicyhash_demo_v1",
  "bootstrapVerificationMethod": "bootstrap-verification-method:1"
}
```

### Expected

```text
configurationAccepted = true
```

---

## TV-S001-B02 — Runtime policy hash mismatch

### Input

```text
bootstrap.policyHash = 0xpolicyhash_demo_v1
runtime canonical policy hash = 0xdifferent_hash
```

### Expected

```text
Admission MUST NOT finalize
Policy result MUST NOT become authoritative ALLOW
no active Trust Anchor
```

---

## TV-S001-B03 — Candidate self-signs "I am a Trust Anchor"

### Input

```text
candidate self-signed assertion = valid cryptographic signature
Admission Decision = missing
bootstrap endorsement = missing
```

### Expected

```text
Trust Anchor activation = rejected
```

Reason:

```text
self-signature proves key control
not initial trust
```

---

## TV-S001-B04 — Evidence-source mismatch

*(Added in Rev 2.3, maintainer decision Q4.)*

### Input

```text
pinned Bootstrap Configuration: evidence profile = HYBRID_DEMO, company source = SYNTHETIC_MOCK
case 1: workflow config company evidence source = REAL_SUMSUB_SANDBOX
case 2: confidential result reports evidence profile / company source different from the pinned configuration
```

### Expected

```text
case 1: confidential execution ends in ERROR; no facts
case 2: the API rejects the result; no facts
no ALLOW, no bootstrap endorsement, no ACTIVE status
```

---

# C. Canonical Identity

## TV-S001-C01 — Create opaque canonical Organization DID

### Input

```text
subjectType = ORGANIZATION
legalName = Organization A
companyApplicantId = sumsub_company_fixture_001
representativeApplicantId = sumsub_person_fixture_001
```

### Expected

```text
did starts with did:catenor:
identifier is opaque/high entropy
subjectType = ORGANIZATION
```

### Must NOT be true

```text
did contains "Organization A"
did contains applicant IDs
did contains operator email
```

---

## TV-S001-C02 — Same legal name does not determine DID

### Input

Create two independent test candidates with:

```text
legalName = Organization A
```

### Expected

```text
DID_1 != DID_2
```

unless the application intentionally resolves both records as the same already-known canonical Subject through an explicit identity resolution mechanism.

The legal name alone MUST NOT determine the DID.

---

## TV-S001-C03 — Public DID Document is minimized

### Expected public fixture

```json
{
  "id": "did:catenor:8f0c92d7e5f04e40a41faee32e5e180b",
  "verificationMethod": [
    {
      "id": "did:catenor:8f0c92d7e5f04e40a41faee32e5e180b#assertion-key-1",
      "controller": "did:catenor:8f0c92d7e5f04e40a41faee32e5e180b",
      "type": "Multikey",
      "publicKeyMultibase": "z6MkFixtureAssertionPublicKey001"
    }
  ],
  "assertionMethod": [
    "did:catenor:8f0c92d7e5f04e40a41faee32e5e180b#assertion-key-1"
  ]
}
```

### Must NOT contain

```text
sumsub_company_fixture_001
sumsub_person_fixture_001
email
PII
private key
financial Account Binding
```

---

# D. Assertion Key / Proof of Possession

## TV-S001-D01 — Valid assertion-key proof

### Preconditions

```text
challenge is fresh
challenge has not been consumed
challenge is bound to CANDIDATE_DID
challenge operation = ADMIT_TRUST_ANCHOR
signature made by assertion-key-1
```

### Expected

```text
ASSERTION_KEY_POSSESSION_VALID = true
```

---

## TV-S001-D02 — Wrong key signs challenge

### Input

```text
challenge = valid
signature = produced by unrelated key
```

### Expected

```text
ASSERTION_KEY_POSSESSION_VALID = false
Admission Policy = DENY
no bootstrap endorsement
no active Trust Anchor
```

---

## TV-S001-D03 — Expired challenge

### Input

```text
challenge.expiresAt = 2026-09-09T22:05:00Z
verification time = 2026-09-09T22:06:00Z
signature = otherwise cryptographically valid
```

### Expected

```text
ASSERTION_KEY_POSSESSION_VALID = false
```

---

## TV-S001-D04 — Challenge replay

### Sequence

```text
1. challenge:admission:001 verified successfully
2. challenge marked consumed
3. identical signed challenge submitted again
```

### Expected first request

```text
valid
```

### Expected second request

```text
rejected
ASSERTION_KEY_POSSESSION_VALID != true for second attempt
```

---

## TV-S001-D05 — Challenge belongs to another DID

### Input

```text
challenge.subject = did:catenor:A
verification requested for did:catenor:B
signature otherwise valid
```

### Expected

```text
verification = false
Admission cannot ALLOW
```

---

## TV-S001-D06 — Verification Method not authorized for assertion

### Input

DID Document contains key:

```text
did:catenor:...#authentication-key-1
```

but it is not listed in `assertionMethod`.

The challenge is signed by that key.

### Expected

```text
ASSERTION_KEY_PURPOSE_VALID = false
Admission Policy = DENY
```

---

# E. Chainlink CRE (identity-confidential) + Sumsub

All E vectors exercise the `trust-anchor-admission` operation of the `identity-confidential` workflow. Provider HTTPS requests are executed from inside `handlerInTee` (CRE `HTTPClient` with `TeeRuntime`).

## TV-S001-E01 — CRE simulation happy path

**Environment:** local/simulation

### Inputs

Mock provider fixtures (labeled MOCK) return:

```text
company applicant externalUserId = COMPANY_BINDING_REF
representative applicant externalUserId = REPRESENTATIVE_BINDING_REF
company KYB = verified
company status = valid
AML = clear
representative KYC = verified
authority evidence = valid
evidence freshness = valid
```

### Expected

Inside the workflow:

```text
handlerInTee executes (operation trust-anchor-admission)
secrets are resolved through the configured secret mechanism (one batched call)
sealed private context is opened inside the TEE
HTTPS requests execute from inside handlerInTee (mock provider endpoint)
provider-binding check passes
minimal result is produced
```

### Expected minimized output

```json
{
  "ORGANIZATION_KYB_VERIFIED": true,
  "ORGANIZATION_STATUS_VALID": true,
  "ORGANIZATION_AML_CLEAR": true,
  "AUTHORIZED_REPRESENTATIVE_VERIFIED": true,
  "REPRESENTATIVE_AUTHORITY_CONFIRMED": true,
  "EVIDENCE_FRESH": true,
  "evidenceCommitment": "0xevidence_demo_001"
}
```

---

## TV-S001-E02 — CRE simulation DENY path

**Environment:** local/simulation

### Input change

```text
AML = not clear
```

### Expected minimized result

```text
ORGANIZATION_AML_CLEAR = false
```

### Expected policy result

```text
DENY
```

---

## TV-S001-E03 — Real deployed CRE happy path

**Environment:** deployed hackathon path

### Preconditions

```text
real CRE Confidential Workflow identity-confidential deployed (private registry)
Vault DON contains the 3 required secrets
real Sumsub sandbox representative applicant reference attached, bound to its Catenor bindingRef
company reference per evidence profile: real Sumsub sandbox applicant (Full Sumsub Sandbox Profile) or the
  SYNTHETIC MOCK fixture reference (Hybrid Demo Profile), as pinned in the Bootstrap Configuration
```

### Expected

```text
real TEE handler execution (trust-anchor-admission)
real Sumsub sandbox HTTPS calls executed from inside the TEE (representative; company too under the Full profile)
provider-binding check passes
sanitized live execution artifact preserved (labeled "Sumsub sandbox")
minimal result returned
```

A mock response MUST NOT satisfy the representative leg of this vector. Under the Hybrid Demo Profile the company leg is the SYNTHETIC MOCK fixture and the artifact MUST state "Company evidence: SYNTHETIC MOCK" and "Representative verification: REAL SUMSUB SANDBOX" (TV-S001-L04).

---

## TV-S001-E04 — Sumsub authentication failure

### Input

One of:

```text
invalid SUMSUB_APP_TOKEN
invalid SUMSUB_SECRET_KEY
invalid generated provider signature
```

### Expected

```text
required provider evidence cannot be verified
workflow result is non-ALLOW
no verified facts are fabricated
```

---

## TV-S001-E05 — Sumsub required evidence unavailable

### Input

Provider request:

```text
timeout
5xx
unavailable
unexpected unavailable status
```

### Expected

```text
Admission MUST NOT ALLOW
```

Possible result:

```text
ERROR
INDETERMINATE
DENY
```

depending on implementation profile.

It must never become `ALLOW`.

---

## TV-S001-E06 — Raw Sumsub response is not emitted

### Input

Mock/live provider response contains synthetic sensitive fields:

```json
{
  "applicantId": "sumsub_company_fixture_001",
  "legalName": "Organization A",
  "sensitiveDocumentNumber": "PRIVATE_FIXTURE_123",
  "reviewResult": "GREEN"
}
```

### Expected normal workflow output

MAY contain:

```text
ORGANIZATION_KYB_VERIFIED = true
evidenceCommitment
```

MUST NOT contain:

```text
PRIVATE_FIXTURE_123
raw full provider response
```

---

## TV-S001-E07 — S001 CRE secret names are present

### Expected configured persistent secret names (exactly 3)

```text
SUMSUB_APP_TOKEN
SUMSUB_SECRET_KEY
CATENOR_INTERNAL_API_TOKEN
```

### Expected

```text
secret values never committed to Git
secret values never written to judge artifacts
secret values never printed in normal logs
```

---

## TV-S001-E08 — RETIRED

**Status:** RETIRED (Rev 2). The component it exercised was removed from S001; ID reserved and never reused.

---

## TV-S001-E09 — RETIRED

**Status:** RETIRED (Rev 2). ID reserved. That authority is never set true without deterministic provider evidence is covered by TV-S001-F06.

---

## TV-S001-E10 — RETIRED

**Status:** RETIRED (Rev 2). The component it exercised was removed from S001; ID reserved and never reused.

---

## TV-S001-E11 — Provider-binding mismatch

**Environment:** unit + CRE simulation (+ live where practical)

### Preconditions

```text
Catenor issued COMPANY_BINDING_REF and REPRESENTATIVE_BINDING_REF
company and representative applicant references attached to the Admission session
key possession valid
```

### Input

One of:

```text
company applicant externalUserId        = some-other-reference
representative applicant externalUserId = some-other-reference
applicant has no externalUserId
```

### Expected

```text
provider-binding check fails inside handlerInTee before fact derivation
no Admission facts are established by the confidential run
run result = ERROR (e.g. PROVIDER_BINDING_MISMATCH)
Admission MUST NOT ALLOW
no bootstrap endorsement, no successful Admission Record, status != ACTIVE
```

### Must NOT happen

```text
any of the six evidence facts returned as true
applicant IDs or bindingRefs appearing in logs, callback errors, audit details or judge views
```

---

# F. Admission Policy

## TV-S001-F01 — All facts true

### Input

Use canonical happy-path verified-facts fixture.

### Expected

```text
decision = ALLOW
```

---

## TV-S001-F02 — Organization KYB false

### Input override

```text
ORGANIZATION_KYB_VERIFIED = false
```

### Expected

```text
decision = DENY
```

---

## TV-S001-F03 — Organization status invalid

### Input override

```text
ORGANIZATION_STATUS_VALID = false
```

### Expected

```text
decision = DENY
```

---

## TV-S001-F04 — AML not clear

### Input override

```text
ORGANIZATION_AML_CLEAR = false
```

### Expected

```text
decision = DENY
```

---

## TV-S001-F05 — Representative identity unverified

### Input override

```text
AUTHORIZED_REPRESENTATIVE_VERIFIED = false
```

### Expected

```text
decision = DENY
```

---

## TV-S001-F06 — Representative identity verified but authority not confirmed

### Input

```text
AUTHORIZED_REPRESENTATIVE_VERIFIED = true
REPRESENTATIVE_AUTHORITY_CONFIRMED = false
```

### Expected

```text
decision = DENY
```

This vector proves:

```text
identity != authority
```

---

## TV-S001-F07 — Assertion key possession invalid

### Input

```text
ASSERTION_KEY_POSSESSION_VALID = false
```

### Expected

```text
decision = DENY
```

---

## TV-S001-F08 — Wrong key purpose

### Input

```text
ASSERTION_KEY_PURPOSE_VALID = false
```

### Expected

```text
decision = DENY
```

---

## TV-S001-F09 — Evidence stale

### Input

```text
EVIDENCE_FRESH = false
```

### Expected

```text
decision = DENY
```

---

## TV-S001-F10 — Required fact missing

### Input

Remove:

```text
ORGANIZATION_AML_CLEAR
```

from policy input.

### Expected

```text
decision != ALLOW
```

Recommended:

```text
DENY
or
INDETERMINATE
```

according to chosen implementation profile.

---

## TV-S001-F11 — Extra unknown fact does not bypass policy

### Input

Happy facts except:

```text
ORGANIZATION_AML_CLEAR = false
```

plus:

```text
SUPER_TRUSTED_BY_UI = true
```

### Expected

```text
decision = DENY
```

Unknown/untrusted fields cannot override required facts.

---

## TV-S001-F12 — RETIRED

**Status:** RETIRED (Rev 2). ID reserved and never reused. That an untrusted, non-policy input cannot override a false required fact is covered by TV-S001-F11.

---

# G. Bootstrap Endorsement

## TV-S001-G01 — Valid ALLOW is endorsed

### Preconditions

```text
Admission Policy = ALLOW
Bootstrap Configuration = valid
candidate DID = expected DID
verificationMethodCommitment = VERIFICATION_METHOD_COMMITMENT
policy hash = expected hash
evidence commitment = expected commitment
endorsement requested by an authorized bootstrap operator
signed by the bootstrap signing authority (not the candidate's assertion key)
```

### Expected

```text
bootstrapEndorsement = created
bootstrapEndorsement verifies = true
```

---

## TV-S001-G02 — DENY cannot be endorsed as successful admission

### Input

```text
Admission Policy = DENY
```

### Expected

```text
no successful bootstrap endorsement
no active Trust Anchor
```

---

## TV-S001-G03 — Endorsement candidate DID mismatch

### Input

Endorsement was created for:

```text
did:catenor:A
```

Activation requested for:

```text
did:catenor:B
```

### Expected

```text
endorsement verification = false
activation rejected
```

---

## TV-S001-G04 — Endorsement policy hash mismatch

### Input

```text
endorsement.policyHash = 0xpolicyhash_demo_v1
runtime Admission Record policyHash = 0xaltered
```

### Expected

```text
endorsement verification = false
activation rejected
```

---

## TV-S001-G05 — Invalid bootstrap signature

### Input

```text
endorsement signature produced by unauthorized key
```

### Expected

```text
bootstrapEndorsementValid = false
activation rejected
```

---

## TV-S001-G06 — Verification Method key replaced before activation

### Input

Endorsement binds:

```text
verificationMethodCommitment = VERIFICATION_METHOD_COMMITMENT   (publicKeyMultibase = z6MkFixtureAssertionPublicKey001)
```

Before activation, the DID Document's `#assertion-key-1` is changed to:

```text
publicKeyMultibase = z6MkFixtureReplacementKey999   (same Verification Method id)
```

### Expected

```text
recomputed verificationMethodCommitment != endorsed value
endorsement verification = false
activation rejected
```

---

# H. Admission Record / Activation

## TV-S001-H01 — Successful Admission Record

### Preconditions

```text
policy decision = ALLOW
bootstrap endorsement = valid
```

### Expected conceptual record

```json
{
  "type": "CatenorTrustAnchorAdmissionRecord",
  "trustDomain": "trust-domain:catenor-one-demo",
  "trustAnchor": "did:catenor:8f0c92d7e5f04e40a41faee32e5e180b",
  "admissionPolicy": "policy:trust-anchor-admission:v1",
  "policyHash": "0xpolicyhash_demo_v1",
  "decision": "ADMIT_TRUST_ANCHOR",
  "verificationMethod": "did:catenor:8f0c92d7e5f04e40a41faee32e5e180b#assertion-key-1",
  "evidenceCommitment": "0xevidence_demo_001",
  "decisionRef": "decision:admission:001",
  "bootstrapEndorsementRef": "endorsement:bootstrap:001"
}
```

### Expected state

```text
Trust Anchor status = ACTIVE
```

---

## TV-S001-H02 — DENY creates no successful Admission Record

### Preconditions

```text
policy decision = DENY
```

### Expected

```text
no successful Trust Anchor Admission Record
Trust Anchor status != ACTIVE
```

A denial Decision/audit record may exist.

---

## TV-S001-H03 — ALLOW without bootstrap endorsement

### Input

```text
policy decision = ALLOW
bootstrap endorsement = missing
```

### Expected

```text
Trust Anchor status != ACTIVE
```

---

# I. Storage / Privacy

## TV-S001-I01 — Private provider refs stay private

### Private DB fixture may contain

```text
sumsub_company_fixture_001
sumsub_person_fixture_001
```

### Public resolver responses MUST NOT contain them.

Expected grep/assertion conceptually:

```text
public_output contains COMPANY_APPLICANT_ID = false
public_output contains REPRESENTATIVE_APPLICANT_ID = false
public_output contains COMPANY_BINDING_REF = false
public_output contains REPRESENTATIVE_BINDING_REF = false
```

"public output" includes public API projections, DID Documents and Judge Inspector responses.

---

## TV-S001-I02 — Public projection is API-exposed, not public PostgreSQL

### Expected architecture condition

```text
Railway PostgreSQL endpoint/database is application infrastructure
public DID resolution occurs through Catenor Resolver/API
```

This is validated through deployment/config review rather than a pure unit test.

---

## TV-S001-I03 — Raw evidence plaintext must not be persisted by normal API

### Input

Synthetic raw confidential value:

```text
RAW_SECRET_DOCUMENT_VALUE_001
```

### Expected

After successful Admission:

```text
normal PostgreSQL textual columns do not contain RAW_SECRET_DOCUMENT_VALUE_001
normal application logs do not contain RAW_SECRET_DOCUMENT_VALUE_001
TEE → API callback payload does not contain RAW_SECRET_DOCUMENT_VALUE_001
```

S001 retains no evidence objects (COMMITMENT_ONLY); no bucket object is written.

---

## TV-S001-I04 — COMMITMENT_ONLY evidence retention

### Preconditions

```text
S001 uses COMMITMENT_ONLY retention by design
confidential verification completed
```

### Expected

```text
raw provider response / evidence snapshot is NOT persisted anywhere by Catenor
no bucket object is written
```

Persisted (private PostgreSQL only):

```text
minimized facts
evidence commitment
normalized commitment preimage + provider-response digests (no raw content)
private Sumsub provider refs + bindingRefs
CRE execution reference
```

Commitment check:

```text
recompute(evidenceCommitment) from the retained normalized preimage + digests = stored evidenceCommitment
```

The commitment binds the Admission to what was observed during confidential execution; it does not preserve or reconstruct the raw provider evidence.

---

## TV-S001-I05 — NOT APPLICABLE TO S001

**Status:** Not applicable to S001 (Rev 2). No encrypted evidence objects and no evidence decryption key exist (COMMITMENT_ONLY). Verified by deployment/config review that none exist. Reserved for a later slice that retains encrypted evidence.

---

## TV-S001-I06 — Private signing key is absent from DB and repo

### Search scope

```text
repository
Railway database fixture
application logs
artifacts/
```

### Expected

```text
no private assertion-key material
```

---

# J. Trust Anchor Verification

## TV-S001-J01 — Happy-path Trust Anchor verification

### Preconditions

```text
DID resolves
Verification Method valid and matches the endorsed verificationMethodCommitment
Admission Record valid
policy hash matches
Decision = ALLOW
bootstrap endorsement valid
status = ACTIVE   (operational status projection)
```

### Expected

```text
TRUST_ANCHOR_VALID = true
```

The result distinguishes cryptographically verified checks (Admission provenance, bootstrap endorsement) from lifecycle status read from the operational status projection.

---

## TV-S001-J02 — Tampered evidence commitment

### Input

Stored Admission Record originally:

```text
evidenceCommitment = 0xevidence_demo_001
```

Tampered:

```text
evidenceCommitment = 0xtampered
```

### Expected

```text
TRUST_ANCHOR_VALID = false
```

where the selected proof/record binding makes the tampering detectable.

---

## TV-S001-J03 — Tampered policy reference/hash

### Input

Admission Record policy hash changed after admission.

### Expected

```text
TRUST_ANCHOR_VALID = false
```

---

## TV-S001-J04 — Missing bootstrap endorsement

### Expected

```text
TRUST_ANCHOR_VALID = false
```

for the Initial Trust Anchor profile.

---

## TV-S001-J05 — Suspended Trust Anchor

### Input

```text
status = SUSPENDED
```

### Expected

```text
current TRUST_ANCHOR_VALID != true
```

---

## TV-S001-J06 — Revoked/deactivated Trust Anchor

### Input

```text
status = REVOKED
```

or:

```text
status = DEACTIVATED
```

### Expected

```text
current TRUST_ANCHOR_VALID = false
```

In S001 the lifecycle status is an operational projection (status changes only through the test harness); J05/J06 verify that a non-ACTIVE projection is never reported as valid.

---

## TV-S001-J07 — Verification Method key replaced after admission

### Preconditions

```text
Trust Anchor admitted with verificationMethodCommitment = VERIFICATION_METHOD_COMMITMENT
```

### Input

After admission, the resolved DID Document's `#assertion-key-1` keeps its id but carries:

```text
publicKeyMultibase = z6MkFixtureReplacementKey999
```

### Expected

```text
recomputed verificationMethodCommitment != endorsed value
TRUST_ANCHOR_VALID = false
```

---

# K. Idempotency / Lifecycle

## TV-S001-K01 — Retry after successful admission

### Preconditions

Candidate already:

```text
did = CANDIDATE_DID
Trust Anchor status = ACTIVE
```

### Input

Same canonical Subject requests Initial Trust Anchor Admission again.

### Expected

One of:

```text
return existing active Admission state
or
ALREADY_ADMITTED
```

### Must NOT happen

```text
new active root for same Subject
new accidental canonical DID
```

---

## TV-S001-K02 — Retry failed admission

### Preconditions

Previous Admission attempt:

```text
decision = DENY
Trust Anchor status != ACTIVE
```

### Input

Candidate retries with corrected evidence.

### Expected

A new Admission attempt/session MAY be created.

The failed historical attempt remains auditable.

If all current requirements now pass:

```text
new attempt may ALLOW
```

---

# L. Live Hackathon Integration

## TV-S001-L01 — Live end-to-end happy path

**Priority:** mandatory

### Preconditions

```text
authorized bootstrap operator
valid Bootstrap Configuration
Sumsub sandbox applicants created with the Catenor bindingRefs as externalUserId
  (Hybrid Demo Profile: representative applicant only; company = SYNTHETIC MOCK fixture reference)
evidence profile pinned in the Bootstrap Configuration (FULL_SUMSUB_SANDBOX preferred, or HYBRID_DEMO)
deployed CRE Confidential Workflow identity-confidential (private registry)
valid Vault DON secrets (3)
working assertion signer
valid required evidence
```

### Sequence

```text
1. operator authenticates
2. bootstrap access accepted
3. candidate Organization created/resolved
4. did:catenor generated and private provider bindingRefs issued
5. operator attaches the Sumsub sandbox applicant references (Hybrid Demo Profile: REAL representative + SYNTHETIC MOCK company reference)
6. assertion key provisioned
7. DID Document resolves
8. key-possession challenge succeeds
9. deployed identity-confidential workflow executes the trust-anchor-admission operation
10. handlerInTee fetches secrets and opens the sealed private context
11. provider-binding check passes; real Sumsub sandbox HTTPS calls from inside the TEE succeed (representative always; company per evidence profile)
12. minimized facts + evidence commitment returned
13. policy evaluates ALLOW
14. bootstrap endorsement verifies
15. Admission Record created
16. Trust Anchor becomes ACTIVE
17. verifier returns TRUST_ANCHOR_VALID = true
18. sanitized audit timeline is visible
```

### Required artifacts

```text
CRE deployment reference
live execution evidence
sanitized provider integration evidence (labeled "Sumsub sandbox")
evidence-profile labels (Hybrid Demo Profile): "Company evidence: SYNTHETIC MOCK", "Representative verification: REAL SUMSUB SANDBOX"
Admission Decision
Admission Record
DID Document
audit timeline
```

---

## TV-S001-L02 — Live invalid key DENY

**Priority:** mandatory recommended demo failure

### Preconditions

Real/live infrastructure available.

### Input

Use an invalid/wrong assertion-key signature.

### Expected

```text
ASSERTION_KEY_POSSESSION_VALID = false
Policy = DENY
no bootstrap endorsement
no successful Admission Record
status != ACTIVE
```

The failure should be visible in the Judge Inspector without exposing secrets.

---

## TV-S001-L03 — Live evidence/policy DENY

**Priority:** strongly preferred

### Input

Use a controlled non-production/test case that produces at least one false required Admission fact.

Example:

```text
ORGANIZATION_AML_CLEAR = false
```

or another safe test fixture supported by the provider/demo environment (Sumsub sandbox). Confirmed feasible with REAL Sumsub sandbox evidence (T0.8):

```text
representative applicant forced RED (reviewRejectType FINAL, reason code SANCTIONS)
→ AUTHORIZED_REPRESENTATIVE_VERIFIED = false
→ REPRESENTATIVE_AUTHORITY_CONFIRMED = false
```

### Expected

```text
Policy = DENY
no active Trust Anchor
```

If the external provider environment cannot safely produce this condition, the project may demonstrate the deterministic negative path through a controlled fixture, provided it is clearly labeled and the live happy path remains real.

---

## TV-S001-L04 — Hybrid Demo Profile is truthfully labeled

**Priority:** mandatory when the Hybrid Demo Profile is used

*(Added in Rev 2.3, maintainer decision Q4.)*

### Preconditions

```text
live path executed under the Hybrid Demo Profile
```

### Expected

```text
the pinned Bootstrap Configuration shows evidence profile HYBRID_DEMO, company source SYNTHETIC_MOCK,
  representative source REAL_SUMSUB_SANDBOX, and its hash is the one bound by the bootstrap endorsement
the Judge Inspector, artifacts and README visibly show:
  "Company evidence: SYNTHETIC MOCK"
  "Representative verification: REAL SUMSUB SANDBOX"
a scan of README, artifacts, Judge Inspector text and submission text finds no
  "Sumsub verified the organization" and no "real Sumsub KYB end-to-end"
```

---

# 10. Test artifact naming

Suggested artifact layout:

```text
artifacts/
├── chainlink/
│   └── s001/
│       ├── simulation-happy.txt
│       ├── simulation-deny.txt
│       ├── deployment.txt
│       ├── live-happy.txt
│       └── live-deny.txt
│
├── privy/
│   └── s001/
│       └── assertion-signer-evidence.*
│
└── judges/
    └── s001/
        ├── README.md
        ├── trust-anchor-flow.html
        ├── happy-path.*
        └── deny-path.*
```

If Privy is not selected for the S001 assertion signer after official-agent review, the corresponding artifact path should reflect the actual implementation.

---

# 11. Sanitization rules for test artifacts

Artifacts MUST NOT contain:

```text
real PII
real government document numbers
real private keys
SUMSUB_SECRET_KEY
SUMSUB_APP_TOKEN
CATENOR_INTERNAL_API_TOKEN
private provider payloads
private applicant IDs unless safely redacted
provider bindingRefs unless safely redacted
```

Use:

```text
sanitized identifiers
truncated hashes
synthetic fixtures
redacted screenshots
```

where necessary.

---

# 12. Test implementation guidance

Recommended mapping:

```text
Domain unit tests
→ C, D, F, G, J

Application/use-case tests
→ A, B, H, K

Infrastructure integration tests
→ E, I

CRE simulation
→ E01, E02, E04, E05, E06, E11

Live deployed integration
→ E03, L01, L02

End-to-end Judge Inspector
→ L01, L02, L03
```

Do not force every vector into the same test runner.

Some architecture/deployment/privacy vectors are best validated by:

```text
automated integration test
deployment assertion
artifact inspection
or
manual judge/demo checklist
```

The PLAN must map each test vector to a concrete verification method.

---

# 13. Minimum automated test set

At minimum, automated tests should cover:

```text
authorized bootstrap access
unauthorized bootstrap access
valid DID/value object generation
DID privacy assertions
valid key proof
wrong key
expired challenge
replay
wrong DID
wrong key purpose

all policy facts true
each policy fact false
missing policy fact (DENY; trace records MISSING, not FALSE)
unknown / untrusted input cannot override policy
provider-binding mismatch establishes no facts

valid bootstrap endorsement
invalid endorsement
policy hash mismatch
Verification Method key replaced under the same ID

Admission success
Admission DENY
idempotent retry
Trust Anchor verification success
tampered record failure
non-active root failure

private/public serialization boundaries
```

---

# 14. Minimum CRE simulation set

Before real deployment:

```text
simulation happy path
simulation AML/policy DENY
simulation provider-binding mismatch → no facts
secret loading works (3 secrets, one batched call)
sealed private context opens inside handlerInTee
in-TEE HTTPS mock provider path works
raw sensitive fixture does not appear in output
```

The local simulator is not a real TEE; simulation output is labeled as simulation.

---

# 15. Minimum live set

Before S001 is considered hackathon-complete:

```text
real CRE deployment (identity-confidential, private registry)
real handlerInTee execution (trust-anchor-admission)
real Sumsub sandbox call over HTTPS from inside the TEE (representative leg in every profile;
  company leg under the Full Sumsub Sandbox Profile, otherwise TV-S001-L04 under the Hybrid Demo Profile)
real minimized output
real happy-path Admission
real ACTIVE Trust Anchor
real verification = true
live invalid-key DENY
```

A live evidence/policy DENY (TV-S001-L03) is strongly preferred; T0.8 confirmed it is feasible with a REAL Sumsub sandbox representative RED review.

---

# 16. Judge-facing result summary

The Judge Inspector should be able to replay or explain at least:

## Scenario 1 — Happy path

```text
ACCESS           ✓
BOOTSTRAP        ✓
DID              ✓
KEY POSSESSION   ✓
SUMSUB / CRE     ✓   (Hybrid Demo Profile: "Company evidence: SYNTHETIC MOCK" ·
                      "Representative verification: REAL SUMSUB SANDBOX")
POLICY           ALLOW
ENDORSEMENT      ✓
ADMISSION        ACTIVE
VERIFY           TRUE
```

## Scenario 2 — Unauthorized bootstrap email

```text
ACCESS           ✗
ADMISSION        NOT STARTED
ACTIVE ROOT      NO
```

## Scenario 3 — Invalid assertion key

```text
ACCESS           ✓
DID              ✓
KEY POSSESSION   ✗
POLICY           DENY
ENDORSEMENT      NO
ACTIVE ROOT      NO
VERIFY           FALSE
```

## Scenario 4 — Required evidence false

```text
ACCESS           ✓
KEY POSSESSION   ✓
CONFIDENTIAL     ✓
POLICY FACT      ✗
POLICY           DENY
ACTIVE ROOT      NO
```

---

# 17. Final test principle

> **Every positive authority state must have a test showing why it is valid, and every critical requirement must have a negative vector proving that it cannot be bypassed.**

For S001:

> **No evidence, no trust. No key control, no trust. No policy ALLOW, no trust. No bootstrap endorsement, no root.**
