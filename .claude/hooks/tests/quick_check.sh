#!/bin/bash
# quick_check.py's checks: it runs the project's quickCheck only once the work has changed (uncommitted
# changes, or a commit since the session began), blocks the stop with exit 2 and the output when they
# fail, never checks a tree that already passed again, and lets go at once when stop_hook_active.
. "$(dirname "$0")/helpers.sh"

repo="$tmp/repo" && git init -q -b main "$repo" && git -C "$repo" "${as_tester[@]}" commit -q --allow-empty -m start
mkdir -p "$repo/.studio"
settle() { git -C "$repo" add -A && git -C "$repo" "${as_tester[@]}" commit -q -m "$1"; }
quick() { # command [seconds]: the project's quick check; each run adds a line to $tmp/ran
  "$jq" -n --arg c "echo run >> '$tmp/ran'; $1" --argjson s "${2:-90}" '{quickCheck:$c, quickCheckSeconds:$s}' > "$repo/.studio/project.json"
}
event() { "$jq" -nc --arg e "$1" --arg d "$repo" --argjson a "${2:-false}" '{hook_event_name:$e, session_id:"s1", cwd:$d, stop_hook_active:$a}'; }
runs() { if [ -f "$tmp/ran" ]; then wc -l < "$tmp/ran" | tr -d " "; else echo 0; fi; }
stop_is() { # code [text]: a Stop exits code, with text on stderr when given
  local out code; out=$(event Stop | "$hooks/quick_check.py" 2>&1); code=$?
  [ "$code" -eq "$1" ] || fail "quick_check.py: expected exit $1, got $code: $out"
  [ -z "${2:-}" ] || printf '%s' "$out" | grep -qF -- "$2" || fail "quick_check.py: expected \"$2\", got: $out"
}

silent quick_check.py "$(event Stop)"  # no .studio/project.json: nothing to run
quick 'exit 1' && settle settings
silent quick_check.py "$(event SessionStart)"
stop_is 0 && [ "$(runs)" = 0 ] || fail "quick_check.py: ran on a turn that changed nothing"
echo x > "$repo/new.txt"
stop_is 2 "The quick checks fail"
printf '%s' "$(event Stop true)" | "$hooks/quick_check.py" || fail "quick_check.py: blocked though stop_hook_active"
quick 'echo all good'
stop_is 0 && before=$(runs)
stop_is 0 && [ "$(runs)" = "$before" ] || fail "quick_check.py: checked a tree that already passed again"
echo y >> "$repo/new.txt"
stop_is 0 && [ "$(runs)" -gt "$before" ] || fail "quick_check.py: didn't check a tree changed since it passed"
quick 'echo broken; exit 3' && settle "work"  # clean, but a commit since the session began
stop_is 2 "broken"
quick 'sleep 5' 1 && settle "slow"
stop_is 0 "ran past 1 seconds"
mkdir -p "$repo/sub" && echo z > "$repo/sub/f" && quick 'exit 1'
out=$("$jq" -nc --arg d "$repo/sub" '{hook_event_name:"Stop", session_id:"s1", cwd:$d}' | "$hooks/quick_check.py" 2>&1)
[ $? -eq 2 ] || fail "quick_check.py: a session in a subfolder wasn't checked: $out"
rejects_bad_payloads quick_check.py
fails_loudly "stop_hook_active is str where bool was expected" quick_check.py '{"stop_hook_active":"yes"}'
