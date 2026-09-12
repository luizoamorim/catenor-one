# Final demo run log

**Date:** 2026-09-12 (UTC). **Operator:** the maintainer, running `scripts/demo/*` by hand, one stage at a time.
**Screenshots:** [`screenshots/`](screenshots/README.md).

This is the public, reviewed record of each stage. The full stage records stay local in `.catenor-demo/runs/`, which
is git-ignored. This log never contains:

- investor DIDs;
- Sumsub applicant IDs or `bindingRef`s;
- VCs or VPs;
- keys or secrets.

**Sponsors:**

| Sponsor | Environment |
|---|---|
| Privy | new **development** app `catenor-one-ethonline-2026` |
| Sumsub | **SANDBOX**, with synthetic applicants and level `id-only` |
| Company KYB | **SYNTHETIC MOCK**, used only for the S001 admission |
| Chainlink CRE | the **deployed** `identity-confidential` Confidential Workflow, admission included. Results reach Catenor through the Railway relay |
| Hedera | **Testnet**, chain 296 |
| Railway | `https://catenor-one-production.up.railway.app`: API and CRE relay only, inert. Its **Postgres** holds the demo's operational state: the local runner writes to it through the TCP proxy |

**Order.** The workflow is deployed twice:

1. After stage 10, with the Bootstrap Configuration hash, for the admission.
2. After stage 11, adding the Trust Anchor's issuer key, for the investor operations.

See `DEMO.md` §15.

An earlier attempt (`c1-202609121438`) was stopped after stage 11 because its admission ran on CRE simulation. Its
record is in [`aborted-c1-202609121438/`](aborted-c1-202609121438/RUN-LOG.md).

## Stages

### Phase A — Local preparation (2026-09-12, 16:59 UTC)

**Instance:** `c1-202609121659`.

| Step | Result |
|---|---|
| `02-reset-local-demo --yes` | The local Docker PostgreSQL and the aborted instance's state files were moved aside. The Railway Postgres was left untouched and holds 0 Catenor rows |
| `01-setup-env` | `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, the Sumsub sandbox token and secret, and `CATENOR_INTERNAL_API_TOKEN_VAR` are all **PRESENT** (never printed). The channel token is the value sealed on Railway, not a new one. CRE CLI logged in |
| Database | **Railway PostgreSQL**, the deployed backend's database, reached through its public TCP proxy: 0 Catenor rows, 5 migrations, up to date |

**Why the database is on Railway.** The maintainer decided that the demo state lives in the deployed backend's
database rather than on this machine. The API is unchanged: it stays inert and only probes the database.

**Record labels.** The stage 01 record labels CRE as SIMULATION because no workflow is configured yet; stage 01 makes
no CRE call. The label becomes DEPLOYED after Phase C. The stage 10 record carries the same default label; stage 10 makes no CRE call either.

### Stage 10 — Trust Domain bootstrap configuration (17:08 UTC)

**Mode:** SPONSOR LIVE (non-spending), Privy development app `catenor-one-ethonline-2026`.

| Item | Value |
|---|---|
| Trust Domain | `trust-domain:catenor-one-demo` |
| Admission policy | `policy:trust-anchor-admission:v1` |
| Bootstrap Endorsement Key wallet | `frpd7k5nwsurmsabp3n9bsao` (Solana, `HKQY5…nVEk`) |
| Policies | `P_BOOTSTRAP` `vzww22mkxmtn4f333fdqpse7` · `P_ASSERT` `e8d0ndsssfq6rr7p2im0ptt4` (allow signMessage; deny exportPrivateKey and exportSeedPhrase) |
| Runtime quorums | `…-bootstrap` `eucmxca0yokwgp9xr68plx6m` (signer for the bootstrap wallet) · `…-assertion` `px0qht07z0tbilnqqfcb3o2n` |
| Owner keys | 2, registered in Privy by public key; the private keys stay in `~/.catenor-one/clean-room/c1-202609121659/` |
| **Bootstrap Configuration hash** | `0x88314d8bae7f81ff33c8192124f7870a4f27586beba74e9772b735a3af007fff`, the input to CRE deploy #1 |

Screenshots: [`screenshots/`](screenshots/README.md) (`10-before-*`, `10-after-*`), with what each object is and why.

### Phase C — CRE deploy #1 (for the admission)

**C1 — `cre/configure.sh --relay-url=…` (17:24 UTC).** This wrote `workflows/identity-confidential/.deploy/config.json`
(git-ignored) in `executionMode: DEPLOYED`.

| Setting | Value |
|---|---|
| Callback | `https://catenor-one-production.up.railway.app/v1/internal/cre/identity-confidential/results`: the workflow's results go to the Railway relay, and the stage runner pulls them |
| Authorized HTTP-trigger key | `0x18487BeFE194528cf429f5889BAE3aCbdA104a6c`. Its private key stays in `.catenor-demo/runtime.env` (0600) |
| Issuer rules | not set yet. They need the Trust Anchor's key from stage 11 and are added by deploy #2 |

The runner stays in SIMULATION until the workflow id is recorded with `--use-deployed`.

