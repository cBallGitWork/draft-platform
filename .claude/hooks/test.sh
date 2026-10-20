#!/bin/bash
# Runs every hook's checks (tests/, one suite per hook), each against payloads it must refuse or
# let through, and fails if any suite fails. A suite also runs alone: tests/<hook>.sh.
# Usage: .claude/hooks/test.sh   (exits 1 on any wrong answer)
set -uo pipefail

tests="$(cd "$(dirname "$0")" && pwd)/tests"
failed=0
for suite in guard_bash gate_on_stop line_ceiling; do
  "$tests/$suite.sh" || { echo "FAIL tests/$suite.sh"; failed=1; }
done
[ "$failed" -eq 0 ] && echo "hooks: all checks pass" || exit 1
