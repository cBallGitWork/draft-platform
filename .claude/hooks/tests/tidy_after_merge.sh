#!/bin/bash
# tidy_after_merge.py's checks: after gh pr merge (a stand-in gh pr view), a merged pull request's
# branch and its clean worktree go; one with extra commits, uncommitted changes, or checked out in
# the main checkout or the folder the merge ran in stays, and says why; nothing else is touched.
. "$(dirname "$0")/helpers.sh"

repo=$tmp/tidy && git init -q -b main "$repo"
git -C "$repo" "${as_tester[@]}" commit -q --allow-empty -m "start"
# a stand-in gh: gh pr view prints $FAKE_PR, or fails when it is unset
mkdir "$tmp/bin" && cat > "$tmp/bin/gh" <<'EOF'
#!/bin/bash
[ -n "${FAKE_PR:-}" ] || { echo "no pull requests found" >&2; exit 1; }
printf '%s\n' "$FAKE_PR"
EOF
chmod +x "$tmp/bin/gh" && export PATH="$tmp/bin:$PATH"
merge='gh pr merge 7 --squash'

built() { # branch: a branch with one commit, checked out in its own worktree at $tmp/wt-<branch>
  git -C "$repo" worktree add -q -b "$1" "$tmp/wt-$1" main
  git -C "$tmp/wt-$1" "${as_tester[@]}" commit -q --allow-empty -m "work on $1"
}
pr() { # branch [state] [head]: gh pr view's answer for it, the head its tip unless given
  local head=${3:-$(git -C "$repo" rev-parse "$1")}
  export FAKE_PR=$("$jq" -nc --arg b "$1" --arg s "${2:-MERGED}" --arg h "$head" \
    '{number:7,state:$s,headRefName:$b,headRefOid:$h}')
}
has_branch() { git -C "$repo" rev-parse --verify --quiet "refs/heads/$1" >/dev/null; }

# merged, every commit in the pull request, worktree clean: both go
built done && pr done
says "its local branch done and any worktree it was in were removed" tidy_after_merge.py "$(bash_in "$repo" "$merge")"
has_branch done && fail "tidy_after_merge.py: the merged branch is still there"
[ -d "$tmp/wt-done" ] && fail "tidy_after_merge.py: the merged branch's worktree is still there"

# a branch with a commit the pull request doesn't hold stays
built extra && pr extra MERGED "$(git -C "$repo" rev-parse main)"
says "holds commits the pull request doesn't" tidy_after_merge.py "$(bash_in "$repo" "$merge")"
has_branch extra || fail "tidy_after_merge.py: removed a branch with commits the pull request lacks"

# a worktree with uncommitted changes stays
built dirty && pr dirty && touch "$tmp/wt-dirty/new.txt"
says "uncommitted changes" tidy_after_merge.py "$(bash_in "$repo" "$merge")"
[ -f "$tmp/wt-dirty/new.txt" ] || fail "tidy_after_merge.py: removed a worktree with uncommitted changes"

# the folder the merge ran in stays, and so does the main checkout
built here && pr here
says "the folder the merge ran in" tidy_after_merge.py "$(bash_in "$tmp/wt-here" "$merge")"
[ -d "$tmp/wt-here" ] || fail "tidy_after_merge.py: removed the folder the merge ran in"
git -C "$repo" "${as_tester[@]}" switch -q -c home && pr home
says "the main checkout" tidy_after_merge.py "$(bash_in "$repo" "$merge")"
has_branch home || fail "tidy_after_merge.py: removed the main checkout's branch"
git -C "$repo" switch -q main

# not merged yet (a failed merge, or --auto): it stays
built waiting && pr waiting OPEN
says "isn't merged yet (OPEN)" tidy_after_merge.py "$(bash_in "$repo" "$merge")"
has_branch waiting || fail "tidy_after_merge.py: removed an unmerged branch"

# no local branch, or no merge: nothing to say
pr gone-already MERGED "$(git -C "$repo" rev-parse main)" && silent tidy_after_merge.py "$(bash_in "$repo" "$merge")"
silent tidy_after_merge.py "$(bash_in "$repo" 'gh pr view 7')"
# a pull request gh can't read is said, never passed over
unset FAKE_PR
says "the branch wasn't tidied: gh pr view failed" tidy_after_merge.py "$(bash_in "$repo" "$merge")"

# a payload it can't read is said on stderr
for ((i = 0; i < ${#bad_payloads[@]}; i += 2)); do
  fails_loudly "${bad_payloads[i + 1]}" tidy_after_merge.py "${bad_payloads[i]}"
done
fails_loudly "command is int where str was expected" tidy_after_merge.py '{"tool_input":{"command":7}}'
