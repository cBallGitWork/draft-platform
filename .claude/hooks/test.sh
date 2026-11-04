#!/bin/bash
# Runs every hook's checks (.claude/hooks/tests/, one suite per hook, plus settings.sh for their
# wiring) and fails if any suite fails. The suites run side by side, each into its own output
# file, which is printed whole once all have finished, so one suite's lines stay together. A suite
# also runs alone: .claude/hooks/tests/<suite>.sh.
# Every .sh there runs, except a file whose first line starts "# Sourced" (helpers.sh and the like).
# Usage: .claude/hooks/test.sh   (exits 1 on any wrong answer)
set -uo pipefail

tests="$(cd "$(dirname "$0")" && pwd)/tests"
out=$(mktemp -d) || exit 1
trap 'rm -rf "$out"' EXIT
names=() pids=()
for suite in "$tests"/*.sh; do
  name=$(basename "$suite")
  head -n 1 "$suite" | grep -q '^# Sourced ' && continue
  "$suite" > "$out/$name" 2>&1 &
  names+=("$name") pids+=($!)
done
failed=0
for i in "${!pids[@]}"; do
  wait "${pids[$i]}" || { echo "FAIL .claude/hooks/tests/${names[$i]}" >> "$out/${names[$i]}"; failed=1; }
done
for name in "${names[@]}"; do cat "$out/$name"; done
[ "$failed" -eq 0 ] && echo "hooks: all checks pass" || exit 1
