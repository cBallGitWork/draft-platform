#!/bin/bash
# settings.json's checks: each hook is wired to the event and matcher it guards, and its script is
# there and executable. A hook that isn't wired never runs, and nothing else would say so.
. "$(dirname "$0")/helpers.sh"

wiring=(  # event|matcher|script, the matcher empty where the entry has none
  'PreToolUse|Bash|guard_bash.py'
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
"$jq" 'del(.hooks.PreToolUse)' "$settings" > "$tmp/no-guard.json"
problems=$(unwired "$tmp/no-guard.json")
[ "$problems" = "settings.json: no PreToolUse/Bash hook runs guard_bash.py" ] ||
  fail "settings.sh: a settings.json with no Bash guard gave: ${problems:-nothing}"
