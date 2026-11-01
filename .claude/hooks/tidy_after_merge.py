#!/usr/bin/env python3
"""PostToolUse note for Bash: after gh pr merge, removes the merged pull request's local branch and
the worktree it is checked out in. GitHub deletes the branch on its side (the repo's "delete
branch on merge"), but nothing deleted the copy here, so 842 branches and 70 worktrees piled up
(30 Oct 2026).

It deletes only what is safe: the branch's tip must be the pull request's head or behind it (every
commit on it went into the merge; gh pr update-branch gives the pull request a merge commit the
branch here never gets, so the head is fetched from origin to check; a checkout with no remote
called origin keeps such a branch, and says why), and the worktree must have nothing uncommitted
and no ignored file but throwaway output: build output, or the screenshots in .shots/ (git
worktree remove deletes ignored files: a .env.local would go). The main checkout and the folder
the merge ran in are never removed, and nor is a worktree in use (#929): one a running builder
holds (Claude Code locks an agent's worktree while it runs, and git worktree remove refuses a
locked one), one any process has as its working directory, or one whose git state changed in the
last RECENT_MINUTES (a builder that finished may be resumed; between commands no process sits in
its folder). A worktree kept is not tried again on a later merge. Anything kept is said, with why;
so is a pull request gh can't read.

Then it moves the main checkout to origin/main when it is detached and behind: the hooks run from
its .claude/hooks/, so a merged hook fix waited until someone moved it by hand (31 Oct 2026: still
at #767 after #777 merged). git checkout --detach keeps a changed file the move doesn't touch, and
refuses over one it would overwrite; that refusal is said, as is a commit of its own or a rebase
or bisect under way keeping it there. On a branch it is left alone.

It runs after the command, so it never blocks one. Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time

from commands import commands
from drift_gate import merge_args, view_args
from hook_payload import BadPayload, field, project_dir, read_payload, report
from main_writes import MAIN
from parsing import Unbalanced, Unreadable
from stdin_reading import UnreadableStdin

MERGED = "MERGED"
BRANCH_REF = "refs/heads/"
REMOTE = "origin"  # where GitHub's copy of the pull request's head is fetched from
PULL_HEAD = "pull/{number}/head"  # GitHub's ref for a pull request's head commit
REMOTE_MAIN = f"{REMOTE}/{MAIN}"  # where the main checkout is moved to
# what git keeps in .git/ while a rebase, merge, cherry-pick, revert or bisect is under way (a
# rebase or bisect leaves HEAD detached), when moving the checkout would wreck it
UNDER_WAY = ("rebase-merge", "rebase-apply", "MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "BISECT_LOG")
# each git, gh or lsof call: eleven at most per merge and four to move the main checkout, inside the
# 180 settings.json gives the hook
RUN_TIMEOUT_SECONDS = 11
NOT_ANCESTOR = 1  # git merge-base --is-ancestor's exit when the first commit isn't behind the second
IGNORED = "!! "  # git status --porcelain --ignored=matching's mark for an ignored path
# ignored paths nobody needs once the work has merged, so a worktree holding only these may go:
# what a build or test run makes again, and .shots, the screenshots scripts/shoot.mjs takes
THROWAWAY = {
    "node_modules", "dist", "coverage", "test-results", "playwright-report", "__pycache__", ".DS_Store", ".shots",
}
# every process's working directory, one "n<path>" line each (lsof's +D walks the whole tree: slow)
CWDS = ("lsof", "-w", "-a", "-d", "cwd", "-Fn")
CWD_LINE = "n"
# a worktree whose git state (its index, HEAD or HEAD's log) changed this recently may be a
# builder's that finished and will be resumed, so it stays (#929)
RECENT_MINUTES = 30
GIT_STATE = ("index", "HEAD", os.path.join("logs", "HEAD"))


def call(folder, *args):
    """(exit code, output) for a command run in folder; output is stderr's first line when it fails,
    and the code is None when the command couldn't run or ran out of time."""
    try:
        done = subprocess.run(list(args), cwd=folder, capture_output=True, text=True, timeout=RUN_TIMEOUT_SECONDS)
    except (OSError, subprocess.SubprocessError) as error:
        return None, str(error)
    if done.returncode == 0:
        return 0, done.stdout
    said = done.stderr.strip().splitlines() or [f"exit {done.returncode}"]
    return done.returncode, said[0]


