"""Every simple command a Bash command line runs, for guard_bash.py, each with the folder it
starts in (where.py). The line is split into words the way the shell would, so text inside a
quoted commit message or a quoted heredoc is never mistaken for a command, and then each string
it hands to a shell is read the same way: sh, bash or zsh -c, eval, env -S, and each $(…) or `…`
outside single quotes. A $'…' is read as the shell reads it, its escapes filled in. A cd inside a
string counts only inside it; an eval that may move the shell leaves the folder after it unsure
(where.py). Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import re
import shlex

from where import SPLIT_STRING, located, moved_by_runner, program_index, program_name, runner_options

HEREDOC = re.compile(r"<<-?[ \t]*(['\"]?)(\w+)\1([^\n]*)\n(.*?\n)?[ \t]*\2[ \t]*(\n|$)", re.S)
PUNCTUATION = ";&|()\n"  # the characters separators are made of
# a quoted or escaped one belongs to its word (git add '|' -A): a stand-in until the line is split
STAND_INS = "\ue000\ue001\ue002\ue003\ue004\ue005"
TO_STAND_INS, FROM_STAND_INS = str.maketrans(PUNCTUATION, STAND_INS), str.maketrans(STAND_INS, PUNCTUATION)
MARK = "\x01{}\x01"  # stands in for a lifted $(…) or `…`, numbered
MARKED = re.compile("\x01(\\d+)\x01")
BACKTICKED = re.compile(r"(?:\\.|[^`\\])*`", re.S)  # the rest of a `…`, up to its closing backtick
WORD_START = " \t\n;&|()"  # a # after one of these starts a comment
SHELLS = {"sh", "bash", "zsh", "dash", "ksh"}
SHELL_VALUE_OPTS = {"-o", "+o", "-O", "+O", "--rcfile", "--init-file"}
FILLED_IN = re.compile("[$`\x01]")  # a word the shell fills in: $GIT, "$(which git)"
SHORT_FLAGS = re.compile(r"^-[A-Za-z]+$")  # -lc, -am
ANSI_C = re.compile(r"\$'((?:\\.|[^'\\])*)'", re.S)  # $'it\'s': a quote in which \ escapes
ANSI_C_ESCAPE = re.compile(r"\\(x[0-9A-Fa-f]{1,2}|u[0-9A-Fa-f]{1,4}|U[0-9A-Fa-f]{1,8}|[0-7]{1,3}|.)", re.S)
ANSI_C_LETTERS = {"a": "\a", "b": "\b", "e": "\x1b", "E": "\x1b", "f": "\f", "n": "\n", "r": "\r",
                  "t": "\t", "v": "\v", "\\": "\\", "'": "'", '"': '"', "?": "?"}


class Unbalanced(Exception):
    """A command line whose own quotes don't balance."""


class Unreadable(Exception):
    """A string that runs as commands but whose quotes or brackets don't balance."""


def commands(cmd, cwd):
    """(words, folder) for every simple command cmd runs, those in its strings included; the
    folder is None where the guard can't be sure. Raises Unbalanced if cmd's own quotes don't
    balance (zsh then runs none of it; bash runs the lines before the bad one) and Unreadable if
    a string inside it doesn't."""
    segs, lifted = parse(cmd)
    out = []
    for words, here in located(segs, cwd):
        out.append((words, here))
        for n in (int(n) for word in words for n in MARKED.findall(word)):
            out += _commands_in_string(lifted[n], here)
        inner_here = None if moved_by_runner(words) else here
        for string in strings_run(words):  # its $(…) ran in this shell, above: the next sees output
            out += _commands_in_string(MARKED.sub("$_", string), inner_here)
    return out


def _commands_in_string(string, here):
    try:
        return commands(string, here)
    except Unbalanced:
        raise Unreadable(string) from None


