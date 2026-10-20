"""Every simple command a Bash command line runs, for guard_bash.py, each with the folder it
starts in (where.py). The line is split into words the way the shell would, so text inside a
quoted commit message or a quoted heredoc is never mistaken for a command, and then each string
it hands to a shell is read the same way: sh, bash or zsh -c, eval, env -S, and each $(…) or `…`
outside single quotes. A cd inside a string counts only inside it; an eval that may move the
shell leaves the folder after it unsure (where.py). Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import os
import re
import shlex

from where import located, program_index, moved_by_runner, runner_options

HEREDOC = re.compile(r"<<-?[ \t]*(['\"]?)(\w+)\1([^\n]*)\n(.*?\n)?[ \t]*\2[ \t]*(\n|$)", re.S)
PUNCTUATION = ";&|()\n"  # the characters separators are made of
MARK = "\x01{}\x01"  # stands in for a lifted $(…) or `…`, numbered
MARKED = re.compile("\x01(\\d+)\x01")
BACKTICKED = re.compile(r"(?:\\.|[^`\\])*`", re.S)  # the rest of a `…`, up to its closing backtick
WORD_START = " \t\n;&|()"  # a # after one of these starts a comment
SHELLS = {"sh", "bash", "zsh", "dash", "ksh"}
SHELL_VALUE_OPTS = {"-o", "+o", "-O", "+O", "--rcfile", "--init-file"}
UNKNOWN_PROGRAM = re.compile("[$`\x01]")  # $GIT commit, "$(which git)" commit


class Unreadable(Exception):
    """A string that runs as commands but whose quotes or brackets don't balance."""


def commands(cmd, cwd):
    """(words, folder) for every simple command cmd runs, those in its strings included; the
    folder is None where the guard can't be sure. Raises ValueError if cmd's own quotes don't
    balance (the shell refuses it too) and Unreadable if a string inside it doesn't."""
    segs, lifted = parse(cmd)
    out = []
    for words, here in located(segs, cwd):
        out.append((words, here))
        for n in (int(n) for word in words for n in MARKED.findall(word)):
            out += _inner(lifted[n], here)
        for string in strings_run(words):  # a marker in one was run by this shell, above
            out += _inner(MARKED.sub("$_", string), None if moved_by_runner(words) else here)
    return out


def _inner(string, here):
    try:
        return commands(string, here)
    except ValueError:
        raise Unreadable(string) from None


def parse(cmd):
    """The command's simple commands as lists of words, with each separator between them as a
    list of its own (located() needs them), heredoc bodies dropped and each $(…) and `…` swapped
    for a marker; and the text each marker stands for."""
    lifted = []

    def keep_the_line(heredoc):  # an unquoted heredoc's $(…) runs too
        quoted, rest, body = heredoc.group(1), heredoc.group(3), heredoc.group(4) or ""
        marks = "" if quoted else " ".join(m.group() for m in MARKED.finditer(lift(body, lifted, False)))
        return f" {marks} {rest}\n"

    text = lift(HEREDOC.sub(keep_the_line, cmd.replace("\\\n", " ")), lifted)
    lex = shlex.shlex(text, posix=True, punctuation_chars=PUNCTUATION)
    lex.whitespace, lex.whitespace_split, lex.commenters = " \t\r", True, ""  # lift() drops comments
    out, cur = [], []
    for word in lex:
        if not word.strip(PUNCTUATION):  # shlex joins a run: ");" or ";(" is two separators
            for sep in re.findall(r"&&|\|\||.", word, re.S):
                out += [cur, [sep]]
                cur = []
        else:
            cur.append(word)
    out.append(cur)
    return [s for s in out if s], lifted


def lift(text, lifted, quotes=True, closer=False):
    """text with each $(…) and `…` the shell runs (any not in single quotes) swapped for a marker
    and comments dropped, appending what each marker stands for to lifted. quotes=False reads a
    heredoc body, where quote marks and # are plain text. With closer, reads a $(…)'s inside and
    returns where its closing bracket is instead."""
    out, quote, depth, i = [], None, 0, 0
    while i < len(text):
        c = text[i]
        if quote == "'":
            quote = None if c == "'" else quote
        elif c == "\\":
            out.append(text[i : i + 2])
            i += 2
            continue
        elif text.startswith("$(", i) or c == "`":
            start = i + (2 if c == "$" else 1)
            end = lift(text[start:], [], closer=True) + start if c == "$" else _backtick_end(text, start)
            lifted.append(text[start:end])
            out.append(MARK.format(len(lifted) - 1))
            i = end + 1
            continue
        elif quotes and c == '"':
            quote = None if quote else '"'
        elif quotes and c == "'" and not quote:
            quote = "'"
        elif closer and not quote and c in "()":
            depth += 1 if c == "(" else -1
            if depth < 0:
                return i
        elif quotes and c == "#" and not quote and (i == 0 or text[i - 1] in WORD_START):
            line_end = text.find("\n", i)
            i = len(text) if line_end < 0 else line_end
            continue
        out.append(c)
        i += 1
    if closer:
        raise Unreadable(text)
    return "".join(out)


def _backtick_end(text, start):
    found = BACKTICKED.match(text, start)
    if not found:
        raise Unreadable(text[start:])
    return found.end() - 1


def strings_run(words):
    """The strings this simple command hands to a shell to run: sh -c "…", eval …, env -S '…'."""
    i = program_index(words)
    out = [value + " " + shlex.join(words[i:]) for runner, opt, value in runner_options(words)
           if runner == "env" and opt in {"-S", "--split-string"}]
    program = os.path.basename(words[i]) if i < len(words) else ""
    if program == "eval":
        out.append(" ".join(words[i + 1 :]))
    elif program in SHELLS:
        out += _dash_c(words[i + 1 :])
    return out


def _dash_c(args):
    """The string a shell runs with -c (bash -lc "…"), [] if it runs a file or stdin."""
    has_c, i = False, 0
    while i < len(args) and args[i].startswith(("-", "+")) and args[i] not in {"-", "--"}:
        has_c = has_c or (re.match(r"^-[a-zA-Z]+$", args[i]) is not None and "c" in args[i])
        i += 2 if args[i] in SHELL_VALUE_OPTS else 1
    if args[i : i + 1] == ["--"]:
        i += 1
    return args[i : i + 1] if has_c else []


def runs_unknown(words):
    """True if the program this simple command runs is a variable or a $(…)."""
    i = program_index(words)
    return i < len(words) and UNKNOWN_PROGRAM.search(os.path.basename(words[i])) is not None
