# Sourced by tidy_after_merge.sh and follow_main.sh, after helpers.sh: the merge their checks run
# tidy_after_merge.py after, and a stand-in gh that answers for it.
# a stand-in gh: gh pr list waits $GH_LIST_SLEEP seconds, then prints $FAKE_MERGED (none when it is
# unset), or fails when $GH_LIST_FAILS is set; gh pr view notes its args in $GH_ARGS, then prints
# $FAKE_PR, or fails when it is unset
export GH_ARGS=$tmp/gh-args
mkdir "$tmp/bin" && cat > "$tmp/bin/gh" <<'EOF'
#!/bin/bash
if [ "$2" = list ]; then
  sleep "${GH_LIST_SLEEP:-0}"
  [ -z "${GH_LIST_FAILS:-}" ] || { echo "HTTP 502" >&2; exit 1; }
  printf '%s\n' "${FAKE_MERGED:-[]}" && exit 0
fi
printf '%s\n' "$*" > "$GH_ARGS"
[ -n "${FAKE_PR:-}" ] || { echo "no pull requests found" >&2; exit 1; }
printf '%s\n' "$FAKE_PR"
EOF
chmod +x "$tmp/bin/gh" && export PATH="$tmp/bin:$PATH"
number=7  # the pull request every check merges
merge="gh pr merge $number --squash"
pr() { # branch [state] [head]: gh pr view's answer for it, the head its tip in $repo unless given
  local head=${3:-$(git -C "$repo" rev-parse "$1")}
  export FAKE_PR=$("$jq" -nc --arg b "$1" --arg s "${2:-MERGED}" --arg h "$head" \
    --argjson n "$number" '{number:$n,state:$s,headRefName:$b,headRefOid:$h}')
}
