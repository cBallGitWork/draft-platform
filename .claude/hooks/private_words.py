"""The private-word check, for guard_bash.py: denies a commit, pull request or issue that names
a word on Craig's private list, in the command (message, body, heredoc), a body or message file
it reads, or a commit's staged lines. The list lives outside the repo (PRIVATE_WORDS, one per
line), so this file never names them; with no list at the default path, nothing is checked. Not
seen: text the shell builds at run time, such as -m "$(cat file)", and branch or file names.
Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import os

from where import git_call, git_dir, git_output, runs_at

PRIVATE_WORDS = os.environ.get("DRAFT_PRIVATE_WORDS") or os.path.expanduser("~/.claude/private-words.txt")
GH_PUBLISHING = {("pr", "create"), ("pr", "edit"), ("pr", "comment"), ("pr", "merge"), ("pr", "review"),
                 ("issue", "create"), ("issue", "edit"), ("issue", "comment"),
                 ("release", "create"), ("release", "edit")}
GIT_PUBLISHING = {"commit", "tag"}
FILE_OPTS = {"-F", "--file", "--body-file"}  # options whose value is a file the text comes from


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
                pass  # git and gh can't read it either, so nothing is published from it
    return out


def added_lines(diff):
    return "\n".join(l for l in diff.splitlines() if l.startswith("+") and not l.startswith("+++"))


def private_word_problem(cmd, cmds, cwd):
    """A deny reason if cmd would publish a word on the list or can't be checked, else None.
    cmds is every simple command it runs, with its folder (commands.py)."""
    publishing = [(words, here) for words, here in cmds if publishes(words)]
    if not publishing:
        return None
    private = private_words()
    if private is None:
        return f"The private-word list at {PRIVATE_WORDS} can't be read, so nothing could be checked."
    texts = [cmd]
    for words, here in publishing:
        texts += files_read(words, here or cwd)
        call, folder = git_call(words), git_dir(words, here)
        if call and call[0] == "commit" and folder:  # an unknown folder is refused by the guard
            staged = git_output(folder, "diff", "--cached", "-U0")
            if staged is None:
                return f"Can't read the staged lines in {folder}, so they couldn't be checked for private words."
            texts.append(added_lines(staged))
    found = "\n".join(texts).lower()
    if any(w in found for w in private):
        return (f"That would publish a word on Craig's private list ({PRIVATE_WORDS}). "
                "Take it out of the message, the body, or the staged lines.")
    return None
