#!/usr/bin/env bash
# LOCAL: generate the DEPLOYED workflow config (.deploy/config.json), the HTTP-trigger key (authorizedKeys) and record
# the public callback URL / workflow id. Never deploys.
#   configure.sh --callback-url=https://<public-host>            (forwards to the local receiver 127.0.0.1:8787)
#   configure.sh --workflow-id=<64 hex>   (after deploy.sh --live; from `cre workflow list`)
#   configure.sh --use-deployed | --use-simulation              (which trigger the demo stages use)
source "$(dirname "$0")/../lib/common.sh"
run_stage cre-configure "$@"
