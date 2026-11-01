#!/bin/bash
# tidy_after_merge.py's checks: after gh pr merge (a stand-in gh pr view), a merged pull request's
# branch and its clean worktree go, also when GitHub's head is a merge commit on top of it; one with
# extra commits, uncommitted changes, a head that can't be fetched, a worktree in use (a process
# working in it, git state changed lately, locked), or checked out in the main checkout or the
# folder the merge ran in stays, and says why; nothing else is touched. Earlier leftovers whose pull
# requests merged go on a later merge, while the hook's time lasts. Then the
# main checkout follows origin/main when detached and behind it, but not on a branch, on a commit
# of its own, mid-bisect, when origin can't be fetched, or over a changed file it would overwrite;
# a builder's worktree on its branch stays on it.
. "$(dirname "$0")/helpers.sh"

repo=$tmp/tidy && git init -q -b main "$repo"
git -C "$repo" "${as_tester[@]}" commit -q --allow-empty -m "start"
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

long_ago=202001010000  # a touch -t time no builder could come back from
built() { # branch: a branch with one commit, checked out in its own worktree at $tmp/wt-<branch>,
  # its git state last changed long ago, so no builder is taken to be coming back to it
  git -C "$repo" worktree add -q -b "$1" "$tmp/wt-$1" main
  git -C "$tmp/wt-$1" "${as_tester[@]}" commit -q --allow-empty -m "work on $1"
  local state=$repo/.git/worktrees/wt-$1
  touch -t "$long_ago" "$state/index" "$state/HEAD" "$state/logs/HEAD"
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
for _ in $(seq 100); do lsof -a -p "$sleeper" -d cwd -Fn | grep -q wt-busy/sub && break; sleep 0.05; done
lsof -a -p "$sleeper" -d cwd -Fn | grep -q wt-busy/sub || fail "tidy_after_merge.py: the sleeper never worked in wt-busy/sub"
says "its worktree is in use: a running process works in it" tidy_after_merge.py "$(bash_in "$repo" "$merge")"
kill "$sleeper" && wait "$sleeper" 2>/dev/null
[ -d "$tmp/wt-busy" ] || fail "tidy_after_merge.py: removed a worktree a process works in"
# lsof exits 1 when it can't read some process (another user's, on Linux), yet lists the rest: read them
built unreadable && pr unreadable && mkdir "$tmp/partial-lsof"
printf '#!/bin/bash\nprintf "p1\\nfcwd\\nn%%s\\n" "%s"\nexit 1\n' "$tmp/wt-unreadable" > "$tmp/partial-lsof/lsof"
chmod +x "$tmp/partial-lsof/lsof"
says "a running process works in it" tidy_after_merge.py "$(bash_in "$repo" "$merge")" PATH="$tmp/partial-lsof:$PATH"
built recent && pr recent && touch "$repo/.git/worktrees/wt-recent/index"
says "its git state changed in the last" tidy_after_merge.py "$(bash_in "$repo" "$merge")"
[ -d "$tmp/wt-recent" ] || fail "tidy_after_merge.py: removed a worktree whose git state just changed"
built locked && pr locked && git -C "$repo" worktree lock --reason "claude agent" "$tmp/wt-locked"
says "cannot remove a locked working tree" tidy_after_merge.py "$(bash_in "$repo" "$merge")"
[ -d "$tmp/wt-locked" ] || fail "tidy_after_merge.py: removed a locked worktree"
git -C "$repo" worktree unlock "$tmp/wt-locked"

# earlier leftovers (#933): a worktree kept as in use goes on a later merge once nothing uses it, a
# locked one is passed over without a word, and the branch just merged, kept, is said once
built earlier && pr earlier && touch "$repo/.git/worktrees/wt-earlier/index"
says "its git state changed in the last" tidy_after_merge.py "$(bash_in "$repo" "$merge")"
touch -t "$long_ago" "$repo/.git/worktrees/wt-earlier/index"
built held && git -C "$repo" worktree lock --reason "claude agent" "$tmp/wt-held"
built later && pr later && touch "$repo/.git/worktrees/wt-later/index"
merged_pr() { "$jq" -c --arg b "$1" --arg h "$(git -C "$repo" rev-parse "$1")" --argjson n "$2" \
  '. + [{number:$n,headRefName:$b,headRefOid:$h}]'; }  # branch number: adds it to a gh pr list answer
export FAKE_MERGED=$(echo '[]' | merged_pr later "$number" | merged_pr earlier 5 | merged_pr held 4)
out=$(printf '%s' "$(bash_in "$repo" "$merge")" | "$hooks/tidy_after_merge.py")
printf '%s' "$out" | grep -qF "#5 merged; its local branch earlier and any worktree it was in were removed" ||
  fail "tidy_after_merge.py: an earlier leftover wasn't tidied: $out"
[ -d "$tmp/wt-earlier" ] && fail "tidy_after_merge.py: an earlier leftover's worktree is still there"
[ -d "$tmp/wt-held" ] && has_branch held || fail "tidy_after_merge.py: removed a locked leftover"
printf '%s' "$out" | grep -q "held" && fail "tidy_after_merge.py: spoke of a locked leftover: $out"
[ "$(printf '%s' "$out" | grep -o "branch later" | wc -l)" -eq 1 ] || fail "tidy_after_merge.py: said the merged branch twice: $out"
git -C "$repo" worktree unlock "$tmp/wt-held"
# a gh pr list that fails is said
built listed && pr listed
says "Earlier merged branches weren't tidied: gh pr list failed (HTTP 502)" tidy_after_merge.py "$(bash_in "$repo" "$merge")" GH_LIST_FAILS=1
# out of time: it doesn't look, or it leaves the leftovers it can't finish for a later merge
sweep_by() { # seconds: sweep's lines with a deadline that far off, each call counted as at most 0.1s
  # (only the budget's figure: the calls themselves keep tidy_branch.py's own limit)
  (cd "$repo" && python3 -B -c 'import sys, time; sys.path.insert(0, sys.argv[1]); import tidy_after_merge as t
t.RUN_TIMEOUT_SECONDS = 0.1; print(" ".join(t.sweep(".", set(), time.monotonic() + float(sys.argv[2]))))' "$hooks" "$1")
}
for seconds in 0 1.15; do  # none left, or time for 11 calls when its two lists and a leftover take 12
  out=$(sweep_by "$seconds")
  [ "$out" = "Earlier merged branches weren't tidied: the hook's time ran short before it could look." ] ||
    fail "tidy_after_merge.py: a sweep with ${seconds}s left gave: $out"
done
out=$(GH_LIST_SLEEP=2 sweep_by 1.5)  # time to call gh pr list, none left once it answers
[ "$out" = "2 earlier merged branch(es) wait for a later merge: the hook's time ran short." ] ||
  fail "tidy_after_merge.py: a sweep out of time gave: $out"
has_branch held || fail "tidy_after_merge.py: a sweep out of time still tidied"
# a leftover's tidy that fails partway (git worktree list) is said, and the sweep's other lines kept
out=$(cd "$repo" && python3 -B -c 'import sys, time; sys.path.insert(0, sys.argv[1]); import tidy_after_merge as t
def broken(*_): raise ValueError("git worktree list failed (x)")
t.tidy = broken; print(" ".join(t.sweep(".", set(), time.monotonic() + t.HOOK_SECONDS)))' "$hooks")
[ "$out" = "Earlier merged branches weren't tidied: git worktree list failed (x). Earlier merged branches weren't tidied: git worktree list failed (x)." ] ||
  fail "tidy_after_merge.py: a leftover's failed tidy gave: $out"
unset FAKE_MERGED

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

# a builder's worktree mid-task stays on its branch while the merge moves the main checkout (#938:
# what detached one was its reviewer's git checkout of origin/main, which guard_bash.py refuses)
git -C "$home" worktree add -q -b feat/builder "$tmp/home-builder"
git -C "$tmp/home-builder" "${as_tester[@]}" commit -q --allow-empty -m "the builder's first commit" && landed hook.py
says "moved 1 commit(s) on to origin/main" tidy_after_merge.py "$(bash_in "$home" "$merge")"
at_origin || fail "tidy_after_merge.py: a merge beside a builder's worktree didn't move the main checkout"
[ "$(git -C "$tmp/home-builder" branch --show-current)" = feat/builder ] ||
  fail "tidy_after_merge.py: a merge moved a builder's worktree off its branch"
