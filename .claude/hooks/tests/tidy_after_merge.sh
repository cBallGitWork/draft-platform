#!/bin/bash
# tidy_after_merge.py's checks: after gh pr merge (a stand-in gh pr view), a merged pull request's
# branch and its clean worktree go, also when GitHub's head is a merge commit on top of it; one with
# extra commits, uncommitted changes, a head that can't be fetched, a worktree in use (a process
# working in it, git state changed lately, locked), or checked out in the main checkout or the
# folder the merge ran in stays, and says why; nothing else is touched. Then the
# main checkout follows origin/main when detached and behind it, but not on a branch, on a commit
# of its own, mid-bisect, when origin can't be fetched, or over a changed file it would overwrite.
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
number=7  # the pull request every check merges
merge="gh pr merge $number --squash"

built() { # branch: a branch with one commit, checked out in its own worktree at $tmp/wt-<branch>,
  # its git state last changed long ago, so no builder is taken to be coming back to it
  git -C "$repo" worktree add -q -b "$1" "$tmp/wt-$1" main
  git -C "$tmp/wt-$1" "${as_tester[@]}" commit -q --allow-empty -m "work on $1"
  local state=$repo/.git/worktrees/wt-$1
  touch -t 202001010000 "$state/index" "$state/HEAD" "$state/logs/HEAD"
}
pr() { # branch [state] [head]: gh pr view's answer for it, the head its tip unless given
  local head=${3:-$(git -C "$repo" rev-parse "$1")}
  export FAKE_PR=$("$jq" -nc --arg b "$1" --arg s "${2:-MERGED}" --arg h "$head" \
    --argjson n "$number" '{number:$n,state:$s,headRefName:$b,headRefOid:$h}')
}
has_branch() { git -C "$repo" rev-parse --verify --quiet "refs/heads/$1" >/dev/null; }
# a stand-in GitHub: a bare origin whose pull request ref the hook fetches when a tip isn't the head
origin=$tmp/origin.git && git init -q --bare -b main "$origin" && git -C "$repo" remote add origin "$origin"
git -C "$repo" push -q origin main
pull_head=refs/pull/$number/head
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
refs_before=$(git -C "$repo" for-each-ref --format='%(refname)' | grep -vx refs/heads/updated)
says "its local branch updated and any worktree it was in were removed" tidy_after_merge.py "$(bash_in "$repo" "$merge")"
has_branch updated && fail "tidy_after_merge.py: a branch behind its updated pull request was kept"
[ -d "$tmp/wt-updated" ] && fail "tidy_after_merge.py: a branch behind its updated pull request kept its worktree"
[ "$(git -C "$repo" for-each-ref --format='%(refname)')" = "$refs_before" ] || fail "tidy_after_merge.py: the fetch left refs behind"
[ -e "$repo/.git/FETCH_HEAD" ] && fail "tidy_after_merge.py: the fetch wrote FETCH_HEAD"

# a head gh names that the fetch didn't bring keeps the branch, and says so
absent_head=0123456789abcdef0123456789abcdef01234567  # a commit no repo here holds
built unknown && pr unknown MERGED "$absent_head"
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

# an ignored file that isn't throwaway (.env.local) keeps the worktree; build output and screenshots don't
printf '.env*\nnode_modules/\n__pycache__/\n.shots/\n' > "$repo/.gitignore"
git -C "$repo" add .gitignore && git -C "$repo" "${as_tester[@]}" commit -q -m "ignore"
built secret && pr secret && touch "$tmp/wt-secret/.env.local"
says "its worktree holds .env.local" tidy_after_merge.py "$(bash_in "$repo" "$merge")"
[ -f "$tmp/wt-secret/.env.local" ] || fail "tidy_after_merge.py: removed a worktree holding .env.local"
built rebuilt && pr rebuilt && mkdir "$tmp/wt-rebuilt/node_modules" && touch "$tmp/wt-rebuilt/node_modules/x"
says "were removed" tidy_after_merge.py "$(bash_in "$repo" "$merge")"
[ -d "$tmp/wt-rebuilt" ] && fail "tidy_after_merge.py: build output alone kept a worktree"
built shots && pr shots && mkdir "$tmp/wt-shots/.shots" && touch "$tmp/wt-shots/.shots/x.png"
says "were removed" tidy_after_merge.py "$(bash_in "$repo" "$merge")"
[ -d "$tmp/wt-shots" ] && fail "tidy_after_merge.py: screenshots in .shots/ alone kept a worktree"
# build output in a subfolder (the hook checks' own .claude/hooks/__pycache__/) doesn't keep it either,
# and a .env in a subfolder still does
built nested && pr nested && mkdir -p "$tmp/wt-nested/hooks/__pycache__" && touch "$tmp/wt-nested/hooks/__pycache__/x.pyc"
says "were removed" tidy_after_merge.py "$(bash_in "$repo" "$merge")"
[ -d "$tmp/wt-nested" ] && fail "tidy_after_merge.py: nested build output kept a worktree"
built nestedsecret && pr nestedsecret && mkdir "$tmp/wt-nestedsecret/app" && touch "$tmp/wt-nestedsecret/app/.env.local"
says "its worktree holds app/.env.local" tidy_after_merge.py "$(bash_in "$repo" "$merge")"

