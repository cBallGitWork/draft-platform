#!/bin/bash
# checks_gate.py's checks, through guard_bash.py (gh pr merge) and guard_github.py
# (merge_pull_request): a merge waits until every check on the pull request's head has passed and
# that head holds all of main; a head with no checks, or one GitHub won't describe, waits too.
# The stand-in gh's API answers are helpers.sh's, set by its FAKE_ variables.
. "$(dirname "$0")/helpers.sh"

# one commit with origin/main, so the drift gate lets every merge through; no picture, so approval does
repo=$tmp/app && git init -q -b main "$repo" && git -C "$repo" "${as_tester[@]}" commit -q --allow-empty -m start
git -C "$repo" update-ref refs/remotes/origin/main HEAD
stand_in_gh <<'EOF'
[ "$1 $2" = "pr view" ] && { echo '{"body":"","labels":[]}'; exit 0; }
echo "stand-in gh: no answer for $*" >&2; exit 1
EOF
merge() { bash_in "$repo" "$1"; }
merge_tool() { gh_call merge_pull_request "${1:-$pr_five}"; }  # [tool input]
pr_five='{"owner":"o","repo":"r","pullNumber":5}'

# green and up to date: every form of naming the pull request merges
for c in 'gh pr merge 5 --squash' 'gh pr merge "#5" --squash' 'gh pr merge -R o/r 5 --squash' \
  'gh pr merge --repo=o/r 5 --squash' 'gh pr merge https://github.com/o/r/pull/5 --squash --delete-branch' \
  'gh pr merge feat/x --squash'; do
  check allow guard_bash.py "$(merge "$c")"
done
check allow guard_github.py "$(merge_tool)"
# a check run skipped or neutral has passed; a commit status of success has too
FAKE_CHECK_RUNS='[{"name":"smoke","status":"completed","conclusion":"skipped"},{"name":"x","status":"completed","conclusion":"neutral"}]' \
  check allow guard_bash.py "$(merge 'gh pr merge 5 --squash')"
FAKE_STATUSES='[{"context":"Vercel","state":"success"}]' check allow guard_github.py "$(merge_tool)"

# behind main: its checks ran on an older main, as the glossary failure of 1 Nov 2026 did
export FAKE_BEHIND=2
check deny guard_bash.py "$(merge 'gh pr merge 5 --squash')"
check deny guard_github.py "$(merge_tool)"
says "Pull request #5 is 2 commit(s) behind main" guard_bash.py "$(merge 'gh pr merge 5 --squash')"
says "Update the branch with main" guard_github.py "$(merge_tool)"
check allow guard_bash.py "$(merge 'gh pr view 5')"  # only a merge is gated
check allow guard_github.py "$(gh_call pull_request_read '{"method":"get","owner":"o","repo":"r","pullNumber":5}')"
unset FAKE_BEHIND

# a check failed, cancelled or still running, a status not success, or no checks at all
for runs in '[{"name":"verify","status":"completed","conclusion":"failure"}]' \
  '[{"name":"verify","status":"completed","conclusion":"cancelled"}]' \
  '[{"name":"verify","status":"completed","conclusion":"success"},{"name":"smoke","status":"in_progress","conclusion":null}]' \
  '[]'; do
  export FAKE_CHECK_RUNS=$runs
  check deny guard_bash.py "$(merge 'gh pr merge 5 --squash')"
  check deny guard_github.py "$(merge_tool)"
done
FAKE_CHECK_RUNS='[{"name":"verify","status":"completed","conclusion":"failure"}]' \
  says "checks haven't all passed: verify (failure)" guard_github.py "$(merge_tool)"
FAKE_CHECK_RUNS='[{"name":"smoke","status":"in_progress","conclusion":null}]' \
  says "smoke (in_progress)" guard_bash.py "$(merge 'gh pr merge 5 --squash')"
FAKE_CHECK_RUNS='[]' says "no checks have run" guard_bash.py "$(merge 'gh pr merge 5 --squash')"
FAKE_STATUSES='[{"context":"Vercel","state":"pending"}]' says "Vercel (pending)" guard_github.py "$(merge_tool)"
unset FAKE_CHECK_RUNS

# what it can't read is a denial, never a pass
for part in pulls/5 check-runs /status compare; do
  export FAKE_API_FAIL=$part
  check deny guard_bash.py "$(merge 'gh pr merge 5 --squash')"
  check deny guard_github.py "$(merge_tool)"
done
says "Can't read pull request #5's checks" guard_github.py "$(merge_tool)"
unset FAKE_API_FAIL
FAKE_OPEN_PRS='[]' says "no single open pull request has the branch feat/x" guard_bash.py "$(merge 'gh pr merge feat/x')"
check deny guard_github.py "$(merge_tool '{"owner":"o","repo":"r"}')"
says "Can't tell which pull request this merges" guard_github.py "$(merge_tool '{"owner":"o","pullNumber":5}')"
