#!/usr/bin/env python3
"""PostToolUse note for Write|Edit: a words file was changed, so it must read in the Matchday voice.

Every word a manager reads lives in src/**/words.ts and convex/**/*Words.ts (CLAUDE.md). The
voice tests catch banned words, but not colon chains, legal compression or system-speak, and a
builder that never opens .claude/agents/matchday-voice.md writes in its own voice (Craig, 18 Nov
2026: "not weird ai claude"). This points it there on every edit. It reports and never blocks.
A payload it can't read (hook_payload.py) exits 1 with the error on stderr. Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import json
import os
import sys

from hook_payload import BadPayload, field, project_dir, read_payload, report

NOTE = (
    "{rel} is shown to managers. Write it in the Matchday voice, .claude/agents/matchday-voice.md "
    "(SPEC.md's Glossary words, its Never table, one colon a line at most), and run the "
    "matchday-voice agent on your words files before the pull request."
)


def is_words_file(rel: str) -> bool:
    name = os.path.basename(rel)
    return (rel.startswith("src/") and name == "words.ts") or (rel.startswith("convex/") and name.endswith("Words.ts"))


def main():
    try:
        path = field(field(read_payload(), "tool_input", dict, {}), "file_path", str, "")
    except BadPayload as error:
        return report(error, "the words file's voice wasn't pointed out")
    if not path:
        return 0
    rel = os.path.relpath(path, project_dir())
    if not is_words_file(rel):
        return 0
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PostToolUse", "additionalContext": NOTE.format(rel=rel)}}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