**C2 — `cre/check-relay.sh` (17:24 UTC): OK.** A probe signed with the channel key was accepted by Railway
(`202 RELAYED`), pulled back (`200`) and re-authenticated locally. The `CATENOR_INTERNAL_API_TOKEN` sealed on Railway
therefore equals the one the CRE secrets will carry.

**C3 — `cre/secrets.sh --live` (17:36 UTC): 3 secrets in the Vault DON.** The command was
`cre secrets create secrets.yaml --secrets-auth browser -T production-settings`, the private-registry mode, authorized
by the maintainer's CRE account in the browser. Created in `namespace=main`, owner
`0x7075057f1589BAf347cB6dD6a993B1FC536B8a0a`:

- `CATENOR_INTERNAL_API_TOKEN`;
- `SUMSUB_APP_TOKEN`;
- `SUMSUB_SECRET_KEY`.

No value was printed. The CLI warned: *"Vault gateway validation skipped; the encryption key and response signatures
will not be verified independently of the gateway."* It is recorded as printed.

The first `--live` attempt failed before any request: `failed to decode the provided private key: invalid hex
character 'Y'`. The CLI parses `CRE_ETH_PRIVATE_KEY` from the `.env` it is given, even in browser mode, and
`workflows/.env` still had the `.env.example` placeholder. The fix was a fresh random, **unfunded** key, generated into
the file without printing it. It is not linked to the account and is not the demo's trigger key.

**C4 — `cre/deploy.sh --live`: the Confidential Workflow is deployed.** This is the first real Confidential Workflow
deploy on this account, and it needed no extra enrollment step.

| Field | Value |
|---|---|
| Workflow | `identity-confidential-production` (target `production-settings`) |
| Registry / DON family | `private` (Chainlink-hosted) / `zone-a` |
| **Workflow ID** | `00e12517fc06c8984befaa63accbadb21b8c4abe529595fcf48542ba097ad250` |
| Status reported by the CLI | **Active**. The deploy did not leave it PAUSED, so `activate.sh` is not needed |
| Binary hash | `9902db587a3878b07ad03d599cb9c781f7c77b8ea440b168d8c42fd18b3fb9fb` |
| Config hash | `7cb69b7b82f6d8a0701ba39b15cc915d6ea3b4ca746c84fd3a805188c38098f8` |
| Owner | `0x7075057f1589BAf347cB6dD6a993B1FC536B8a0a`, derived from the account; the same owner as the Vault secrets |
| Artifacts | `https://storage.cre.chain.link/artifacts/00e12517fc06c8984befaa63accbadb21b8c4abe529595fcf48542ba097ad250/{binary.wasm,config}` |

The uploaded config was checked before this entry and holds no secret:

- the Railway callback URL;
- the Bootstrap Configuration hash `0x88314d8b…7fff`;
- the evidence-acceptance rules (HYBRID_DEMO: Sumsub sandbox `id-only` plus the synthetic company mock);
- the authorized trigger address `0x18487BeF…4a6c`.

There are no issuer rules yet; deploy #2 adds them after stage 11.

**C5 — skipped.** The workflow was already Active.

**C6 — `cre/configure.sh --workflow-id=… --use-deployed` and `cre/status.sh` (17:45 UTC).** The runner is now in
**`demoCreMode: DEPLOYED`**, so the confidential stages trigger the deployed workflow through the CRE gateway. CRE
reports:

| Field | Value |
|---|---|
| Workflow status | **ACTIVE** (registered 17:38:55 UTC) |
| Deployment status | **ACTIVE** (deployed 17:38:56 UTC) |
| Registry | private |
| Executions | none yet ("Last executed: never") |

### Stage 11 — Root Trust Anchor admission

**Attempt 1 (17:50 UTC): stopped at the gateway, `CRE gateway HTTP 400`.** Before the trigger:

- the candidate `did:catenor:d21efcc6c9f93fa5aacdd438bb99f7a8` was created;
- its Privy assertion key was provisioned;
- a Sumsub sandbox representative was created and forced GREEN;
- key possession verified (`possessionValid` and `purposeValid` true).

The CRE gateway then refused the `workflows.execute` request with HTTP 400. No workflow execution was created, and the
dashboard still shows 0. The root Trust Anchor was not admitted, so nothing set-once was consumed. The abandoned session
and the objects it created stay as they are.

**Why the cause is unknown:** the verifier threw only the status and discarded the gateway's JSON-RPC error. The
documented causes are an invalid JWT, an unauthorized key, or the workflow not being found. The fix: the error now
carries the gateway's code and message, capped and without control characters. These messages name only public values;
the request is never echoed. A test covers it. Attempt 2 creates a new session.

**Attempt 2 (17:56 UTC): the gateway does not know the workflow.** A new candidate,
`did:catenor:264c79583b82623b85e64d9e41a9454a`, went through the same steps, with key possession valid. The gateway then
answered:

> `-32600 Workflow not found. 'workflowID' 0x00e12517fc06c8984befaa63accbadb21b8c4abe529595fcf48542ba097ad250 is not a valid workflow ID`

No execution was created and no Trust Anchor was admitted. Read-only checks afterwards:

