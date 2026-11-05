#!/bin/bash
# guard_sessions.py's checks: a message to another session, or starting one, is denied; a message to
# a subagent goes through; an unreadable payload is reported, never a denial.
. "$(dirname "$0")/helpers.sh"

call() { "$jq" -nc --arg t "$1" --argjson i "$2" '{tool_name:$t,tool_input:$i}'; }

check deny guard_sessions.py "$(call SendMessage '{"to":"local_1f4cec5a-0e7c-488f-b2a4-169cfc70fc31","message":"stop the draft work"}')"
check deny guard_sessions.py "$(call mcp__ccd_session_mgmt__send_message '{"session_id":"local_x","message":"hi"}')"
check deny guard_sessions.py "$(call mcp__ccd_session__start_session '{"title":"draft room","prompt":"x"}')"
check deny guard_sessions.py "$(call mcp__ccd_session__hand_off_to_session '{"title":"x","remaining_plan":"y"}')"
says "sessions bleed into each other" guard_sessions.py "$(call SendMessage '{"to":"local_abc","message":"x"}')"
check allow guard_sessions.py "$(call SendMessage '{"to":"af82db1e2c4ec848a","message":"add this to the PR"}')"  # a subagent
check allow guard_sessions.py "$(call SendMessage '{"to":"researcher","message":"x"}')"
check allow guard_sessions.py "$(call mcp__ccd_session__mark_chapter '{"title":"x"}')"  # not a message or a start
check allow guard_sessions.py "$(call mcp__ccd_session_mgmt__list_sessions '{}')"
silent guard_sessions.py "$(call SendMessage '{"to":"researcher","message":"x"}')"

for ((i = 0; i < ${#bad_payloads[@]}; i += 2)); do
  fails_loudly "${bad_payloads[i + 1]}" guard_sessions.py "${bad_payloads[i]}"
done
