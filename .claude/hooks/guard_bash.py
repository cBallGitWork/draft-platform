#!/usr/bin/env python3
"""PreToolUse guard for Bash: the CLAUDE.md "Working" rules, as machinery.

Denies staging everything, force pushes, pushing to main, and committing or pushing
while on main. The command is split into words the way the shell would, so text
inside a quoted commit message or a heredoc is never mistaken for a command.

Also denies a commit, pull request or issue that names a word on Craig's private list:
in the command (message, body, heredoc), a body or message file it reads, or a commit's
staged lines. The list lives outside the repo (PRIVATE_WORDS, one per line), so this file
never names them; with no list, nothing is checked.

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

SEPARATORS = {";", "&", "&&", "|", "||", "(", ")", "\n"}
HEREDOC = re.compile(r"<<-?[ \t]*(['\"]?)(\w+)\1[^\n]*\n(.*?\n)?[ \t]*\2[ \t]*(\n|$)", re.S)
# git options that take a value before the subcommand: `git -C dir add`, `git -c k=v push`
GIT_VALUE_OPTS = {"-C", "-c", "--git-dir", "--work-tree", "--namespace"}
COMMIT_VALUE_SHORT = set("mFCct")  # in `-am msg` everything after m is the value
MAIN_REFS = {"main", "refs/heads/main"}
PRIVATE_WORDS = os.environ.get("DRAFT_PRIVATE_WORDS") or os.path.expanduser("~/.claude/private-words.txt")
GH_PUBLISHING = {("pr", "create"), ("pr", "edit"), ("pr", "comment"), ("pr", "merge"),
                 ("issue", "create"), ("issue", "edit"), ("issue", "comment")}
FILE_OPTS = {"-F", "--file", "--body-file"}  # options whose value is a file the text comes from


def segments(cmd):
    """Each simple command as a list of words, heredoc bodies dropped."""
    cmd = HEREDOC.sub("\n", cmd.replace("\\\n", " "))
    lex = shlex.shlex(cmd, posix=True, punctuation_chars=";&|()\n")
    lex.whitespace = " \t\r"
    lex.whitespace_split = True
    out, cur = [], []
    for word in lex:
        if word in SEPARATORS:
            out.append(cur)
            cur = []
        else:
            cur.append(word)
    out.append(cur)
    return [s for s in out if s]


def git_call(words):
    """(subcommand, args) if this simple command runs git, else None."""
    i = 0
    while i < len(words) and re.match(r"^\w+=", words[i]):
        i += 1  # FOO=1 git ...
    if i >= len(words) or os.path.basename(words[i]) != "git":
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


def current_branch(project_dir):
    try:
        return subprocess.run(
            ["git", "-C", project_dir, "branch", "--show-current"],
            capture_output=True, text=True, timeout=5,
        ).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return ""


def private_words():
    try:
        with open(PRIVATE_WORDS, encoding="utf-8") as f:
            return [w.strip().lower() for w in f if w.strip() and not w.startswith("#")]
    except OSError:
        return []


def publishes(words):
    """True if this simple command writes text Craig shares: a commit, a PR or an issue."""
    call = git_call(words)
    if call:
        return call[0] == "commit"
    return len(words) >= 3 and os.path.basename(words[0]) == "gh" and (words[1], words[2]) in GH_PUBLISHING


def files_read(words, cwd):
    """The text of every file a -F/--file/--body-file option points at."""
    out = []
    for opt, val in zip(words, words[1:]):
        if opt in FILE_OPTS and val != "-":
            try:
                with open(os.path.join(cwd, val), encoding="utf-8") as f:
                    out.append(f.read())
            except OSError:
                pass
    return out


def staged_lines(project_dir):
    try:
        diff = subprocess.run(
            ["git", "-C", project_dir, "diff", "--cached", "-U0"],
            capture_output=True, text=True, timeout=5,
        ).stdout
    except (OSError, subprocess.SubprocessError):
        return ""
    return "\n".join(l for l in diff.splitlines() if l.startswith("+") and not l.startswith("+++"))


def private_word_in(cmd, segs, project_dir, cwd):
    """The first private word this command would publish, or None."""
    words = private_words()
    publishing = [s for s in segs if publishes(s)]
    if not words or not publishing:
        return None
    texts = [cmd]
    for s in publishing:
        texts += files_read(s, cwd)
        if git_call(s):
            texts.append(staged_lines(project_dir))
    found = "\n".join(texts).lower()
    return next((w for w in words if w in found), None)


def decide(cmd, project_dir, cwd=None):
    """A deny reason, or None to allow."""
    try:
        segs = segments(cmd)
    except ValueError:
        return None  # unbalanced quotes: the shell would refuse it too
    word = private_word_in(cmd, segs, project_dir, cwd or project_dir)
    if word:
        return (
            f'That would publish "{word}", which is on Craig\'s private list ({PRIVATE_WORDS}). '
            "Take it out of the message, the body, or the staged lines."
        )
    branch = None
    for words in segs:
        call = git_call(words)
        if not call:
            continue
        sub, args = call
        if sub in {"switch", "checkout"} and args[-1:] in (["main"], ["origin/main"]) and "-c" not in args and "-b" not in args:
            branch = "main"
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
            if branch is None:
                branch = current_branch(project_dir)
            if branch == "main":
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
    project_dir = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    reason = decide(cmd, project_dir, payload.get("cwd") or project_dir)
    if reason:
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }}))


if __name__ == "__main__":
    main()
