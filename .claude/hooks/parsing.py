"""A Bash command line split into simple commands the way the shell splits it, for commands.py:
quotes and escapes kept to their words, comments dropped, each $(…) and `…` the shell runs lifted
out to be read on its own, and each heredoc's body lifted out of the line, so a quoted commit
message or a heredoc's text is never mistaken for a command. A $'…' is read as the shell reads
it, its escapes filled in, and each redirection's operator is marked (2>&1 is one, not a
background &). Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import re
import shlex
from collections import namedtuple

PUNCTUATION = ";&|()\n"  # the characters separators are made of
# a separator that doesn't end what comes before it: |& is a pipe (stderr too), and a line that
# ends in |, && or || goes on to the next
CONTINUED = {("|", "&"), ("|", "\n"), ("&&", "\n"), ("||", "\n")}
# a quoted or escaped one belongs to its word (git add '|' -A): a stand-in until the line is split
STAND_INS = ""
TO_STAND_INS, FROM_STAND_INS = str.maketrans(PUNCTUATION, STAND_INS), str.maketrans(STAND_INS, PUNCTUATION)
MARK = "\x01{}\x01"  # stands in for a lifted $(…) or `…`, numbered
MARKED = re.compile("\x01(\\d+)\x01")
HEREDOC_MARK = "\x02{}\x02"  # stands in for a heredoc, numbered the same way
HEREDOC_MARKED = re.compile("\x02(\\d+)\x02")
HERE_STRING = "\x03"  # stands in for an unquoted <<<
# stand in for an unquoted redirection's operator, its target the word after: one that feeds stdin
# (< f, 0<&3, <> f) and any other (> f, 2>&1, &>> f, >| f)
REDIRECT_IN, REDIRECT_OUT = "\x04<", "\x04>"
# <(…) too: bash <(curl x) is refused, as curl x | bash is
REDIRECT = re.compile(r"(\d*)(>>|>&|>\||>|<>|<&|<)")
REDIRECT_BOTH = re.compile(r"&>>?")  # stdout and stderr: &> f
NOT_A_MARK = str.maketrans("\x01\x02\x03\x04", "????")  # what a $'…' holds can't pass for one
# a heredoc's operator and delimiter word: <<EOF, <<-'EOF', <<"E.F", <<\EOF, <<E"O"F
HEREDOC = re.compile(r"""<<-?[ \t]*((?:'[^']*'|"(?:\\.|[^"\\])*"|\\.|[^\s;&|()<>'"\\])+)""", re.S)
Heredoc = namedtuple("Heredoc", "body quoted")  # body is None if its delimiter line never comes
BACKTICKED = re.compile(r"(?:\\.|[^`\\])*`", re.S)  # the rest of a `…`, up to its closing backtick
WORD_START = " \t\n;&|()"  # a # after one of these starts a comment
ANSI_C = re.compile(r"\$'((?:\\.|[^'\\])*)'", re.S)  # $'it\'s': a quote in which \ escapes
ANSI_C_ESCAPE = re.compile(r"\\(x[0-9A-Fa-f]{1,2}|u[0-9A-Fa-f]{1,4}|U[0-9A-Fa-f]{1,8}|[0-7]{1,3}|.)", re.S)
ANSI_C_LETTERS = {"a": "\a", "b": "\b", "e": "\x1b", "E": "\x1b", "f": "\f", "n": "\n", "r": "\r",
                  "t": "\t", "v": "\v", "\\": "\\", "'": "'", '"': '"', "?": "?"}


class Unbalanced(Exception):
    """A command line whose own quotes don't balance."""


class Unreadable(Exception):
    """A string that runs as commands but whose quotes or brackets don't balance."""


def parse(cmd):
    """The command's simple commands as lists of words, with each separator between them as a
    list of its own (located() needs them), each $(…) and `…` swapped for a marker and each
    heredoc for a marker word; and what each marker stands for: the text, or a Heredoc."""
    lifted = []
    text = lift_substitutions(cmd.replace("\\\n", " "), lifted)
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
                if cur or not out or (out[-1][0], sep) not in CONTINUED:
                    out += [cur, [sep]]
                cur = []
        else:
            cur.append(word.translate(FROM_STAND_INS))
    out.append(cur)
    return [s for s in out if s], lifted


