#!/bin/bash
# settings.json's checks: each hook is wired to the event and matcher it guards, and its script is
# there and executable. A hook that isn't wired never runs, and nothing else would say so.
. "$(dirname "$0")/helpers.sh"

wiring=(  # event|matcher|script, the matcher empty where the entry has none
  'SessionStart||setup_current.py'
  'PreToolUse|Bash|guard_bash.py'
  'PreToolUse|mcp__github__.*|guard_github.py'
  'PreToolUse|AskUserQuestion|mcp__ccd_turn__wrap_up|guard_ask.py'
  'PreToolUse|Bash|Write|Edit|MultiEdit|mcp__github__.*|guard_mode.py'
  'PreToolUse|SendMessage|mcp__ccd_session__.*|mcp__ccd_session_mgmt__send_message|guard_sessions.py'
  'UserPromptSubmit||last_prompt.py'
  'PostToolUse|Write|Edit|line_ceiling.py'
  'PostToolUse|AskUserQuestion|guard_ask.py'
  'UserPromptSubmit||context_size.py'
  'SessionStart||quick_check.py'
  'Stop||quick_check.py'
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

# no session deploys to production around the merge to main (forge#56): the deny list holds each way in
for rule in 'Read(./.env*)' 'Bash(vercel --prod*)' 'Bash(vercel * --prod*)' 'Bash(vercel promote*)' 'Bash(vercel rollback*)' \
  'Bash(npx vercel --prod*)' 'Bash(npx vercel * --prod*)' 'Bash(npx vercel promote*)' \
  mcp__84f42f52-2732-4528-ab6f-b9eb615d85ea__{create_deployment,request_promote,request_rollback,assign_alias}; do
  "$jq" -e --arg r "$rule" '.permissions.deny | index($r)' "$settings" >/dev/null || fail "settings.json: deny list lacks $rule"
done
