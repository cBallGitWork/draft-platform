---
name: retro
description: Read back through this session for where the work struggled, and suggest the cheapest change to the surroundings (a hook, a test, a CLAUDE.md line, a skill step, a memory) so the next session doesn't struggle the same way. Suggests only; Craig picks. Run before clearing the chat.
disable-model-invocation: true
---

# Retro: make it impossible next time

An agent doesn't complain. It hits a problem, pushes through, and the struggle stays buried
in the transcript. This reads the transcript for it. Adapted from epl-draft's `/retro`, itself
from Matt Pocock's `retro` (skills v1.3, Oct 2026).

## 1. Find the struggle

Read the session back and list each place where:

- a search took more than two tries to find a file or a fact;
- a hook, a test or a build failed, and why;
- Craig corrected the work: wording, scope, a screen, a rule, an assumption about the product;
- the same command or fix ran three or more times;
- a line in CLAUDE.md, SPEC.md or memory was wrong, stale or missing.

Quote the moment in one line each. A session with nothing on the list says so.

## 2. Pick the cheapest fix that would have stopped it

In this order, because a check holds and a sentence is a hope:

1. **A check**: a hook in `.claude/hooks/`, a test, a lint rule. Anything a machine can spot.
2. **A pointer**: one line in CLAUDE.md saying where a thing lives or what went wrong.
3. **A skill step** a skill was missing.
4. **A memory**: a preference of Craig's that no check can express.

CLAUDE.md says a rule goes in only after Claude gets something wrong; this is where that
happens. Suggest deleting any line a new check makes redundant.

## 3. Suggest, never apply

```
Retro — 2 suggestions

1. [check] What happened, in one line. → the exact change.
2. ...
```

Number them, name the kind, the evidence and the exact change. Stop there. Craig picks which
to keep; apply only those, on their own branch. Don't fix your own findings unasked: an agent
chasing its own findings chases false positives.
