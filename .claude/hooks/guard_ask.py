#!/usr/bin/env python3
"""PreToolUse guard for questions to Craig (AskUserQuestion, and the next-step box's ask in
mcp__ccd_turn__wrap_up): denies a question one of Craig's standing answers already settles, naming
the answer, so the session acts on it instead of stopping for him. In one hour on 5 Nov 2026 two
sessions asked him 18 questions, 7 of them settled this way (Craig: "we created a dev team but it
still feels like im a solo worker"). Each kind below is one standing answer: a question counts
when its words match the kind's topic and also ask leave ("shall I", "OK to"). A question that
truly is his (a product rule no spec file settles, a look call the picture doesn't settle, a
one-way door once real leagues exist) gets through, since it asks what should happen, not whether
Claude may. An unreadable payload is reported on stderr and the question goes ahead: blocking
would stop every question to Craig. A question counts as asked only once Craig answered it: the
PostToolUse run records each answered question, and the PreToolUse run refuses one recorded within
ASK_ONCE_DAYS. A refused call, or one Craig met with a message instead of answers, records nothing
(9 Nov 2026: such questions were logged at PreToolUse and could never be asked again). Stdlib only,
Python 3.9+.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
import tempfile
import time
from collections import namedtuple
from pathlib import Path

from hook_payload import BadPayload, field, read_payload, report

ASK_TOOL = "AskUserQuestion"
WRAP_UP_TOOL = "mcp__ccd_turn__wrap_up"
WRAP_UP_ASK = "ask"
MOST_PER_BATCH = 5  # questions in one AskUserQuestion: Craig answers one short batch, not a quiz
ASKED_DIR = Path(tempfile.gettempdir()) / "draft-asked"  # each question Craig answered, by its hash, across sessions
ANSWERED_EVENT = "PostToolUse"
ANSWERS = "answers"  # AskUserQuestion's result, {questions, answers}: each question's words with Craig's answer
ASK_ONCE_DAYS = 7  # a question asked within this many days isn't asked again (#1150 was asked four times)

# words that ask Craig's leave rather than his view
LEAVE = re.compile(
    r"\b(shall|should|can|may) i\b|\b(ok|okay|fine|safe|alright|happy)\b[^?]{0,40}\bto\b|"
    r"\bwant me to\b|\bgo ahead\b|\bdo i\b|\bis it ok\b|\bready to\b", re.I)

Kind = namedtuple("Kind", "name topic answer")
KINDS = (
    Kind("a merge", re.compile(r"\bmerg(e|es|ed|ing)\b", re.I),
         "Merge on green yourself, and for a Code Owner pull request send the link with the phone "
         "steps, never a question (Craig, 4 Nov 2026: \"you ask me every merge and stall work\")."),
    Kind("re-scoring or filling in alpha data",
         re.compile(r"\b(re-?pric\w*|re-?scor\w*|backfill\w*|fill(ed|s)? in|re-?run\w* .{0,30}\b(live|dev))\b", re.I),
         "Alpha holds no real league yet, so re-scoring or filling in its data needs no ask "
         "(Craig, 4 Nov 2026); do it and say so in one line."),
    Kind("the phone's layout",
         re.compile(r"\b(phone|mobile|390)\b[^?]{0,60}\b(layout|fit|fits|row|rows|px|line|lines|spacing|wrap|pitch)\b|"
                    r"\b(layout|fit|fits|row|rows|px|spacing|wrap)\b[^?]{0,60}\b(phone|mobile|390)\b", re.I),
         "The phone waits until Craig asks (1 Nov 2026: \"focus on desktop for now, mobile can wait\"); "
         "keep it from breaking, decide the detail yourself."),
    Kind("a small look detail",
         re.compile(r"\b(\d+ ?px|spacing|padding|margins?|gaps?|line[- ]height|font[- ]size|rims?|underlines?|"
                    r"borders?|shades?|subtitles?|tag colou?r)\b", re.I),
         "Once Craig has picked a look, details like these are yours (small calls: just decide); "
         "state the call in one line. A layout the approved picture doesn't settle still goes to /design."),
    Kind("a fix or upkeep",
         re.compile(r"\b(fix|let|make|rerun|re-run|retry|restart|rebase|update|bring|cancel|close|reopen|turn on|switch on)\b", re.I),
         "Fixing what's broken and keeping the pipeline, hooks, CI and services running are Claude's "
         "(Craig, 4 Nov 2026: \"Claude sets up services\"; the fix-all); do it and report the outcome."),
)

Settled = namedtuple("Settled", "question kind")


def questions(tool, tool_input):
    """The question texts a call puts to Craig, each with its header where it has one."""
    if tool == ASK_TOOL:
        texts = []
        for item in field(tool_input, "questions", list, []):
            if isinstance(item, dict):
                texts.append(" ".join(str(item.get(k) or "") for k in ("header", "question")).strip())
        return [t for t in texts if t]
    if tool == WRAP_UP_TOOL:
        ask = tool_input.get(WRAP_UP_ASK)
        return [ask] if isinstance(ask, str) and ask.strip() else []
    return []


def settled(text):
    """The first kind whose standing answer settles this question, or None."""
    if not LEAVE.search(text):
        return None
    for kind in KINDS:
        if kind.topic.search(text):
            return kind
    return None


def normal(text):
    return " ".join(re.sub(r"[^a-z0-9 ]", " ", text.lower()).split())


def ask_texts(tool_input):
    """Each AskUserQuestion question's own words, without its header: what a repeat is judged on."""
    texts = (str(item.get("question") or "").strip() for item in field(tool_input, "questions", list, [])
             if isinstance(item, dict))
    return [t for t in texts if t]


