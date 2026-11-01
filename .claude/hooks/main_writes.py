"""Main's names, and the writes to main that skip git push, for guard_bash.py and guard_github.py:
a gh api call that commits a file, moves a ref or merges into main, and a GitHub tool call whose
branch or ref is main. git push to main is guard_bash.py's own check. Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import re

from where import options, runs_at

MAIN = "main"
REMOTE = "origin"  # GitHub's copy of the repo
REMOTE_MAIN = f"{REMOTE}/{MAIN}"  # GitHub's main, as fresh as the last fetch
MAIN_REFS = {MAIN, "refs/heads/" + MAIN}
TO_MAIN = "That writes to main. Changes reach main only through a squash-merged PR."

WRITE_METHODS = {"PUT", "POST", "PATCH", "DELETE"}
METHOD_OPTS = {"-X", "--method"}
FIELD_OPTS = {"-f", "--raw-field", "-F", "--field"}
INPUT_OPT = "--input"  # a body from a file or stdin: its fields can't be seen
GH_API_VALUE_OPTS = METHOD_OPTS | FIELD_OPTS | {INPUT_OPT, "-H", "--header", "-q", "--jq", "-t", "--template",
                                                "--cache", "-p", "--preview", "--hostname"}
CONTENTS = re.compile(r"/contents(/|$)")  # a file commit; with no branch field it lands on the default, main
REF_OR_MERGE = re.compile(r"/git/refs(/|$)|/merges$")
MAIN_IN_PATH = re.compile(r"/git/refs/heads/" + MAIN + r"$")
BRANCH_FIELDS = {"branch", "ref", "base"}  # contents' branch, a new ref's name, a merge's base
MCP_BRANCH_ARGS = ("branch", "ref")


def gh_api_parts(args):
    """A gh api call's method (upper case, or None), its fields as {key: value}, whether it reads
    its body with --input, and its path: its first operand, without a query string."""
    method, fields, has_input, operands, i = None, {}, False, [], 0
    while i < len(args):
        found, i = options(args, i, GH_API_VALUE_OPTS)
        for opt, value in found:
            if opt in METHOD_OPTS:
                method = value.upper()
            elif opt in FIELD_OPTS:
                key, _, field_value = value.partition("=")
                fields[key] = field_value
            elif opt == INPUT_OPT:
                has_input = True
        operands += args[i : i + 1]
        i += 1
    if method is None and (fields or has_input):
        method = "POST"  # what gh sends when it has a body and no -X
    path = operands[0].split("?")[0].rstrip("/") if operands else ""
    return method, fields, has_input, path


def gh_api_writes_main(words):
    """True if this simple command is a gh api write that lands on main: a contents write on main
    or naming no branch, a ref made, moved or deleted at main, or a merge into main."""
    i = runs_at(words, "gh")
    if i is None or words[i + 1 : i + 2] != ["api"]:
        return False
    method, fields, has_input, path = gh_api_parts(words[i + 2 :])
    if method not in WRITE_METHODS:
        return False
    named = {fields[key] for key in BRANCH_FIELDS & fields.keys()}
    if CONTENTS.search(path):
        return has_input or not named or bool(named & MAIN_REFS)
    return bool(REF_OR_MERGE.search(path)) and (bool(MAIN_IN_PATH.search(path)) or bool(named & MAIN_REFS))


def gh_api_problem(cmds):
    """A deny reason if any of cmds (each (words, folder)) is a gh api write to main, else None."""
    if any(gh_api_writes_main(words) for words, _ in cmds):
        return TO_MAIN + " A gh api file write names its branch: -f branch=<branch>."
    return None


def mcp_problem(tool_input):
    """A deny reason if a GitHub tool's branch or ref argument is main, else None."""
    if any(isinstance(tool_input.get(arg), str) and tool_input[arg] in MAIN_REFS for arg in MCP_BRANCH_ARGS):
        return TO_MAIN
    return None
