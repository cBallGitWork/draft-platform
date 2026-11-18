---
name: handover
description: Write the session's handover for the next one, with the facts gathered first so the numbers in it are real: what merged, what is open, what waits on Craig, what to do next. Use before clearing the chat, before a long gap, or when Craig asks for a handover.
argument-hint: "[topic] [--dry-run]"
disable-model-invocation: true
---

# Write the handover

A handover is how a session's findings survive it. The next session reads it first, so its top has
to carry the load.

**First, read the project's facts:** `.studio/skills.md`, section *Handover*: where handovers live
(the memory folder, or one file in the repo with older ones archived), how the last one is found,
and the project's gate. A project whose handovers need more (a research campaign's attribution and
control rows, say) keeps its own `handover` skill, which wins over this one.

## 1. Gather the facts before writing prose

```bash
git fetch origin && git log --oneline -5 origin/main    # where main is now
git status --short                                       # what is uncommitted, and whose
gh pr list --state open                                  # open pull requests
gh pr list --state merged --limit 10                     # what merged, to find this session's
gh issue list --state open                               # the queue
```

Run the project's gate (`/verify`) if this session changed anything. The previous handover records
the commit `main` was at: that is the range start. With none, say so rather than inventing a range.

A number goes in only with the command that gave it or the date it was true on. A check you did not
run is written "not run", never "passes".

## 2. What makes it work

Fill `${CLAUDE_SKILL_DIR}/template.md`.

- **Lead with the finding that reorders the rest**, not with what you built. If something learned
  late reversed an earlier answer, say so first; never silently edit the earlier part.
- **Craig's answers, in his words**, each with its date and where it was filed. An answer filed
  nowhere is filed now.
- **What waits on Craig** is numbered, each a question in plain words with the options and what it
  holds up. Nothing his standing answers already settle goes on it.
- **Next** names issues and pull requests by full GitHub URL. A "next" isn't a go-ahead.
- **Hazards**: parallel sessions, running servers, scheduled jobs, which local settings file is
  which.
- Say what you deliberately didn't do, and why: an absence read as an oversight gets rebuilt.

## 3. Save it

Where the project's facts say, as `handover-<YYYY-MM-DD>-<topic>.md` unless they say otherwise,
and point the index at it so the next session reads it first. With `--dry-run`, print it and write
nothing.

Stage by named path only, never `git add -A`: another session may share the tree. Before stopping,
commit and push any work on its own branch: a worktree with nothing committed can be removed when
the session ends.
