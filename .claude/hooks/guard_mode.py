#!/usr/bin/env python3
"""PreToolUse guard: talk is talk. Craig, 5 Nov 2026: "yesterday i thought id do some fun theory
crafting on scoring, and instead youve tried built it and its destroyed the project flow". So a
command that files, specs, starts or ships work (gh issue create or edit, gh pr create, ready or
merge, gh workflow run, the GitHub tool's writes, and an edit to SPEC.md or spec/) is denied unless
Craig's latest message in this session (last_prompt.py) says to act: one of GO_WORDS, as "build it",
"go ahead", "file it", "ship it", "merge", a bare "File" or "yes", or a slash command, which is an instruction by itself.
Without his message on record (a cloud builder, whose whole run is a build Craig or the lead started)
nothing is gated. Reads and git are never gated: a branch, a commit and a push are the session's own
and publish nothing. Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import json
import re
import sys

from hook_payload import BadPayload, field, project_dir, read_payload, report
from last_prompt import state_file

GO_WORDS = re.compile(
    r"\b(build|go ahead|go for it|do it|do that|do them|do all|do both|"
    r"file (it|them|that|these|those|all|both|the rest|an issue|issues)|"
    r"ship|merge|open (a|the) (pr|pull request)|start (it|them|the build|building)|run it|make it|create|"
    r"sort it|set it up|set up|implement|land|label it|fix (it|that|them|those|the|this|all|everything)|"
    r"just do|get on with|crack on|carry on|proceed|"
    # a yes that names the action: Claude's own reply buttons read so (9 Nov 2026, #1376: "Yes, run the lead" was refused)
    r"yes,? (please,? )?(do|build|go|fix|ship|run|file|merge|start|open|add|make|set))\b", re.I)
# a whole message that only says yes to Claude's "shall I file these?" (6 Nov 2026: a bare "File" was
# refused as talk, and Craig had to say "File them (this is silly)")
BARE_GO = re.compile(r"^\W*(file|yes|yes please|go|go on)\W*$", re.I)
SLASH_COMMAND = re.compile(r"^\s*/[a-z]")
GH_GATED = {("issue", "create"), ("issue", "edit"), ("pr", "create"), ("pr", "ready"), ("pr", "merge"),
            ("workflow", "run")}
GITHUB_TOOL = "mcp__github__"
GITHUB_READS = ("get_", "list_", "search_", "issue_read", "pull_request_read", "actions_get", "actions_list")
SPEC_PATHS = ("SPEC.md", "spec/", "/spec/", "/SPEC.md")
DEFAULT_BRANCH = "main"
DRY_RUN_INPUT = "dry_run=true"
TALK = ("Craig's latest message didn't say to build, file or ship ({what}); it reads as talk, and talk stays "
        "talk (Craig, 5 Nov 2026: theory-crafting on scoring became a build and \"destroyed the project flow\"). "
        "Keep it as ideas in chat, or ask him in one line whether to build it.")


def go_said(prompt):
    return bool(GO_WORDS.search(prompt) or BARE_GO.match(prompt) or SLASH_COMMAND.match(prompt))


def pipeline_test(words):
    """A workflow run that tests a pipeline change rather than starts work: a dry run, or a run from a branch
    (CLAUDE.md: a pipeline change is tested by a real run from its branch first). CTO review, 5 Nov 2026: the
    guard refused three such test runs that Craig had asked for."""
    if DRY_RUN_INPUT in words:
        return True
    return any(word == "--ref" and i + 1 < len(words) and words[i + 1] != DEFAULT_BRANCH for i, word in enumerate(words))


def gated_bash(command):
    """What this command does that is gated, or None."""
    words = command.split()
    for i, word in enumerate(words):
        if word == "gh" and tuple(words[i + 1:i + 3]) in GH_GATED:
            if words[i + 1:i + 3] == ["workflow", "run"] and pipeline_test(words[i + 3:]):
                continue
            return f"gh {' '.join(words[i + 1:i + 3])}"
    return None


def gated(tool, tool_input):
    """What this tool call does that is gated, or None."""
    if tool == "Bash":
        return gated_bash(field(tool_input, "command", str, ""))
    if tool in {"Write", "Edit", "MultiEdit"}:
        path = field(tool_input, "file_path", str, "")
        if path.endswith("SPEC.md") or "/spec/" in path or path.startswith("spec/"):
            return f"an edit to {path}"
        return None
    if tool.startswith(GITHUB_TOOL) and not tool[len(GITHUB_TOOL):].startswith(GITHUB_READS):
        return tool[len(GITHUB_TOOL):]
    return None


def decide(payload):
    """The deny reason, or None."""
    what = gated(field(payload, "tool_name", str, ""), field(payload, "tool_input", dict, {}))
    if not what:
        return None
    try:
        prompt = state_file(field(payload, "session_id", str, "")).read_text(encoding="utf-8")
    except OSError:
        return None  # no message on record: a cloud build, or the first turn's hook didn't write
    return None if go_said(prompt) else TALK.format(what=what)


def main():
    try:
        reason = decide(read_payload())
    except BadPayload as error:
        return report(error, "the call wasn't checked against Craig's latest message")
    if reason:
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
