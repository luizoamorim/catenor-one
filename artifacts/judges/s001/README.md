# S001 Judge Inspector

This artifact is the technical companion to the simplified Catenor One product flow.

Open:

```text
trust-anchor-flow.html
```

It demonstrates:

- Bootstrap Access Gate;
- Trust Domain bootstrap;
- canonical `did:catenor`;
- DID Document;
- private provider bindingRefs (Catenor-issued, used as Sumsub `externalUserId`);
- assertion-key Proof of Possession;
- Chainlink CRE Confidential Workflow `identity-confidential`, operation `trust-anchor-admission` (`handlerInTee`);
- Vault DON secret boundary (3 secrets);
- Sumsub sandbox evidence, requested over HTTPS from inside the TEE, with deterministic fact derivation;
- Railway private PostgreSQL (COMMITMENT_ONLY evidence retention — no raw provider evidence stored);
- deterministic Admission Policy;
- Bootstrap Endorsement (binds `verificationMethodCommitment`);
- Admission Record;
- Trust Anchor verification;
- happy and DENY scenarios.

## Intended use

The production UI should explain the user journey with less technical detail.

The Judge Inspector exists to answer questions such as:

```text
Why is this Trust Anchor trusted?
What ran inside the TEE?
What left the confidential boundary?
Which policy produced ALLOW?
What happens when a critical requirement fails?
Can the resulting authority be independently explained?
```

The HTML is a **visualization only** until wired to live slice state (the live inspector will be served at `/judge/s001`).
It must never be represented as evidence that a sponsor integration is live.

Labeling rules: the identity provider environment is the **Sumsub sandbox** (synthetic organization — not production KYB); CRE provider calls are "HTTPS requests executed from inside the confidential TEE boundary" (not the separate Confidential HTTP capability); Trust Anchor verification cryptographically verifies Admission provenance and bootstrap endorsement, while current lifecycle status comes from the operational status projection.

Live execution evidence belongs in the corresponding sponsor artifact directories.
