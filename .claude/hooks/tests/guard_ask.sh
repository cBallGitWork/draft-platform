#!/bin/bash
# guard_ask.py's checks, most of them on questions sessions really asked Craig on 5 Nov 2026: one his
# standing answers settle (merge, alpha data, the phone, a small look detail, a fix) is denied,
# in AskUserQuestion and in the next-step box's ask; a product rule or a look call is let through;
# an unreadable payload is reported, never a denial.
. "$(dirname "$0")/helpers.sh"

ask() { "$jq" -nc --arg q "$1" '{tool_name:"AskUserQuestion",tool_input:{questions:[{header:"H",question:$q,options:[]}]}}'; }
box() { "$jq" -nc --arg q "$1" '{tool_name:"mcp__ccd_turn__wrap_up",tool_input:{recap:"r",ask:$q}}'; }

# settled by a standing answer
check deny guard_ask.py "$(ask "Saved lineups (#1040): it writes saved league data (alpha only). OK to merge once green?")"
check deny guard_ask.py "$(ask "The pipeline PR #1172 is green. Shall I merge it?")"
check deny guard_ask.py "$(ask "Last season's points are worked out on dev but not on live. Shall I run the reprice on live now?")"
check deny guard_ask.py "$(ask "Alpha teams already drafted have no lineup. OK to backfill them?")"
check deny guard_ask.py "$(ask "Should I set the two-line role closer together on the phone so it fits its row?")"
check deny guard_ask.py "$(ask "Shall I make the tile's padding 12px?")"
check deny guard_ask.py "$(ask "The Sonnet reviewer fails on every PR the build bot opens. Shall I let it review the bot's PRs?")"
check deny guard_ask.py "$(ask "The gate is only a check on my side. Shall I make it a real GitHub check?")"
check deny guard_ask.py "$(ask "Want me to rerun the failed build?")"
check deny guard_ask.py "$(box "Merge #1177 now?  Is it ok to merge?")"
check deny guard_ask.py "$(box "Shall I fix the red check on #1176?")"
# one settled question among real ones denies the call, so the rest are asked again without it
check deny guard_ask.py '{"tool_name":"AskUserQuestion","tool_input":{"questions":[
  {"header":"Cameos","question":"Do a role'"'"'s points count in a cameo?"},{"header":"Merge","question":"OK to merge #1179?"}]}}'
says "Merge on green yourself" guard_ask.py "$(ask "OK to merge #1179?")"
says "alpha" guard_ask.py "$(ask "Shall I run the reprice on live now?")"

# Craig's to answer: product rules and look calls ask what should happen
check allow guard_ask.py "$(ask "Role scoring (#10): do a role's points count in a cameo? Example: a poacher comes on for 4 minutes.")"
check allow guard_ask.py "$(ask "Draft rounds (#1088): rounds = the league's maximum squad size, but the rules allow no maximum. How many rounds then?")"
check allow guard_ask.py "$(ask "Draft start (#1130): can a team whose manager left still be handed to a new manager after the start?")"
check allow guard_ask.py "$(ask "Draft ending mid-season (#1097): there's no 'starting gameweek' league rule yet. Add one?")"
check allow guard_ask.py "$(ask "Formation window (#1170): what goes in the subtitle line?")"
check allow guard_ask.py "$(ask "Should the draft also check the players left can still finish a legal squad?")"
check allow guard_ask.py "$(box "Which change first?")"
silent guard_ask.py "$(ask "How should the balance check run?")"
silent guard_ask.py "$("$jq" -nc '{tool_name:"mcp__ccd_turn__wrap_up",tool_input:{recap:"r"}}')"  # no ask
silent guard_ask.py "$("$jq" -nc '{tool_name:"Bash",tool_input:{command:"echo shall I merge"}}')"  # not a question

# an unreadable payload is said, and the question goes ahead
for ((i = 0; i < ${#bad_payloads[@]}; i += 2)); do
  fails_loudly "${bad_payloads[i + 1]}" guard_ask.py "${bad_payloads[i]}"
done
fails_loudly "questions is str" guard_ask.py '{"tool_name":"AskUserQuestion","tool_input":{"questions":"x"}}'
