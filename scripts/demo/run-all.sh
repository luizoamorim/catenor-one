#!/usr/bin/env bash
# run-all — the whole clean-room walkthrough in order. Safe by default:
#
#   scripts/demo/run-all.sh          every stage; Hedera stages run as READ-ONLY preflights (nothing is broadcast);
#                                    Privy development-app resources, Sumsub SANDBOX applicants and CRE simulations
#                                    ARE created (non-spending, sponsor sandboxes).
#   scripts/demo/run-all.sh --live   same, but the Hedera stages (50 --from-treasury, 60, 61, 62, 63, 83) broadcast —
#                                    each one still asks for its own typed confirmation. Testnet (296) only.
#
# It stops at the first failing stage. 02-reset-local-demo.sh is never part of run-all.
source "$(dirname "$0")/lib/common.sh"
live=()
[[ "${1:-}" == "--live" ]] && live=(--live)
header "Catenor One — clean-room walkthrough" "run-all" "Maintainer" "every stage in order" \
  "$([[ ${#live[@]} -gt 0 ]] && echo 'TESTNET LIVE at the Hedera stages (each confirmed)' || echo 'SAFE: no Hedera broadcast')" \
  "Privy · Sumsub sandbox · Chainlink CRE · Hedera Testnet" "A PAY 6 HBAR · B HOLD 4 HBAR (dry-signed without --live)"

D="$(dirname "$0")"
step() { echo; echo "▶ $*"; "$@"; }
step "$D/00-check-prerequisites.sh"
step "$D/01-setup-env.sh"
step "$D/10-create-trust-domain.sh"
step "$D/11-admit-root-trust-anchor.sh"
step "$D/20-create-sponsor.sh"
step "$D/21-trust-anchor-authorize-sponsor.sh"
step "$D/30-create-spv.sh"
step "$D/31-create-offering-policy.sh"
step "$D/40-create-investor-a.sh"
step "$D/41-create-investor-b.sh"
step "$D/42-create-investor-credentials.sh"
step "$D/43-create-investor-presentations.sh"
step "$D/44-check-offering-eligibility.sh"
step "$D/70-create-distribution-agent.sh"
step "$D/71-sponsor-establish-agent-relationship.sh"
step "$D/72-sponsor-delegate-distribution-capability.sh"
if [[ ${#live[@]} -gt 0 ]]; then
  step "$D/50-fund-testnet-wallets.sh" --wait
else
  step "$D/50-fund-testnet-wallets.sh"
fi
step "$D/60-tokenize-spv.sh" ${live[@]+"${live[@]}"}
step "$D/61-investor-a-invest.sh" ${live[@]+"${live[@]}"}
step "$D/62-investor-b-invest.sh" ${live[@]+"${live[@]}"}
step "$D/63-create-dividend.sh" ${live[@]+"${live[@]}"}
step "$D/80-invalidate-investor-b.sh"
step "$D/81-trigger-revenue.sh"
step "$D/82-run-confidential-distribution.sh"
step "$D/83-execute-approved-distribution.sh" ${live[@]+"${live[@]}"}
step "$D/90-show-cre-execution.sh"
step "$D/93-verify-catenor-audit.sh"
step "$D/99-verify-complete-demo.sh"
echo
echo "Done. Evidence: .catenor-demo/runs/ (private, git-ignored). Independent checks: 91-verify-hedera.sh, 92-verify-privy.sh."