def lift_substitutions(text, lifted, quotes=True, closer=False):
    """text with each $(…) and `…` the shell runs (any not in single quotes) swapped for a marker,
    each heredoc's operator and delimiter for one and its body cut out, each unquoted <<< for
    HERE_STRING, any other redirection's operator for REDIRECT_IN or REDIRECT_OUT (its target
    the word after), each $'…' for the plain quote it means, each quoted or escaped separator
    character for its stand-in (STAND_INS) and comments dropped, appending what each marker
    stands for to lifted. quotes=False reads a heredoc body, where quote marks, # and << are
    plain text. With closer, reads a $(…)'s inside and returns where its closing bracket is."""
    out, quote, depth, i, pending = [], None, 0, 0, []  # pending: heredocs whose bodies come next
    while i < len(text):
        c = text[i]
        unquoted = quotes and not quote
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
        elif unquoted and (ansi_c := ANSI_C.match(text, i)):
            out.append(shlex.quote(ansi_c_text(ansi_c.group(1)).translate(TO_STAND_INS)))
            i = ansi_c.end()
            continue
        elif unquoted and text.startswith("<<<", i):
            out.append(f" {HERE_STRING} ")
            i += 3
            continue
        elif unquoted and (heredoc := HEREDOC.match(text, i)):
            pending.append((len(lifted), heredoc.group(1)))
            out.append(f" {HEREDOC_MARK.format(len(lifted))} ")
            lifted.append(Heredoc(None, False))
            i = heredoc.end()
            continue
        elif unquoted and (redirect := _redirect_at(text, i)):
            marker, i = redirect
            out.append(f" {marker} ")
            continue
        elif unquoted and c == "\n" and pending:
            out.append(c)
            i = _read_bodies(text, i + 1, pending, lifted)
            pending = []
            continue
        elif quotes and c == '"':
            quote = None if quote else '"'
        elif unquoted and c == "'":
            quote = "'"
        elif closer and not quote and c in "()":
            depth += 1 if c == "(" else -1
            if depth < 0:
                return i
        elif unquoted and c == "#" and (i == 0 or text[i - 1] in WORD_START):
            line_end = text.find("\n", i)
            i = len(text) if line_end < 0 else line_end
            continue
        out.append(c.translate(TO_STAND_INS) if quote else c)
        i += 1
    if closer:
        raise Unreadable(text)
    return "".join(out)


def _redirect_at(text, i):
    """(its marker, where it ends) for a redirection's operator starting at text[i], with any
    file descriptor before it (2>&1 but not a2>b, which is a2 and >b), else None."""
    if text.startswith("&>", i) and text[i - 1 : i] not in ("&", "|"):  # true &&>f is && >f
        return REDIRECT_OUT, REDIRECT_BOTH.match(text, i).end()
    if not (text[i] in "<>" or (text[i].isdigit() and (i == 0 or text[i - 1] in WORD_START))):
        return None
    found = REDIRECT.match(text, i)
    if not found:
        return None
    feeds_stdin = found.group(2)[0] == "<" and found.group(1) in ("", "0")
    return REDIRECT_IN if feeds_stdin else REDIRECT_OUT, found.end()


def _read_bodies(text, i, pending, lifted):
    """Fills in the Heredoc for each (marker number, delimiter word) on the line before text[i],
    and returns where the text goes on after their bodies. One whose delimiter line never comes
    keeps a body of None, and its lines are read as commands."""
    for n, word in pending:
        quoted = any(q in word for q in "'\"\\")  # its body is then plain text
        found = _delimiter_line(text, i, shlex.split(word)[0])
        if found:
            body, i = text[i : found[0]], found[1]
            lifted[n] = Heredoc(body if quoted else lift_substitutions(body, lifted, quotes=False), quoted)
    return i


def _delimiter_line(text, i, delimiter):
    """(where it starts, where the line after it starts) for the first line from text[i] that
    is the delimiter, give or take blanks round it; None if none is."""
    while True:
        newline = text.find("\n", i)
        end = len(text) if newline < 0 else newline
        if text[i:end].strip() == delimiter:
            return i, end + 1
        if newline < 0:
            return None
        i = newline + 1


def ansi_c_text(body):
    """What the inside of a $'…' says, its escapes filled in, up to any \\0 (bash drops the rest)."""
    return ANSI_C_ESCAPE.sub(_ansi_c_char, body).split("\0")[0].translate(NOT_A_MARK)


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
