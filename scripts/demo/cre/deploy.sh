#!/usr/bin/env bash
# LIVE: deploy identity-confidential to the PRIVATE registry with the generated DEPLOYED config. `cre workflow deploy
# --help`: "Compiles the workflow, uploads the artifacts, and registers the workflow" · --config overrides workflow.yaml.
# The workflow starts PAUSED (activate.sh). handlerInTee / the TEE constraint are compiled into the binary.
source "$(dirname "$0")/cre-common.sh"
refuse_onchain
[[ -f "$PROJECT_ROOT/$WORKFLOW/$DEPLOY_CONFIG" ]] || { echo "BLOCKED: run configure.sh --callback-url=https://… first" >&2; exit 2; }
if grep -q 'REPLACE-WITH-PUBLIC-CALLBACK' "$PROJECT_ROOT/$WORKFLOW/$DEPLOY_CONFIG"; then
  echo "BLOCKED: the deployed config has no public callback URL (configure.sh --callback-url=https://…)" >&2; exit 2
fi
CMD=(workflow deploy "$WORKFLOW" -T "$CRE_TARGET" -R "$PROJECT_ROOT" --config "$DEPLOY_CONFIG")
cre_header "deploy" "LIVE (private registry)" "registers $WORKFLOW_NAME (the CLI prints its status; activate.sh only if PAUSED)" "a workflow id (record it: configure.sh --workflow-id=…)"
echo "Command: cre ${CMD[*]}"
is_live "$@" || { echo "DRY RUN — re-run with --live (maintainer; requires cre login + Confidential Workflows enrollment)."; exit 0; }
cre "${CMD[@]}"
echo "Next: if the status above is PAUSED, scripts/demo/cre/activate.sh --live; then configure.sh --workflow-id=<Workflow ID above> --use-deployed"
