#!/usr/bin/env python3
"""PreToolUse guard for Bash: the CLAUDE.md "Working" rules, as machinery.

Denies staging everything, force pushes, committing while on main (a local commit GitHub can't
see: a push or write to main GitHub's main ruleset refuses itself), publishing a word on Craig's
private list (private_words.py), a pull request body that breaks the template's rules or a title
far too long (pr_body.py), a gh pr merge with --admin or of
no pull request it can name (approval_gate.py), and a read-only agent's git command that changes a checkout of this repo (read_only.py). Every command the line runs is
checked, those it passes to sh -c, eval, $(…), a heredoc, here-string or pipe into a shell (or a
group around one), find -exec or ssh included, whatever its redirections (commands.py; where.py
lists what it can't see), each in the folder it runs in (the shell's cwd, any cd before it, its
-C: where.py), so a worktree is judged on its own branch. A title only somewhat long, publishing
with no private list to check, or a subagent's payload with no agent_type gets a note instead.
Where it can't be sure what runs or where, it refuses and says how to run the command plainly.
Reads the hook payload (JSON) on stdin; prints a deny, a note, or nothing. Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import re
import sys

from approval_gate import approval_problem
from commands import XARGS, Unbalanced, Unreadable, UnreadableStdin, commands, runs_unknown, short_flags
from hook_payload import field, project_dir, run_guard
from pr_body import pr_body_problem, pr_title_note
from private_words import list_missing_note, private_word_problem
from read_only import agent_type_note, read_only_problem
from where import MAIN, REMOTE_MAIN, current_branch, git_call, git_dir, options, previous_branch, runners

COMMIT_VALUE_SHORT = set("mFCct")  # in `-am msg` everything after m is the value
MAIN_NAMES = {MAIN, REMOTE_MAIN}  # git switch main, git checkout origin/main
CREATES_BRANCH = {"-c", "-C", "-b", "-B", "--create", "--force-create", "--orphan"}
ATTACHED_CREATE = re.compile(r"^-[a-zA-Z]*?([cCbB])(.*)$")  # -cmain, -qb main
PREVIOUS = re.compile(r"^(-|@\{-(\d+)\})$")  # git switch -, git checkout @{-2}
PUSH_VALUE_OPTS = {"-o", "--push-option", "--repo", "--receive-pack", "--exec"}
FORCE_OPTS = {"--mirror", "-f"}  # and every --force…, but for NOT_FORCE
NOT_FORCE = {"--force-if-includes"}  # alone it forces nothing: it only tightens --force-with-lease
UNREADABLE = ("Can't read a string that runs as commands (sh -c, eval, env -S, $(…), backticks, or a "
              "heredoc or pipe into a shell): its quotes or brackets don't balance. Run the commands "
              "plainly, not inside a string.")
UNREADABLE_STDIN = ("Can't read what that feeds a shell on stdin, or what xargs puts into a string a shell "
                    "runs: a program's output, a file, or a heredoc or here-string with a $ or backtick the "
                    "shell fills in. Run the commands plainly, or feed them literally: bash <<'EOF' "
                    "(quoted), or echo '…' | sh.")
STAGE_NAMED = "Stage named paths only: git add path/one path/two."
UNKNOWN_PROGRAM = ("Can't tell what program that runs (it's a variable or a $(…)), so the guard can't "
                   "check it isn't git. Write the program out: vim f, not $EDITOR f; git commit, not $GIT commit.")
UNKNOWN_FOLDER = ("Can't tell which folder that runs in (a cd that may not take effect or into a "
                  "folder not made yet, a variable, pushd, source, an eval with a cd, a cd in a "
                  "function, GIT_DIR, --git-dir, env -C, sudo -D, find -execdir, or a command run "
                  "by ssh, su, watch, script or fish). Run it plainly: cd <folder> && git commit, "
                  "or git -C <folder> commit.")
CUT_A_BRANCH = ("Cut a branch first: git switch -c <type>/<thing> origin/main. "
                "Prefixes: feat/ fix/ refactor/ docs/ chore/.")
ON_MAIN = "You are on main. " + CUT_A_BRANCH
SWITCHED_TO_MAIN = ("That switches to main before it commits (a git switch - counts as main "
                    "where the guard can't tell which branch it goes back to). " + CUT_A_BRANCH)


def split_creating_options(args):
    """args with a creating option's attached name split off: --create=main and -cmain become
    --create main and -c main."""
    out = []
    for arg in args:
        opt, has_value, value = arg.partition("=")
        attached = ATTACHED_CREATE.match(arg) if not arg.startswith("--") else None
        if has_value and opt in CREATES_BRANCH:
            out += [opt, value]
        elif attached:
            out.append("-" + attached.group(1))
            if attached.group(2):
                out.append(attached.group(2))
        else:
            out.append(arg)
    return out


def switches_to_main(args, folder):
    """True if git switch or checkout with these args leaves the folder on main: git switch main,
    git switch -C main, git switch - back to it. With -- and a path after it, it restores files
    (git checkout main -- a) and stays put. The branch git switch - goes back to is read in
    folder; where that's None or git can't say, it counts as main."""
    args = split_creating_options(args)
    if "--" in args[:-1]:
        return False
    created = [name for opt, name in zip(args, args[1:]) if opt in CREATES_BRANCH]
    names = set(created[:1] or args)
    for name in list(names):
        back = PREVIOUS.match(name)
        if back:
            found = previous_branch(folder, int(back.group(2) or 1)) if folder else None
            names.add(found or MAIN)
    return bool(MAIN_NAMES & names)


def stages_everything(args):
    for a in args:
        if a in {"-A", "--all", "-u", "--update", ".", "./", ":/", "*"}:
            return True
        if set(short_flags(a)) & {"A", "u"}:
            return True
    return False


def commits_all(args):
    skip = False
    for a in args:
        if skip:
            skip = False
            continue
        if a in {"-a", "--all"}:
            return True
        if a in {"-m", "-F", "-C", "-c", "-t", "--message", "--file", "--author", "--date"}:
            skip = True
            continue
        for ch in short_flags(a):
            if ch == "a":
                return True
            if ch in COMMIT_VALUE_SHORT:
                break
    return False


def push_parts(args):
    """A push's options, as (option, value), and its refspecs: its operands after the remote,
    or all of them where --repo names it. An option's value is neither (push -o ci.skip x)."""
    opts, operands, i = [], [], 0
    while i < len(args):
        found, i = options(args, i, PUSH_VALUE_OPTS)
        opts += found
        operands += args[i : i + 1]
        i += 1
    repo_given = any(opt == "--repo" for opt, _ in opts)
    return opts, operands if repo_given else operands[1:]


