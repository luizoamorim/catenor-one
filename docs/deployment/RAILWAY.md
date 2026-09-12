# Catenor One API on Railway

**Prompt:** `docs/hackathon/prompts/2026-09-12-024-railway-backend-preparation.md`

**Status:** **deployed** on 2026-09-12 by the maintainer, by hand, following §8.

- **URL:** `https://catenor-one-production.up.railway.app`.
- **Commit:** `bc19c10`.
- **Database:** PostgreSQL, migrated (5/5).
- **State:** no demo state; the CRE relay is not configured yet.

Nothing was done in Privy, Sumsub, Hedera or Chainlink.

## 1. What is deployed

| Item | Value |
|---|---|
| Service | `@catenor-one/api` (`apps/api`), one Railway service (`catenor-one`, production) |
| Root Directory | empty, meaning the repository root. The API imports the workspace packages `packages/*`, so the whole pnpm workspace is the build context |
| Service settings | set in the **dashboard** (Railway deprecated Config as Code, and services created after 2026-08-28 cannot opt in). `apps/api/railway.toml` is kept only as a written record of the same values |
| Builder | **Dockerfile**, with Dockerfile path `apps/api/Dockerfile` (Node 24.10.0 slim, pnpm 10.11.0) |
| Build | `pnpm install --frozen-lockfile --filter "@catenor-one/api..."`, then `pnpm --filter @catenor-one/api db:generate` (runs inside the Dockerfile; needs no database and no secret) |
| Start | the Dockerfile `CMD`, `node --conditions=@catenor-one/source --import tsx src/main.ts` (cwd `apps/api`). No custom start command |
| PORT | variable `PORT=8080`, set explicitly so it matches the domain's target port. Listens on `::` (IPv4 and IPv6) |
| Domain | `catenor-one-production.up.railway.app` → target port 8080 |
| Health check | healthcheck path `/v1/health`: static, with no database or sponsor call |
| Replicas | exactly 1, because the CRE relay mailbox is held in memory |
| Auto deploy | **disabled**; every deploy is triggered by hand (Redeploy) |
| Migrations | **not automatic**; run once by the maintainer from the service Console (§8, step 6) |

There was no HTTP server in `apps/api` before this change: every flow ran from the local stage runner. `src/main.ts`
is new and deliberately minimal. It is not the planned NestJS app; T4.1 is still open.

## 2. Inert startup (non-negotiable)

`main.ts` does four things:

- reads `PORT`, `HOST`, `CATENOR_INTERNAL_API_TOKEN` and `DATABASE_URL`;
- derives the CRE channel keys in memory;
- prints one line saying which features are enabled (never a value);
- listens.

It **never**:

- connects to the database at startup, and never migrates;
- calls Privy, Sumsub, Hedera or Chainlink;
- admits, issues, delegates, deploys, pays, or creates any Subject, wallet, policy or applicant.

A malformed `CATENOR_INTERNAL_API_TOKEN` makes it refuse to start, without echoing the value.

This is enforced by `apps/api/src/main.inert.test.ts`. The test walks every static and lazy import reachable from
`main.ts` and fails if any of them reaches:

- the Privy, ATS or ethers SDKs;
- `child_process`;
- `@catenor-one/authority`;
- the application services (`src/modules/`);
- the key-management, identity-provider, execution or runtime adapters;
- the CRE gateway or simulator.

### Never on Railway

The following stay on the maintainer's machine:

- **Management-owner private keys.** `~/.catenor-one/clean-room/<instance>/`, 0600. They are outside every build
  context and the `.dockerignore` excludes them as well.
- **Runtime authorization keys.** `.catenor-demo/runtime.env`.
- **The CRE trigger key.**
- **The Privy app secret.**
- **The Sumsub credentials.**
- **The clean-room state.**
- **Every `--live` operation.**

The Docker context also excludes, in `.dockerignore`:

- every `.env` and `.env.*` file;
- `.catenor-demo/`;
- `workflows/` (its `.env` holds the Vault DON secret values);
- `scratch/`, `.git/` and local tooling.

## 3. Routes