- `cre workflow list` shows the workflow `ACTIVE` in the private registry, with the same ID and owner.
- `cre workflow get` shows the deployment `ACTIVE` and "Last executed: never".
- A local `cre workflow simulate` with the **deployed config** and a junk payload initializes the workflow and registers
  the HTTP trigger. It then fails closed as expected (`SEALED_CONTEXT_OPEN_FAILED`). The config is therefore not what
  stops the workflow loading.
- The request format matches Chainlink's "Triggering Deployed Workflows" page: the private-registry gateway, a
  `workflowID` without `0x`, and a JWT with `alg: ETH`. The gateway parsed our ID, since its error echoes it.

**Open question for Chainlink.** Why does the private-registry gateway not see a workflow that the registry reports as
ACTIVE? Confidential Workflows is a private beta that needs enrollment through the Chainlink account team. The CLI
deployed without complaint, but nothing shows whether this organization's Workflow DON loads confidential workflows.

**Control experiment (about 18:15 UTC): the cause is the gateway URL.** A minimal **non-confidential** workflow was
deployed to the same private registry:

- `catenor-http-control`, workflow ID `0038de787580f971728b4e2599d83107eb6e8933a632b8021f67c72a3672a66f`;
- a plain handler with the same HTTP trigger and the same authorized trigger key, returning `"ok"`;
- scaffolded in the git-ignored `scratch/`.

It was then triggered with the demo's JWT code:

| Gateway | Result |
|---|---|
| `https://01.enterprise-gateway.zone-a.cre.chain.link/`, the one the docs give for the private registry | HTTP 400 `-32600 Workflow not found`, twice, including about 5 min after the deploy |
| `https://01.gateway.zone-a.cre.chain.link`, the only gateway URL embedded in CRE CLI v1.33.0 | **HTTP 200, `ACCEPTED`**, execution `0xf85c571f52d9605e711f3ab37ef64dbd53af6aac67cf14245b1125e880e660b6` |

**The fix:** the verifier's default gateway is now `https://01.gateway.zone-a.cre.chain.link`, overridable with
`DEMO_CRE_GATEWAY_URL`. The two stage 11 failures were therefore neither an enrollment problem nor a TEE problem. The
same signed request had simply gone to a gateway that does not serve this organization's workflows.

**Attempt 3 (19:12 UTC): the same `Workflow not found`.** It ran while the gateway fix was still being written, so it
still used the documented enterprise gateway. It created candidate 3, with a Privy wallet and a Sumsub applicant, and
no execution.

**Attempt 4 (19:18 UTC): ADMITTED on the deployed Confidential Workflow.** The first admission of the root Trust
Anchor to run on a deployed CRE workflow:

| Item | Value |
|---|---|
| Root Trust Anchor | `did:catenor:656d66dff9ce1db692786ee241bc3cab` (assertion method `#assertion-key-1`, a Privy Ed25519 wallet under `P_ASSERT`) |
| Key possession | `possessionValid` and `purposeValid` true (Privy `signMessage`, `eddsa-jcs-2022`) |
| CRE execution | `0x394f66228ed74f270e5917ba9401a78f36aea40366864cf89306936e74ce4bd8`, operation `TRUST_ANCHOR_ADMISSION`, mode **DEPLOYED**, workflow `00e12517…d250` |
| Result path | the workflow's signed callback went to the Railway relay; the runner pulled it, re-authenticated it and delivered it: `EVIDENCE_RECEIVED` |
| Facts (derived inside the TEE) | `ORGANIZATION_KYB_VERIFIED`, `ORGANIZATION_STATUS_VALID`, `ORGANIZATION_AML_CLEAR`, `AUTHORIZED_REPRESENTATIVE_VERIFIED`, `REPRESENTATIVE_AUTHORITY_CONFIRMED`, `EVIDENCE_FRESH`: all true, provenance `CONFIDENTIAL_VERIFICATION`. The company facts come from the SYNTHETIC MOCK; the representative facts come from the real Sumsub sandbox |
| Evidence commitment | `0x032c3587582592487fde060e08ab3e3747e80b25cf7bc825ee6bdbc58cf31846` (COMMITMENT_ONLY: Catenor keeps no raw Sumsub response) |
| Decision | `decision:4721cc3e-702a-42cc-95e1-60f34d66185a`, **ALLOW** |
| Activation | bootstrap endorsement by the separate `P_BOOTSTRAP` key → ACTIVE → `TRUST_ANCHOR_VALID: true`, no failed checks |

The DID is recorded as `DEMO_TRUST_ANCHOR_DID` in state. Its public key goes into the workflow's issuer rules in
deploy #2.

**Leftovers, which stay as they are:**

- the abandoned attempt-1, 2 and 3 candidates, each with a Privy assertion wallet and a Sumsub sandbox applicant.
  The Privy wallets are all Solana, under the same `…-assertion` quorum and owner key:

  | Wallet | Created (UTC) | What |
  |---|---|---|
  | `HKQY5…nVEk` | 17:08 | Bootstrap Endorsement Key (stage 10) |
  | `CMhqU…5Stc` | 17:50 | attempt 1, abandoned |
  | `5SUTj…rFYM` | 17:56 | attempt 2, abandoned |
  | `GMQ6i…bz53` | 19:13 | attempt 3, abandoned |
  | `9PvXY…PGkT` | 19:18 | **the Trust Anchor's Credential Assertion Key** (attempt 4) |
