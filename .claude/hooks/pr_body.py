"""The pull-request body check, for guard_bash.py: denies a gh pr create or gh pr edit whose body
(--body, or the file --body-file names) holds a local path or a closing word near an issue number
anywhere but a bare "Closes #n" line, and a gh pr create whose body lacks the template's Merge
danger or Fresh-eyes review. A body the guard can't read is denied too. Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import os
import re

from parsing import MARKED
from where import options, runs_at

CHECKED = {"create", "edit"}  # gh pr …
BODY_OPTS = {"-b", "--body"}
BODY_FILE_OPTS = {"-F", "--body-file"}
REQUIRED = ("## Merge danger", "## Fresh-eyes review")  # .github/pull_request_template.md
LOCAL_PATH = "/Users/"
CLOSING = re.compile(r"(?i)\b(close[sd]?|fix(e[sd])?|resolve[sd]?)\b[^\n#]{0,40}#\d+")
BARE_CLOSES = re.compile(r"^Closes #\d+\s*$")
USE_A_FILE = "Write the body to a file and pass it with --body-file <file>."


def pr_call(words):
    """'create' or 'edit' and the args after it, if this simple command runs gh pr create or edit."""
    i = runs_at(words, "gh")
    if i is None or words[i + 1 : i + 2] != ["pr"] or len(words) < i + 3 or words[i + 2] not in CHECKED:
        return None
    return words[i + 2], words[i + 3 :]


def bodies(args, cwd):
    """Each body these gh args give, as text; raises ValueError saying why one can't be read."""
    out, i = [], 0
    while i < len(args):
        found, i = options(args, i, BODY_OPTS | BODY_FILE_OPTS)
        for opt, value in found:
            if opt in BODY_OPTS:
                if MARKED.search(value):
                    raise ValueError("its --body is filled in by the shell ($(…) or backticks). " + USE_A_FILE)
                out.append(value)
            elif opt in BODY_FILE_OPTS:
                out.append(_read(value, cwd))
        i += 1
    return out


def _read(path, cwd):
    if path == "-" or MARKED.search(path):
        raise ValueError(f"its --body-file ({path}) is stdin or filled in by the shell. Name a file.")
    try:
        with open(os.path.join(cwd, path), encoding="utf-8") as f:
            return f.read()
    except OSError as error:
        raise ValueError(f"its --body-file can't be read ({error.strerror}: {path}).") from None


def body_problem(body, creating):
    """What breaks the rules in this body, with the fix, or None."""
    if creating:
        missing = [heading for heading in REQUIRED if heading not in body]
        if missing:
            return (f"The body lacks {' and '.join(missing)}. Fill in the whole template "
                    "(.github/pull_request_template.md).")
    if LOCAL_PATH in body:
        return f"The body names a local path ({LOCAL_PATH}…). Name the file by its path in the repo."
    for line in body.splitlines():
        if CLOSING.search(line) and not BARE_CLOSES.match(line):
            return (f"A closing word sits next to an issue number ({line.strip()!r}), so merging shuts "
                    "that issue. Only a line holding just 'Closes #n' (no comment after it) may close one, "
                    "for an issue this PR finishes; elsewhere write 'Part of #n' or 'Refs #n'.")
    return None


def pr_body_problem(cmds, cwd):
    """A deny reason if a gh pr create or edit among cmds (every simple command, with its folder:
    commands.py) breaks the body rules or can't be checked, else None."""
    for words, here in cmds:
        call = pr_call(words)
        if not call:
            continue
        sub, args = call
        try:
            texts = bodies(args, here or cwd)
        except ValueError as error:
            return f"Can't check that pull request's body: {error}"
        if sub == "create" and not texts:
            return "gh pr create needs its body given, so the guard can check it. " + USE_A_FILE
        for text in texts:
            problem = body_problem(text, sub == "create")
            if problem:
                return "Pull request body: " + problem
    return None
