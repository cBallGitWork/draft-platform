---
name: retro
description: Read back through this session for where the work struggled, and suggest the cheapest change to the surroundings (a check, a CLAUDE.md or rules line, a skill step, a memory) so the next session doesn't struggle the same way. Suggests only; Craig picks. Run before clearing the chat.
disable-model-invocation: true
---

# Retro: make it impossible next time

An agent doesn't complain. It hits a problem, pushes through, and the struggle stays buried in the
transcript. This reads the transcript for it. Adapted from Matt Pocock's `retro` (skills v1.3,
Oct 2026; MIT, see `.claude/skills/THIRD_PARTY_LICENSES.md`).

**First, read the project's facts:** `.studio/skills.md`, section *Retro* (where its checks live,
which docs count, anything it adds to the list below), then `CLAUDE.md`.

## 1. Find the struggle

Read the session back and list each place where:

- a search took more than two tries to find a file or a fact;
- a check, a hook or a build failed, and why (a red that was already red before the session
  started is not this session's struggle);
- a step went green and produced nothing, and it took a while to notice;
- Craig corrected the work: wording, scope, a screen, a rule, a fact, an assumption;
- the same command or fix ran three or more times;
- a line in CLAUDE.md, a rules file, a project doc or memory was wrong, stale or missing.

Quote the moment in one line each. A session with nothing on the list says so.

## 2. Pick the cheapest fix that would have stopped it

In this order, because a check holds and a sentence is a hope:

1. **A check**: a test, a lint rule, a script the gate runs, or a hook in `.claude/hooks/` with
   its test. Anything a machine can spot gets one.
2. **A pointer**: one line in CLAUDE.md or a `.claude/rules/` file saying where a thing lives or
   what went wrong. Never a live number in CLAUDE.md.
3. **A skill step** a skill was missing (in the project, or in this plugin, in Forge).
4. **A memory**: a preference or correction of Craig's that no check can express.

A standing answer Craig gave ("just merge those", "you decide that") becomes a check or a rule, so
it is never asked again. Suggest deleting any line a new check makes redundant.

## 3. Suggest, never apply

```
Retro — 2 suggestions

1. [check] What happened, in one line. → the exact change.
2. ...
```

Number them, name the kind, the evidence and the exact change, in plain words. Stop there. Craig
picks which to keep; apply only those, on their own branch. Never fix your own findings unasked:
an agent chasing its own findings chases false positives.
