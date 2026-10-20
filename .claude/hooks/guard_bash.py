#!/usr/bin/env python3
"""PreToolUse guard for Bash: the CLAUDE.md "Working" rules, as machinery.

Denies staging everything, force pushes, pushing to main, and committing or pushing while on
main. Every command the line runs is checked, those it passes as a string to sh -c, eval, env -S
or $(…) included (commands.py), each in the folder it runs in (the shell's cwd, any cd before it,
its -C: where.py), so a worktree is judged on its own branch, not the project's. Also denies
publishing a word on Craig's private list (private_words.py). Where it can't be sure what runs
or where, it refuses and says how to run the command plainly.

Reads the hook payload (JSON) on stdin; prints a deny decision or nothing.
Stdlib only, Python 3.9+, because it runs on whatever python3 is present.
"""

from __future__ import annotations

import json
import os
import re
import sys

from commands import Unbalanced, Unreadable, commands, runs_unknown, short_flags
from private_words import private_word_problem
from where import current_branch, git_call, git_dir, previous_branch

COMMIT_VALUE_SHORT = set("mFCct")  # in `-am msg` everything after m is the value
MAIN = "main"
MAIN_REFS = {MAIN, "refs/heads/" + MAIN}
MAIN_NAMES = {MAIN, "origin/" + MAIN}  # git switch main, git checkout origin/main
CREATES_BRANCH = {"-c", "-C", "-b", "-B", "--create", "--force-create", "--orphan"}
ATTACHED_CREATE = re.compile(r"^-[a-zA-Z]*?([cCbB])(.*)$")  # -cmain, -qb main
PREVIOUS = re.compile(r"^(-|@\{-(\d+)\})$")  # git switch -, git checkout @{-2}
UNREADABLE = ("Can't read a string that runs as commands (sh -c, eval, env -S, $(…) or backticks): "
              "its quotes or brackets don't balance. Run the commands plainly, not inside a string.")
UNKNOWN_PROGRAM = ("Can't tell what program that runs: the command is a variable or a $(…). "
                   "Write the program out: git commit -m x, not $GIT commit -m x.")
UNKNOWN_FOLDER = ("Can't tell which folder that runs in (a cd that may not take effect or into a "
                  "folder not made yet, a variable, pushd, an eval with a cd, GIT_DIR, --git-dir, "
                  "env -C or sudo -D). Run it plainly: cd <folder> && git commit, or git -C <folder> commit.")
CUT_A_BRANCH = ("Cut a branch first: git switch -c <type>/<thing> origin/main. "
                "Prefixes: feat/ fix/ refactor/ docs/ chore/.")
ON_MAIN = "You are on main. " + CUT_A_BRANCH
SWITCHED_TO_MAIN = ("That switches to main before it commits or pushes (a git switch - counts as main "
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


def push_problem(args):
    positional = []
    for a in args:
        if a.startswith("--force") or a == "--mirror":
            return "force"
        if "f" in short_flags(a):
            return "force"
        if not a.startswith("-"):
            positional.append(a)
    for ref in positional[1:]:  # the first is the remote
        if ref.startswith("+"):
            return "force"
        if ref.split(":")[-1] in MAIN_REFS:
            return "main"
    return None


def deletes_only(args):
    """True if this push only deletes remote branches (--delete x, or :x), so it pushes nothing
    from the branch it runs on. Deleting main is refused before this, as a push to main."""
    refs = [a for a in args if not a.startswith("-")][1:]  # the first is the remote
    deleting = "--delete" in args or "-d" in args or all(ref.startswith(":") for ref in refs)
    names = {ref.lstrip(":") for ref in refs}
    return bool(refs) and deleting and not names & {"HEAD", "@"}


def decide(cmd, cwd):
    """A deny reason, or None to allow; cwd is where the shell starts."""
    try:
        cmds = commands(cmd, cwd)
    except Unbalanced:
        return None  # zsh runs none of a line whose quotes don't balance (see commands())
    except Unreadable:
        return UNREADABLE
    problem = private_word_problem(cmd, cmds, cwd)
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
            return "That stages everything. Stage named paths only: git add path/one path/two."
        if sub == "commit" and commits_all(args):
            return "git commit -a stages every tracked change. Stage named paths with git add, then commit."
        if sub == "push":
            problem = push_problem(args)
            if problem == "force":
                return "No force pushes. If a branch has diverged, say so and let Craig decide."
            if problem == "main":
                return "That pushes to main. Changes reach main only through a squash-merged PR."
        if sub in {"commit", "push"}:
            if folder is None:
                return UNKNOWN_FOLDER
            if sub == "push" and deletes_only(args):
                continue
            if switched_to_main:
                return SWITCHED_TO_MAIN
            branch = current_branch(folder)
            if branch is None:
                return (f"Can't read which branch {folder} is on. "
                        f"Check that git runs there: git -C {folder} status.")
            if branch == MAIN:
                return ON_MAIN
    return None


def main():
    try:
        payload = json.load(sys.stdin)
    except ValueError:
        return
    cmd = (payload.get("tool_input") or {}).get("command") or ""
    cwd = payload.get("cwd") or os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    try:
        reason = decide(cmd, cwd)
    except Exception as error:  # a guard that crashes prints nothing, which would allow
        reason = f"The Bash guard failed ({type(error).__name__}: {error}), so nothing was checked."
    if reason:
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }}))


if __name__ == "__main__":
    main()
