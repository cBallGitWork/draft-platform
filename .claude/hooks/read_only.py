"""For guard_bash.py: a read-only agent may not run a git command that changes a checkout of this
repo. A reviewer runs in its caller's worktree, so `git checkout -q origin/main` there, to search
the end of a drift pass's range, left the builder on a detached HEAD, and the builder's next
commit landed off its branch (#938: drift passes 13, 18, 19 and 20, each found in the worktree's
reflog as "checkout: moving from refactor/drift-pass-N to origin/main" while its pr-reviewer ran).

An agent is read-only when Claude Code says it is (READ_ONLY_BUILT_INS) or when its file in
.claude/agents/ gives it tools but no editing tool; the hook payload's agent_type names it inside
a subagent. A folder in another repository (a scratch repo built to try a hook) is its own.
Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import os

from where import git_call, git_dir, git_output

AGENTS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "agents")
READ_ONLY_BUILT_INS = {"Explore", "Plan"}  # Claude Code's own agents with no editing tool
EDITING_TOOLS = {"Edit", "Write", "NotebookEdit"}
TOOLS_LINE = "tools:"
FRONTMATTER = "---"
# git subcommands that move HEAD or change the index, the working files or the shared stash
CHANGES_CHECKOUT = {
    "checkout", "switch", "restore", "reset", "merge", "rebase", "pull", "commit", "stash",
    "cherry-pick", "revert", "am", "apply", "clean", "rm", "mv", "add", "bisect",
}
READ_ANOTHER_COMMIT = ("You are read-only and share this checkout with the agent that called you, so "
                       "git {sub} here would change its work (a git checkout of origin/main leaves its "
                       "branch detached, #938). Read another commit without moving: "
                       "git show <rev>:<path>, git grep -n <pattern> <rev>, git diff <range>, "
                       "git ls-tree -r --name-only <rev>.")


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


def common_dir(folder):
    out = git_output(folder, "rev-parse", "--path-format=absolute", "--git-common-dir")
    return None if out is None else os.path.realpath(out.strip())


def read_only_problem(cmds, cwd, agent_type):
    """A deny reason when a read-only agent's command changes a checkout of the repo cwd is in, or
    one the guard can't place; else None."""
    if not is_read_only(agent_type):
        return None
    ours = None  # the git dir every checkout of cwd's repo shares, read once it is needed
    for words, here in cmds:
        call = git_call(words)
        if not call or call[0] not in CHANGES_CHECKOUT:
            continue
        folder = git_dir(words, here)
        if folder is not None:
            ours = ours or common_dir(cwd)
            theirs = common_dir(folder)
            if theirs is None or theirs != ours:
                continue
        return READ_ANOTHER_COMMIT.format(sub=call[0])
    return None
