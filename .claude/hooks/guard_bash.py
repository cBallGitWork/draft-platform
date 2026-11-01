#!/usr/bin/env python3
"""PreToolUse guard for Bash: the CLAUDE.md "Working" rules, as machinery.

Denies staging everything, force pushes, pushing to main, a gh api write to main (main_writes.py),
committing or pushing while on main, publishing a word on Craig's private list (private_words.py),
a pull request body that breaks the template's rules or a title far too long (pr_body.py), a gh pr
merge once a drift pass is due unless it is one (drift_gate.py), a gh pr merge of a screen whose
differences from its approved picture wait for Craig, or adding his craig-approved label
(approval_gate.py), and a read-only agent's git
command that changes a checkout of this repo (read_only.py). Every command the line runs is
checked, those it passes to sh -c, eval, $(…), a heredoc, here-string or pipe into a shell (or a
group around one), find -exec or ssh included, whatever its redirections (commands.py; where.py
lists what it can't see), each in the folder it runs in (the shell's cwd, any cd before it, its
-C: where.py), so a worktree is judged on its own branch. A title only somewhat long, publishing
with no private list to check, or a subagent's payload with no agent_type gets a note instead.
Where it can't be sure what runs or where, it refuses and says how to run the command plainly.
Reads the hook payload (JSON) on stdin; prints a deny, a note, or nothing. Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import json
import re
import sys

from approval_gate import approval_problem, label_problem
from commands import XARGS, Unbalanced, Unreadable, UnreadableStdin, commands, runs_unknown, short_flags
from drift_gate import merge_problem
from hook_payload import project_dir
from main_writes import MAIN, MAIN_REFS, gh_api_problem
from pr_body import pr_body_problem, pr_title_note
from private_words import list_missing_note, private_word_problem
from read_only import agent_type_note, read_only_problem
from where import current_branch, git_call, git_dir, options, previous_branch, runners

COMMIT_VALUE_SHORT = set("mFCct")  # in `-am msg` everything after m is the value
MAIN_NAMES = {MAIN, "origin/" + MAIN}  # git switch main, git checkout origin/main
CREATES_BRANCH = {"-c", "-C", "-b", "-B", "--create", "--force-create", "--orphan"}
ATTACHED_CREATE = re.compile(r"^-[a-zA-Z]*?([cCbB])(.*)$")  # -cmain, -qb main
PREVIOUS = re.compile(r"^(-|@\{-(\d+)\})$")  # git switch -, git checkout @{-2}
PUSH_VALUE_OPTS = {"-o", "--push-option", "--repo", "--receive-pack", "--exec"}
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


def push_problem(args):
    opts, refs = push_parts(args)
    for opt, _ in opts:
        if opt.startswith("--force") or opt in {"--mirror", "-f"}:
            return "force"
    for ref in refs:
        if ref.startswith("+"):
            return "force"
        if ref.split(":")[-1] in MAIN_REFS:
            return "main"
    return None


def deletes_only(args):
    """True if this push only deletes remote branches (--delete x, or :x), so it pushes nothing
    from the branch it runs on. Deleting main is refused before this, as a push to main."""
    opts, refs = push_parts(args)
    deleting = any(opt in {"--delete", "-d"} for opt, _ in opts) or all(r.startswith(":") for r in refs)
    names = {ref.lstrip(":") for ref in refs}
    return bool(refs) and deleting and not names & {"HEAD", "@"}


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
    problem = private_word_problem(cmd, cmds, cwd) or pr_body_problem(cmds, cwd) or gh_api_problem(cmds)
    problem = problem or label_problem(cmds) or merge_problem(cmds) or approval_problem(cmds)
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


def note(cmd, cwd, payload):
    """Each *_note's advice that doesn't deny, or None. Asked only when decide allows."""
    try:
        cmds = commands(cmd, cwd)
    except (Unbalanced, Unreadable, UnreadableStdin):
        return agent_type_note(payload)
    notes = [n for n in (list_missing_note(cmds), pr_title_note(cmds), agent_type_note(payload)) if n]
    return "\n".join(notes) or None


def main():
    advice = None
    try:  # a payload it can't read is denied too: allowing it would check nothing
        payload = json.load(sys.stdin)
        if isinstance(payload, dict):
            cmd = (payload.get("tool_input") or {}).get("command") or ""
            cwd = project_dir(payload.get("cwd"))
            reason = decide(cmd, cwd, payload.get("agent_type"))
            advice = None if reason else note(cmd, cwd, payload)
        else:
            reason = (f"The Bash guard couldn't read the hook payload (a JSON {type(payload).__name__}, "
                      "not an object), so nothing was checked.")
    except Exception as error:  # a guard that crashes prints nothing, which would allow
        reason = f"The Bash guard failed ({type(error).__name__}: {error}), so nothing was checked."
    if reason:
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }}))
    elif advice:  # additionalContext reaches Claude; systemMessage shows it to Craig
        print(json.dumps({"systemMessage": advice,
                          "hookSpecificOutput": {"hookEventName": "PreToolUse", "additionalContext": advice}}))


if __name__ == "__main__":
    main()
