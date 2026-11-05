#!/usr/bin/env python3
"""PreToolUse guard: one session per project, and sessions don't talk to each other. Craig, 5 Nov
2026: "sessions bleed into each other", after three sessions on this repo messaged one another and
he moved work between them himself. Denies a message to another session (SendMessage to a local_…
id, or the session tools' send_message) and starting a session from this one (start_session,
hand_off_to_session). A message to a subagent this session spawned (an agent id, a name) is the
session's own and goes through. Builds report through GitHub and the PM dashboard, never to a
session. Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import json
import sys

from hook_payload import BadPayload, field, read_payload, report

SESSION_ID = "local_"
STARTS = {"mcp__ccd_session__start_session", "mcp__ccd_session__hand_off_to_session"}
SENDS = {"mcp__ccd_session_mgmt__send_message"}
ONE_SESSION = ("One session per project, and sessions don't message each other (Craig, 5 Nov 2026: \"sessions "
               "bleed into each other\"). {what}. Do the work here, or leave it on GitHub for the lead and the "
               "PM dashboard.")


def decide(payload):
    tool = field(payload, "tool_name", str, "")
    tool_input = field(payload, "tool_input", dict, {})
    if tool in STARTS:
        return ONE_SESSION.format(what="Don't start or hand off to another session")
    if tool in SENDS:
        return ONE_SESSION.format(what="Don't message another session")
    if tool == "SendMessage" and field(tool_input, "to", str, "").startswith(SESSION_ID):
        return ONE_SESSION.format(what="Don't message another session")
    return None


def main():
    try:
        reason = decide(read_payload())
    except BadPayload as error:
        return report(error, "the call wasn't checked for a cross-session message")
    if reason:
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
