"""The pull-request body check, for guard_bash.py: denies a gh pr create or gh pr edit whose body
(--body, or the file --body-file names) holds a local path or a closing word near an issue number
anywhere but a bare "Closes #n" line. On gh pr create it also denies a body that lacks the
template's headings; one with neither pr-reviewer's pasted signature nor an unticked "not run" line
for it; one with a ticked box that says "not run"; and, where the branch changes a file that renders
a screen with an approved picture (screen_routes.py), one without ui-verifier's signature and an
"Approved vs built" section that says it "matches the approved picture" or numbers each difference
(#947; approval_gate.py then holds the merge for Craig). A body the guard can't read is denied too.
A title past TITLE_HARD characters is denied; one past TITLE_SOFT gets a note, not a denial
(pr_title_note; Craig, 22 Oct 2026).
Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import os
import re

from parsing import MARKED
from screen_routes import screens_changed
from where import options, runs_at

PR_CALLS = (["pr", "create"], ["pr", "edit"])
BODY_OPTS = {"-b", "--body"}
BODY_FILE_OPTS = {"-F", "--body-file"}
TITLE_OPTS = {"-t", "--title"}
TITLE_SOFT, TITLE_HARD = 100, 120  # characters
REQUIRED = ("## Merge danger", "## Checks", "## Fresh-eyes review", "## Left for later")  # the template
SIGNATURE = "*Reviewer: pr-reviewer ("  # starts the last line of pr-reviewer's block
NOT_RUN_LINE = "- [ ] pr-reviewer: not run"
SIGNED = re.compile("^" + re.escape(SIGNATURE), re.M)
NOT_RUN = re.compile("^" + re.escape(NOT_RUN_LINE), re.M)
TICKED_NOT_RUN = re.compile(r"^- \[[xX]\] .*not run", re.M)
LOCAL_PATHS = ("/Users/", "/private/tmp/")  # a Mac home folder, the session scratchpad
# One line at a time, by design: "Closes" at a line's end with "#12" starting the next, and
# "Closes https://…/issues/5", both get through. A known limit, not a promise.
CLOSING = re.compile(r"(?i)\b(close[sd]?|fix(e[sd])?|resolve[sd]?)\b[^\n#]{0,40}#\d+")
BARE_CLOSES = re.compile(r"^Closes #\d+\s*$")
USE_A_FILE = "Write the body to a file and pass it with --body-file <file>."
# ui-verifier's block for a screen with an approved picture (.claude/agents/ui-verifier.md, Output)
APPROVED_VS_BUILT = "## Approved vs built"
MATCHES = "matches the approved picture"
VERIFIER_SIGNATURE = "*Verifier: ui-verifier ("  # starts the last line of ui-verifier's block
VERIFIER_SIGNED = re.compile("^" + re.escape(VERIFIER_SIGNATURE), re.M)
COMMENT = re.compile(r"<!--.*?-->", re.S)
# the section ends at the next heading but its own, as ui-verifier's pasted block repeats it
NEXT_HEADING = re.compile(r"^## (?!" + re.escape(APPROVED_VS_BUILT[3:]) + ")", re.M)
DIFFERENCE = re.compile(r"^\s*\d+\.\s+\S.*$", re.M)  # "1. Columns: …"


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


def titles(args):
    """Each title these gh args give; one the shell fills in ($(…)) can't be measured, so is skipped."""
    out, i = [], 0
    while i < len(args):
        found, i = options(args, i, TITLE_OPTS | BODY_OPTS | BODY_FILE_OPTS)
        out += [value for opt, value in found if opt in TITLE_OPTS and not MARKED.search(value)]
        i += 1
    return out


def long_titles(cmds, limit):
    """The titles of gh pr create or edit calls among cmds longer than limit characters."""
    calls = (pr_call(words) for words, _ in cmds)
    return [title for call in calls if call for title in titles(call[1]) if len(title) > limit]


def pr_title_note(cmds):
    """A note, never a denial, for a pull request title past the soft limit, else None."""
    long = long_titles(cmds, TITLE_SOFT)
    if not long:
        return None
    return (f"That pull request title is {len(long[0])} characters, past the soft limit of {TITLE_SOFT} "
            f"(denied past {TITLE_HARD}). Say what was wrong and what is now true in fewer words.")


def _read(path, cwd):
    if path == "-" or MARKED.search(path):
        raise ValueError(f"its --body-file ({path}) is stdin or filled in by the shell. Name a file.")
    try:
        with open(os.path.join(cwd, path), encoding="utf-8") as f:
            return f.read()
    except OSError as error:
        raise ValueError(f"its --body-file can't be read ({error.strerror}: {path}).") from None


def approved_vs_built(body):
    """The body's Approved vs built section, its HTML comments taken out, or None if it has none."""
    text = COMMENT.sub("", body)
    start = text.find(APPROVED_VS_BUILT)
    if start < 0:
        return None
    rest = text[start + len(APPROVED_VS_BUILT):]
    end = NEXT_HEADING.search(rest)
    return rest[: end.start()] if end else rest


def differences(body):
    """Each numbered difference the body's Approved vs built section lists."""
    section = approved_vs_built(body) or ""
    return [m.group(0).strip() for m in DIFFERENCE.finditer(section)]


def screen_problem(body, screens):
    """What a body for a branch that changes these screens ({route: files}) lacks, or None."""
    if not screens:
        return None
    named = ", ".join(f"{route} ({', '.join(files[:3])}{', …' if len(files) > 3 else ''})"
                      for route, files in screens.items())
    section = approved_vs_built(body)
    if not VERIFIER_SIGNED.search(body) or section is None or not (MATCHES in section or differences(body)):
        return (f"This branch changes a screen with an approved picture: {named}. Run the ui-verifier agent "
                f"and paste its block: a '{APPROVED_VS_BUILT}' section that says it '{MATCHES}' or numbers "
                f"each difference (1. …), and its line starting '{VERIFIER_SIGNATURE}…'.")
    return None


def body_problem(body, creating):
    """What breaks the rules in this body, with the fix, or None."""
    if creating:
        missing = [heading for heading in REQUIRED if heading not in body]
        if missing:
            return (f"The body lacks {', '.join(missing)}. Fill in the whole template "
                    "(.github/pull_request_template.md).")
        ticked = TICKED_NOT_RUN.search(body)
        if ticked:
            return (f"A ticked box says a step was not run ({ticked.group(0).strip()!r}). "
                    "Untick it and say why: '- [ ] <step>: not run — <why>'.")
        if not SIGNED.search(body) and not NOT_RUN.search(body):
            return ("The body has no pr-reviewer verdict. Paste its block under Fresh-eyes review "
                    f"(it ends '{SIGNATURE}…'), or write '{NOT_RUN_LINE} — <why>'.")
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
    commands.py) breaks the body rules or can't be checked, or has a title past the hard limit, else None."""
    long = long_titles(cmds, TITLE_HARD)
    if long:
        return (f"Pull request title: it is {len(long[0])} characters, past the limit of {TITLE_HARD}. "
                f"Keep it under {TITLE_SOFT}: what was wrong, and what is now true.")
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
        screens = {}
        if sub == "create":
            try:
                screens = screens_changed(here or cwd)
            except ValueError as error:
                return f"Can't tell whether this branch changes a screen with an approved picture: {error}."
        for text in texts:
            problem = body_problem(text, sub == "create") or screen_problem(text, screens)
            if problem:
                return "Pull request body: " + problem
    return None