def run(folder, *args):
    """(ok, output) for a command run in folder; output is stderr's first line when it fails."""
    code, out = call(folder, *args)
    return code == 0, out


def why_not_in_head(number, tip, head, folder):
    """None when every commit on the branch's tip is in the pull request's head, else why the branch
    stays. The head is fetched first, since GitHub may have made it."""
    if tip == head:
        return None
    ok, said = run(folder, "git", "fetch", "--quiet", "--no-write-fetch-head", REMOTE, PULL_HEAD.format(number=number))
    if not ok:
        return f"its tip isn't the pull request's head, and fetching that head to check failed ({said})."
    code, said = call(folder, "git", "merge-base", "--is-ancestor", tip, head)
    if code == NOT_ANCESTOR:
        return "it holds commits the pull request doesn't."
    if code != 0:
        return f"git merge-base failed ({said})."
    return None


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
    """(path, branch) for each worktree, the main checkout first; branch is "" when detached, and
    None for a bare repo (it has no checkout to move)."""
    ok, out = run(folder, "git", "worktree", "list", "--porcelain")
    if not ok:
        raise ValueError(f"git worktree list failed ({out})")
    found = []
    for block in out.strip().split("\n\n"):
        lines = dict(line.partition(" ")[::2] for line in block.splitlines())
        branch = lines.get("branch", "" if "detached" in lines else None)
        found.append((lines.get("worktree", ""), branch and branch.removeprefix(BRANCH_REF)))
    return found


def inside(path, folder):
    path, folder = os.path.realpath(path), os.path.realpath(folder)
    return folder == path or folder.startswith(path + os.sep)


def why_in_use(path, folder):
    """None when no process has a folder inside the worktree at path as its working directory and its
    git state hasn't changed in the last RECENT_MINUTES, else why it stays."""
    try:  # not run(): lsof exits 1 when some process can't be read (another user's), yet lists the rest
        done = subprocess.run(list(CWDS), cwd=folder, capture_output=True, text=True, timeout=RUN_TIMEOUT_SECONDS)
    except (OSError, subprocess.SubprocessError) as error:
        return f"which processes work in it couldn't be checked ({error})"
    if not done.stdout:
        said = done.stderr.strip().splitlines() or [f"exit {done.returncode}"]
        return f"which processes work in it couldn't be checked ({said[0]})"
    if any(line.startswith(CWD_LINE) and inside(path, line[len(CWD_LINE):]) for line in done.stdout.splitlines()):
        return "a running process works in it"
    ok, git_dir = run(path, "git", "rev-parse", "--absolute-git-dir")
    if not ok:
        return f"git rev-parse failed ({git_dir})"
    states = [os.path.join(git_dir.strip(), name) for name in GIT_STATE]
    changed = max((os.path.getmtime(state) for state in states if os.path.exists(state)), default=0)
    if time.time() - changed < RECENT_MINUTES * 60:
        return f"its git state changed in the last {RECENT_MINUTES} minutes, so a builder may come back to it"
    return None


def would_lose(status):
    """What removing the worktree would lose, from its git status --porcelain --ignored=matching
    (which names a nested ignored folder itself, not its top): its uncommitted changes, and each
    ignored path that isn't throwaway output, at any depth (.claude/hooks/__pycache__/ is)."""
    lines = status.splitlines()
    ignored = [line[len(IGNORED):] for line in lines if line.startswith(IGNORED)]
    held = ["uncommitted changes"] if len(ignored) < len(lines) else []
    return held + [path for path in ignored if not THROWAWAY & set(path.rstrip("/").split("/"))]