- the control workflow `catenor-http-control`, to be deleted after the demo.

### Phase E — CRE deploy #2: the Trust Anchor's key is pinned (19:33–19:36 UTC)

**E1 — `cre/configure.sh`.** The config now carries `credentialRules`:

- **Credential type:** `CatenorInvestorEligibilityCredential`.
- **Accepted issuer:** the root Trust Anchor, `did:catenor:656d66dff9ce1db692786ee241bc3cab#assertion-key-1`, whose
  public key is pinned as `z6MknrBa8Vbrsz5YCoBhgmV54ALJP9p1YSocpeBvgzBgJVXq`.
- **Credential status:** must be at most 600 s old.
- **Pinned policies:** `policy:offering-eligibility:v1` and `policy:distribution-eligibility:v2`.

The config is 3.3 KB and holds public data only.

**E2 — `cre/deploy.sh --live`.** The CLI warned *"Workflow identity-confidential-production already exists. This will
update the existing workflow"*, and the maintainer confirmed the overwrite.

| Field | Value |
|---|---|
| **New workflow ID** | `0000e58d50da8eaf29fb4212c236f374d11d7eb2452502c3bad0afe74d3f25c8` |
| Binary hash | `9902db587a3878b07ad03d599cb9c781f7c77b8ea440b168d8c42fd18b3fb9fb`, **unchanged** from deploy #1: the same code |
| Config hash | `e7703b193460430b4767b89d44caea2620eda5b3c844deee69f9db9436207d1d` |
| Status | **Active** (activate not needed) |

The deploy #1 version (`00e12517…d250`) was replaced. Its only use was the admission, whose execution `394f…4bd8` is
recorded above.

**E3 — `cre/configure.sh --workflow-id=0000e58d…25c8` (19:38 UTC).** The runner now points at the new workflow, still
`DEPLOYED`. In `status.sh`:

