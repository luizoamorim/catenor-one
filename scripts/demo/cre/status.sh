#!/usr/bin/env bash
# READ-ONLY: deployment health and executions. `cre workflow get|list`, `cre execution list|status|events|logs`.
# For Confidential Workflows the TEE handler logs are not exported in production; the Catenor callback record
# (90-show-cre-execution.sh) shows the allowlisted result.
source "$(dirname "$0")/cre-common.sh"
cre_header "status" "READ-ONLY" "none" "deployment health + recent executions"
uuid="${1:-}"
cre workflow get "$WORKFLOW" -T "$CRE_TARGET" -R "$PROJECT_ROOT" || echo "(not deployed, or not logged in)"
cre execution list "$WORKFLOW_NAME" --limit 10 || echo "(no executions)"
if [[ -n "$uuid" && "$uuid" != --* ]]; then
  cre execution status "$uuid"
  cre execution events "$uuid"
  cre execution logs "$uuid" || true
fi
