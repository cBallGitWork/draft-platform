"""What each simple command reads on stdin, for commands.py: a heredoc's or here-string's text,
or what the command before a pipe writes where the guard can tell (echo's words, printf's plain
format, cat passing its stdin on); a file (< f) can't be read. Its redirections are taken out of
its words, so bash > log still reads stdin. A pipe into ( … ), { … } or a compound command (if,
while, until, for, select, case), or a redirection after its closing word ({ sh; } <<EOF,
done < f), feeds every command inside it. Stdlib only, Python 3.9+.
"""

from __future__ import annotations

import re
from collections import namedtuple

from parsing import HEREDOC_MARKED, HERE_STRING, MARKED, REDIRECT_IN, REDIRECT_OUT, ansi_c_text
from where import KEYWORDS, SEPARATORS, program_index, program_name

FILLED_IN = re.compile("[$`\x01]")  # a word the shell fills in: $GIT, "$(which git)"
ECHO_FLAGS = re.compile(r"^-[neE]+$")
UNKNOWN = object()  # stdin a program writes, or one the shell fills in: not something to read
STDIN = object()  # in place of a string: the commands a shell reads on its stdin
# the word that opens a group of commands and the one that closes it
CLOSES = {"(": ")", "{": "}", "if": "fi", "while": "done", "until": "done", "for": "done",
          "select": "done", "case": "esac"}
Group = namedtuple("Group", "closer stdin opened")  # opened: (segment, word) where it opens


class UnreadableStdin(Exception):
    """A shell reads commands on stdin, or xargs puts them into a string a shell runs, where the
    guard can't read them: a program's output, a file, or a heredoc or here-string the shell fills
    in."""


def stdins(segs, lifted):
    """segs with each command's redirections taken out, and for each command in turn: what it
    reads on stdin (the text, UNKNOWN, or None if nothing on the line feeds it) and the lifted $(…)
    those redirections run."""
    closing_feeds = _closing_feeds(segs, lifted)
    out, feeds, output, piped, groups = [], [], UNKNOWN, None, []  # groups: each Group still open
    for k, seg in enumerate(segs):
        fed = piped if piped is not None else (groups[-1].stdin if groups else None)
        _open_and_close(seg, k, groups, fed, closing_feeds)
        if groups and groups[-1].opened[0] == k:  # { sh; } <<EOF: sh is fed what its group is
            fed = groups[-1].stdin
        if seg[0] in SEPARATORS:  # (echo x) | sh: what ran inside a ( … ) isn't followed
            piped, output = output if seg == ["|"] else None, UNKNOWN
            out.append(seg)
            continue
        words, stdin, substituted = _redirects(seg, lifted)
        stdin = fed if stdin is None else stdin
        out.append(words or [""])  # a heredoc with no command runs no program, but its $(…) runs
        feeds.append((stdin, substituted))
        output = _output(words, stdin)
    return out, feeds


def _closing_feeds(segs, lifted):
    """Where each group opens, as (segment, word), that a redirection after its closing word feeds
    ({ sh; } <<EOF, done < f, (sh) <<< '…'), and what it feeds it."""
    out, groups = {}, []
    for k, seg in enumerate(segs):
        after = segs[k + 1] if seg == [")"] and k + 1 < len(segs) else seg  # ( … ) <<EOF
        stdin = None if after[0] in SEPARATORS else _redirects(after, lifted)[1]
        for opened in _open_and_close(seg, k, groups, None, {}):
            if stdin is not None:
                out[opened] = stdin
    return out


def _open_and_close(seg, k, groups, fed, closing_feeds):
    """Opens a group for each one segs[k] starts ((, {, if, while …), fed what a redirection after
    its closing word feeds it, or else what the segment is fed, and closes one for each closing word
    (), }, fi, done …), returning where each it closes opened. A close that matches no open (a case
    pattern's ")") is passed over, so the stdin is still handed on."""
    closed = []
    for j, word in enumerate(seg):
        if word in CLOSES:
            fed = closing_feeds.get((k, j), fed)  # a group opened inside it is fed the same: { { sh
            groups.append(Group(CLOSES[word], fed, (k, j)))
        elif groups and word == groups[-1].closer:
            closed.append(groups.pop().opened)
        elif word not in KEYWORDS:
            break
    return closed


def _redirects(seg, lifted):
    """seg without its redirections (heredocs, here-strings, > f, 2>&1, < f), what the last that
    feeds stdin feeds it (a file is UNKNOWN), and the numbers of the $(…) they run."""
    words, stdin, substituted, i = [], None, [], 0
    while i < len(seg):
        word, i = seg[i], i + 1
        heredoc = HEREDOC_MARKED.fullmatch(word)
        if heredoc:
            body, quoted = lifted[int(heredoc.group(1))]
            if body is not None and not quoted:
                substituted += MARKED.findall(body)
            stdin = UNKNOWN if body is None or (not quoted and FILLED_IN.search(body)) else body
        elif word == HERE_STRING:
            value, i = (seg[i], i + 1) if i < len(seg) else ("", i)
            substituted += MARKED.findall(value)
            stdin = UNKNOWN if FILLED_IN.search(value) else value + "\n"
        elif word in (REDIRECT_IN, REDIRECT_OUT):
            target, i = (seg[i], i + 1) if i < len(seg) else ("", i)
            substituted += MARKED.findall(target)  # > "$(git add -A)" runs it
            stdin = UNKNOWN if word == REDIRECT_IN else stdin
        else:
            words.append(word)
    return words, stdin, [int(n) for n in substituted]


def _output(words, stdin):
    """What this simple command writes to a pipe where the guard can tell: echo's words, printf's
    plain format, cat's stdin. UNKNOWN for anything else, or where the shell fills a word in."""
    i, program = program_index(words), program_name(words)
    args = words[i + 1 :]
    if program == "cat" and not args:
        return stdin
    if program == "echo":
        flags = ""
        while args and ECHO_FLAGS.match(args[0]):
            flags += args.pop(0)
        text = " ".join(args) + ("" if "n" in flags else "\n")
        text = text if "E" in flags else ansi_c_text(text)  # zsh's echo fills \n in unasked
    elif program == "printf" and len(args) == 1 and "%" not in args[0]:
        text = ansi_c_text(args[0])
    else:
        return UNKNOWN
    return UNKNOWN if FILLED_IN.search(text) else text
