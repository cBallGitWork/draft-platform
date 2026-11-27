---
name: regression-pack
description: The QA tester's regression pack, one per project, all on one template. Builds the pack the first time, brings it up to date with the spec, or runs its cases and records the result. Every case cites the spec answer it checks; a gap in the spec becomes a question for Craig, and a case the code fails becomes a bug the lead can build. Use when Craig asks for a regression pack, a regression run, or test cases for an area.
argument-hint: "build | refresh | run [area code, P1, or case IDs]"
---

# Regression pack

Forge's QA tester role (Craig, 15 Nov 2026: the QA tester owns regression packs, and Forge is built so
he never defines one per project again). Learned from draft-platform's hand-made pack of 15 Nov 2026:
1,202 cases in six areas, 125 open questions answered into the spec, and bugs filed as
draft-platform#2309 to #2313.

The pack is one CSV in the repository, started from this skill's `template.csv`. The project's
settings are `.studio/regression-pack.json` (example: `settings.example.json` here): where the pack is,
the project's areas, and how spec answers are named. Where questions go is the grill wants list in
`.studio/skills.md`, *Grill*. `node scripts/regression-pack.mjs` checks the pack (add `--summary` for
counts by area); a project turns the pack on by putting that in its gate.

**The spec is the only judge.** Claude writes the code, the tests and this pack, so a case never asserts
what the code happens to do as if it were a rule. A case cites a spec answer, or it is an open question.

## The columns

One row per case. A case checks one thing a person (or a scheduled job) does and what they get.

| Column | What goes in it |
|---|---|
| ID | Area code, dash, three digits: `LG-001`. Kept for good; a new case takes one above the area's highest; never reused. |
| Area | The feature group inside the area, short: `Sign-in`. |
| Feature | What this case checks, under ten words: `Same reply on or off the list`. |
| Where | The screen, route, command or job: `/sign-in`, `python -m sideband.screendiff`, `Daily job`. |
| Role | Who does it: `Manager`, `Commissioner`, `Visitor (not on list)`, `System`. |
| Type | Happy path, Negative, Boundary, Permission, Multi-user, Time, Interruption, Error handling, Data integrity, Accessibility, Open question. |
| Priority | P1: scoring, saved data, money, sign-in, deadlines, anything that can't be undone. P2: the rest a person meets. P3: housekeeping no one sees. |
| Preconditions | The made-up data the case starts from, named: `zed@example.com is not on the allowed list.` |
| Steps | Numbered, one action each, on one line: `1. Ask for a link for zed@example.com. 2. Compare the reply with LG-001's.` |
| Expected result | What is seen, in the screen's exact words in quotes, then what is stored or not: `Same 'Check your email…' reply word for word. No email sent, no user made.` |
| Spec ref | The answer ID (`S14.27`) or spec line (`spec/02-sign-in.md:6`), then the code that does it (`convex/signIn/signInLinks.ts:44`), `;` between. |
| Level | Unit, Integration, E2E or Manual: the cheapest level that can really show it. |
| Automated | `Yes (tests/…; tests/…)`, `Partly (tests/…)` with what is missing in Notes, or `No`. |
| Notes | Anything a tester needs: `Code-only limit (RFC 5321); spec silent on length.` |
| Status | Not run, Pass, Fail (Issue names the bug) or Blocked (Notes says on what). |
| Last run, Run by | The date and who or what ran it: `2026-11-20`, `Claude (regression-pack run)`. |
| Issue | The bug or question this case raised: `#2309`. |

Cover each feature from several types, not just its happy path: what a person can't do (Permission),
the edges (Boundary: at, just under and just over a limit), two people at once (Multi-user), deadlines
and clocks (Time), a reload or a back mid-way (Interruption), and what is saved (Data integrity).

## build: the first pack

1. **Read before writing.** `.studio/regression-pack.json`, the spec (all of it), CLAUDE.md, the
   architecture map, and the screens or commands list. Split the product into four to eight areas of
   roughly equal size and write them into the settings (`areas`), with Craig's names for things.
2. **One subagent per area**, in the foreground, each given the columns above, its area, the spec files
   and code folders it covers, and two worked rows from this file. Each reads the spec answer, then the
   code that does it, then the tests that cover it, and writes its cases: every spec answer in its area
   gets at least one case, and every screen or route at least one happy path. Where the code does
   something the spec doesn't settle, it writes the case as an open question (below), never as a rule.
3. **Join and check.** Put the areas' rows in one pack, by ID. Run `node scripts/regression-pack.mjs
   --summary` and fix every line it prints. Then look for cases two areas both wrote, and for spec
   answer IDs no case cites (`grep` the pack for each ID), and fill the gaps.
4. **Questions and bugs** as below, then one pull request with the pack, the settings and the gate line.

## refresh: keep it true

Run after a run of spec changes, or when Craig asks. For the range since the pack last changed
(`git log -1 --format=%H -- <pack>`): every new or reworded spec answer gets a case or an updated one;
every withdrawn answer's cases are changed to cite what replaced it, or deleted with the reason in the
pull request; cases whose cited files moved point at where they went. Then the check, then one pull
request.

**On every pull request, the builder does the same for what it touched** (the kit's build prompt says
so): a change to what a case covers updates that case; new behaviour adds cases; the check in the gate
fails a pack that has drifted. No extra Claude run per pull request (Craig, 17 Nov 2026).

## run: run the cases

`run` with an area code, `P1`, or case IDs (default: every P1). Automated cases: run the test files the
case names with the project's test command and set Status from the result. Manual and E2E cases with
no test: walk them on the running site with the walk tool (`node scripts/qa-walk.mjs`, as `/qa-panel`
describes) where the project has one, otherwise list them for a person, unrun. Set Last run and Run by
on every case run. A case that fails goes to the bug step. One pull request with the updated pack, its
description giving the counts the check prints.

## Open questions: the spec is silent

The case's Type is `Open question`; its Expected result starts `Spec silent:` and says what the code
does now; Notes says why it matters. Then, five at a time, add them to the project's grill wants list
(`.studio/skills.md`, *Grill*), each with the case ID, the question in plain words with an example, a
recommended answer and one alternative. Say plainly when the recommendation is just "keep what the code
does". Never more than five waiting at once; the rest wait in the pack.

When Craig answers, the answer goes into the spec with a new answer ID (one documentation issue for a
batch, as draft-platform#2313 did), and the case changes to its real Type and cites that ID. An answer
that makes the code wrong becomes a bug, below.

## Bugs: the spec is clear and the code isn't

File it yourself for the lead to build (Craig, 17 Nov 2026), one issue per bug, labelled `bug` and
`rules:clear`. Title: what happens, then what the spec says, `A second-yellow red costs -4, though the
spec says -3 in all`. Body: what the code does with its file and line, the spec answer quoted with its
ID, `Start with a test citing <ID> that fails on main.`, and `Regression pack case <case ID>.` Small
fixes the standing answers already settle (words, a blank page, a tab title) go in one numbered issue
together, each with its case ID, as draft-platform#2312 did. Set the case's Status to `Fail` and Issue
to the number. Never more than five new bug issues in one go; list the rest in the last one.

## Report

Under 15 lines: the counts the check prints, by area; questions added to the wants list; issues filed,
each with its full GitHub URL; the pull request's URL.
