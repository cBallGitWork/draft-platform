---
name: deepen
description: The architecture pass. Looks across the whole codebase, not one diff, for shallow modules, missing seams and a rule kept in two places, then hands Craig up to six candidates in plain words. Craig picks one, it goes to /grill, and the grill ends in issues. Use only when Craig asks for an architecture pass.
argument-hint: "[an area, such as convex/scoring, or nothing for the whole codebase]"
---

# The architecture pass

`/refactor` and the drift pass are tactical: they tidy what is there. This pass is strategic: it
asks whether the code is cut into the right pieces. Agents find the candidates; Craig decides which
are worth it, because that is a judgement about the product's future, not a fact in the code.
Adapted from Matt Pocock's `improve-codebase-architecture` (Oct 2026). When it runs is
[docs/REFACTORING.md](../../../docs/REFACTORING.md)'s *The architecture pass*.

## The words

Use these and only these, in the reports and with Craig:
!`sed -n '/^## The words/,/^## /{/^## /d;p;}' docs/REFACTORING.md`

## 1. Explore, split by area

Given an area, explore that alone. Given nothing, run one `Explore` agent per area in one message,
"very thorough", each over a group of folders under `convex/` and `src/` of about 5,000 lines
(`find convex src -name '*.ts*' -not -path '*/_generated/*' | xargs wc -l`), and one more over the
seams *between* areas: where `src/` and `convex/` each work out the same thing, and where one
area reaches into another's internals instead of its interface. Each agent gets the words above,
the signs below, and returns candidates with the file and line each rests on.

The signs:
- **Shallow:** a module whose interface is nearly as big as what it does; a function that only
  passes its arguments on; a caller that must call three things in the right order.
- **Low locality:** one rule (a points value, a deadline, who may pick) worked out in two places,
  so a change to it means finding both; the last few fixes in one area touched many files
  (`git log --stat -20 -- <area>`).
- **No seam:** logic that can only be tested through the screen or a whole Convex function, so its
  tests are slow or missing; a test double replacing the logic it should protect.
- **Leaking:** a caller that knows a module's internals (a table's field names, a feed's raw
  shape, FPL's per-season `id`).

## 2. Check before reporting

Read the code each candidate rests on yourself. Drop any that:
- is only similar, not the same rule (`/refactor`'s rule of 2/3 holds here too);
- lifts code copied from epl-draft into a shared package (copied on purpose, `CLAUDE.md`);
- turns a league's rule into a constant;
- deepens for a feature not yet in `SPEC.md` (YAGNI, `docs/PHILOSOPHY.md`).

## 3. Up to six, in plain words

Rank by what Craig gets for the cost. Each candidate, for someone who doesn't read the code:

```
1. <What is wrong, in one line, no file names.>
   For example: <one concrete case, as a manager or as the next change would meet it>.
   The fix: <the deeper module, its interface in a sentence>.
   You get: <fewer places to change / a test that can now be written / ...>.
   Size: <about N files, M pull requests>. Touches scoring, the draft or saved data: <yes/no>.
```

Then the file and line evidence under each, for the builder, not for Craig. A pass that finds
nothing worth it says so; never pad the list.

## 4. Craig picks, then /grill

Stop and wait for Craig's pick. The pick goes to `/grill`, which settles the module's interface in
rounds (the functions, what each takes and returns, where the seam and its test sit) and ends in
issues, its step 6. A candidate that touches scoring, the draft or saved data stays one of
*What is never a refactor*'s own pull requests, proved by *Proving nothing changed*.

When Craig is away, the list goes into the session's handover or report for him and nothing is
built from it. The candidates he didn't pick are dropped, not filed: the next pass finds them again
if they still matter.
