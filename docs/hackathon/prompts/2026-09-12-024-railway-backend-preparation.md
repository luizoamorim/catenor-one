# Catenor One — Railway only / final demo backend

**Date:** 2026-09-12  
**Project:** Catenor One  
**Scope:** prepare the existing Catenor API for a Railway deployment (inert startup, Postgres/Prisma, env classification, CRE public route, deployment docs); no Railway login/link/deploy, no Privy/Sumsub changes, no Hedera broadcasts, no CRE deployment, no clean-room live flow, no frontend; STOP after the report  
**Tool:** Claude Code (main session)  
**Type:** Human prompt to Claude Code — verbatim text of the maintainer's instruction, preserved exactly as provided

## Prompt (verbatim)

````text
==================================================
CATENOR ONE — RAILWAY ONLY / FINAL DEMO BACKEND
==================================================

We are on the final day of ETHOnline.

For this task, work ONLY on preparing the existing Catenor One backend for Railway.

IMPORTANT CHANGE IN DEMO PLAN:

We intend to create, manually and from scratch later:

- a NEW Privy app dedicated to the final demo;
- a NEW Sumsub Sandbox policy/level dedicated to the final demo;
- a fresh final clean-room demo instance.

Therefore:

DO NOT create or modify anything in Privy.
DO NOT create or modify anything in Sumsub.
DO NOT reuse current Privy/Sumsub credentials as permanent Railway configuration.
DO NOT fund wallets.
DO NOT broadcast Hedera transactions.
DO NOT deploy or activate Chainlink CRE.
DO NOT run the clean-room live flow.
DO NOT build the frontend.

The maintainer will perform every external/live step manually, one by one.

==================================================
GOAL
==================================================

Prepare the backend so that it can be safely deployed to Railway and become the
stable HTTPS backend for the final hackathon demo.

Railway will eventually provide:

- the public Catenor API;
- stable HTTPS;
- database connectivity;
- the public endpoint required by the deployed CRE workflow;
- read-only/demo endpoints where already supported.

The backend deployment must NOT itself create demo state.

==================================================
ARCHITECTURE BOUNDARY
==================================================

LOCAL MAINTAINER MACHINE:

- scripts/demo/*
- clean-room orchestration
- management-owner private keys
- Trust Anchor owner keys
- explicit --live operations
- Hedera broadcasts
- maintainer confirmations

RAILWAY:

- Catenor API
- PostgreSQL/runtime DB
- stable HTTPS
- runtime-safe secrets
- CRE HTTP endpoint/gateway
- later frontend-facing read APIs

Management-owner private keys MUST remain local under ~/.catenor-one/.

They must NEVER be:

- copied to Railway;
- copied to repository env files;
- included in Docker images;
- exposed in logs;
- required for normal API startup.

==================================================
INERT STARTUP — NON-NEGOTIABLE
==================================================

Starting or restarting Railway MUST NOT automatically:

- admit a Trust Anchor;
- create a Sponsor;
- create a Catenor Subject;
- issue credentials;
- delegate capabilities;
- create Privy wallets;
- create Privy policies;
- create Sumsub applicants;
- mutate Sumsub state;
- deploy ATS equity;
- issue ATS units;
- create dividends;
- send HBAR;
- deploy CRE;
- activate CRE.

Application startup must be operationally inert.

==================================================
NEW PRIVY / SUMSUB PLAN
==================================================

Current Privy and Sumsub integrations may be used as implementation references,
but the final demo credentials will be provided later by the maintainer.

Therefore Railway preparation should make these values configurable via
environment variables and MUST NOT hardcode existing demo credentials.

For every relevant variable, classify it as:

- REQUIRED AT BOOT
- REQUIRED ONLY WHEN FEATURE IS USED
- OPTIONAL
- LOCAL-ONLY / NEVER RAILWAY

Never print secret values.

If the API currently refuses to start merely because Privy or Sumsub credentials
are absent, report that clearly.

Prefer not to change this behavior unless a very small, safe change is genuinely
needed for Railway deployment.

==================================================
CRE
==================================================

We eventually want Railway to replace ngrok as the stable HTTPS endpoint used by
the deployed Chainlink CRE Confidential Workflow.

Inspect the existing implementation and identify:

- exact existing route;
- method;
- authentication mechanism;
- required runtime env;
- expected public Railway URL form.

Do NOT invent a new CRE route if the current implementation already has one.

Do NOT deploy CRE.

==================================================
DATABASE
==================================================

Inspect the current PostgreSQL setup.

Determine:

- exact DATABASE_URL expectations;
- Prisma version/configuration;
- generation command;
- migration/deploy command;
- whether migrations are currently safe for Railway;
- whether application startup itself mutates schema;
- whether a clean Railway Postgres database can boot safely.

Do NOT delete/reset existing local data.

==================================================
RAILWAY / MONOREPO
==================================================

Inspect the repository and determine the smallest correct Railway deployment for
the existing API.

Check:

- monorepo package structure;
- pnpm workspace;
- API package path;
- build command;
- production start command;
- PORT handling;
- Node version;
- health endpoint;
- Dockerfile;
- railway.toml;
- nixpacks config;
- Procfile;
- root-directory requirements;
- Prisma generation;
- migrations;
- build-time vs runtime env needs.

Do not redesign the repository.

==================================================
THIS TASK
==================================================

You may:

1. inspect the repository;
2. run LOCAL read-only/build/test commands;
3. prepare the minimal Railway deployment files if they are missing;
4. make small deployment-specific fixes if necessary;
5. add documentation for the Railway deployment;
6. run tests locally.

You may NOT:

- create a Railway project;
- log into Railway;
- link Railway;
- deploy;
- set Railway variables;
- provision Railway PostgreSQL;
- push;
- create Privy resources;
- create Sumsub resources;
- perform Hedera broadcasts;
- fund wallets;
- deploy CRE.

==================================================
DELIVERABLE
==================================================

At the end report:

RAILWAY TARGET
- exact service/package being deployed
- root directory
- build command
- start command
- PORT behavior
- health check path

FILES
- existing deployment files reused
- files added/changed
- why each was necessary

DATABASE
- exact safe Railway Postgres setup
- Prisma generate command
- migration command
- whether migrations happen automatically

ENVIRONMENT
- REQUIRED AT BOOT
- REQUIRED ONLY WHEN FEATURE IS USED
- OPTIONAL
- LOCAL-ONLY / NEVER RAILWAY

Do not reveal secret values.

PRIVY
- what Railway will eventually need from the NEW final-demo Privy app
- what remains local
- confirm no current Privy app was changed

SUMSUB
- what Railway will eventually need from the NEW final-demo Sumsub configuration
- whether callback/webhook URL is needed
- confirm no current Sumsub configuration was changed

CRE
- exact existing route intended for public HTTPS use
- future Railway URL shape
- auth requirements
- confirm no CRE deployment happened

SECURITY
- confirm startup is inert
- confirm management keys remain local
- confirm secret scanning

TESTS
- build/test/typecheck results

MANUAL DEPLOYMENT PLAN
Give the maintainer the exact commands/actions required NEXT to deploy Railway,
but DO NOT execute any of them.

The plan must be step-by-step so the maintainer can execute and inspect every
external action manually.

STOP after this report.

Do not proceed to Privy, Sumsub, Hedera, CRE deployment, clean-room execution,
frontend, or video.
````
