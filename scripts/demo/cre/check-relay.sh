#!/usr/bin/env bash
# LOCAL + Railway: checks that the Railway CRE relay shares the channel secret K with this instance (one signed probe
# callback, pulled straight back and re-authenticated). No CRE execution, nothing persistent; prints status codes only.
#   check-relay.sh      (after configure.sh --relay-url=https://<railway-host>)
source "$(dirname "$0")/../lib/common.sh"
run_stage cre-check-relay "$@"
