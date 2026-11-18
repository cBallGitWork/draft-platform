---
name: deepen
description: The architecture pass. Looks across the whole codebase, not one diff, for shallow modules, missing seams and a rule kept in two places, then hands Craig up to six candidates in plain words. Craig picks one, it goes to /grill, and the grill ends in issues. Use only when Craig asks for an architecture pass.
argument-hint: "[an area, by its folder, or nothing for the whole codebase]"
---

# The architecture pass

`/refactor` is tactical: it tidies what is there. This pass is strategic: it asks whether the code
is cut into the right pieces. Agents find the candidates; Craig decides which are worth it, because
that is a judgement about the product's future, not a fact in the code. Adapted from Matt Pocock's
`improve-codebase-architecture` (Oct 2026; MIT, see `.claude/skills/THIRD_PARTY_LICENSES.md`).

**First, read the project's facts:** `.studio/skills.md`, section *Deepen* (where its architecture
map is, and what may never be lifted into a constant), then `CLAUDE.md`. With no app code in the
repo, say so and stop.

## The words

Use these and only these, in the reports and with Craig (John Ousterhout, *A Philosophy of
Software Design*):

- **Module:** a unit of the code with one job.
- **Interface:** everything a caller must know to use it: its functions, what they take and
  return, and the rules for calling them.
- **Implementation:** what it does inside, which a caller never needs to know.
- **Deep / shallow:** a deep module hides a lot behind a small interface; a shallow one's
  interface is nearly as big as what it does. Deep is better.
- **Seam:** where one module meets another. Tests poke a module at its seam.
- **Adapter:** a thing that plugs in at a seam, such as one data feed among several.
- **Locality:** a change, or a bug, sits in one place, not spread across many.
- **Leverage:** how much a module does per thing its caller must learn.

## 1. Explore, split by area

Given an area, explore that alone. Given nothing, read the architecture map, then run one `Explore`
agent per area in one message, "very thorough", each over about 5,000 lines, and one more over the
seams *between* areas. Each gets the words above and the signs below, and returns candidates with
the file and line each rests on.

The signs:
- **Shallow:** an interface nearly as big as what it does; a function that only passes its
  arguments on; a caller that must call three things in the right order.
- **Low locality:** one rule worked out in two places; the last few fixes in one area touched many
  files (`git log --stat -20 -- <area>`).
- **No seam:** logic testable only through the screen or a whole server function; a test double
  replacing the logic it should protect.
- **Leaking:** a caller that knows a module's internals (field names, a feed's raw shape).

## 2. Check before reporting

Read the code each candidate rests on yourself. Drop any that:
- is only similar, not the same rule (the rule of two and three: two copies stay);
- turns something the project's facts keep as data into a constant;
- deepens for a feature not yet in the spec.

## 3. Up to six, in plain words

Rank by what Craig gets for the cost. Each candidate, for someone who doesn't read the code:

```
1. <What is wrong, in one line, no file names.>
   For example: <one concrete case, as a user or the next change would meet it>.
   The fix: <the deeper module, its interface in a sentence>.
   You get: <fewer places to change / a test that can now be written / ...>.
   Size: <about N files, M pull requests>. Changes what users see or saved data: <yes/no>.
```

Then the file and line evidence under each, for the builder. A pass that finds nothing worth it
says so; never pad the list.

## 4. Craig picks, then /grill

Stop and wait for Craig's pick. It goes to `/grill`, which settles the module's interface and ends
in issues. A candidate that changes what users see or saved data is never a refactor: it gets its
own pull requests, each proved by a test that shows nothing a user sees changed.

When Craig is away, the list goes into the session's handover and nothing is built from it.
Candidates he didn't pick are dropped, not filed: the next pass finds them again if they matter.