| Method and path | Purpose | Authentication |
|---|---|---|
| `GET /v1/health` | liveness; reports `startup: INERT`, whether the CRE relay is enabled and whether a database is configured | none |
| `GET /v1/health/db` | read-only readiness: database reachable, and migrations `applied` vs `packaged` | none; never writes |
| `POST /v1/internal/cre/identity-confidential/results` | the **existing** CRE callback path (`CALLBACK_PATH`), now served publicly | callback HMAC (below) |
| `GET /v1/internal/cre/identity-confidential/results/<runId>` | one-time pull of a relayed result by the local stage runner | relay HMAC (below) |

Every other route answers 404. Responses carry stable codes only; bodies, headers and secrets are never logged.

## 4. CRE callback relay

A deployed `identity-confidential` workflow calls back over HTTPS. The result, though, is awaited by the process that
triggered it, which is the local stage runner:

- investor operations wait on an in-memory map (`InvestorCredentialsService.pending`);
- Trust Anchor admission waits in its stage.

So Railway **stores and forwards**; it never records protocol state itself.

```text
TEE ──POST callback (x-catenor-timestamp, x-catenor-signature)──▶ Railway API
        authenticateCallback: HMAC(cb key), ±300 s, commitment recomputed for OK results
        → in-memory mailbox[runId]: raw timestamp, signature and body; TTL 300 s, capacity 64, single use
        ← 202 RELAYED  (the workflow reports DELIVERED on any 2xx)
local stage runner ──GET …/results/<runId> (relay HMAC)──▶ Railway API ── 200 {timestamp, signature, body} (then deleted)
        runner re-runs authenticateCallback on the same bytes → deliver → U8 / recordResult  (unchanged code path)
```

**Callback authentication (unchanged).** The relay checks:

- `x-catenor-signature = hex(HMAC-SHA256(cb, timestamp + "." + body))`, where `cb` is HKDF-SHA256 of `K` with info
  `catenor-one/identity-confidential/cb/v1`;
- the timestamp is within ±5 min;
- for OK results, the evidence commitment is recomputed.

**Pull authentication [REF-IMPL, new in this prompt].** The pull uses `x-catenor-timestamp` plus
`x-catenor-signature = hex(HMAC-SHA256(relay, timestamp + ".GET " + path))`:

- `relay` is HKDF-SHA256 of `K` with info `catenor-one/identity-confidential/relay/v1`, a separate key from `cb`;
- the timestamp must be within ±5 min.

`K` is `CATENOR_INTERNAL_API_TOKEN`: 32 random bytes, hex-encoded. The same value must appear in three places:

- the Railway variable;
- the instance's `workflows/.env` (`CATENOR_INTERNAL_API_TOKEN_VAR`);
- the Vault DON secret `CATENOR_INTERNAL_API_TOKEN`.

**Enabling it on the runner.** Run `scripts/demo/cre/configure.sh --relay-url=https://<railway-host>`. It records:

- `DEMO_CRE_RELAY_URL`;
- `DEMO_CRE_CALLBACK_PUBLIC_URL = https://<railway-host>/v1/internal/cre/identity-confidential/results`.

In DEPLOYED mode the stages then poll the relay every 1.5 s for the runs they requested. Stage 11 waits for its
admission result. `--callback-url=` (a tunnel to the local receiver) clears the relay again.

**Limits.**

- A Railway restart or redeploy drops undelivered results: the runner times out, and the stage is re-run.
- Do not redeploy during a live CRE run.
- The simulation path is untouched.

## 5. Database

| Question | Answer |
|---|---|
| Prisma | 7.10.0 (`prisma`, `@prisma/client`, `@prisma/adapter-pg`); config `apps/api/prisma.config.ts`; the datasource URL comes only from `DATABASE_URL` |
| `DATABASE_URL` | a standard PostgreSQL connection string. On Railway use the reference variable `${{Postgres.DATABASE_URL}}` (the private-network URL). No `?schema=`: the model uses two schemas, `catenor_public` and `catenor_private` |
| Generate | `pnpm --filter @catenor-one/api db:generate` (`prisma generate`; no database needed; runs in the image build) |
| Migrate | `pnpm --filter @catenor-one/api db:migrate:deploy` (`prisma migrate deploy`: applies pending committed migrations only; never resets, drops or seeds) |
| Automatic? | **No.** Neither startup nor any deploy setting runs migrations (no pre-deploy step) |
| Migrations | 5, all additive: schemas and tables, CHECK constraints, and plpgsql immutability / append-only triggers. No `DROP` or `TRUNCATE`, no extensions. Railway's default `postgres` role can apply them |
| Clean database | the API boots and stays healthy with no database at all; `/v1/health/db` reports `applied: 0` until step 6 and `applied: 5, packaged: 5` after it |
| Demo data | none is written by Railway. The local runner keeps using its own `DEMO_DATABASE_URL`, and the CRE relay needs no database |

