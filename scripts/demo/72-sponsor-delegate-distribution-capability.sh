#!/usr/bin/env bash
# 72-sponsor-delegate-distribution-capability — thin wrapper over the clean-room stage runner (apps/api/scripts/demo/clean-room/). The stage prints its own
# header (step, actor, Catenor operation, changes, sponsors, mode, expected) before doing anything. See DEMO.md.
source "$(dirname "$0")/lib/common.sh"
run_stage 72-sponsor-delegate-distribution-capability "$@"
