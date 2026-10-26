"""The private-word check, for guard_bash.py: denies a commit, pull request or issue that names
a word on Craig's private list, in the command (message, body, heredoc), a body or message file
it reads, or a commit's staged lines; guard_github.py asks it about the GitHub tools' text too.
The list lives outside the repo (PRIVATE_WORDS, one per line), so this file never names them; a
cloud environment, with no home folder of Craig's, holds the words themselves in
DRAFT_PRIVATE_WORDS_LIST instead (one per line or comma-separated). With neither (a fresh clone),
nothing is checked and the guard says so in a note, never a denial, so work there goes on.
Not seen: text the shell builds at run time, such as -m "$(cat file)", and branch or file names.
Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import os

from where import git_call, git_dir, git_output, runs_at

LIST_OVERRIDE_ENV = "DRAFT_PRIVATE_WORDS"  # names another list; the hook tests use it
LIST_ENV = "DRAFT_PRIVATE_WORDS_LIST"  # the words themselves, set in a cloud environment's settings
DEFAULT_LIST = "~/.claude/private-words.txt"
PRIVATE_WORDS = os.environ.get(LIST_OVERRIDE_ENV) or os.path.expanduser(DEFAULT_LIST)
NO_LIST = (f"No private-word list at {DEFAULT_LIST} on this machine, "
           "so this wasn't checked for private words. "
           f"In a cloud environment, set {LIST_ENV} in its settings.")
GH_PUBLISHING = {("pr", "create"), ("pr", "edit"), ("pr", "comment"), ("pr", "merge"), ("pr", "review"),
                 ("issue", "create"), ("issue", "edit"), ("issue", "comment"),
                 ("release", "create"), ("release", "edit")}
GIT_PUBLISHING = {"commit", "tag"}
FILE_OPTS = {"-F", "--file", "--body-file"}  # options whose value is a file the text comes from


def private_words():
    """The list, [] if there is none at the default path, None if one is there (or named by an
    override) but can't be read. LIST_ENV, where set, is the list."""
    held = os.environ.get(LIST_ENV, "")
    if held.strip():
        return [w.strip().lower() for w in held.replace(",", "\n").splitlines() if w.strip()]
    try:
        with open(PRIVATE_WORDS, encoding="utf-8") as f:
            return [w.strip().lower() for w in f if w.strip() and not w.startswith("#")]
    except FileNotFoundError:  # list_missing_note says so
        return None if os.environ.get(LIST_OVERRIDE_ENV) else []
    except OSError:  # there, but a folder or unreadable: checking nothing would pass in silence
        return None


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


def list_missing_note(cmds):
    """A note, never a denial, when cmds publish and there is no list at the default path to check
    them against, else None. An override that can't be read is private_word_problem's denial."""
    return NO_LIST if not has_list() and any(publishes(words) for words, _ in cmds) else None


def has_list():
    """True if there is a list to check against, however it is held: one that holds no word (a lone
    comma, an empty file) would check nothing, so it counts as none and gets the note. One that
    can't be read is text_problem's denial."""
    return private_words() != []


def text_problem(texts):
    """A deny reason if any of texts names a word on the list, or the list can't be read, else None."""
    private = private_words()
    if private is None:
        return f"The private-word list at {PRIVATE_WORDS} can't be read, so nothing could be checked."
    found = "\n".join(texts).lower()
    if any(w in found for w in private):
        return (f"That would publish a word on Craig's private list ({PRIVATE_WORDS} or {LIST_ENV}). "
                "Take it out of the message, the body, or the staged lines.")
    return None


def private_word_problem(cmd, cmds, cwd):
    """A deny reason if cmd would publish a word on the list or can't be checked, else None.
    cmds is every simple command it runs, with its folder (commands.py)."""
    publishing = [(words, here) for words, here in cmds if publishes(words)]
    if not publishing:
        return None
    texts = [cmd]
    for words, here in publishing:
        texts += files_read(words, here or cwd)
        call, folder = git_call(words), git_dir(words, here)
        if call and call[0] == "commit" and folder:  # an unknown folder is refused by the guard
            staged = git_output(folder, "diff", "--cached", "-U0")
            if staged is None:
                return (f"Can't read the staged lines in {folder}, "
                        "so they couldn't be checked for private words.")
            texts.append(added_lines(staged))
    return text_problem(texts)