# a worktree in use stays (#929): one a process works in, one whose git state changed lately (a
# builder that finished may be resumed), and one a running builder has locked
built busy && pr busy && mkdir "$tmp/wt-busy/sub"
(cd "$tmp/wt-busy/sub" && exec sleep 60) & sleeper=$!
for _ in $(seq 100); do lsof -a -p "$sleeper" -d cwd -Fn | grep -q wt-busy/sub && break; done
says "its worktree is in use: a running process works in it" tidy_after_merge.py "$(bash_in "$repo" "$merge")"
kill "$sleeper" && wait "$sleeper" 2>/dev/null
[ -d "$tmp/wt-busy" ] || fail "tidy_after_merge.py: removed a worktree a process works in"
built recent && pr recent && touch "$repo/.git/worktrees/wt-recent/index"
says "its git state changed in the last" tidy_after_merge.py "$(bash_in "$repo" "$merge")"
[ -d "$tmp/wt-recent" ] || fail "tidy_after_merge.py: removed a worktree whose git state just changed"
built locked && pr locked && git -C "$repo" worktree lock --reason "claude agent" "$tmp/wt-locked"
says "cannot remove a locked working tree" tidy_after_merge.py "$(bash_in "$repo" "$merge")"
[ -d "$tmp/wt-locked" ] || fail "tidy_after_merge.py: removed a locked worktree"
git -C "$repo" worktree unlock "$tmp/wt-locked"

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

# after a merge, the main checkout follows origin/main when it is detached and behind it: hooks run
# from its .claude/hooks/, so a merged hook fix takes effect only once it has moved
upstream=$tmp/upstream.git && git init -q --bare -b main "$upstream"
pusher=$tmp/pusher && git clone -q "$upstream" "$pusher" 2>/dev/null
landed() { # file: a commit on origin's main that writes it
  echo "$RANDOM" > "$pusher/$1" && git -C "$pusher" add "$1"
  git -C "$pusher" "${as_tester[@]}" commit -q -m "change $1" && git -C "$pusher" push -q origin HEAD:main
}
landed hook.py && landed .gitignore
home=$tmp/home-checkout && git clone -q "$upstream" "$home" && git -C "$home" checkout -q --detach
pr not-here MERGED "$(git -C "$home" rev-parse HEAD)"  # no local branch: only the main checkout is said
at_origin() { [ "$(git -C "$home" rev-parse HEAD)" = "$(git -C "$upstream" rev-parse main)" ]; }
stayed() { [ "$(git -C "$home" rev-parse HEAD)" = "$before" ]; }  # still at the commit noted in $before

# detached and behind: it moves, and a changed file the move doesn't touch is kept
landed hook.py && echo "mine" >> "$home/.gitignore"
says "moved 1 commit(s) on to origin/main" tidy_after_merge.py "$(bash_in "$home" "$merge")"
at_origin || fail "tidy_after_merge.py: a detached main checkout behind origin/main didn't move"
grep -q mine "$home/.gitignore" || fail "tidy_after_merge.py: the move lost a changed file it doesn't touch"
git -C "$home" symbolic-ref -q HEAD && fail "tidy_after_merge.py: the moved main checkout isn't detached"

# already at origin/main: nothing new to say
silent tidy_after_merge.py "$(bash_in "$home" "$merge")"

# a changed file the move would overwrite: git refuses, it stays, and says why
landed .gitignore && before=$(git -C "$home" rev-parse HEAD)
says "would be overwritten" tidy_after_merge.py "$(bash_in "$home" "$merge")"
stayed || fail "tidy_after_merge.py: moved over a changed file"
grep -q mine "$home/.gitignore" || fail "tidy_after_merge.py: lost the changed file it refused to overwrite"
git -C "$home" checkout -q -- .gitignore

# detached on a commit of its own: it stays, and says so
git -C "$home" "${as_tester[@]}" commit -q --allow-empty -m "local work" && before=$(git -C "$home" rev-parse HEAD)
says "it holds 1 commit(s) origin/main doesn't" tidy_after_merge.py "$(bash_in "$home" "$merge")"
stayed || fail "tidy_after_merge.py: moved a main checkout off its own commit"
git -C "$home" checkout -q --detach HEAD~1

# a bisect (or rebase) under way, which leaves HEAD detached: it stays, and says so
before=$(git -C "$home" rev-parse HEAD) && touch "$home/.git/BISECT_LOG"
says "a git operation is under way there (BISECT_LOG)" tidy_after_merge.py "$(bash_in "$home" "$merge")"
stayed || fail "tidy_after_merge.py: moved a main checkout mid-bisect"
rm "$home/.git/BISECT_LOG"

# origin can't be reached: it stays, and says so
git -C "$home" remote set-url origin "$tmp/no-such-origin.git"
says "git fetch failed" tidy_after_merge.py "$(bash_in "$home" "$merge")"
stayed || fail "tidy_after_merge.py: moved a main checkout when the fetch failed"
git -C "$home" remote set-url origin "$upstream"

# on a branch: it stays, whatever origin/main holds
git -C "$home" switch -q -c local && before=$(git -C "$home" rev-parse HEAD)
silent tidy_after_merge.py "$(bash_in "$home" "$merge")"
stayed || fail "tidy_after_merge.py: moved a main checkout on a branch"
[ "$(git -C "$home" branch --show-current)" = local ] || fail "tidy_after_merge.py: switched a main checkout off its branch"

# a merge run in another worktree moves the main checkout too
git -C "$home" checkout -q --detach && git -C "$home" worktree add -q --detach "$tmp/home-wt"
says "moved 1 commit(s) on to origin/main" tidy_after_merge.py "$(bash_in "$tmp/home-wt" "$merge")"
at_origin || fail "tidy_after_merge.py: a merge in a worktree didn't move the main checkout"
