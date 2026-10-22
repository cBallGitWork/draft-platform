#!/bin/bash
# Runs every hook's checks (.claude/hooks/tests/, one suite per hook, plus settings.sh for their
# wiring) and fails if any suite fails. A suite also runs alone: .claude/hooks/tests/<suite>.sh.
# Every .sh there runs, except a file whose first line starts "# Sourced" (helpers.sh and the like).
# Usage: .claude/hooks/test.sh   (exits 1 on any wrong answer)
set -uo pipefail

tests="$(cd "$(dirname "$0")" && pwd)/tests"
failed=0
for suite in "$tests"/*.sh; do
  name=$(basename "$suite")
  head -n 1 "$suite" | grep -q '^# Sourced ' && continue
  "$suite" || { echo "FAIL .claude/hooks/tests/$name"; failed=1; }
done
[ "$failed" -eq 0 ] && echo "hooks: all checks pass" || exit 1
