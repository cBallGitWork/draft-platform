---
name: qa-panel
description: Run a panel of QA testers on the project's running site. They are fresh eyes, bug hunter, breaker, completionist and minimalist, each a qa-tester agent with a persona and jobs from .studio/qa-panel.json. Their scorecards are totalled and compared with the last run, and the run is posted on GitHub. Use when Craig asks for a QA panel, a fresh-eyes test, or "can new users figure it out".
argument-hint: "[styles to run, e.g. fresh-eyes breaker; default: every persona in the config]"
---

# QA panel

Forge's QA tester role (Craig, 16 Nov 2026: "Create this persona so we can do regular checks/better
testing"; "the bug hunter, the twat who tries to break things, the completionist, the minimalist").

**Only when Craig asks.** Never schedule it, never run it unasked, and never suggest a rerun until a
good share of the last run's findings, or new screens, have landed; then say so in one line. Craig, 16
Nov 2026: "I like to ask that's fun. Let's get other screens or work done before we ask them again."

## 1. Read the project's panel

`.studio/qa-panel.json` holds the project's settings:
- `start`, `env`, `port`, `startPath`: how to start the site and where a tester lands.
- `data`: what the site runs on, such as made-up preview data where saves don't stick.
- `personas`: each with a `style`, `who` (one line) and `jobs` (plain tasks with a clear end point,
  never a click path).

Run the personas the arguments name, or all of them. Pass a persona's words only: never the panel's
purpose, the spec, or what you hope to find. A tester that knows the goal grades kindly.

## 2. Start the site

Run `start` in the background with `env`, and wait for its port to answer. Make a shots folder in the
scratchpad, one per run.

## 3. Run the testers side by side

Use one `qa-tester` agent per persona, all in one message, in the background. Each brief holds:
- the style and `who`;
- the jobs, numbered;
- the shots folder;
- what the site runs on (`data`), in one line.

Nothing more. Stop the site once every tester is back.

## 4. Total the scorecards

Check the findings before they count:
- **A job's result** is the tester's. Show each job as done, struggled or gave up, with its clicks and ease.
- **A bug** counts only when you can see it in its screenshot or reproduce it with the walk tool. If it
  comes from the made-up data, say so and keep it apart.
- **An info dump or an unclear word** counts when two testers name it, or one names it and its screenshot
  shows it.

Then compare with the last run: the newest issue labelled `qa-panel` in this repository. Name each job
that got better or worse, and each finding fixed or still there.

## 5. Post the run

Post the run as one issue labelled `qa-panel`, titled `QA panel <date>: <n> of <m> jobs done without a
struggle`. It holds the jobs table, the findings, the comparison and what the site ran on.

Each new finding is its own issue: titled by what is wrong, its steps and screenshot evidence in words,
and its lane. Before filing one, search the open issues and add to a match rather than duplicate it. A
finding that changes a screen's layout or needs a rule is the owner's call.

Tell Craig the headline, the jobs table, and each new issue with its full link and what it is.

## Limits, said in every run

The testers are Claude agents, not people. They find what blocks a newcomer, what disagrees and what
breaks, and they over-finish and over-praise despite the rules. Real users still decide (Nielsen Norman
Group: synthetic users are "too shallow" alone; UXAgent, CHI 2025, made them a pilot before human
studies).
