#!/bin/bash
# gate_on_stop.py's checks: it blocks a stop (and is otherwise silent) only while watched files are changed and the gate
# fails, in the checkout the stop came from (the payload's cwd, else the project dir).
. "$(dirname "$0")/helpers.sh"

gate_repo() { # dir: a checkout with its package.json committed, so nothing is changed yet
  git init -q -b chore/g "$1" && printf '{}\n' > "$1/package.json" && git -C "$1" add package.json &&
    git -C "$1" "${as_tester[@]}" commit -q -m x
}
stop_in() { # folder [event]: a stop payload from that folder, a builder's SubagentStop by default
  "$jq" -nc --arg d "$1" --arg e "${2:-SubagentStop}" '{hook_event_name:$e,stop_hook_active:false,cwd:$d}'
}
dirty=$tmp/gate-dirty clean=$tmp/gate-clean nopkg=$tmp/gate-nopkg nogit=$(mktemp -d) || exit 1
gate_repo "$dirty" && gate_repo "$clean"
wt_dirty=$tmp/gate-wt-dirty wt_clean=$tmp/gate-wt-clean  # builders work in linked worktrees
git -C "$dirty" worktree add -q -b chore/wd "$wt_dirty" && git -C "$clean" worktree add -q -b chore/wc "$wt_clean"
mkdir -p "$wt_dirty/src" && touch "$wt_dirty/src/a.ts"
export CLAUDE_PROJECT_DIR=$dirty
silent gate_on_stop.py '{}' DRAFT_GATE_CMD=false   # nothing changed
mkdir -p "$dirty/src" && touch "$dirty/src/a.ts"
blocks gate_on_stop.py '{}' DRAFT_GATE_CMD=false
silent gate_on_stop.py '{}' DRAFT_GATE_CMD=true
silent gate_on_stop.py '{"stop_hook_active":true}' DRAFT_GATE_CMD=false
silent gate_on_stop.py "$(stop_in "$wt_clean")" DRAFT_GATE_CMD=false  # a builder's clean worktree
blocks gate_on_stop.py "$(stop_in "$wt_dirty")" CLAUDE_PROJECT_DIR="$clean" DRAFT_GATE_CMD=false
# a subfolder is judged and gated at its checkout's top, where src/a.ts exists, so this gate fails
blocks gate_on_stop.py "$(stop_in "$wt_dirty/src")" CLAUDE_PROJECT_DIR="$clean" DRAFT_GATE_CMD='test ! -e src/a.ts'
# a subagent in the main checkout leaves it to the session's own Stop, which still gates it
silent gate_on_stop.py "$(stop_in "$dirty")" DRAFT_GATE_CMD=false
dirty_stop=$(stop_in "$dirty" Stop)
blocks gate_on_stop.py "$dirty_stop" DRAFT_GATE_CMD=false
mkdir -p "$nogit/src" && touch "$nogit/package.json" "$nogit/src/a.ts"
silent gate_on_stop.py "$(stop_in "$nogit")" DRAFT_GATE_CMD=false  # not a git checkout: no gate
git init -q "$nopkg" && mkdir "$nopkg/src" && touch "$nopkg/src/a.ts"
silent gate_on_stop.py '{}' CLAUDE_PROJECT_DIR="$nopkg" DRAFT_GATE_CMD=false  # no package.json: no gate
rm -rf "$nogit"
# a git status that fails (here a corrupt index) is one line on stderr, never "nothing changed" or a traceback
broken=$tmp/gate-broken && gate_repo "$broken" && printf 'not an index' > "$broken/.git/index"
broken_stop=$(stop_in "$broken" Stop)
one_line() { # what: fails_loudly's stderr (in $tmp/stderr) is a single line
  [ "$(wc -l < "$tmp/stderr")" -eq 1 ] || fail "gate_on_stop.py: $1 said other than one line: $(cat "$tmp/stderr")"
}
fails_loudly "gate_on_stop.py: git status --porcelain -- " gate_on_stop.py "$broken_stop" DRAFT_GATE_CMD=true
one_line "a failed git status"
fails_loudly "failed in $(git -C "$broken" rev-parse --show-toplevel) (exit 128: " gate_on_stop.py "$broken_stop" DRAFT_GATE_CMD=true
# a gate that runs past its timeout is one line saying so, never a traceback (here src/a.ts is changed in $dirty)
slow='sleep 5' short=0.2 dirty_top=$(git -C "$dirty" rev-parse --show-toplevel) ungated='so the stop goes ahead ungated.'
fails_loudly "gate_on_stop.py: the gate ($slow) ran past its $short-second timeout in $dirty_top, $ungated" \
  gate_on_stop.py "$dirty_stop" DRAFT_GATE_CMD="$slow" DRAFT_GATE_TIMEOUT=$short
one_line "a gate past its timeout"
# so is a gate whose program isn't there, or a DRAFT_GATE_TIMEOUT that isn't a number
fails_loudly "gate_on_stop.py: no-such-gate couldn't start in $dirty_top (No such file or directory), $ungated" \
  gate_on_stop.py "$dirty_stop" DRAFT_GATE_CMD=no-such-gate
one_line "a gate that can't start"
fails_loudly "gate_on_stop.py: DRAFT_GATE_TIMEOUT is 'soon', not a number of seconds, $ungated" \
  gate_on_stop.py "$dirty_stop" DRAFT_GATE_CMD=true DRAFT_GATE_TIMEOUT=soon
one_line "a DRAFT_GATE_TIMEOUT that isn't a number"
# a payload it can't read is said on stderr, never taken for {} (here, a dirty checkout whose gate fails)
for ((i = 0; i < ${#bad_payloads[@]}; i += 2)); do
  fails_loudly "${bad_payloads[i + 1]}" gate_on_stop.py "${bad_payloads[i]}" DRAFT_GATE_CMD=false
done
fails_loudly "cwd is int where str was expected" gate_on_stop.py '{"cwd":3}' DRAFT_GATE_CMD=false
fails_loudly "stop_hook_active is str where bool was expected" gate_on_stop.py '{"stop_hook_active":"yes"}' DRAFT_GATE_CMD=false
fails_loudly "hook_event_name is list where str was expected" gate_on_stop.py '{"hook_event_name":[]}' DRAFT_GATE_CMD=false
# each is watched (verify tests or reads it), so a change there alone runs the gate
for path in scripts/a.mjs tests/a.test.ts playwright.config.ts index.html docs/design/plate.md; do
  repo=$tmp/gate-watch-${path%%[/.]*} && gate_repo "$repo"
  silent gate_on_stop.py "$(stop_in "$repo" Stop)" DRAFT_GATE_CMD=false
  mkdir -p "$repo/$(dirname "$path")" && touch "$repo/$path"
  blocks gate_on_stop.py "$(stop_in "$repo" Stop)" DRAFT_GATE_CMD=false
done
