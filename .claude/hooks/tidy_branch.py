"""The rules tidy_after_merge.py removes a merged pull request's local branch and its worktree by.

It deletes only what is safe: the branch must hold a commit origin/main doesn't (#955: one made at
origin/main with no commits yet, such as a builder's under a merged pull request's name, is a new
branch, not the merged one; every pull request here is squash-merged, so a merged branch's own
commits are never on main), its tip must be the pull request's head or behind it (every
commit on it went into the merge; gh pr update-branch gives the pull request a merge commit the
branch here never gets, so the head is fetched from origin to check; a checkout with no remote
called origin keeps such a branch, and says why), and the worktree must have nothing uncommitted
and no ignored file but throwaway output: build output, or the screenshots in .shots/ (git
worktree remove deletes ignored files: a .env.local would go). The main checkout and the folder
the merge ran in are never removed, and nor is a worktree in use (#929): one a running builder
holds (Claude Code locks an agent's worktree while it runs, and git worktree remove refuses a
locked one), one any process has as its working directory, or one whose git state changed in the
last RECENT_MINUTES (a builder that finished may be resumed; between commands no process sits in
its folder). Anything kept is said, with why. Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import os
import subprocess
import time

from main_writes import MAIN

BRANCH_REF = "refs/heads/"
REMOTE = "origin"  # where GitHub's copy of the pull request's head is fetched from
# where follow_main.py moves the main checkout to; a branch whose tip is on it has no commits of its own
REMOTE_MAIN = f"{REMOTE}/{MAIN}"
PULL_HEAD = "pull/{number}/head"  # GitHub's ref for a pull request's head commit
# each git, gh or lsof call's limit: the hook's time is counted in these (tidy_after_merge.py)
RUN_TIMEOUT_SECONDS = 11
# the most calls tidy() makes: rev-parse, merge-base, fetch, merge-base, worktree prune, worktree
# list, lsof, rev-parse, status, worktree remove, branch -D
TIDY_CALLS = 11
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
LOCKED = "locked"  # git worktree list --porcelain's line for a locked worktree


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


def why_not_its_own(tip, folder):
    """None when the branch's tip holds a commit REMOTE_MAIN doesn't, else why the branch stays."""
    code, said = call(folder, "git", "merge-base", "--is-ancestor", tip, REMOTE_MAIN)
    if code == 0:
        return f"it has no commits of its own (its tip is on {REMOTE_MAIN}): a new branch, not the merged one."
    if code != NOT_ANCESTOR:
        return f"whether it has commits of its own couldn't be checked: git merge-base failed ({said})."
    return None


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


def worktrees(folder):
    """(path, branch, locked) for each worktree, the main checkout first; branch is "" when detached,
    and None for a bare repo (it has no checkout to move)."""
    ok, out = run(folder, "git", "worktree", "list", "--porcelain")
    if not ok:
        raise ValueError(f"git worktree list failed ({out})")
    found = []
    for block in out.strip().split("\n\n"):
        lines = dict(line.partition(" ")[::2] for line in block.splitlines())
        branch = lines.get("branch", "" if "detached" in lines else None)
        found.append((lines.get("worktree", ""), branch and branch.removeprefix(BRANCH_REF), LOCKED in lines))
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
    """Removes the branch and its worktree when nothing would be lost, in at most TIDY_CALLS calls; a
    line saying what happened, or None when there is no local branch (gh's --delete-branch, or it
    was never here)."""
    ok, tip = run(folder, "git", "rev-parse", "--verify", "--quiet", BRANCH_REF + branch)
    if not ok:
        return None
    kept = f"#{number} merged; its branch {branch} was kept"
    tip = tip.strip()
    why = why_not_its_own(tip, folder) or why_not_in_head(number, tip, head, folder)
    if why:
        return f"{kept}: {why}"
    run(folder, "git", "worktree", "prune")  # a worktree whose folder is gone would hold the branch for good
    for i, (path, checked_out, _) in enumerate(worktrees(folder)):
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