Pointing the local runner at Railway Postgres, so that later read APIs (FD-8) can serve the demo state, is **not**
configured. It would need the Postgres TCP proxy, which the S001 plan (T15.2) keeps off; decide that separately.

## 6. Environment

Nothing is required at boot: the API starts with zero variables. Never paste a value into a file in the repository.

**REQUIRED AT BOOT**

- (none)

**REQUIRED ONLY WHEN THE FEATURE IS USED**

| Variable | Feature | Railway type |
|---|---|---|
| `CATENOR_INTERNAL_API_TOKEN` | the CRE callback relay, whose routes answer 503 `CRE_RELAY_NOT_CONFIGURED` without it | **sealed** variable. Must equal the fresh instance's `CATENOR_INTERNAL_API_TOKEN_VAR` and the Vault DON secret |
| `DATABASE_URL` | `GET /v1/health/db` and the manual `prisma migrate deploy` | reference variable `${{Postgres.DATABASE_URL}}` |

**OPTIONAL**

| Variable | Default and meaning |
|---|---|
| `PORT` | 8080 if unset. **Set to `8080` in production** so that it equals the domain's target port |
| `HOST` | `::` |
| `RAILWAY_GIT_COMMIT_SHA` | injected by Railway; its first 12 characters appear in `/v1/health` |

**LOCAL ONLY — NEVER RAILWAY** (the Railway API never reads these)

- **Management-owner private keys:**
  - `~/.catenor-one/clean-room/<instance>/*`;
  - `CATENOR_PRIVY_KEYS_FILE`, `CATENOR_SPV_KEYS_FILE`, `CATENOR_AGENT_KEYS_FILE` and `CATENOR_INVESTOR_KEYS_FILE`
    (these hold key-file paths).
- **Runtime authorization keys:**
  - `DEMO_{ASSERTION,BOOTSTRAP,SPV,AGENT,TREASURY}_RUNTIME_AUTHORIZATION_KEY`;
  - `CATENOR_{ASSERTION,BOOTSTRAP,SPV,AGENT}_RUNTIME_AUTHORIZATION_KEY`.
- **CRE trigger keys:** `DEMO_CRE_TRIGGER_PRIVATE_KEY` and `CRE_ETH_PRIVATE_KEY`.
- **Privy app credentials:** `PRIVY_APP_ID` and `PRIVY_APP_SECRET`. These come from the **new** final-demo Privy app,
  are loaded by the local runner, and are not used by the Railway API today.
- **Sumsub credentials:** `SUMSUB_APP_TOKEN_VAR` and `SUMSUB_SECRET_KEY_VAR`. These come from the **new** Sumsub sandbox
  and go into `workflows/.env`, which the Vault DON and the local runner use.
- **Runner configuration:** `DEMO_DATABASE_URL`, the public refs in `.catenor-demo/state.env`, `CRE_BIN`,
  `CATENOR_DEMO_CONFIRM` and `CATENOR_HEDERA_LIVE`.

## 7. Privy, Sumsub and CRE for the final demo

- **Privy (new final-demo app).** Railway needs **nothing** from it today. `PRIVY_APP_ID` and `PRIVY_APP_SECRET` go into
  the local `apps/api/.env`. The clean-room stages create the new app's authorization keys, wallets and policies
  themselves, with owner keys under `~/.catenor-one/`. A later operator-login route (T4.2) or the web app would need
  the app id, and allowed origins in the Privy dashboard. That is not implemented.
- **Sumsub (new sandbox level).** Railway needs **nothing**. No webhook or callback URL is used anywhere: the TEE reads
  the applicant review from inside CRE, and the local runner performs the sandbox operator actions. **The new level
  must be named `id-only`**, the name hard-coded in `sumsub-sandbox.ts` and in the workflow config
  (`investorEvidence.levelNames`), or the code and config must change first.