- `cre workflow get` failed with a transient CLI account error ("unable to retrieve organization info… try again in a
  few minutes");
- the execution list worked. It still shows the admission execution `394f…4bd8` (SUCCESS, 19:18:37–19:18:45 UTC, 8 s)
  under `identity-confidential-production`, so the history survived the in-place update.

The deployed triggers do not depend on the CLI session: they are signed with the trigger key.

A re-run a few minutes later was clean:

- workflow `0000e58d…25c8` **ACTIVE**, registered 17:38:55 UTC, last executed 19:18:45 UTC;
- deployment **ACTIVE**, deployed 19:36:04 UTC;
- last execution `394f…4bd8` SUCCESS, 8 s.

### Phase F — Sponsor, SPV and offering (Privy only, no spending)

**Stage 20 — Sponsor Subject (19:58 UTC).** The Sponsor is `did:catenor:5b87cad5d25e94dbf62f4443cf85761d`, an
ORGANIZATION with a random DID and no PII. Its assertion method is `#assertion-key-1`, the Privy Solana wallet
`GLHPd…oTdX` (`o2kjl90on5veciqodvlppp2u`), a signMessage-only key.

At this point the Sponsor is not a Trust Anchor and holds no capability.

**Stage 21 — Sponsor authorization (20:01 UTC).** Signed by the root Trust Anchor through its Privy Ed25519 key
(`eddsa-jcs-2022`):

- **Relationship Credential:** `urn:uuid:697d1767-2ea8-45d8-b875-f13a00943cba`, the Sponsor is `AUTHORIZED_SPONSOR_IN`
  `trust-domain:catenor-one-demo`. It is **valid**, and it grants nothing by itself (Relationship ≠ Capability).
- **Five Capability grants** on `spv:catenor-demo-001`, all **ALLOW**: `TOKENIZE_ASSET`, `DEFINE_OFFERING_POLICY`,
  `CREATE_AGENT`, `CREATE_DISTRIBUTION`, `DELEGATE_DISTRIBUTION_AUTHORITY`.
- **Negative path:** the same capability on another resource → **DENY `CAPABILITY_MISSING`**. Authority is scoped to
  the resource.

**Stage 30 — SPV creation under `TOKENIZE_ASSET` (20:08 UTC).** The Sponsor's `TOKENIZE_ASSET` on
`spv:catenor-demo-001` evaluated ALLOW. Only then were these created:

- **SPV:** `did:catenor:bd7856964b7ab1cce73a0e9c4c875d44`, an ORGANIZATION ("Catenor One Demo SPV 001", a synthetic
  real-estate SPV).
- **Privy EVM execution wallet:** `0x182F8c7DDbDa1b5f295893E2c4f6D55abBdB9926`, holding 0 HBAR until stage 50.
- **SPV execution policy**, owned by the SPV management-owner key outside the runtime, so the runtime signer cannot
  change it:
  - ALLOW `eth_signTransaction` only if `chain_id = 296` and `to` is the ATS v8 Factory
    `0xd1F118A40f3b02883D35909eF2517e7EDd78379d`;
  - DENY `exportPrivateKey` and `exportSeedPhrase`; everything else is denied by default;
  - after `deployEquity`, owner-authorized rules add `issueByPartition` (default partition),
    `grantRole(ROLE_CORPORATE_ACTION, SPV)` and `setDividend`, each pinned to the new equity.
- **A private `SPV_EXECUTION` Account Binding**, and a Relationship Credential: SPV `SPONSORED_BY` Sponsor.

This is the separation in practice. Catenor's authority (the capability) decides whether the SPV may exist. Privy's
policy constrains what its wallet may sign.

**Stage 31 — offering defined by the Sponsor (20:22 UTC).** The offering is
`offering:ab27ec9a-cd89-4b5b-92ea-bef19fbd9f9f`: 1,000 equity-interest units in "Catenor One Demo SPV 001", a synthetic
real-estate SPV whose units are equity interests, not a land deed.

- **Eligibility:** `policy:offering-eligibility:v1`, pinned by hash
  `0xa3326b33a0932b68c140a477334160a1585a75d4ccc824e0c89aa68d57dd51a2`. It requires `INVESTOR_PRESENTATION_VALID`,
  `INVESTOR_IDENTITY_VERIFIED`, `INVESTOR_AML_CLEAR` and `EVIDENCE_FRESH`.
- **Accepted credential:** `CatenorInvestorEligibilityCredential`.
- **Verification:** signed with the Sponsor's assertion key and checked against its `DEFINE_OFFERING_POLICY` grant, so
  **ALLOW**.

Phase F is complete: Sponsor → authorization → SPV → offering, with no spending.

### Phase G — Investors

**Stages 40–41 — investor onboarding (20:26 and 20:29 UTC).** SPONSOR LIVE (non-spending), Privy and the Sumsub
sandbox, with **no CRE call by design**. Onboarding creates the objects; the evidence is read only inside the TEE in
stage 42.

| | Investor A | Investor B |
|---|---|---|
| Sumsub sandbox display name (fictional) | Lisa Simpson | Bart Simpson |
| Sumsub review (sandbox, forced) | GREEN, Approved | GREEN, Approved |
| Privy receiving wallet (EVM, receive-only: own owner key, no signer, no policy) | `0x7de572532820B22040B561e68543419419b72473` | `0xCfCa833A8e6b7651E44480b92822576BcB78Da73` |
| Holder key | Privy Ed25519 (`#authentication-key-1`): signs Verifiable Presentations, never money | same |
| Account Binding | **private**: `did:catenor → eip155:296:<wallet>`, never published in the DID Document | same |

Each investor has a random `did:catenor` with no PII. Following this log's rule, **investor DIDs are not recorded
here**; they are in the local run records only. Each Sumsub applicant's `externalUserId` is the private bindingRef,
never the DID.

**Stage 42 — investor credentials on the deployed workflow (20:34–20:35 UTC).** Two `INVESTOR_ELIGIBILITY` runs on
workflow `0000e58d…25c8`, mode **DEPLOYED**. For each, the TEE read the investor's current Sumsub sandbox review
behind the binding gate and returned facts plus a commitment. Only then did the Trust Anchor sign a W3C VC 2.0
`CatenorInvestorEligibilityCredential` (`eddsa-jcs-2022`, `#assertion-key-1`), with claims
`investorIdentityVerified` and `investorAmlClear`, no PII, and an issuer-signed status statement.

| | CRE execution | Facts | Evidence commitment |
|---|---|---|---|
| Investor A | `0xe66a410799c33f710fa19baefa09ea49f0d2f89aaced4266390d14cdee320b8f` | identity ✓ · AML ✓ · fresh ✓ | `0xfb4c06ba260790febb51433bfc39df2c91189e9393e8d8522e8cd5c6a5e105a2` |
| Investor B | `0x61485b72ad43bd2a63d466fdb7778d02d49a5dec4206979171aa68a15df064f8` | identity ✓ · AML ✓ · fresh ✓ | `0xf0ebd2f5cf0bcdde1f79426ca494116a553333e0e6460a60315558b15072afee` |

- **Validity:** both VCs run from 2026-09-12 to 2026-12-11.
- **Trigger pacing:** the runner waited 44 s between the two triggers because of the deployed rate limit (1 per 60 s).
- **CRE dashboard:** 3 successful executions, 0 unsuccessful.

**Stage 43 — investor presentations (20:41 UTC).** A local verification; no CRE call. Each investor signed a
Verifiable Presentation over their credential with the **holder key** (`authentication`, Privy `signMessage` over the
`eddsa-jcs-2022` hashData). The proof is bound to a verifier challenge and to the domain
`offering:ab27ec9a-cd89-4b5b-92ea-bef19fbd9f9f`. The Trust Anchor signed a fresh status statement for each credential:
`ACTIVE`.

**Checks:** both presentations pass the seven checks the TEE also runs:

1. `PRESENTATION_WELL_FORMED`
2. `HOLDER_PROOF_VALID`
3. `CREDENTIAL_SIGNATURE_VALID`
4. `ISSUER_AUTHORIZED`
5. `SUBJECT_IS_HOLDER`
6. `WITHIN_VALIDITY_WINDOW`
7. `STATUS_ACTIVE`

**Negative path:** replaying either presentation with another challenge → **`HOLDER_PROOF_VALID` false**.

**Stage 44 — offering eligibility on the deployed workflow (20:45 UTC).** **One** sealed `OFFERING_ELIGIBILITY` run,
execution `0xfecb527d3d0133d4fd23a4c29a36b7998a1dc379c137a65175d72f4272464715` (DEPLOYED, 8 s). Each investor was
given a fresh challenge and presented their VP, and the issuer signed a status statement. Inside `handlerInTee`, the
workflow checked:

- the holder proof, the VC signature, the issuer's authority (the pinned Trust Anchor key), the subject, the validity
  window and the status;
- the **current** Sumsub evidence, and its reconciliation with the credential;
- `policy:offering-eligibility:v1`.

Only minimized conclusions left the TEE.

| | Units | Decision | Decision ref | Decision commitment |
|---|---|---|---|---|
| Investor A | 600 | **ALLOW** `SUBSCRIBE_OFFERING` on `spv:catenor-demo-001` | `decision:8c0a84a1-d53f-4c2b-94f8-f88787ab53dd` | `0xc840946f7ce24f007a5e6ce7790f70495299fa08642a09b42d8d8d5b276830b0` |
| Investor B | 400 | **ALLOW** | `decision:3000f2f5-0376-446f-b9b9-bbffdd8078ef` | `0xc30ba843a87f17c3d3b42d7cae738c8a2971950d40c9f61b64bb68835317d59e` |

**Both investors had:**

- a trace where every requirement is TRUE (presentation valid, identity verified, AML clear, evidence fresh);
- 7/7 presentation checks;
- reconciliation CONSISTENT, both credential against current and against the provider;
- no reason codes.

One run covers both investors, so both carry the run's evidence commitment
`0x83db064bab91f7dfd86dfd0309cbfe6f5d68f568116554fa2b21715b92599beb`.

**Observed on the deployed platform: TEE user logs are visible.** The CRE dashboard's Logs tab shows **user logs from
several DON nodes** (Node 1, 2, 4, 5, 8, 9…), each with the same markers. The simulator's banner says otherwise: "user
logs … will not be visible, and will not leave the TEE". The workflow logs only non-sensitive markers through
`safe-log` (event names, status and error codes, no values), so nothing sensitive appears. Catenor therefore does not
claim that logs stay inside the enclave. Each node's copy also calls back (`handler_completed status=DELIVERED`). The
Railway relay keeps the first authenticated result for a run and answers `409 LATE_OR_DUPLICATE_RESULT` to the rest.

Phase G is complete: Lisa and Bart are both eligible (**green**) before the investment.

### Phase H — Hedera ATS (testnet, spends HBAR)

**Stage 50 — TESTNET BOOTSTRAP FUNDING (20:55–20:57 UTC).** This is not Catenor authority and not a distribution.

**Treasury** (`--setup-treasury`): the maintainer chose the optional **Privy testnet treasury** so the faucet is used
once:

- **Wallet:** EVM `0x49e969483fEd8b2419D60EcB23D34C89af2E5210` (`jmzbtjnuv7f6x2w1h0fg239e`).
- **Policy:** `catenor-one-clean-room-testnet-treasury` (`zqr5ynnrd3mi6o9snqq8ex8g`). It allows `eth_signTransaction`
  only when `chain_id = 296` and the value is ≤ 30 HBAR, and denies both exports.
- **Keys:** the owner key stays outside the runtime; the runtime signer is a separate quorum,
  `catenor-one-clean-room-treasury`.

The maintainer funded the treasury with **100 HBAR** from the Hedera portal faucet. The balance was read before the
broadcast.

**Transfers** (`--live --from-treasury`, confirmation typed): three plain transfers, each signed by the treasury's
Privy wallet and checked at the signer boundary (from, to, value, data and chain are exactly the prepared transfer):

| To | HBAR | Transaction | Status |
|---|---|---|---|
| SPV execution wallet `0x182F…9926` | 25 | `0xa2b789128e5fd40ff8ad2b7815ca3c26c24a3e17cfca848345f0af46650b7f08` | SUCCESS |
| Investor A receiving wallet `0x7de5…2473` | 1 | `0x79829109bd42301ea5a4dab455c9e4b6d539d1c93865f4e52cf7f4430b760060` | SUCCESS |
| Investor B receiving wallet `0xCfCa…Da73` | 1 | `0xeb370383f7ed074da4c6fd61eaa0b4d6782a2483e7dcda7ffda2423999406c4f` | SUCCESS |

The investor transfers are account activation only (HIP-583 lazy create). HashScan now shows Hedera accounts
`0.0.10509879` (SPV, 25 ℏ), `0.0.10509881` (Investor A, 1 ℏ) and `0.0.10509882` (Investor B, 1 ℏ). The Privy dashboard
shows none of this: Privy's balance lookup does not cover Hedera (chain 296), and Privy only signed; the runner
broadcast the transactions. The Agent wallet, which does not exist yet,
is funded after stage 70.

**Stage 60 — tokenization (21:13–21:14 UTC).** Catenor authorized the Sponsor's `TOKENIZE_ASSET` request as ALLOW,
under grant `capability-grant:1984657d-ecab-403e-850f-67f5f29d3cc6`. The dry run then simulated the exact
`deployEquity` (estimated 7.40M gas, 15M limit, at most 18 HBAR) and got a Privy dry signature, which was discarded.
With `--live` and the typed confirmation:

| Item | Value |
|---|---|
| `deployEquity` transaction | `0x2396ad88874aec78419dfc5138fbdb5004f2cf3170adc3fbd1e0f8d701b4c570`, **SUCCESS**, 6,898,334 gas, sent from the SPV Privy wallet to the ATS v8 Factory |
| **Equity** | `0xf37A91c3aC757ac5f14e4b8BC92D4b1001D97ABC` (Hedera contract `0.0.10510175`), the address the preflight predicted |

**Then the runner failed: `invalid equity or SPV address`.** The chain side was already done. The runner had passed
the asset *reference* (`hedera-testnet:ats-equity:0x…`) where the SPV policy extension needs the bare address, and it
had recorded that reference as `DEMO_EQUITY_ADDRESS`, which every later stage reads as an address. This path had not
run live on this runner before.

**The fix.** Stage 60 now:

- records the checksummed address in `DEMO_EQUITY_ADDRESS` and the reference in `DEMO_EQUITY_REF`;
- when the equity already exists, never deploys again. It normalizes an old reference-shaped record and, with `--live`,
  completes the owner-authorized SPV policy extension. That step is Privy only and spends no HBAR.

The equity was not deployed twice.

**The re-run (21:25 UTC, `--live`)** reported *"already deployed: 0xf37A…7ABC … no new deployment"* and completed the
owner-authorized SPV policy extension. The SPV management-owner key, from `~/.catenor-one`, added three rules, each
pinned to the equity: `allow-issueByPartition-equity`, `allow-grantRole-corporate-action-to-spv` and
`allow-setDividend-equity`.

The policy now holds six rules:

- `allow-ats-factory-hedera-testnet`;
- `deny-exportPrivateKey` and `deny-exportSeedPhrase`;
- `allow-issueByPartition-equity`, `allow-grantRole-corporate-action-to-spv` and `allow-setDividend-equity`.

This step spent no HBAR.

**HashScan and Privy after stage 60.**

- **The `deployEquity` transaction:** SUCCESS at 21:14:07 UTC in block 40438071. The fee was **7.864 ℏ**, paid by the
  SPV account `0.0.10509879`, which now holds 17.136 ℏ.
- **The equity:** contract `0.0.10510175`, EVM `0xf37a…7abc`.
- **The factory:** the ATS v8 Factory `0.0.9213391`.
- **The treasury account:** `0.0.10509855`, with 70.92 ℏ left.
- **The SPV policy:** its JSON after the extension is saved in
  `artifacts/privy/final-demo/clean-room-c1-202609121659/spv-policy-after-equity.json`. It was copied from the Privy
  dashboard, and only the ABI arrays are abbreviated.

**Stage 61 — Investor A investment (21:55 UTC).** Catenor authorized the issuance before anything was signed:

- Investor A's stage 44 decision `decision:8c0a84a1-d53f-4c2b-94f8-f88787ab53dd` is ALLOW, unused, and within the
  offering total;
- the Sponsor's `TOKENIZE_ASSET` grant `capability-grant:1984657d…3cc6` evaluates ALLOW.

The dry run simulated the call (485,034 gas estimated) and got a Privy dry signature. The live issuance followed:

| Item | Value |
|---|---|
| Call | `issueByPartition(600 units, default partition)` on the equity `0xf37A…7ABC`, to her private receiving binding `0x7de5…2473` |
| Signer | the SPV Privy wallet, allowed only by the equity-pinned `allow-issueByPartition-equity` rule |
| Transaction | `0x59359ae9eeba4e6ab54bdf7acd6a60d398bd2b79f3838e419c88e4508a0efa4e` |
| Holder balance after | **600** |

**No generic mint:** the amount is exactly the one the TEE-backed decision approved, and the decision is consumed.

**Stage 62 — Investor B investment (21:57 UTC).** Investor B's decision
`decision:3000f2f5-0376-446f-b9b9-bbffdd8078ef` was ALLOW, for 400 units. `issueByPartition(400)` went to his private
receiving binding `0xCfCa…Da73`, signed by the SPV Privy wallet, in transaction
`0x9c6c4cb2677e6687e38a5e1b6125aaf6533fa600fe26b00e08d23a006ff00d62`. His holder balance is **400**.

**On-chain read-back after both issuances** (`eth_call` on the equity `0xf37A…7ABC`, Hedera testnet, right after stage 62):

| Read | Value |
|---|---|
| `totalSupply()` | **1000** (`decimals()` is 0) |
| `balanceOf(Investor A 0x7de5…2473)` | **600** |
| `balanceOf(Investor B 0xCfCa…Da73)` | **400** |

The whole offering is issued, and exactly the approved units went to each investor.

**Stage 91, run early (22:02 UTC; read-only, public chain data, no keys).** Every recorded transaction is SUCCESS:

| Transaction | Target | Gas |
|---|---|---|
| `deployEquity` | the Factory | 6,898,334 |
| `issueByPartition` → A | the equity | 456,629 |
| `issueByPartition` → B | the equity | 405,329 |

The sender is the SPV account's long-zero address `0x…a05e37`, which is `0.0.10509879`. The equity reads
"Catenor One Demo SPV 001 (SYNTHETIC)", symbol `C1SPV001`, totalSupply **1000**: **Investor A 600, Investor B 400**,
1 ℏ each. No dividend is recorded yet. HashScan shows both issuances SUCCESS, in blocks 40439213 and 40439263.

**Stage 63 — dividend corporate action (22:05 UTC).** The SPV Privy wallet sent two transactions, each confirmed
separately and each allowed only by its equity-pinned policy rule:

| Call | Transaction | Gas |
|---|---|---|
| `grantRole(ROLE_CORPORATE_ACTION, SPV)` | `0x726032ce12d343d9ced3933035e2a55833f527dd2de128c90d776139818d9f94` | 179,949 |
| `setDividend(recordDate 1789250830, executionDate 1789251010, amount 1, decimals 2)` | `0xaac4a085a3c9c2532c315ecb641028bb35525cb338b628715505aac3cd3ef865` | 532,107 |

The record date is 2026-09-12 22:07:10 UTC and the execution date 22:10:10 UTC.

**What ATS computes:** entitlements by ownership only, Investor A 600 → **6**, Investor B 400 → **4**. **No funds
move.** Who is actually **paid** is decided later by Catenor, in the TEE.

**Stage 91 re-check (22:08 UTC, after the record date).** All five transactions are SUCCESS: `deployEquity`, the two
issuances, `grantRole` and `setDividend`. ATS reports **dividend 1 entitlements: Investor A 6, Investor B 4**. Phase H
is complete: tokenized, issued and dividend set, on Hedera testnet through ATS.

### Phase I — Distribution Agent

**Stage 70 — the Sponsor creates the Distribution Agent (22:10 UTC).** The Sponsor's `CREATE_AGENT` evaluated ALLOW,
and these were created:

- **The Agent:** `did:catenor:9b25f52aff6dc4cac4d0a7aa3d8dc074`, with its own identity.
- **Its Privy EVM execution wallet:** `0x90894535F5f35271f2d4112179BF2b4e887913E3`, bound privately
  (`AGENT_EXECUTION`).
- **Its own signer set:** the owner key stays in `~/.catenor-one`; the runtime quorum is `…-agent-runtime`.
- **Policy `catenor-one-distribution-agent-3d8dc074`.** It is narrower than the SPV's:
  - ALLOW `eth_signTransaction` only if `chain_id = 296`, `to` is one of the **two investor receiving wallets** of
    `spv:catenor-demo-001`, and the value is **≤ 20 HBAR**;
  - exports are denied, and everything else is denied by default: no ATS contract, no SPV wallet, no other chain;
  - the policy is owned by the Agent management-owner key, outside the runtime.

**Negative path:** the Agent requested a distribution **before any delegation** → **DENY `CAPABILITY_MISSING`**. Being
created is not being authorized.

**Stage 71 — Sponsor → Agent relationship (22:19 UTC).** The relationship credential is
`urn:uuid:87eb74d1-4314-49bc-bb4c-8ad6d3cb6794`: Agent `AGENT_OF` Sponsor, signed by the Sponsor, **valid**. The
predicate is [REF-IMPL]: the protocol's only example, `OFFICER_OF`, relates a Human to an Organization, and the
predicate vocabulary is an open design item.

**Negative path:** the Agent's request with **only the relationship → DENY `CAPABILITY_MISSING`**
(Relationship ≠ Capability).

**Stage 72 — delegated capability (22:20 UTC).** Before signing, Catenor checked three things: the action is
explicitly delegable, and the Sponsor holds both `CREATE_DISTRIBUTION` and `DELEGATE_DISTRIBUTION_AUTHORITY` on the
same resource from the ACTIVE Trust Anchor. The Sponsor then signed grant
`capability-grant:7bd93930-e21c-4f78-86fd-8f8c9aa46156`: **`EXECUTE_DISTRIBUTION`** on `spv:catenor-demo-001` for the
Agent. The authority chain evaluates **ALLOW**:

| Grant | Issuer → subject | Action | Valid until |
|---|---|---|---|
| `34fd209d…` | Trust Anchor → Sponsor | `CREATE_DISTRIBUTION` | 2026-10-12 |
| `e250671b…` | Trust Anchor → Sponsor | `DELEGATE_DISTRIBUTION_AUTHORITY` | 2026-10-12 |
| `7bd93930…` | Sponsor → Agent | `EXECUTE_DISTRIBUTION` | 2026-10-02 (20 days, inside the Sponsor's 30) |

Delegated authority stays within the delegator's authority.

**Negative paths:**

- The Sponsor tried to delegate `TOKENIZE_ASSET` → **refused `ACTION_NOT_DELEGABLE`, no signature requested**.
- Investor A presented the Agent's grant → **DENY `SUBJECT_MISMATCH`**.

None of this uses the CRE, by design. Relationships, capabilities and delegation are public-key-verifiable authority
with no sensitive input. The TEE is used for current eligibility (stage 82).

