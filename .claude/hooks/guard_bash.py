#!/usr/bin/env python3
"""PreToolUse guard for Bash: the CLAUDE.md "Working" rules, as machinery.

Denies staging everything, force pushes, pushing to main, and committing or pushing
while on main. The command is split into words the way the shell would, so text
inside a quoted commit message or a heredoc is never mistaken for a command. The branch and
the staged lines are read in the folder each git command runs in (the shell's cwd, any cd
before it, its -C), so a worktree is judged on its own branch, not the project's.

Also denies a commit, pull request or issue that names a word on Craig's private list:
in the command (message, body, heredoc), a body or message file it reads, or a commit's
staged lines. The list lives outside the repo (PRIVATE_WORDS, one per line), so this file
never names them; with no list at the default path, nothing is checked. Not seen: text the
shell builds at run time, such as -m "$(cat file)", and branch or file names.

Reads the hook payload (JSON) on stdin; prints a deny decision or nothing.
Stdlib only, Python 3.9+, because it runs on whatever python3 is present.
"""

from __future__ import annotations

import json
import os
import re
import shlex
import subprocess
import sys

from where import GIT_VALUE_OPTS, SEPARATORS, current_branch, git_dir, located, runs_at

HEREDOC = re.compile(r"<<-?[ \t]*(['\"]?)(\w+)\1[^\n]*\n(.*?\n)?[ \t]*\2[ \t]*(\n|$)", re.S)
COMMIT_VALUE_SHORT = set("mFCct")  # in `-am msg` everything after m is the value
MAIN_REFS = {"main", "refs/heads/main"}
PRIVATE_WORDS = os.environ.get("DRAFT_PRIVATE_WORDS") or os.path.expanduser("~/.claude/private-words.txt")
GH_PUBLISHING = {("pr", "create"), ("pr", "edit"), ("pr", "comment"), ("pr", "merge"), ("pr", "review"),
                 ("issue", "create"), ("issue", "edit"), ("issue", "comment"),
                 ("release", "create"), ("release", "edit")}
GIT_PUBLISHING = {"commit", "tag"}
FILE_OPTS = {"-F", "--file", "--body-file"}  # options whose value is a file the text comes from


def segments(cmd):
    """Each simple command as a list of words, heredoc bodies dropped, and each separator
    between them as a list of its own, so located() can tell when a cd may not take effect."""
    cmd = HEREDOC.sub("\n", cmd.replace("\\\n", " "))
    lex = shlex.shlex(cmd, posix=True, punctuation_chars=";&|()\n")
    lex.whitespace = " \t\r"
    lex.whitespace_split = True
    out, cur = [], []
    for word in lex:
        if word in SEPARATORS:
            out += [cur, [word]]
            cur = []
        else:
            cur.append(word)
    out.append(cur)
    return [s for s in out if s]


def git_call(words):
    """(subcommand, args) if this simple command runs git, else None."""
    i = runs_at(words, "git")  # FOO=1 git ..., env git ...
    if i is None:
        return None
    i += 1
    while i < len(words) and words[i].startswith("-"):
        i += 2 if words[i] in GIT_VALUE_OPTS else 1
    if i >= len(words):
        return None
    return words[i], words[i + 1 :]


def short_flags(arg):
    return arg[1:] if re.match(r"^-[A-Za-z]+$", arg) else ""


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


def private_words():
    """The list, [] if there is none at the default path, None if an override can't be read."""
    try:
        with open(PRIVATE_WORDS, encoding="utf-8") as f:
            return [w.strip().lower() for w in f if w.strip() and not w.startswith("#")]
    except OSError:
        return None if os.environ.get("DRAFT_PRIVATE_WORDS") else []


def publishes(words):
    """True if this simple command writes text Craig shares: a commit, a PR or an issue."""
    call = git_call(words)
    if call:
        return call[0] in GIT_PUBLISHING
    i = runs_at(words, "gh")
    if i is None:
        return False
    return words[i + 1 : i + 2] == ["api"] or tuple(words[i + 1 : i + 3]) in GH_PUBLISHING


def files_read(words, cwd):
    """The text of every file a -F/--file/--body-file option points at."""
    out = []
    pairs = list(zip(words, words[1:])) + [tuple(w.split("=", 1)) for w in words if "=" in w]
    for opt, val in pairs:
        if opt in FILE_OPTS and val != "-":
            try:
                with open(os.path.join(cwd, val), encoding="utf-8") as f:
                    out.append(f.read())
            except OSError:
                pass
    return out


def staged_lines(folder):
    try:
        diff = subprocess.run(
            ["git", "-C", folder, "diff", "--cached", "-U0"],
            capture_output=True, text=True, timeout=5,
        ).stdout
    except (OSError, subprocess.SubprocessError):
        return ""
    return "\n".join(l for l in diff.splitlines() if l.startswith("+") and not l.startswith("+++"))


def private_word_in(cmd, segs, cwd):
    """The first private word this command would publish, "" for an unreadable list, or None."""
    publishing = [(s, here) for s, here in located(segs, cwd) if publishes(s)]
    if not publishing:
        return None
    words = private_words()
    if words is None:
        return ""
    texts = [cmd]
    for s, here in publishing:
        texts += files_read(s, here or cwd)
        call, folder = git_call(s), git_dir(s, here)
        if call and call[0] == "commit" and folder:
            texts.append(staged_lines(folder))  # an unknown folder is refused below
    found = "\n".join(texts).lower()
    return next((w for w in words if w in found), None)


def decide(cmd, cwd):
    """A deny reason, or None to allow; cwd is where the shell starts."""
    try:
        segs = segments(cmd)
    except ValueError:
        return None  # unbalanced quotes: the shell would refuse it too
    word = private_word_in(cmd, segs, cwd)
    if word == "":
        return f"The private-word list at {PRIVATE_WORDS} can't be read, so nothing could be checked."
    if word:
        return (
            f"That would publish a word on Craig's private list ({PRIVATE_WORDS}). "
            "Take it out of the message, the body, or the staged lines."
        )
    switched_to_main = False
    for words, here in located(segs, cwd):
        call = git_call(words)
        if not call:
            continue
        sub, args = call
        if sub in {"switch", "checkout"} and args[-1:] in (["main"], ["origin/main"]) and "-c" not in args and "-b" not in args:
            switched_to_main = True
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
            folder = git_dir(words, here)
            if folder is None:
                return (
                    "Can't tell which folder that runs in (a cd that may not take effect, pushd, "
                    "GIT_DIR, --git-dir or env -C). Run it plainly: cd <folder> && git commit, or "
                    "git -C <folder> commit."
                )
            if switched_to_main or current_branch(folder) == "main":
                return (
                    "You are on main. Cut a branch first: git switch -c <type>/<thing> origin/main. "
                    "Prefixes: feat/ fix/ refactor/ docs/ chore/."
                )
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
