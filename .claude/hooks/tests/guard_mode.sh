#!/bin/bash
# guard_mode.py's checks, with last_prompt.py's: after a message that only talks, filing, starting or
# shipping work and editing the spec are denied; after one that says to build, go or file, or a slash
# command, they go through; with no message on record (a cloud build) nothing is gated; reads, git and
# edits outside the spec are never gated; an unreadable payload is reported, never a denial.
. "$(dirname "$0")/helpers.sh"

session=test-session-$$
said() { printf '%s' "$("$jq" -nc --arg s "$session" --arg p "$1" '{session_id:$s,prompt:$p}')" | "$hooks/last_prompt.py" || fail "last_prompt.py failed on: $1"; }
call() { "$jq" -nc --arg s "$session" --arg t "$1" --argjson i "$2" '{session_id:$s,tool_name:$t,tool_input:$i}'; }
bash_call() { call Bash "$("$jq" -nc --arg c "$1" '{command:$c}')"; }
edit() { call Edit "$("$jq" -nc --arg f "$1" '{file_path:$f,old_string:"a",new_string:"b"}')"; }

# no message on record: a cloud build, nothing gated
check allow guard_mode.py "$(bash_call 'gh pr create --title x --body-file b.md')"

# talk: Craig thinking out loud
said "what if a poacher got +2 for a shot in the box and we add a sweeper role, fun to theory craft this"
check deny guard_mode.py "$(bash_call 'gh issue create --title "poacher +2" --body x')"
check deny guard_mode.py "$(bash_call 'gh issue edit 10 --add-label build')"
check deny guard_mode.py "$(bash_call 'gh pr create --title x --body-file b.md')"
check deny guard_mode.py "$(bash_call 'gh pr ready 5')"
check deny guard_mode.py "$(bash_call 'gh pr merge 5 --squash')"
check deny guard_mode.py "$(bash_call 'gh workflow run claude-build.yml -f issue=10')"
check deny guard_mode.py "$(bash_call 'cd /x && gh issue create --title t')"  # anywhere in the line
check deny guard_mode.py "$(edit "$tmp/spec/05-scoring.md")"
check deny guard_mode.py "$(edit "$tmp/SPEC.md")"
check deny guard_mode.py "$(call Write "$("$jq" -nc --arg f "spec/05-scoring.md" '{file_path:$f,content:"x"}')")"
check deny guard_mode.py "$(call mcp__github__create_issue '{"title":"x"}')"
check deny guard_mode.py "$(call mcp__github__create_pull_request '{"title":"x"}')"
says "reads as talk" guard_mode.py "$(bash_call 'gh issue create --title t')"
says "gh issue create" guard_mode.py "$(bash_call 'gh issue create --title t')"
# never gated: reads, git, edits elsewhere
check allow guard_mode.py "$(bash_call 'gh issue view 10')"
check allow guard_mode.py "$(bash_call 'gh pr list --state open')"
check allow guard_mode.py "$(bash_call 'git push -u origin feat/x')"
check allow guard_mode.py "$(bash_call 'npm run verify')"
check allow guard_mode.py "$(edit "$tmp/docs/to-grill.md")"
check allow guard_mode.py "$(edit "$tmp/src/draft/words.ts")"
check allow guard_mode.py "$(call mcp__github__issue_read '{"issue_number":1}')"
silent guard_mode.py "$(bash_call 'gh issue view 10')"

# a go
for go in "ok build it" "go ahead" "file it as an issue" "ship it" "merge that" "yes, do it" "sort it" \
  "plan and build the fixes" "/grill scoring" "open a PR for that" "crack on" "File" "file these" \
  "Yes." "go" "File them (this is silly)"; do
  said "$go"
  check allow guard_mode.py "$(bash_call 'gh issue create --title t')"
  check allow guard_mode.py "$(edit "$tmp/spec/05-scoring.md")"
done
# a bare yes-word is a go only as the whole message: in a sentence it is talk
for talk in "file naming is odd" "yes but what about a libero" "go figure, the cameo rule again"; do
  said "$talk"
  check deny guard_mode.py "$(bash_call 'gh issue create --title t')"
done
# the latest message counts, not an earlier go
said "hmm, what about a libero though"
check deny guard_mode.py "$(bash_call 'gh pr create --title x --body-file b.md')"
# a pipeline test is never gated: a dry run, or a run from a branch; a run on main still is
check allow guard_mode.py "$(bash_call 'gh workflow run lead.yml --ref refactor/pipeline-smooth -f dry_run=true')"
check allow guard_mode.py "$(bash_call 'gh workflow run claude-build.yml --ref fix/x -f issue=1206 -f mode=fix -f pr=1211')"
check allow guard_mode.py "$(bash_call 'gh workflow run lead.yml -f dry_run=true')"
check deny guard_mode.py "$(bash_call 'gh workflow run claude-build.yml --ref main -f issue=10')"
check deny guard_mode.py "$(bash_call 'gh workflow run lead.yml --ref fix/x && gh pr merge 5')"  # the merge is still gated
# an app notice isn't his message: the talk before it still stands, and his words after one still count
said "<task-notification>
<task-id>x</task-id> go ahead, build it
</task-notification>"
check deny guard_mode.py "$(bash_call 'gh pr create --title x --body-file b.md')"
said "<system-reminder>a background task finished</system-reminder>
yes, build it"
check allow guard_mode.py "$(bash_call 'gh pr create --title x --body-file b.md')"
said "<agent-message from=\"a1\">ship it</agent-message>"
check allow guard_mode.py "$(bash_call 'gh pr create --title x --body-file b.md')"  # the go before stands
said "hmm, what about a libero though"
# another session's message doesn't speak for this one
other=$("$jq" -nc --arg s "other-$$" --arg t Bash '{session_id:$s,tool_name:$t,tool_input:{command:"gh issue create --title t"}}')
check allow guard_mode.py "$other"  # no record for it

for ((i = 0; i < ${#bad_payloads[@]}; i += 2)); do
  fails_loudly "${bad_payloads[i + 1]}" guard_mode.py "${bad_payloads[i]}"
  fails_loudly "${bad_payloads[i + 1]}" last_prompt.py "${bad_payloads[i]}"
done
rm -f "$tmp/draft-last-prompt/$session"
