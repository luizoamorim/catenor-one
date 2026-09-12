#!/usr/bin/env bash
# 71-sponsor-establish-agent-relationship — thin wrapper over the clean-room stage runner (apps/api/scripts/demo/clean-room/). The stage prints its own
# header (step, actor, Catenor operation, changes, sponsors, mode, expected) before doing anything. See DEMO.md.
source "$(dirname "$0")/lib/common.sh"
run_stage 71-sponsor-establish-agent-relationship "$@"
