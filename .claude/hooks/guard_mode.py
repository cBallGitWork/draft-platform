#!/usr/bin/env python3
"""PreToolUse guard: talk is talk. Craig, 5 Nov 2026: "yesterday i thought id do some fun theory
crafting on scoring, and instead youve tried built it and its destroyed the project flow". So a
command that files, specs, starts or ships work (gh issue create or edit, gh pr create, ready or
merge, gh workflow run, the GitHub tool's writes, and an edit to SPEC.md or spec/) is denied unless
Craig's latest message in this session (last_prompt.py; an answer he picks in a question box counts, as
guard_ask.py records it) says to act: one of GO_WORDS, as "build it", "go ahead", "file it", "ship it",
"merge it" (merge and the verbs after a yes need an object), a bare "File", a message opening with "yes" or
with "file" and an object ("file answers"), one made only of numbered answers ("1 a\n2 b"), or a slash
command, which is an instruction by itself.
Only a gh call the command line really runs is gated, each read as the shell reads it (commands.py), so a
commit message, echo or grep that quotes one isn't, and gh's options before its command are skipped; in a
line it can't read, every gh counts.
Without his message on record (a cloud builder, whose whole run is a build Craig or the lead started)
nothing is gated. Reads and git are never gated: a branch, a commit and a push are the session's own
and publish nothing. A payload it can't read is denied (guard_run.run_guard). Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import re
import sys

from commands import Unbalanced, Unreadable, UnreadableStdin, commands
from guard_run import run_guard
from hook_payload import field, project_dir
from last_prompt import state_file
from private_words import GH_VALUE_OPTS
from where import arguments, runs_at

GO_WORDS = re.compile(
    r"\b(build|go ahead|go for it|do it|do that|do them|do all|do both|do more|"
    r"file (it|them|that|these|those|all|both|the rest|an issue|issues)|"
    r"ship|merge (it|them|that|this|these|those|the|a|an|now|#\d+)|open (a|the) (pr|pull request)|start (it|them|the build|building)|run it|make it|create|"
    r"sort it|set it up|set up|implement|land|label it|fix (it|that|them|those|the|this|all|everything|where|what)|"
    r"just do|get on with|crack on|carry on|proceed|"
    # Craig's go-aheads it missed, 5 Nov 2026 (#1228): "get as many features done as you can", "fix where we can"
    r"get(\s+\w+){0,5}\s+done|"
    # a yes that names the action: Claude's own reply buttons read so (9 Nov 2026, #1376: "Yes, run the lead" was refused)
    # and an object after the newer verbs, so "yes, set pieces matter" stays talk (#1378's review)
    # merge too needs one: Craig's "yes merge confilcts are annoying" was a go (9 Nov 2026)
    r"yes,? (do|build|go|fix|ship)|"
    r"yes,? (please,? )?(run|file|merge|start|open|add|make|set) (it|them|that|this|these|those|the|a|an))\b", re.I)
# a whole message that only says yes to Claude's "shall I file these?" (6 Nov 2026: a bare "File" was
# refused as talk, and Craig had to say "File them (this is silly)")
BARE_GO = re.compile(r"^\W*(file|yes|yes please|go|go on)\W*$", re.I)
# a message that opens with a go (9 Nov 2026, all refused: "file answers", "yes but multiple workflows in one
# go"): "file" and an object, unless the object is followed by a verb ("file naming is odd" is talk), or "yes"
OPENS_WITH_GO = re.compile(
    r"^\W*(?:(?:ok|okay|please|now|then|and),?\s+)?(?:yes\b|file\s+\w+\b(?!\s+(?:is|are|was|were|looks?|seems?|feels?)\b))", re.I)
# a message made only of numbered answers to Claude's lettered questions: "1a 2b", "1 a\n2 a", "1. a" (9 Nov 2026)
NUMBERED_ANSWERS = re.compile(r"^\s*(?:\d+\s*[.):-]?\s*[a-z]\b[\s,;.]*)+$", re.I)
SLASH_COMMAND = re.compile(r"^\s*/[a-z]")
GH_GATED = {("issue", "create"), ("issue", "edit"), ("pr", "create"), ("pr", "ready"), ("pr", "merge"),
            ("workflow", "run")}
GITHUB_TOOL = "mcp__github__"
GITHUB_READS = ("get_", "list_", "search_", "issue_read", "pull_request_read", "actions_get", "actions_list")
SPEC_PATHS = ("SPEC.md", "spec/", "/spec/", "/SPEC.md")
DEFAULT_BRANCH = "main"
DRY_RUN_INPUT = "dry_run=true"
UNREAD_WORDS = re.compile(r"[\s'\"`;&|()<>$\\]+")  # a line it can't read, split at blanks, quotes and the shell's marks
TALK = ("Craig's latest message didn't say to build, file or ship ({what}); it reads as talk, and talk stays "
        "talk (Craig, 5 Nov 2026: theory-crafting on scoring became a build and \"destroyed the project flow\"). "
        "Keep it as ideas in chat, or ask him in one line whether to build it.")


def go_said(prompt):
    return bool(GO_WORDS.search(prompt) or BARE_GO.match(prompt) or OPENS_WITH_GO.match(prompt)
                or NUMBERED_ANSWERS.match(prompt) or SLASH_COMMAND.match(prompt))


def pipeline_test(words):
    """A workflow run that tests a pipeline change rather than starts work: a dry run, or a run from a branch
    (CLAUDE.md: a pipeline change is tested by a real run from its branch first). CTO review, 5 Nov 2026: the
    guard refused three such test runs that Craig had asked for."""
    if DRY_RUN_INPUT in words:
        return True
    return any(word == "--ref" and i + 1 < len(words) and words[i + 1] != DEFAULT_BRANCH for i, word in enumerate(words))


def gh_command(args):
    """The command these gh arguments name: the first two that aren't an option or an option's value
    (gh -R o/r issue create). An option GH_VALUE_OPTS doesn't list, put between the two (gh issue
    --body-file b.md create), still hides it."""
    return tuple(arguments(args, GH_VALUE_OPTS)[1][:2])


def gated_bash(command, cwd):
    """What this command does that is gated, or None. Each gh call it runs is judged by its own words; a gh
    command only quoted (git commit -m "say when gh pr create is refused", echo, grep) isn't gated (#1557).
    A line it can't read is judged on every gh its words hold, quoted or not: bash runs the lines before an
    unbalanced quote, and refusing a line that doesn't run costs nothing."""
    try:
        cmds = commands(command, cwd)
    except (Unbalanced, Unreadable, UnreadableStdin):
        words = UNREAD_WORDS.split(command)
        found = [pair for pair in (gh_command(words[i + 1:]) for i, word in enumerate(words) if word == "gh")
                 if pair in GH_GATED]
        return f"gh {' '.join(found[0])}, in a line the guard can't read" if found else None
    for words, _ in cmds:
        i = runs_at(words, "gh")
        pair = () if i is None else gh_command(words[i + 1:])
        if pair in GH_GATED and not (pair == ("workflow", "run") and pipeline_test(words[i + 1:])):
            return "gh " + " ".join(pair)
    return None


def gated(tool, tool_input, cwd):
    """What this tool call does that is gated, or None; cwd is where a Bash command starts."""
    if tool == "Bash":
        return gated_bash(field(tool_input, "command", str, ""), cwd)
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
    what = gated(field(payload, "tool_name", str, ""), field(payload, "tool_input", dict, {}),
                 project_dir(field(payload, "cwd", str, "")))
    if not what:
        return None
    try:
        prompt = state_file(field(payload, "session_id", str, "")).read_text(encoding="utf-8")
    except OSError:
        return None  # no message on record: a cloud build, or the first turn's hook didn't write
    return None if go_said(prompt) else TALK.format(what=what)


def main():
    return run_guard("talk-is-talk", lambda payload: (decide(payload), None))


if __name__ == "__main__":
    sys.exit(main())
