#!/usr/bin/env python3
"""PostToolUse note for Bash: after gh pr merge, removes the merged pull request's local branch and
the worktree it is checked out in. GitHub deletes the branch on its side (the repo's "delete
branch on merge"), but nothing deleted the copy here, so 842 branches and 70 worktrees piled up
(30 Oct 2026).

It deletes only what is safe: the branch's tip must be the pull request's head (every commit on
it went into the merge), and the worktree must have nothing uncommitted. The main checkout and the
folder the merge ran in are never removed. Anything kept is said, with why; so is a pull request
gh can't read. It runs after the command, so it never blocks one. Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys

from commands import commands
from drift_gate import merge_args, view_args
from hook_payload import BadPayload, field, read_payload, report
from parsing import Unbalanced, Unreadable
from stdin_reading import UnreadableStdin

MERGED = "MERGED"
BRANCH_REF = "refs/heads/"
RUN_TIMEOUT_SECONDS = 15  # each git or gh call: six at most, inside the 120 settings.json gives the hook


def run(folder, *args):
    """(ok, output) for a command run in folder; output is stderr's first line when it fails."""
    try:
        done = subprocess.run(list(args), cwd=folder, capture_output=True, text=True, timeout=RUN_TIMEOUT_SECONDS)
    except (OSError, subprocess.SubprocessError) as error:
        return False, str(error)
    if done.returncode == 0:
        return True, done.stdout
    said = done.stderr.strip().splitlines() or [f"exit {done.returncode}"]
    return False, said[0]


def pull_request(args, folder):
    """The merged pull request's number, state, branch and head commit; ValueError says why not."""
    ok, out = run(folder, "gh", "pr", "view", *view_args(args), "--json", "number,state,headRefName,headRefOid")
    if not ok:
        raise ValueError(f"gh pr view failed ({out})")
    try:
        pr = json.loads(out)
        return pr["number"], pr["state"], pr["headRefName"], pr["headRefOid"]
    except (ValueError, KeyError, TypeError) as error:
        raise ValueError(f"gh pr view gave no head ({error})") from error


def worktrees(folder):
    """(path, branch) for each worktree, the main checkout first; branch is "" when detached."""
    ok, out = run(folder, "git", "worktree", "list", "--porcelain")
    if not ok:
        raise ValueError(f"git worktree list failed ({out})")
    found = []
    for block in out.strip().split("\n\n"):
        lines = dict(line.partition(" ")[::2] for line in block.splitlines())
        found.append((lines.get("worktree", ""), lines.get("branch", "").removeprefix(BRANCH_REF)))
    return found


def inside(path, folder):
    path, folder = os.path.realpath(path), os.path.realpath(folder)
    return folder == path or folder.startswith(path + os.sep)


def tidy(number, branch, head, folder):
    """Removes the branch and its worktree when nothing would be lost; a line saying what happened,
    or None when there is no local branch (gh's --delete-branch, or it was never here)."""
    ok, tip = run(folder, "git", "rev-parse", "--verify", "--quiet", BRANCH_REF + branch)
    if not ok:
        return None
    kept = f"#{number} merged; its branch {branch} was kept"
    if tip.strip() != head:
        return f"{kept}: it holds commits the pull request doesn't."
    trees = worktrees(folder)
    for i, (path, checked_out) in enumerate(trees):
        if checked_out != branch:
            continue
        if i == 0 or inside(path, folder):
            where = "the main checkout" if i == 0 else "the folder the merge ran in"
            return f"{kept}: it is checked out in {where} ({path}). Switch off it, then git branch -D {branch}."
        ok, changes = run(path, "git", "status", "--porcelain")
        if not ok or changes.strip():
            why = f"git status failed ({changes})" if not ok else "its worktree has uncommitted changes"
            return f"{kept}: {why} ({path})."
        ok, said = run(folder, "git", "worktree", "remove", path)
        if not ok:
            return f"{kept}: git worktree remove {path} failed ({said})."
    ok, said = run(folder, "git", "branch", "-D", branch)
    if not ok:
        return f"{kept}: git branch -D failed ({said})."
    return f"#{number} merged; its local branch {branch} and any worktree it was in were removed."


def notes(cmd, cwd):
    lines = []
    try:
        cmds = commands(cmd, cwd)
    except (Unbalanced, Unreadable, UnreadableStdin):
        return lines  # guard_bash.py refuses what it can't read, so this ran no merge it could see
    for words, here in cmds:
        args = merge_args(words)
        if args is None:
            continue
        if here is None:
            lines.append("A pull request merged, but in a folder the hook can't be sure of: its branch was kept.")
            continue
        try:
            number, state, branch, head = pull_request(args, here)
            if state != MERGED:
                lines.append(f"#{number} isn't merged yet ({state}): its branch stays.")
            else:
                lines.append(tidy(number, branch, head, here))
        except ValueError as error:
            lines.append(f"After the merge, the branch wasn't tidied: {error}.")
    return [line for line in lines if line]


def main():
    try:
        payload = read_payload()
        cmd = field(field(payload, "tool_input", dict, {}), "command", str, "")
        cwd = field(payload, "cwd", str, "") or os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    except BadPayload as error:
        return report(error, "no merged branch was tidied")
    said = notes(cmd, cwd)
    if said:
        print(json.dumps({"hookSpecificOutput": {"hookEventName": "PostToolUse", "additionalContext": " ".join(said)}}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
