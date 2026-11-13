#!/bin/bash
# guard_mode.py's checks, with last_prompt.py's and guard_ask.py's record of a question-box answer: after
# a message that only talks, filing, starting or shipping work and editing the spec are denied; after one
# that says to build, go or file, or a slash command, they go through; with no message on record (a cloud
# build) nothing is gated; reads, git and edits outside the spec are never gated; an unreadable payload is
# denied (last_prompt.py reports it).
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
check deny guard_mode.py "$(bash_call 'cd /x && gh issue create --title t')"  # any command the line runs
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
# only a gh call the line runs counts, read as the shell reads it, gh's options skipped (#1557)
check deny guard_mode.py "$(bash_call 'gh -R o/r issue create --title x')"
check deny guard_mode.py "$(bash_call 'gh --repo=o/r pr merge 5')"
check deny guard_mode.py "$(bash_call 'gh issue -R o/r edit 10 --add-label build')"
check deny guard_mode.py "$(bash_call 'bash -c "gh pr create --title x"')"
check deny guard_mode.py "$(bash_call 'echo "$(gh pr ready 5)"')"
says "gh issue create" guard_mode.py "$(bash_call 'gh -R o/r issue create --title x')"
# a gh command only quoted isn't gated
check allow guard_mode.py "$(bash_call 'git commit -m "docs: say when gh pr create is refused"')"
check allow guard_mode.py "$(bash_call 'echo "then gh issue create is gated"')"
check allow guard_mode.py "$(bash_call 'grep -rn "when gh pr merge runs" .claude/hooks')"
check allow guard_mode.py "$(bash_call "python3 -c \"print('a gh pr create here')\"")"
# a heredoc a shell runs counts; one written to a file is only words
check deny guard_mode.py "$(bash_call $'cat <<\'EOF\' | bash\ngh pr merge 5\nEOF')"
check allow guard_mode.py "$(bash_call $'cat <<\'EOF\' > notes.md\ngh pr merge 5\nEOF')"
# a line it can't read counts every gh its words hold: bash runs the lines before an unbalanced quote
check deny guard_mode.py "$(bash_call $'gh issue create --title x\necho \'oops')"
check deny guard_mode.py "$(bash_call 'gh -R o/r pr create -t x; echo "oops')"
check deny guard_mode.py "$(bash_call "sh -c 'gh pr merge \"5'")"  # a string inside it that can't be read
check deny guard_mode.py "$(bash_call 'echo "$CMD" | sh && gh pr merge 5')"  # what a shell reads on stdin
says "in a line the guard can't read" guard_mode.py "$(bash_call $'gh issue create --title x\necho \'oops')"
check allow guard_mode.py "$(bash_call $'gh issue view 10\necho \'oops')"  # a read is still a read

# a go
for go in "ok build it" "go ahead" "file it as an issue" "ship it" "merge that" "yes, do it" "sort it" \
  "plan and build the fixes" "/grill scoring" "open a PR for that" "crack on" "File" "file these" \
  "Yes." "go" "File them (this is silly)" "Yes, run the lead" "yes run it" "Yes, file them" "Yes, merge it" \
  "yes please, open the PR" "merge it" "merge #1378" "ok merge them" \
  "file answers" "File the answers on their issues" "yes but multiple workflows in one go" "yes, run them" \
  "yes but what about a libero" "yes, set pieces matter" "yes merge confilcts are annoying" \
  "1a 2b" "1 a
2 a
3 a" "1. a" "3 a" "1) b, 2) c" \
  "get as many features done as you can" "go through issues and fix where we can" "fix what you can" "do more"; do
  said "$go"
  check allow guard_mode.py "$(bash_call 'gh issue create --title t')"
  check allow guard_mode.py "$(edit "$tmp/spec/05-scoring.md")"
done
# a message opening with yes is a go (Craig, 9 Nov 2026); other talk stays talk, and numbers need only answers
for talk in "file naming is odd" "go figure, the cameo rule again" "what if we run the draft live" \
  "merge conflicts again" "i think one team tactic might be better?" "or shall i answer more qs first?" \
  "the file looks wrong" "yesterday was slow" "2 things bother me" "1 a but what about cameos" \
  "is the draft done yet" "the fix was odd"; do
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
check deny guard_mode.py "$(bash_call 'gh workflow run claude-build.yml -f issue=10 && echo dry_run=true')"  # another command's words
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
# an answer he picks in a question box is his latest message, and the question's own words aren't (#1228)
picked() { "$jq" -nc --arg s "$session" --arg q "$1" --arg a "$2" '{session_id:$s,hook_event_name:"PostToolUse",
  tool_name:"AskUserQuestion",tool_input:{questions:[{header:"H",question:$q,options:[]}]},
  tool_response:{answers:{($q):$a}}}' | "$hooks/guard_ask.py" || fail "guard_ask.py failed on: $2"; }
picked "Build the six fixes now?" "Yes, build them all"
check allow guard_mode.py "$(bash_call 'gh pr create --title x --body-file b.md')"
picked "Shall I build them?" "Not yet, keep it as talk"
check deny guard_mode.py "$(bash_call 'gh pr create --title x --body-file b.md')"
picked "Build them now?" ""  # no answer: his message before stands
check deny guard_mode.py "$(bash_call 'gh pr create --title x --body-file b.md')"
# another session's message doesn't speak for this one
other=$("$jq" -nc --arg s "other-$$" --arg t Bash '{session_id:$s,tool_name:$t,tool_input:{command:"gh issue create --title t"}}')
check allow guard_mode.py "$other"  # no record for it

denies_unreadable guard_mode.py
for ((i = 0; i < ${#bad_payloads[@]}; i += 2)); do
  fails_loudly "${bad_payloads[i + 1]}" last_prompt.py "${bad_payloads[i]}"
done
rm -f "$tmp/draft-last-prompt/$session"
