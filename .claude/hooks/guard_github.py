#!/usr/bin/env python3
"""PreToolUse guard for the GitHub tools (mcp__github__*), which a cloud session publishes through
in place of gh, so guard_bash.py never sees them: denies a call naming a word on Craig's private
list (private_words.py) in any text it sends, a write whose branch or ref is main
(main_writes.py), and one that puts Craig's craig-approved label on a pull request
(approval_gate.py). Every tool is checked but the reads (READS), which publish nothing, so a
write tool added or renamed is checked rather than missed. With no list to check against, a write gets a
note, never a denial, as guard_bash.py gives. A payload it can't read is denied: allowing it would
check nothing. Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import json
import sys

from approval_gate import mcp_label_problem
from main_writes import mcp_problem
from private_words import NO_LIST, has_list, text_problem

PREFIX = "mcp__github__"
READ_PREFIXES = ("get_", "list_", "search_")
READS = {"issue_read", "pull_request_read", "actions_get", "actions_list"}


def writes(tool):
    """True if this GitHub tool may send text that others read: any but a read."""
    if not tool.startswith(PREFIX):
        return False
    name = tool[len(PREFIX):]
    return not (name.startswith(READ_PREFIXES) or name in READS)


def strings(value):
    """Every string inside a tool's input, however deep: a file's content, a review's comments."""
    if isinstance(value, str):
        return [value]
    if isinstance(value, dict):
        return [s for v in value.values() for s in strings(v)]
    if isinstance(value, list):
        return [s for v in value for s in strings(v)]
    return []


def decide(payload):
    """(deny reason, note): at most one of them."""
    tool = payload.get("tool_name") or ""
    if not writes(tool):
        return None, None
    tool_input = payload.get("tool_input") or {}
    refused = mcp_problem(tool_input) or mcp_label_problem(tool_input)
    if refused:
        return refused, None
    if not has_list():
        return None, NO_LIST
    return text_problem(strings(tool_input)), None


def main():
    reason = advice = None
    try:
        payload = json.load(sys.stdin)
        if isinstance(payload, dict):
            reason, advice = decide(payload)
        else:
            reason = (f"The GitHub guard couldn't read the hook payload (a JSON {type(payload).__name__}, "
                      "not an object), so nothing was checked.")
    except Exception as error:  # a guard that crashes prints nothing, which would allow
        reason = f"The GitHub guard failed ({type(error).__name__}: {error}), so nothing was checked."
    if reason:
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }}))
    elif advice:  # additionalContext reaches Claude; systemMessage shows it to Craig
        print(json.dumps({"systemMessage": advice,
                          "hookSpecificOutput": {"hookEventName": "PreToolUse", "additionalContext": advice}}))


if __name__ == "__main__":
    main()
