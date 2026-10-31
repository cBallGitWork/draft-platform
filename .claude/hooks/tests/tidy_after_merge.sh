#!/bin/bash
# tidy_after_merge.py's checks: after gh pr merge (a stand-in gh pr view), a merged pull request's
# branch and its clean worktree go, also when GitHub's head is a merge commit on top of it; one with
# extra commits, uncommitted changes, a head that can't be fetched, or checked out in the main
# checkout or the folder the merge ran in stays, and says why; nothing else is touched.
. "$(dirname "$0")/helpers.sh"

repo=$tmp/tidy && git init -q -b main "$repo"
git -C "$repo" "${as_tester[@]}" commit -q --allow-empty -m "start"
# a stand-in gh: gh pr view notes its args in $GH_ARGS, then prints $FAKE_PR, or fails when it is unset
export GH_ARGS=$tmp/gh-args
mkdir "$tmp/bin" && cat > "$tmp/bin/gh" <<'EOF'
#!/bin/bash
printf '%s\n' "$*" > "$GH_ARGS"
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
# a stand-in GitHub: a bare origin whose pull request ref the hook fetches when a tip isn't the head
origin=$tmp/origin.git && git init -q --bare -b main "$origin" && git -C "$repo" remote add origin "$origin"
git -C "$repo" push -q origin main
pull_head=refs/pull/7/head
on_github() { git -C "$repo" push -q -f origin "$1:$pull_head"; }  # commit: the pull request's head

# merged, every commit in the pull request, worktree clean: both go
built done && pr done
says "its local branch done and any worktree it was in were removed" tidy_after_merge.py "$(bash_in "$repo" "$merge")"
has_branch done && fail "tidy_after_merge.py: the merged branch is still there"
[ -d "$tmp/wt-done" ] && fail "tidy_after_merge.py: the merged branch's worktree is still there"

# a branch with a commit the pull request doesn't hold stays
built extra && pr extra MERGED "$(git -C "$repo" rev-parse main)" && on_github main
says "holds commits the pull request doesn't" tidy_after_merge.py "$(bash_in "$repo" "$merge")"
has_branch extra || fail "tidy_after_merge.py: removed a branch with commits the pull request lacks"

# gh pr update-branch: on GitHub, main merged into the pull request, a head the branch here is
# behind and has never seen (made in another clone); the hook fetches it, and both go
built updated && git -C "$repo" push -q origin updated
github=$tmp/github && git clone -q "$origin" "$github"
git -C "$github" "${as_tester[@]}" commit -q --allow-empty -m "main moved on" && moved=$(git -C "$github" rev-parse HEAD)
git -C "$github" switch -q updated && git -C "$github" "${as_tester[@]}" merge -q --no-ff --no-edit "$moved"
git -C "$github" push -q -f origin "HEAD:$pull_head" && updated_head=$(git -C "$github" rev-parse HEAD)
git -C "$repo" cat-file -e "$updated_head" 2>/dev/null && fail "tidy_after_merge.py's checks: the updated head was already here"
pr updated MERGED "$updated_head"
says "its local branch updated and any worktree it was in were removed" tidy_after_merge.py "$(bash_in "$repo" "$merge")"
has_branch updated && fail "tidy_after_merge.py: a branch behind its updated pull request was kept"
[ -d "$tmp/wt-updated" ] && fail "tidy_after_merge.py: a branch behind its updated pull request kept its worktree"

# a head gh names that the fetch didn't bring keeps the branch, and says so
built unknown && pr unknown MERGED 0123456789abcdef0123456789abcdef01234567
says "git merge-base failed" tidy_after_merge.py "$(bash_in "$repo" "$merge")"
has_branch unknown || fail "tidy_after_merge.py: removed a branch whose pull request head isn't here"

# a head that can't be fetched keeps the branch, and says so
built unfetched && pr unfetched MERGED "$(git -C "$repo" rev-parse main)"
git -C "$origin" update-ref -d "$pull_head"
says "fetching that head to check failed" tidy_after_merge.py "$(bash_in "$repo" "$merge")"
has_branch unfetched || fail "tidy_after_merge.py: removed a branch whose pull request head couldn't be fetched"

# a worktree with uncommitted changes stays
built dirty && pr dirty && touch "$tmp/wt-dirty/new.txt"
says "uncommitted changes" tidy_after_merge.py "$(bash_in "$repo" "$merge")"
[ -f "$tmp/wt-dirty/new.txt" ] || fail "tidy_after_merge.py: removed a worktree with uncommitted changes"

# an ignored file a build doesn't make again (.env.local) keeps the worktree; build output doesn't
printf '.env*\nnode_modules/\n' > "$repo/.gitignore"
git -C "$repo" add .gitignore && git -C "$repo" "${as_tester[@]}" commit -q -m "ignore"
built secret && pr secret && touch "$tmp/wt-secret/.env.local"
says "its worktree holds .env.local" tidy_after_merge.py "$(bash_in "$repo" "$merge")"
[ -f "$tmp/wt-secret/.env.local" ] || fail "tidy_after_merge.py: removed a worktree holding .env.local"
built rebuilt && pr rebuilt && mkdir "$tmp/wt-rebuilt/node_modules" && touch "$tmp/wt-rebuilt/node_modules/x"
says "were removed" tidy_after_merge.py "$(bash_in "$repo" "$merge")"
[ -d "$tmp/wt-rebuilt" ] && fail "tidy_after_merge.py: build output alone kept a worktree"

# a worktree whose folder is already gone doesn't hold the branch for good
built vanished && pr vanished && rm -rf "$tmp/wt-vanished"
says "were removed" tidy_after_merge.py "$(bash_in "$repo" "$merge")"
has_branch vanished && fail "tidy_after_merge.py: a gone worktree kept its branch"

# gh pr merge's other ways of naming the pull request reach gh pr view: --repo, a url, none
views=(  # merge command|the gh pr view it makes
  'gh pr merge --repo o/r 7 --squash|pr view --repo o/r 7 --json number,state,headRefName,headRefOid'
  'gh pr merge https://github.com/o/r/pull/7|pr view https://github.com/o/r/pull/7 --json number,state,headRefName,headRefOid'
  'gh pr merge --squash|pr view --json number,state,headRefName,headRefOid'
)
for row in "${views[@]}"; do
  built "by-${#row}" && pr "by-${#row}"
  says "were removed" tidy_after_merge.py "$(bash_in "$repo" "${row%%|*}")"
  [ "$(cat "$GH_ARGS")" = "${row#*|}" ] || fail "tidy_after_merge.py: ${row%%|*} asked gh: $(cat "$GH_ARGS")"
done

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
