#!/usr/bin/env python3
"""PostToolUse note for Write|Edit: a code file past 250 lines, then past 300.

Tests, typecheck and review all pass a 900-line file, so the only thing that ever held
the line was somebody noticing. This notices. It reports and never blocks, because a split
is a judgement about responsibilities. A payload it can't read (hook_payload.py) exits 1 with
the error on stderr. Adapted from epl-draft's line_ceiling.sh (17 Oct 2026). Stdlib only,
Python 3.9+.
"""

from __future__ import annotations

import json
import os
import sys

from hook_payload import BadPayload, field, read_payload, report

CODE = (".ts", ".tsx", ".js", ".mjs", ".css", ".py", ".sh")
SOFT, HARD = 250, 300


def main():
    try:
        path = field(field(read_payload(), "tool_input", dict, {}), "file_path", str, "")
    except BadPayload as error:
        return report(error, "the file's length wasn't checked")
    if not path.endswith(CODE) or not os.path.isfile(path):
        return 0
    with open(path, encoding="utf-8", errors="replace") as f:
        lines = sum(1 for _ in f)
    root = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    rel = os.path.relpath(path, root)
    if lines > HARD:
        note = f"{rel} is now {lines} lines, past the {HARD}-line ceiling. Split it by responsibility before committing."
    elif lines > SOFT:
        note = f"{rel} is {lines} lines, closing on the {HARD}-line ceiling. Worth splitting now, while you know what the pieces are."
    else:
        return 0
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PostToolUse", "additionalContext": note}}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
