"""The drift-pass merge gate, for guard_bash.py: denies gh pr merge once DUE_AFTER or more pull
requests have merged since the last drift pass (drift_due.py's count, in the folder the merge runs
in), unless the pull request being merged is itself a drift pass: its title, read with gh pr view,
starts "refactor: drift pass". The session-start note alone was missed (10 passes in 432 merges:
the audit, 29 Oct 2026), so past the trigger it is a refusal. A count or a title it can't read is
a denial too, never a silent pass. It stops the usual route only: a merge through gh api or the
web button doesn't pass through it.
Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import json
import subprocess

from drift_due import DUE_AFTER, PASS_MARK, GitFailed, merged_since_pass
from where import runs_at

MERGE_CALL = ["pr", "merge"]
PASS_TITLE = PASS_MARK.lstrip("^")  # a drift pass's title starts with it
REPO_OPTS = {"-R", "--repo"}
MERGE_VALUE_OPTS = {"-b", "--body", "-F", "--body-file", "-t", "--subject", "-A", "--author-email",
                    "--match-head-commit"} | REPO_OPTS  # gh pr merge's options that take a value
RUN_THE_PASS = ("Run the drift pass first (docs/REFACTORING.md \"The drift pass\"): a refactor/ branch "
                "whose pull request title starts \"refactor: drift pass\"; that one may merge.")


def merge_args(words):
    """The args after gh pr merge, if this simple command runs it, else None."""
    i = runs_at(words, "gh")
    if i is None or words[i + 1 : i + 3] != MERGE_CALL:
        return None
    return words[i + 3 :]


def view_args(args):
    """gh pr view's args for the same pull request: its number, url or branch, and any --repo."""
    out, i = [], 0
    while i < len(args):
        arg = args[i]
        if arg.partition("=")[0] in REPO_OPTS:
            out += [arg] if "=" in arg else args[i : i + 2]
            i += 0 if "=" in arg else 1
        elif arg in MERGE_VALUE_OPTS:
            i += 1
        elif not arg.startswith("-"):
            out.append(arg)
        i += 1
    return out


def title_of(args, folder):
    """The pull request's title; raises ValueError saying why it can't be read."""
    try:
        proc = subprocess.run(["gh", "pr", "view", *view_args(args), "--json", "title"],
                              cwd=folder, capture_output=True, text=True)
    except OSError as error:
        raise ValueError(f"gh couldn't run ({error})") from error
    if proc.returncode != 0:
        said = proc.stderr.strip().splitlines() or [f"exit {proc.returncode}"]
        raise ValueError(f"gh pr view failed ({said[0]})")
    try:
        return json.loads(proc.stdout)["title"]
    except (ValueError, KeyError, TypeError) as error:
        raise ValueError(f"gh pr view gave no title ({error})") from error


def merge_problem(cmds):
    """A deny reason if any of cmds (each (words, folder)) merges a pull request past the drift
    trigger that isn't a drift pass, else None."""
    for words, here in cmds:
        args = merge_args(words)
        if args is None:
            continue
        try:
            merged, last_pass = merged_since_pass(here)
        except GitFailed as error:
            return f"Can't count the merges since the last drift pass: {error}."
        if merged < DUE_AFTER:
            continue
        since = last_pass or "the start"
        try:
            title = title_of(args, here)
        except ValueError as error:
            return (f"{merged} merged since the last drift pass ({since}), and the guard can't read this "
                    f"pull request's title to see if it is one: {error}.")
        if not title.startswith(PASS_TITLE):
            return (f"Merges wait for the drift pass: {merged} merged since {since} "
                    f"(the trigger is {DUE_AFTER}). " + RUN_THE_PASS)
    return None
