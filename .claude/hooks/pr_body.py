"""The pull-request body check, for guard_bash.py: denies a gh pr create or gh pr edit whose body
(--body, or the file --body-file names) holds a local path or a closing word near an issue number
anywhere but a bare "Closes #n" line. On gh pr create it also denies a body that lacks the
template's Merge danger, Checks, Fresh-eyes review or Left for later heading; one with neither
pr-reviewer's pasted signature ("*Reviewer: pr-reviewer (" starting a line) nor an unticked
"- [ ] pr-reviewer: not run" line; and one with a ticked box that says "not run". A body the guard
can't read is denied too. Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import os
import re

from parsing import MARKED
from where import options, runs_at

PR_CALLS = (["pr", "create"], ["pr", "edit"])
BODY_OPTS = {"-b", "--body"}
BODY_FILE_OPTS = {"-F", "--body-file"}
REQUIRED = ("## Merge danger", "## Checks", "## Fresh-eyes review", "## Left for later")  # the template
SIGNED = re.compile(r"^\*Reviewer: pr-reviewer \(", re.M)  # the last line of pr-reviewer's block
NOT_RUN = re.compile(r"^- \[ \] pr-reviewer: not run", re.M)
TICKED_NOT_RUN = re.compile(r"^- \[[xX]\] .*not run", re.M)
LOCAL_PATHS = ("/Users/", "/private/tmp/")  # a Mac home folder, the session scratchpad
# One line at a time, by design: "Closes" at a line's end with "#12" starting the next, and
# "Closes https://…/issues/5", both get through. A known limit, not a promise.
CLOSING = re.compile(r"(?i)\b(close[sd]?|fix(e[sd])?|resolve[sd]?)\b[^\n#]{0,40}#\d+")
BARE_CLOSES = re.compile(r"^Closes #\d+\s*$")
USE_A_FILE = "Write the body to a file and pass it with --body-file <file>."


def pr_call(words):
    """'create' or 'edit' and the args after it, if this simple command runs gh pr create or edit."""
    i = runs_at(words, "gh")
    if i is None or words[i + 1 : i + 3] not in PR_CALLS:
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
        ticked = TICKED_NOT_RUN.search(body)
        if ticked:
            return (f"A ticked box says a step was not run ({ticked.group(0).strip()!r}). "
                    "Untick it and say why: '- [ ] <step>: not run — <why>'.")
        if not SIGNED.search(body) and not NOT_RUN.search(body):
            return ("The body has no pr-reviewer verdict. Paste its block under Fresh-eyes review "
                    "(it ends '*Reviewer: pr-reviewer (…'), or write '- [ ] pr-reviewer: not run — <why>'.")
    local = next((path for path in LOCAL_PATHS if path in body), None)
    if local:
        return f"The body names a local path ({local}…). Name the file by its path in the repo."
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
