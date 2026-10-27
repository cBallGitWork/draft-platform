#!/bin/bash
# settings.json's checks: each hook is wired to the event and matcher it guards, and its script is
# there and executable, the Stop gates' timeouts sit over gate_on_stop.py's own, and package.json's
# test deadline under that. A hook that isn't wired never runs, and nothing else would say so.
. "$(dirname "$0")/helpers.sh"

wiring=(  # event|matcher|script, the matcher empty where the entry has none
  'SessionStart||drift_due.py'
  'PreToolUse|Bash|guard_bash.py'
  'PreToolUse|mcp__github__.*|guard_github.py'
  'PostToolUse|Write|Edit|line_ceiling.py'
  'Stop||gate_on_stop.py'
  'SubagentStop||gate_on_stop.py'
)

unwired() { # settings-file: a loud line for each row it doesn't wire, so silence means all are
  local row event matcher script
  for row in "${wiring[@]}"; do
    event=${row%%|*} script=${row##*|} matcher=${row#*|}
    matcher=${matcher%|*}
    "$jq" -e --arg e "$event" --arg m "$matcher" --arg s "/$script" '
      .hooks[$e][]? | select((.matcher // "") == $m) | .hooks[]?.command | select(endswith($s))' \
      "$1" >/dev/null || echo "settings.json: no $event/${matcher:-(no matcher)} hook runs $script"
    [ -x "$hooks/$script" ] || echo "hooks/$script isn't there or isn't executable"
  done
}

settings=$hooks/../settings.json
problems=$(unwired "$settings")
[ -z "$problems" ] || fail "$problems"

# a copy without the Bash guard must be caught, or these checks prove nothing
"$jq" 'del(.hooks.PreToolUse[] | select(.matcher == "Bash"))' "$settings" > "$tmp/no-guard.json"
problems=$(unwired "$tmp/no-guard.json")
[ "$problems" = "settings.json: no PreToolUse/Bash hook runs guard_bash.py" ] ||
  fail "settings.sh: a settings.json with no Bash guard gave: ${problems:-nothing}"

# the gate's own timeout must sit inside the one settings.json gives its hook, or Claude Code kills
# the hook first and a slow gate never reports
gate_timeout=$(sed -n 's/^GATE_TIMEOUT_SECONDS = \([0-9][0-9]*\).*/\1/p' "$hooks/gate_on_stop.py")
[ -n "$gate_timeout" ] || fail "settings.sh: no 'GATE_TIMEOUT_SECONDS = N' line in gate_on_stop.py"
short_timeouts() { # settings-file: a loud line for each Stop or SubagentStop gate entry not over it
  local event
  for event in Stop SubagentStop; do
    "$jq" -e --arg e "$event" --argjson t "${gate_timeout:-0}" '
      [.hooks[$e][]?.hooks[]? | select(.command | endswith("/gate_on_stop.py"))] |
      length > 0 and all((.timeout // 0) > $t)' "$1" >/dev/null ||
      echo "settings.json: the $event gate's timeout isn't over gate_on_stop.py's $gate_timeout seconds"
  done
}
problems=$(short_timeouts "$settings")
[ -z "$problems" ] || fail "$problems"

# a copy whose Stop timeout is under the gate's must be caught
short=100
"$jq" --argjson t "$short" '.hooks.Stop[0].hooks[0].timeout = $t' "$settings" > "$tmp/short-stop.json"
problems=$(short_timeouts "$tmp/short-stop.json")
[ "$problems" = "settings.json: the Stop gate's timeout isn't over gate_on_stop.py's $gate_timeout seconds" ] ||
  fail "settings.sh: a settings.json with a $short-second Stop timeout gave: ${problems:-nothing}"

# package.json's test deadline must sit inside the gate's, with room for the rest of verify
# (typecheck, the hook checks), or the gate times out on a slow run before the tests can say why
test_deadline=$("$jq" -r '.scripts.test' "$hooks/../../package.json" | sed -n 's/.*with-deadline\.mjs \([0-9][0-9]*\) .*/\1/p')
[ -n "$test_deadline" ] || fail "settings.sh: package.json's test script names no with-deadline.mjs seconds"
[ "${test_deadline:-0}" -lt $((gate_timeout - 60)) ] ||
  fail "settings.sh: package.json's ${test_deadline}s test deadline leaves under a minute of gate_on_stop.py's ${gate_timeout}s"
