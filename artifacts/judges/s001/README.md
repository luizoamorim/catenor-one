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
- assertion-key Proof of Possession;
- Chainlink CRE `handlerInTee`;
- Vault DON secret boundary;
- Sumsub + auxiliary LLM;
- Railway operational/evidence storage;
- deterministic Admission Policy;
- Bootstrap Endorsement;
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

The HTML is a visualization/mock until wired to live slice state.
It must never be represented as evidence that a sponsor integration is live.

Live execution evidence belongs in the corresponding sponsor artifact directories.