def tidy(number, branch, head, folder):
    """Removes the branch and its worktree when nothing would be lost; a line saying what happened,
    or None when there is no local branch (gh's --delete-branch, or it was never here)."""
    ok, tip = run(folder, "git", "rev-parse", "--verify", "--quiet", BRANCH_REF + branch)
    if not ok:
        return None
    kept = f"#{number} merged; its branch {branch} was kept"
    why = why_not_in_head(number, tip.strip(), head, folder)
    if why:
        return f"{kept}: {why}"
    run(folder, "git", "worktree", "prune")  # a worktree whose folder is gone would hold the branch for good
    for i, (path, checked_out) in enumerate(worktrees(folder)):
        if checked_out != branch:
            continue
        if i == 0 or inside(path, folder):
            where = "the main checkout" if i == 0 else "the folder the merge ran in"
            return f"{kept}: it is checked out in {where} ({path}). Switch off it, then git branch -D {branch}."
        in_use = why_in_use(path, folder)
        if in_use:
            return f"{kept}: its worktree is in use: {in_use} ({path})."
        ok, status = run(path, "git", "status", "--porcelain", "--ignored=matching")
        if not ok:
            return f"{kept}: git status failed ({status}) ({path})."
        held = would_lose(status)
        if held:
            return f"{kept}: its worktree holds {', '.join(held)} ({path})."
        ok, said = run(folder, "git", "worktree", "remove", path)
        if not ok:
            return f"{kept}: git worktree remove {path} failed ({said})."
    ok, said = run(folder, "git", "branch", "-D", branch)
    if not ok:
        return f"{kept}: git branch -D failed ({said})."
    return f"#{number} merged; its local branch {branch} and any worktree it was in were removed."


def follow_main(folder):
    """Moves the main checkout to origin/main when it is detached and behind it; a line saying what
    happened, or None when it is on a branch or already there."""
    path, branch = worktrees(folder)[0]
    if branch != "":
        return None
    checkout = f"The main checkout ({path})"
    stays = f"{checkout} stays off {REMOTE_MAIN}, so merged hook fixes don't take effect yet"
    under_way = [mark for mark in UNDER_WAY if os.path.exists(os.path.join(path, ".git", mark))]
    if under_way:
        return f"{stays}: a git operation is under way there ({', '.join(under_way)})."
    ok, said = run(path, "git", "fetch", "--quiet", "--no-write-fetch-head", REMOTE, MAIN)
    if not ok:
        return f"{stays}: git fetch failed ({said})."
    ok, counts = run(path, "git", "rev-list", "--count", "--left-right", f"HEAD...{REMOTE_MAIN}")
    if not ok:
        return f"{stays}: git rev-list failed ({counts})."
    ahead, behind = (int(n) for n in counts.split())
    if ahead:
        return f"{stays}: it holds {ahead} commit(s) {REMOTE_MAIN} doesn't."
    if not behind:
        return None
    ok, said = run(path, "git", "checkout", "--quiet", "--detach", REMOTE_MAIN)
    if not ok:
        return f"{stays}: git checkout --detach {REMOTE_MAIN} failed ({said})."
    return f"{checkout} moved {behind} commit(s) on to {REMOTE_MAIN}, so merged hook fixes take effect."


def notes(cmd, cwd):
    lines, merged_in = [], None
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
                merged_in = here
                lines.append(tidy(number, branch, head, here))
        except ValueError as error:
            lines.append(f"After the merge, the branch wasn't tidied: {error}.")
    if merged_in is not None:
        try:
            lines.append(follow_main(merged_in))
        except ValueError as error:
            lines.append(f"After the merge, the main checkout wasn't moved: {error}.")
    return [line for line in lines if line]


def main():
    try:
        payload = read_payload()
        cmd = field(field(payload, "tool_input", dict, {}), "command", str, "")
        cwd = project_dir(field(payload, "cwd", str, ""))
    except BadPayload as error:
        return report(error, "no merged branch was tidied")
    said = notes(cmd, cwd)
    if said:
        print(json.dumps({"hookSpecificOutput": {"hookEventName": "PostToolUse", "additionalContext": " ".join(said)}}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