def parse(cmd):
    """The command's simple commands as lists of words, with each separator between them as a
    list of its own (located() needs them), heredoc bodies dropped and each $(…) and `…` swapped
    for a marker; and the text each marker stands for."""
    lifted = []

    def keep_the_line(heredoc):  # an unquoted heredoc's $(…) runs too
        quoted, rest, body = heredoc.group(1), heredoc.group(3), heredoc.group(4) or ""
        if quoted:
            return f" {rest}\n"
        marks = MARKED.findall(lift_substitutions(body, lifted, quotes=False))
        return " " + " ".join(MARK.format(n) for n in marks) + f" {rest}\n"

    text = lift_substitutions(HEREDOC.sub(keep_the_line, cmd.replace("\\\n", " ")), lifted)
    lex = shlex.shlex(text, posix=True, punctuation_chars=PUNCTUATION)
    lex.whitespace = " \t\r"
    lex.whitespace_split = True
    lex.commenters = ""  # comments are dropped above; shlex would start one inside a word (a#b)
    try:
        lexed = list(lex)
    except ValueError:  # shlex's: no closing quotation, or a \ with nothing after it
        raise Unbalanced(cmd) from None
    out, cur = [], []
    for word in lexed:
        if word and not word.strip(PUNCTUATION):  # shlex joins a run: ");" is two separators; "" is a word
            for sep in re.findall(r"&&|\|\||.", word, re.S):
                out += [cur, [sep]]
                cur = []
        else:
            cur.append(word.translate(FROM_STAND_INS))
    out.append(cur)
    return [s for s in out if s], lifted


def lift_substitutions(text, lifted, quotes=True, closer=False):
    """text with each $(…) and `…` the shell runs (any not in single quotes) swapped for a marker,
    each $'…' for the plain quote it means, each quoted or escaped separator character for its
    stand-in (STAND_INS) and comments dropped, appending what each marker stands for to lifted.
    quotes=False reads a heredoc body, where quote marks and # are plain text. With closer, reads
    a $(…)'s inside and returns where its closing bracket is instead."""
    out, quote, depth, i = [], None, 0, 0
    while i < len(text):
        c = text[i]
        if quote == "'":
            quote = None if c == "'" else quote
        elif c == "\\":
            out.append(text[i : i + 2].translate(TO_STAND_INS))
            i += 2
            continue
        elif text.startswith("$(", i) or c == "`":
            start = i + (2 if c == "$" else 1)
            if c == "$":
                end = start + lift_substitutions(text[start:], [], closer=True)
            else:
                end = _backtick_end(text, start)
            lifted.append(text[start:end])
            out.append(MARK.format(len(lifted) - 1))
            i = end + 1
            continue
        elif quotes and not quote and (ansi_c := ANSI_C.match(text, i)):
            out.append(shlex.quote(_ansi_c(ansi_c.group(1)).translate(TO_STAND_INS)))
            i = ansi_c.end()
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
        out.append(c.translate(TO_STAND_INS) if quote else c)
        i += 1
    if closer:
        raise Unreadable(text)
    return "".join(out)


def _ansi_c(body):
    """What the inside of a $'…' says, its escapes filled in, up to any \\0 (bash drops the rest).
    A \\x01 in it becomes ?, so it can't pass for a marker."""
    return ANSI_C_ESCAPE.sub(_ansi_c_char, body).split("\0")[0].replace("\x01", "?")


def _ansi_c_char(escape):
    """The character a $'…' escape stands for: \\n, \\x63, \\u00e9, \\101. An unknown one stays, and so
    does \\cA (a control character, which no git word holds)."""
    e = escape.group(1)
    if e[0] in "xuU" and len(e) > 1:
        code = int(e[1:], 16)
        return chr(code) if code <= 0x10FFFF else escape.group(0)
    if e[0] in "01234567":
        return chr(int(e, 8))
    return ANSI_C_LETTERS.get(e, escape.group(0))


def _backtick_end(text, start):
    found = BACKTICKED.match(text, start)
    if not found:
        raise Unreadable(text[start:])
    return found.end() - 1


def strings_run(words):
    """The strings this simple command hands to a shell to run: sh -c "…", eval …, env -S '…'."""
    i, program = program_index(words), program_name(words)
    out = [value + " " + shlex.join(words[i:]) for runner, opt, value in runner_options(words)
           if runner == "env" and opt in SPLIT_STRING]
    if program == "eval":
        out.append(" ".join(words[i + 1 :]))
    elif program in SHELLS:
        out += _dash_c(words[i + 1 :])
    return out


def _dash_c(args):
    """The string a shell runs with -c (bash -lc "…"), [] if it runs a file or stdin."""
    has_c, i = False, 0
    while i < len(args) and args[i].startswith(("-", "+")) and args[i] not in {"-", "--"}:
        has_c = has_c or "c" in short_flags(args[i])
        i += 2 if args[i] in SHELL_VALUE_OPTS else 1
    if args[i : i + 1] == ["--"]:
        i += 1
    return args[i : i + 1] if has_c else []


def runs_unknown(words):
    """True if the program this simple command runs is a variable or a $(…)."""
    return FILLED_IN.search(program_name(words)) is not None


def short_flags(arg):
    """The letters of a cluster of short options (-lc gives lc), "" for anything else."""
    return arg[1:] if SHORT_FLAGS.match(arg) else ""
