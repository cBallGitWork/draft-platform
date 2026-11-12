"""The private-word check, for guard_bash.py: denies a commit, a tag or a gh write (any gh call but a
read) that names a word on Craig's private list, in the command (message, body, heredoc), a body, notes
or message file it reads (where.text_files), or a commit's staged lines and the unstaged lines of any
path it names; guard_github.py asks it about the GitHub tools' text too.
The list lives outside the repo (PRIVATE_WORDS, one per line), so this file never names them; a
cloud environment, with no home folder of Craig's, holds the words themselves in
DRAFT_PRIVATE_WORDS_LIST instead (one per line or comma-separated). With neither (a fresh clone),
nothing is checked and the guard says so in a note, never a denial, so work there goes on.
Not seen: text the shell builds at run time, such as -m "$(cat file)", and branch or file names.
Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import os

from where import TEXT_FILE_OPTS, arguments, git_call, git_dir, git_output, runs_at, text_files

LIST_OVERRIDE_ENV = "DRAFT_PRIVATE_WORDS"  # names another list; the hook tests use it
LIST_ENV = "DRAFT_PRIVATE_WORDS_LIST"  # the words themselves, set in a cloud environment's settings
DEFAULT_LIST = "~/.claude/private-words.txt"
PRIVATE_WORDS = os.environ.get(LIST_OVERRIDE_ENV) or os.path.expanduser(DEFAULT_LIST)
NO_LIST = (f"No private-word list at {DEFAULT_LIST} on this machine, "
           "so this wasn't checked for private words. "
           f"In a cloud environment, set {LIST_ENV} in its settings.")
# gh publishes unless it is a known read, as guard_github.py treats its tools, so a write gh adds
# or a flag like `close --comment` is checked too; a read is left alone, so a search term isn't denied
GH_READ_COMMANDS = {"search", "status", "browse", "help", "version", "--version", "--help"}  # gh <command>
GH_READ_VERBS = {"view", "list", "status", "checks", "diff", "watch"}  # gh <noun> <verb>
GIT_PUBLISHING = {"commit", "tag"}
# the options that take a value, besides where.TEXT_FILE_OPTS, so a value is never read as an option
GIT_VALUE_OPTS = {"-m", "--message", "-c", "-C", "--reuse-message", "--reedit-message", "-t", "--template",
                  "--author", "--date", "--fixup", "--squash", "--cleanup", "--trailer", "--pathspec-from-file"}
GH_VALUE_OPTS = {"-b", "--body", "-t", "--title", "-n", "--notes", "-R", "--repo", "-B", "--base", "-H", "--head",
                 "-a", "--assignee", "-l", "--label", "-r", "--reviewer", "-m", "--milestone", "-p", "--project",
                 "-T", "--template", "--target", "-f", "--raw-field", "-X", "--method", "--jq", "-q"}


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
    """True if this simple command may write text Craig shares: a commit, a tag, or any gh call
    but a known read (gh api always counts)."""
    call = git_call(words)
    if call:
        return call[0] in GIT_PUBLISHING
    i = runs_at(words, "gh")
    if i is None:
        return False
    command, verb = (words[i + 1 : i + 3] + [None, None])[:2]
    return command not in GH_READ_COMMANDS and verb not in GH_READ_VERBS


def publishing_args(words):
    """The args a publishing git or gh call takes its text from, and their options that take a value."""
    call = git_call(words)
    if call:
        return call[1], GIT_VALUE_OPTS
    i = runs_at(words, "gh")
    return words[i + 1 :], GH_VALUE_OPTS


def files_read(words, cwd):
    """The text of every file a publishing call's -F, --file, --body-file or --notes-file names."""
    out = []
    for path in text_files(*publishing_args(words)):
        if path == "-":
            continue
        try:
            with open(os.path.join(cwd, path), encoding="utf-8") as f:
                out.append(f.read())
        except OSError:
            pass  # git and gh can't read it either, so nothing is published from it
    return out


def committed_paths(args):
    """The paths a git commit names: their working copy is committed, staged or not."""
    return arguments(args, TEXT_FILE_OPTS | GIT_VALUE_OPTS)[1]


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
            # the staged lines, and the unstaged ones of any path it names (git commit path/one)
            paths = committed_paths(call[1])
            diffs = [git_output(folder, "diff", "--cached", "-U0")]
            if paths:
                diffs.append(git_output(folder, "diff", "-U0", "--", *paths))
            if None in diffs:
                return (f"Can't read the lines to be committed in {folder}, "
                        "so they couldn't be checked for private words.")
            texts += [added_lines(diff) for diff in diffs]
    return text_problem(texts)
