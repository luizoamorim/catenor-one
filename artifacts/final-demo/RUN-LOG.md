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
