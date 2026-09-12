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