- **CRE.** The public callback URL becomes `https://<railway-host>/v1/internal/cre/identity-confidential/results` (§4).
  Deploying and activating CRE stays a separate, manual step (`scripts/demo/cre/*.sh --live`).

## 8. Deployment procedure (as executed on 2026-09-12)

These are the steps the maintainer ran, and how to repeat them. Run and inspect each step before starting the next.

1. **Local gate.** Run `pnpm check`. Optionally build the image:
   `docker build -f apps/api/Dockerfile -t catenor-one-api:local .`
2. **Push** `main` to GitHub (Railway deploys from the repository).
3. **Create the project and service.** Railway → New Project → Deploy from GitHub repo → `luizoamorim/catenor-one`,
   branch `main`.
   - The automatic first deploy **fails**, and that is expected: the default Railpack builder sees a monorepo root and
     stops. Nothing is created.
   - Do not use Settings → Config-as-code ("Add File Path"). It is deprecated and cannot be enabled on new services.
4. **Configure the service** in the dashboard (Settings):
   - **Source:** Root Directory empty. Auto deploy can stay **disabled**.
   - **Build:** Builder **Dockerfile**, Dockerfile path `apps/api/Dockerfile`. If the path field is missing, set the
     variable `RAILWAY_DOCKERFILE_PATH=apps/api/Dockerfile`. No custom build command.
   - **Deploy:** no custom start command, no pre-deploy step, Healthcheck Path `/v1/health`.
   - **Scale:** 1 replica.
   - **Variables:** `PORT=8080`.
   - **Networking:** Generate Domain with target port `8080`.
   - Then run Deployments → ⋮ → **Redeploy**.
5. **Check liveness.** `curl -s https://<host>/v1/health` should show `startup: INERT`, and `commit` should be the
   deployed commit.
6. **Add PostgreSQL, then migrate by hand.**
   1. Project → Create → Database → PostgreSQL. Do **not** enable its public TCP proxy.
   2. Add the API variable `DATABASE_URL = ${{Postgres.DATABASE_URL}}` and deploy the change.
   3. `curl -s https://<host>/v1/health/db` should show `REACHABLE` with `applied: 0, packaged: 5`.
   4. In the service **Console**, run `cd /app && pnpm --filter @catenor-one/api db:migrate:deploy`. It should print
      `All migrations have been successfully applied.`
   5. `/v1/health/db` should now show `applied: 5, packaged: 5`.

   Other ways to migrate: `railway ssh --service <api>` with the same command; or a pre-deploy step with the same
   command for one deploy, removed afterwards.

   Notes:
   - The Console shell runs as `root`, while the API process runs as `node`.
   - Ignore Prisma's "update available" banner: the project pins 7.10.0.
7. **Later: CRE relay.** Do this only once the fresh clean-room instance exists:
   - Set `CATENOR_INTERNAL_API_TOKEN` as a **sealed** variable, with that instance's `CATENOR_INTERNAL_API_TOKEN_VAR`
     (generated by the local `01-setup-env.sh`). Paste it from the file; never print it. Deploy the change.
   - `curl -s https://<host>/v1/health` should show `creRelay: ENABLED`.
   - `curl -s -X POST https://<host>/v1/internal/cre/identity-confidential/results -d '{}'` should answer 401
     `CALLBACK_UNAUTHENTICATED`; without the token it answers 503 `CRE_RELAY_NOT_CONFIGURED`.
8. **Later: CRE deployment.** Separate authorizations, not part of this deployment:
   - `scripts/demo/cre/configure.sh --relay-url=https://<host>`;
   - put the same token into `workflows/.env`, then run `scripts/demo/cre/secrets.sh --live`;
   - `deploy.sh --live`, then `activate.sh --live`;
   - `configure.sh --workflow-id=<id> --use-deployed`.

Do not redeploy the API while a live CRE run is in flight: relayed results that have not been pulled yet are lost.

## 9. Local verification (no Railway)

```bash
pnpm --filter @catenor-one/api start                                  # PORT=8080; inert; no variables needed
docker build -f apps/api/Dockerfile -t catenor-one-api:local .
docker run --rm -p 8080:8080 catenor-one-api:local
curl -s localhost:8080/v1/health
```
