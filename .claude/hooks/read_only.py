"""For guard_bash.py: a read-only agent may not run a git command that changes a checkout of this
repo. A reviewer runs in its caller's worktree, so `git checkout -q origin/main` there, to search
the end of a drift pass's range, left the builder on a detached HEAD, and the builder's next
commit landed off its branch (#938: drift passes 13, 18, 19 and 20, each found in the worktree's
reflog as "checkout: moving from refactor/drift-pass-N to origin/main" while its pr-reviewer ran).

An agent is read-only when Claude Code says it is (READ_ONLY_BUILT_INS) or when its file in
.claude/agents/ gives it tools but no editing tool. The hook payload names it: Claude Code's hooks
reference, "Common input fields": agent_type is "Present when the session uses --agent or the
hook fires inside a subagent", and agent_id is the "Unique identifier for the subagent". A payload
with an agent_id but no agent_type gets a note, since the check would then pass everything by.
A folder in another repository (a scratch repo built to try a hook) is its own. What is refused
is a deny-list of the git commands known to move a checkout or change its files, so it is
incomplete by design: a command it doesn't name goes through.
Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import os

from commands import short_flags
from where import git_call, git_dir, git_options, git_output

AGENTS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "agents")
READ_ONLY_BUILT_INS = {"Explore", "Plan"}  # Claude Code's own agents with no editing tool
EDITING_TOOLS = {"Edit", "Write", "NotebookEdit"}
TOOLS_LINE = "tools:"
FRONTMATTER = "---"
# git subcommands that move HEAD or a branch, or change the index, the working files or the stash
CHANGES_CHECKOUT = {
    "checkout", "switch", "restore", "reset", "merge", "rebase", "pull", "commit", "stash",
    "cherry-pick", "revert", "am", "apply", "clean", "rm", "mv", "add", "bisect", "read-tree",
    "update-ref", "checkout-index", "update-index",
}
STASH_READS = {"list", "show"}  # git stash list, git stash show
# git branch's options that move, delete, copy or rename a branch, as long and as short letters
BRANCH_WRITES = {"--force", "--delete", "--move", "--copy", "--set-upstream-to", "--unset-upstream"}
BRANCH_WRITE_LETTERS = set("fdDmMcCu")
ALIAS = "alias."  # an alias can run any of the above under a name the guard doesn't know
CONFIG_READS = {"--get", "--get-all", "--get-regexp", "-l", "--list"}
DELETES = {"-d", "--delete"}  # git symbolic-ref -d HEAD
READ_ANOTHER_COMMIT = (
    "You are read-only and share this checkout with the agent that called you, so git {sub} here "
    "would change its work (a git checkout of origin/main leaves its branch detached, #938). Read "
    "another commit without moving: git show <rev>:<path>, git grep -n <pattern> <rev>, git diff "
    "<range>, git ls-tree -r --name-only <rev>; for its files on disk, git worktree add --detach "
    "<scratch dir> <rev>, then git worktree remove <scratch dir>.")
NO_AGENT_TYPE = ("This Bash call came from a subagent (its hook payload has an agent_id) but names no "
                 "agent_type, so guard_bash.py can't tell a read-only reviewer from a builder and lets "
                 "its git commands through (#938). Claude Code's hook payload may have changed.")


def agent_tools(agent_type):
    """The tools an agent's file in .claude/agents/ gives it, None with no file or no tools line."""
    try:
        with open(os.path.join(AGENTS, f"{agent_type}.md"), encoding="utf-8") as file:
            lines = file.read().splitlines()
    except OSError:
        return None
    if lines[:1] != [FRONTMATTER]:
        return None
    for line in lines[1:]:
        if line == FRONTMATTER:
            return None
        if line.startswith(TOOLS_LINE):
            return {name.strip() for name in line[len(TOOLS_LINE):].split(",") if name.strip()}
    return None


def is_read_only(agent_type):
    if not agent_type:
        return False
    if agent_type in READ_ONLY_BUILT_INS:
        return True
    given = agent_tools(agent_type)
    return given is not None and not given & EDITING_TOOLS


def agent_type_note(payload):
    """A note when the payload is a subagent's (an agent_id) yet names no agent_type, else None."""
    return NO_AGENT_TYPE if payload.get("agent_id") and not payload.get("agent_type") else None


def common_dir(folder):
    out = git_output(folder, "rev-parse", "--path-format=absolute", "--git-common-dir")
    return None if out is None else os.path.realpath(out.strip())


def changes_checkout(words, sub, args):
    """True if this git call may move HEAD or a branch, or change the checkout's files or stash."""
    if any(opt == "-c" and value.lower().startswith(ALIAS) for opt, value in git_options(words)):
        return True
    if sub == "stash":
        return not args or args[0] not in STASH_READS
    if sub == "branch":
        return any(arg.split("=")[0] in BRANCH_WRITES or BRANCH_WRITE_LETTERS & set(short_flags(arg))
                   for arg in args)
    if sub == "symbolic-ref":
        return bool(DELETES & set(args)) or len([arg for arg in args if not arg.startswith("-")]) > 1
    if sub == "config":
        return any(arg.lower().startswith(ALIAS) for arg in args) and not CONFIG_READS & set(args)
    return sub in CHANGES_CHECKOUT


def read_only_problem(cmds, cwd, agent_type):
    """A deny reason when a read-only agent's command changes a checkout of the repo cwd is in, or
    one the guard can't place; else None."""
    if not is_read_only(agent_type):
        return None
    ours = None  # the git dir every checkout of cwd's repo shares, read once it is needed
    for words, here in cmds:
        call = git_call(words)
        if not call or not changes_checkout(words, *call):
            continue
        folder = git_dir(words, here)
        if folder is not None:
            ours = ours or common_dir(cwd)
            theirs = common_dir(folder)
            if theirs is None or theirs != ours:
                continue
        return READ_ANOTHER_COMMIT.format(sub=call[0])
    return None
