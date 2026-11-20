---
name: grill
description: Interview Craig about the product, a feature, a plan or a problem before any code exists. Maps the decisions, asks the open ones in numbered rounds with a recommended answer each, settles the words, and writes only his answers into the project's spec. Craig starts it.
argument-hint: "[the product, a feature or a plan, in a sentence]"
disable-model-invocation: true
---

# Grill before building

A one-sentence ask leaves gaps, and an agent fills every gap with a silent guess. This skill turns
those guesses into questions Craig answers before the first line is written. Adapted from Matt
Pocock's `grill-me` (skills v1.3, Oct 2026; MIT, see `.claude/skills/THIRD_PARTY_LICENSES.md`).

**First, read the project's facts:** `.studio/skills.md` in the repo, section *Grill* (where the
spec, the glossary, the decisions log and the wants list live, and how its issues are labelled),
then `CLAUDE.md`. Where this skill says "the spec" or "the glossary", it means the files named
there. A project with no `.studio/skills.md` gets the defaults in brackets, and says so once.

**Contents:** 1. Map the decisions · 2. Facts are yours, decisions are Craig's · 3. One numbered
round at a time · 4. One word for one thing · 5. Done is an empty frontier and a yes · 6. Then the
tickets

## 1. Map the decisions

Draw the ask as a tree: the ask at the top, every decision it implies underneath, and the
decisions those imply. A decision belongs here when two reasonable builds would differ on it.

**The frontier** is every decision whose parent is settled. Ask only the frontier.

## 2. Facts are yours, decisions are Craig's

Never ask Craig a fact you can look up: how the real-world game or league works, what `CLAUDE.md`,
the spec or the decisions log already settles. Quote a settled answer; don't re-ask it. Research
notes the project keeps rest on search snippets: check a fact there before a recommendation leans
on it.

Where the project names a model to follow (its *Grill* facts say which), say first how the model
does it, then what this project changes, and recommend the model's way unless the project breaks
it. What other products do is background, never the product: don't put a decision on the tree
because another product has it.

A want on the project's wants list is raw material: it isn't the product until Craig answers it
here. Never offer a rule only the code holds as a recommendation; flag it as a rule nobody chose.

## 3. One numbered round at a time

```
Round 2 — 4 open

1. A question, in one line.
   Recommend: an answer — one clause of why.
2. ...
```

Every question carries your recommendation, so most answers are "yes, yes, no, 3: the other one".
With no grounds to recommend, say so rather than invent one. Past about thirty questions on one
feature, it is two features; say so.

Phrase each question so "yes" means taking the recommendation; a question whose recommendation is
"not now" is asked as "later?", never "this?". Plain words, with a real example where one helps.
At most five questions in one AskUserQuestion.

Some questions don't settle by talking, usually what a screen looks like. Offer two or three
throwaway mock-ups that look nothing alike, and let Craig pick.

## 4. One word for one thing

When Craig uses two words for what might be one thing, or one word for two, stop and ask: "is a
*game* the same as a *match*?" Record the answer in the glossary: the term, one line of meaning,
and the words to avoid.

## 5. Done is an empty frontier and a yes

Write no code while the frontier has a question on it. When it is empty, ask once: "same page?"
Before asking, list every no Craig gave in this grill and the out-of-scope line each becomes, then
every "later" and its later line.

On yes, write or update the spec where the project's facts say [`SPEC.md` at the repo root]:
what it is in Craig's words, the features with their status, later, out of scope, the glossary.
Only Craig's answers go in; a recommendation he didn't take stays out. A real-world fact an answer
rests on (ten teams, best of three) is written as data with the date it was checked, never as the
rule itself. The spec change goes in on its own branch and pull request, like any change; in the
same pull request, delete what this grill settled from the wants list.

When the reviewer checks the spec, give it the grill's questions with his answers, or it can't
tell his words from yours.

## 6. Then the tickets

A feature grilled for building ends in GitHub issues, the build queue:

- **Title** says what is missing or wrong, not what to add.
- **The stories**, numbered, one per settled decision, each pointing at its line in the spec.
- **The seam**: where the tests will poke the feature. Aim for one.
- **Done**: the check that proves it, which a session can rerun.
- **Blocked by**: the data it reads, the screen it sits on, the issue that builds each.
- **Reuses**: the existing code and test fixtures it builds on, and the folder its code goes in.
- **Label**: as the project's *Grill* facts say (a pipeline lane, or none).

A feature bigger than one fresh session, or past the project's pull-request size, is cut into
several issues, each a thin slice that works on its own, with the blocking order named.
