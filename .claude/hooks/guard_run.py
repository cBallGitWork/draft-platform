"""Runs a guard (guard_bash.py, guard_github.py, guard_mode.py, guard_sessions.py): its payload is
read with hook_payload.read_payload(), and a payload it can't read, or a guard that crashes, is
denied, never let through unchecked, since Claude Code lets a PreToolUse hook's exit 1 through.
The notes (line_ceiling.py, last_prompt.py) and guard_ask.py, whose blocking would stop every
question to Craig, report() instead (hook_payload.py). Kept apart from hook_payload.py, a studio
kit file. Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import json

from hook_payload import BadPayload, read_payload


def deny(reason):
    """Prints a PreToolUse denial with this reason."""
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": reason,
    }}))


def run_guard(name, decide):
    """Runs a guard: decide(payload) returns (reason, advice), a deny reason or None and a note for an
    allowed call or None. A payload it can't read, or a guard that crashes, is denied, never let
    through unchecked; name says which guard in the reason. Returns the exit code, always 0."""
    advice = None
    try:
        reason, advice = decide(read_payload())
    except BadPayload as error:
        reason = f"The {name} guard couldn't read the call: {error}, so nothing was checked."
    except Exception as error:  # a guard that crashes prints nothing, which would allow
        reason = f"The {name} guard failed ({type(error).__name__}: {error}), so nothing was checked."
    if reason:
        deny(reason)
    elif advice:  # additionalContext reaches Claude; systemMessage shows it to Craig
        print(json.dumps({"systemMessage": advice,
                          "hookSpecificOutput": {"hookEventName": "PreToolUse", "additionalContext": advice}}))
    return 0
