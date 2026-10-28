"""The overdue drift pass, for guard_bash.py: denies gh pr create once BLOCK_AFTER or more pull
requests have merged since the last drift pass (drift_due.py's count), unless the pull request is
the drift pass itself (its title starts "refactor: drift pass") or its branch starts fix/, so a
fix is never held up. guard_github.py asks it too, for the GitHub tool a cloud session opens
pull requests with (pr_tool_problem). drift_due.py's note alone was passed over: 72 merges went
by after #461 (28 Oct 2026). A count it can't make is denied, saying why.
Stdlib only, Python 3.9+.
"""

from __future__ import annotations

from drift_due import DUE_AFTER, PASS_MARK, GitFailed, merged_since_pass
from pr_body import BODY_FILE_OPTS, BODY_OPTS, TITLE_OPTS, pr_call, titles
from where import current_branch, options

BLOCK_AFTER = 20  # twice drift_due.py's DUE_AFTER: the note comes first, the block after
DRIFT_TITLE = PASS_MARK.lstrip("^")  # how a drift pass's title starts
HOTFIX = "fix/"  # a branch that may open a pull request however overdue the pass is
HEAD_OPTS = {"-H", "--head"}
PR_TOOL = "mcp__github__create_pull_request"  # how a cloud session opens one


def head_branch(args, folder):
    """The branch a gh pr create opens from: its --head, else the folder's branch."""
    i = 0
    while i < len(args):
        found, i = options(args, i, HEAD_OPTS | TITLE_OPTS | BODY_OPTS | BODY_FILE_OPTS)
        heads = [value for opt, value in found if opt in HEAD_OPTS]
        if heads:
            return heads[-1]
        i += 1
    return current_branch(folder)


def overdue_problem(folder, pr_titles, head):
    """A deny reason if a pull request with these titles, from the branch head, would open from
    folder while the drift pass is overdue, else None."""
    if any(title.startswith(DRIFT_TITLE) for title in pr_titles):
        return None
    if (head or "").rpartition(":")[2].startswith(HOTFIX):  # gh and GitHub take owner:branch too
        return None
    try:
        merged, last_pass = merged_since_pass(folder)
    except GitFailed as error:
        return f"Can't count the merges since the last drift pass ({error}), so the pull request waits."
    if merged < BLOCK_AFTER:
        return None
    return (f"The drift pass is overdue: {merged} pull requests merged since {last_pass or 'the start'} "
            f"(due at {DUE_AFTER}, blocked at {BLOCK_AFTER}). Run it first (docs/REFACTORING.md, The drift pass); "
            f"its title starts '{DRIFT_TITLE}'. A {HOTFIX} branch may still open. If the pass has merged, "
            "git fetch: the count reads origin/main as last fetched.")


def drift_block_problem(cmds, cwd):
    """A deny reason if a gh pr create among cmds opens while the drift pass is overdue, else None."""
    for words, here in cmds:
        call = pr_call(words)
        if not call or call[0] != "create":
            continue
        folder = here or cwd
        problem = overdue_problem(folder, titles(call[1]), head_branch(call[1], folder))
        if problem:
            return problem
    return None


def pr_tool_problem(tool, tool_input, folder):
    """The same for the GitHub tool a cloud session opens a pull request with (guard_github.py)."""
    if tool != PR_TOOL:
        return None
    return overdue_problem(folder, [tool_input.get("title") or ""], tool_input.get("head"))
