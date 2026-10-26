#!/bin/bash
# guard_github.py's checks: a GitHub tool call that writes is denied for a word on the private list
# anywhere in its text, reads are never checked, no list gives a note not a denial, and the list
# can come from DRAFT_PRIVATE_WORDS_LIST, as a cloud environment holds it.
. "$(dirname "$0")/helpers.sh"

gh_call() { "$jq" -nc --arg t "mcp__github__$1" --argjson i "$2" '{tool_name:$t,tool_input:$i}'; }  # tool input-json

# the list as a cloud environment holds it: a made-up word, so this file names nothing real
export DRAFT_PRIVATE_WORDS_LIST="acmecorp, othercorp"
check deny guard_github.py "$(gh_call create_pull_request '{"title":"x","body":"for Acmecorp"}')"
check deny guard_github.py "$(gh_call issue_write '{"method":"create","title":"othercorp","body":"x"}')"
check deny guard_github.py "$(gh_call add_issue_comment '{"issue_number":1,"body":"see acmecorp"}')"
check deny guard_github.py "$(gh_call push_files '{"files":[{"path":"a.md","content":"acmecorp"}]}')"  # however deep
check deny guard_github.py "$(gh_call update_pull_request '{"pullNumber":3,"body":"acmecorp"}')"
check deny guard_github.py "$(gh_call merge_pull_request '{"commit_message":"acmecorp"}')"
check allow guard_github.py "$(gh_call create_pull_request '{"title":"x","body":"clean"}')"
check deny guard_github.py "$(gh_call submit_pending_pull_request_review '{"body":"acmecorp"}')"  # no write verb in its name
check deny guard_github.py "$(gh_call request_copilot_review '{"note":"acmecorp"}')"
check deny guard_github.py "$(gh_call some_tool_added_later '{"text":"acmecorp"}')"  # unknown is checked, not missed
check allow guard_github.py "$(gh_call search_issues '{"query":"acmecorp"}')"  # a read publishes nothing
check allow guard_github.py "$(gh_call get_file_contents '{"path":"acmecorp.md"}')"
check allow guard_github.py "$(gh_call issue_read '{"method":"get","issue_number":1}')"
check allow guard_github.py "$(gh_call pull_request_read '{"method":"get","pullNumber":3}')"
check allow guard_github.py "$("$jq" -nc '{tool_name:"Bash",tool_input:{command:"echo acmecorp"}}')"  # not a GitHub tool
silent guard_github.py "$(gh_call create_pull_request '{"body":"clean"}')"  # checked, nothing to say
# one per line works too
DRAFT_PRIVATE_WORDS_LIST=$'acmecorp\nothercorp'
check deny guard_github.py "$(gh_call create_pull_request '{"body":"othercorp"}')"

# the list in a file still counts
unset DRAFT_PRIVATE_WORDS_LIST
mkdir -p "$tmp/.claude" && printf 'acmecorp\n' > "$tmp/.claude/private-words.txt"
check deny guard_github.py "$(gh_call create_pull_request '{"body":"acmecorp"}')"
rm "$tmp/.claude/private-words.txt"

# no list anywhere: a write goes ahead, with a note to Craig and to Claude; a read says nothing
check allow guard_github.py "$(gh_call create_pull_request '{"body":"acmecorp"}')"
says "No private-word list" guard_github.py "$(gh_call create_pull_request '{"body":"clean"}')"
says "DRAFT_PRIVATE_WORDS_LIST" guard_github.py "$(gh_call create_pull_request '{"body":"clean"}')"
silent guard_github.py "$(gh_call list_issues '{}')"
# a list that holds no word, as a lone comma would, checks nothing, so it says so
export DRAFT_PRIVATE_WORDS_LIST=" , "
says "No private-word list" guard_github.py "$(gh_call create_pull_request '{"body":"clean"}')"
unset DRAFT_PRIVATE_WORDS_LIST

# a payload it can't read is denied, never let through unchecked
check deny guard_github.py 'not json'
check deny guard_github.py '[]'
