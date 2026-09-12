# Plan — Clean-room demo runbook (prompt 2026-09-11-023)

**Status:** working plan (Hackathon Delivery Mode)  
**Prompt:** `docs/hackathon/prompts/2026-09-11-023-reproducible-demo-runbook.md`  
**Scope guard:** no change to frozen S001 semantics, the Admission Policy, the S001 facts or the golden vectors. Everything
new is labeled Catenor One **[REF-IMPL]** where the protocol leaves the vocabulary or wire format open (Draft v0.1:
relationship predicates, action vocabulary, VP holder binding, credential status, delegation wire format).

## 1. Gap analysis (before this work)

| Required by the prompt | Existing | Gap |
|---|---|---|
| Trust Anchor → Sponsor (relationship + 5 capabilities) | TA grants `TOKENIZE_ASSET` / `EXECUTE_DISTRIBUTION` directly | Sponsor Subject with its own assertion key; Relationship Credential; 3 new [REF-IMPL] actions |
| Sponsor → Agent (relationship + delegated capability) | TA → Agent grant | Sponsor-signed delegation verified through the chain; `AGENT_OF` relationship |
| SPV Subject + Privy EVM wallet + controls after the Sponsor's ALLOW | pre-seeded SPV wallet (FD-2 open) | runtime provisioning from public values (owner key outside the runtime) |
| Offering Policy defined by the Sponsor | none | `policy:offering-eligibility:v1` + Sponsor-signed offering definition |
| VC / VP | `eddsa-jcs-2022` proofs only | W3C VC 2.0 / VP envelopes, issuer-signed status statement, investor holder key (`authentication`) |
| VC/VP verified inside CRE | CRE checks provider evidence only | Ed25519 + JCS verification in `handlerInTee`; `OFFERING_ELIGIBILITY` operation |
| Distribution computed inside CRE | per-holder CRE facts; plan computed in the API | `CONFIDENTIAL_DISTRIBUTION` operation computes PAY/HOLD and amounts; API verifies and executes |
| Numbered, stateful, reproducible scripts | one monolithic `pnpm demo:s001` with a throwaway database | persistent local Postgres + `.catenor-demo/` state + stage runner + `scripts/demo/*.sh` |
| CRE deployment scripts | simulation only | `scripts/demo/cre/*` from the installed CLI (cre-engineer), mutating steps gated by `--live` |

## 2. Design decisions

- **Relationship vocabulary:** protocol example `OFFICER_OF` is Human → Organization; the vocabulary is an OPEN design
  item (`authority/01-RELATIONSHIPS.md` §5). Catenor One uses [REF-IMPL] predicates, carried in
  `CatenorRelationshipCredential` (protocol working shape, DATA-MODEL-BASELINE §14):
  `AUTHORIZED_SPONSOR_IN` (Sponsor → Trust Domain, issued by the Trust Anchor), `SPONSORED_BY` (SPV → Sponsor, issued
  by the Sponsor), `AGENT_OF` (Agent → Sponsor, issued by the Sponsor). A relationship never authorizes anything.
- **Capabilities:** existing `CatenorOneCapabilityGrant` envelope, one action per grant. New [REF-IMPL] actions
  `DEFINE_OFFERING_POLICY`, `CREATE_AGENT`, `CREATE_DISTRIBUTION`, `DELEGATE_DISTRIBUTION_AUTHORITY`.
- **Delegation (explicit delegability):** a Sponsor-signed `EXECUTE_DISTRIBUTION` grant is valid only if the ACTIVE
  Trust Anchor granted the Sponsor both `CREATE_DISTRIBUTION` (the authority being delegated) and
  `DELEGATE_DISTRIBUTION_AUTHORITY` (the explicit permission to delegate it) on the same resource, and the delegated
  validity does not exceed either parent. Only `EXECUTE_DISTRIBUTION` is delegable. Chain depth 2.
- **Credentials:** W3C VC 2.0 envelope with `DataIntegrityProof` / `eddsa-jcs-2022` (the approved crypto profile).
  `CatenorInvestorEligibilityCredential` issued by the Trust Anchor (its issuer authority comes from Admission), claims:
  identity verified, AML clear, evidence commitment (no PII). [REF-IMPL] status: `CatenorOneCredentialStatus`, an
  issuer-signed status statement fetched at evaluation time (`UNKNOWN` ≠ ACTIVE).
- **Presentations:** holder = investor DID; holder proof `proofPurpose: authentication` with `challenge` and `domain`
  from the verifier request; the holder key is an investor Ed25519 key (Privy Solana wallet, signMessage-only policy),
  listed under the DID Document's `authentication` — distinct from the investor's EVM receiving account.
- **Inside CRE:** VP holder proof, VC signature, issuer = the pinned Trust Anchor, issuer authority, subject = holder,
  validity window, status, current Sumsub evidence, reconciliation, policy → minimized result + commitment.
- **Distribution in CRE:** one run takes the revenue event, holdings, all VPs and status statements, computes pro-rata
  shares, evaluates `policy:distribution-eligibility:v2` per holder and returns PAY/HOLD + amounts. The API verifies
  the HMAC, the commitment and the arithmetic, then executes PAY holders only through the Agent's Privy wallet.
- **State:** `.catenor-demo/` (git-ignored): `state.env` (public refs), `runtime.env` (runtime keys, 0600),
  `runs/` (sanitized per-stage evidence). Management-owner keys: `~/.catenor-one/clean-room/<instance>/` (0600).
- **Safety:** Hedera broadcasts only with `--live` plus an interactive confirmation; `run-all.sh` without `--live`
  never spends HBAR. No mainnet. No raw-key fallback.

## 3. Order

1. Domain: credentials (VC/VP/status), authority (relationships, actions, delegation, offering), policy (offering v1,
   distribution v2), identity (`authentication` relationship).
2. Workflow: shared eddsa-jcs verification; `OFFERING_ELIGIBILITY`; `CONFIDENTIAL_DISTRIBUTION`.
3. API: persistence (signed documents, audit types, SPV binding), services, CRE verifier widening.
4. Stage runner + scripts + env automation + funding.
5. `DEMO.md`; CRE deployment scripts (cre-engineer).
6. Run every non-spending stage from zero; STOP before any Hedera broadcast.
