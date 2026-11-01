#!/bin/bash
# follow_main.py's checks, run through tidy_after_merge.py after gh pr merge (a stand-in gh pr view):
# the main checkout follows origin/main when detached and behind it, but not on a branch, on a
# commit of its own, mid-bisect, when origin can't be fetched, or over a changed file it would
# overwrite; a builder's worktree on its branch stays on it.
. "$(dirname "$0")/helpers.sh"
. "$(dirname "$0")/merge_gh.sh"

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