def mark_of(text):
    return ASKED_DIR / hashlib.sha256(normal(text).encode()).hexdigest()[:24]


def asked_before(text):
    """True if Craig answered this question within ASK_ONCE_DAYS. Only reads, so a call's PreToolUse hooks
    running twice (6 Nov 2026) can't make a question a repeat of itself."""
    try:
        return time.time() - mark_of(text).stat().st_mtime < ASK_ONCE_DAYS * 86400
    except OSError:
        return False


def record_answered(payload):
    """On PostToolUse: records each question the result holds an answer for. Nothing else counts as asked."""
    if field(payload, "tool_name", str, "") != ASK_TOOL:
        return
    response = payload.get("tool_response")
    if not isinstance(response, dict):
        return  # Craig met the questions with a message instead of answers: nothing was answered
    answers = response.get(ANSWERS)
    if not isinstance(answers, dict):
        print(f"guard_ask.py: AskUserQuestion's result has no {ANSWERS} dict (keys: {sorted(response)}), "
              "so no question was recorded as asked.", file=sys.stderr)
        return
    answered = {normal(str(q)) for q, a in answers.items() if str(a or "").strip()}
    for text in ask_texts(field(payload, "tool_input", dict, {})):
        if normal(text) in answered:
            try:
                ASKED_DIR.mkdir(exist_ok=True)
                mark_of(text).write_text(text, encoding="utf-8")
            except OSError as error:
                print(f"guard_ask.py: couldn't record an answered question ({error}), so it can be asked again.",
                      file=sys.stderr)


def decide(payload):
    """The deny reason for a call holding settled questions, too many, or a repeat; or None."""
    tool = field(payload, "tool_name", str, "")
    asked = questions(tool, field(payload, "tool_input", dict, {}))
    if tool == ASK_TOOL and len(asked) > MOST_PER_BATCH:
        return (f"That's {len(asked)} questions; Craig answers at most {MOST_PER_BATCH} in one batch. Ask the "
                f"{MOST_PER_BATCH} that block the most work now, and file the rest on their issues for the PM dashboard.")
    found = []
    for text in asked:
        kind = settled(text)
        if kind:
            found.append(Settled(text, kind))
    if not found and tool == ASK_TOOL:
        repeats = [t for t in ask_texts(field(payload, "tool_input", dict, {})) if asked_before(t)]
        if repeats:
            return (f"Already asked in the last {ASK_ONCE_DAYS} days: \"{repeats[0][:120]}\". Read the answer on its "
                    "issue or the PM dashboard (file-answers-before-asking), and ask only what's new.")
    if not found:
        return None
    lines = [f"- \"{s.question[:120]}\" is {s.kind.name}: {s.kind.answer}" for s in found]
    return ("Craig has already answered these, so asking stalls the work:\n" + "\n".join(lines) +
            "\nAct on the answer, drop these questions, and ask him only the rest. If one truly is his "
            "(a product rule no spec file settles, a look call the picture doesn't settle, a one-way door "
            "once real leagues exist), ask what should happen, not whether you may.")


def main():
    try:
        payload = read_payload()
        if field(payload, "hook_event_name", str, "") == ANSWERED_EVENT:
            record_answered(payload)
            return 0
        reason = decide(payload)
    except BadPayload as error:
        return report(error, "the question wasn't checked against Craig's standing answers")
    if reason:
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