def force_pushes(args):
    """True if this push forces: --force or its kin, -f, --mirror, or a +refspec. Main itself
    needs no check here: GitHub's main ruleset refuses any push to it."""
    opts, refs = push_parts(args)
    if any((opt.startswith("--force") or opt in FORCE_OPTS) and opt not in NOT_FORCE for opt, _ in opts):
        return True
    return any(ref.startswith("+") for ref in refs)


def decide(cmd, cwd, agent_type=None):
    """A deny reason, or None to allow; cwd is where the shell starts, agent_type the subagent's."""
    try:
        cmds = commands(cmd, cwd)
    except Unbalanced:
        return None  # zsh runs none of a line whose quotes don't balance (see commands())
    except Unreadable:
        return UNREADABLE
    except UnreadableStdin:
        return UNREADABLE_STDIN
    problem = private_word_problem(cmd, cmds, cwd) or pr_body_problem(cmds, cwd)
    problem = problem or approval_problem(cmds)
    problem = problem or read_only_problem(cmds, cwd, agent_type)
    if problem:
        return problem
    switched, switched_to_main = False, False
    for words, here in cmds:
        if runs_unknown(words):
            return UNKNOWN_PROGRAM
        call = git_call(words)
        if not call:
            continue
        sub, args = call
        folder = git_dir(words, here)
        if sub in {"switch", "checkout"}:  # after an earlier switch, git switch - is unsure
            switched_to_main = switched_to_main or switches_to_main(args, None if switched else folder)
            switched = True
        if sub == "add" and stages_everything(args):
            return "That stages everything. " + STAGE_NAMED
        if sub == "add" and XARGS in runners(words):
            return "xargs adds the paths stdin holds, so the guard can't tell what that stages. " + STAGE_NAMED
        if sub == "commit" and commits_all(args):
            return "git commit -a stages every tracked change. Stage named paths with git add, then commit."
        if sub == "push" and force_pushes(args):
            return "No force pushes. If a branch has diverged, say so and let Craig decide."
        if sub == "commit":
            if folder is None:
                return UNKNOWN_FOLDER
            if switched_to_main:
                return SWITCHED_TO_MAIN
            branch = current_branch(folder)
            if branch is None:
                return (f"Can't read which branch {folder} is on. "
                        f"Check that git runs there: git -C {folder} status.")
            if branch == MAIN:
                return ON_MAIN
    return None


def note(cmd, cwd, payload):
    """Each *_note's advice that doesn't deny, or None. Asked only when decide allows."""
    try:
        cmds = commands(cmd, cwd)
    except (Unbalanced, Unreadable, UnreadableStdin):
        return agent_type_note(payload)
    notes = [n for n in (list_missing_note(cmds), pr_title_note(cmds), agent_type_note(payload)) if n]
    return "\n".join(notes) or None


def check(payload):
    """(deny reason, advice) for a payload: run_guard's decide."""
    cmd = field(field(payload, "tool_input", dict, {}), "command", str, "")
    cwd = project_dir(field(payload, "cwd", str, ""))
    reason = decide(cmd, cwd, payload.get("agent_type"))
    return reason, None if reason else note(cmd, cwd, payload)


def main():
    return run_guard("Bash", check)


if __name__ == "__main__":
    sys.exit(main())
