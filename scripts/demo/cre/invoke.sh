#!/usr/bin/env bash
# How a DEPLOYED workflow is invoked: there is no CLI helper. The HTTP trigger is called through the CRE gateway
# (https://01.gateway.zone-a.cre.chain.link — the documented enterprise-gateway URL answered "Workflow not found") as JSON-RPC `workflows.execute`, with a
# JWT (alg ETH) signed by the key in authorizedKeys — implemented in
# apps/api/src/infrastructure/confidential-compute/cre-gateway-verifier.ts (spec: docs.chain.link/cre/guides/workflow/
# using-triggers/http-trigger/triggering-deployed-workflows). The demo stages use it after `configure.sh --use-deployed`:
source "$(dirname "$0")/cre-common.sh"
cre_header "invoke" "LIVE (through the stages)" "one execution per confidential stage" "DELIVERED callbacks labeled DEPLOYED"
cat <<TXT
  1. scripts/demo/cre/configure.sh --callback-url=https://<public tunnel to 127.0.0.1:8787>
  2. scripts/demo/cre/secrets.sh --live && scripts/demo/cre/deploy.sh --live && scripts/demo/cre/activate.sh --live
  3. scripts/demo/cre/configure.sh --workflow-id=<id from 'cre workflow list'> --use-deployed
  4. scripts/demo/42-create-investor-credentials.sh   (or 44 / 82) — each call is one gateway trigger
     NOTE: the deployed HTTP trigger is rate-limited (limits: every60s:1) — space the confidential stages ≥ 60 s.
  5. scripts/demo/cre/status.sh [execution-uuid]  ·  scripts/demo/90-show-cre-execution.sh
TXT
