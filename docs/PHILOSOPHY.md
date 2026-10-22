# How we build

Below, the PR "line limits" for your domain mean about 400 changed lines of non-test code per
pull request (tests, docs and generated files don't count; pr-reviewer names a split past it), and
`gh stack`, which this repo doesn't have, means large work split by `/grill` step 6 into pull
requests that merge in order (Craig, 22 Oct 2026).

Craig's engineering philosophy, adopted for this repo on 16 Oct 2026, word for word. It was
written for a team; here the team is Craig and Claude, and where it says "triage together" or
"discuss at kick-off", that is a `/grill`. CLAUDE.md and the hooks are the enforced rules; this is
the spirit they serve.

**Contents:** [The Principles](#the-principles) · [Error Handling](#error-handling) ·
[When You Disagree](#when-you-disagree)

---

We're a small team. We move fast, we ship fast, and we don't overthink things to the point of paralysis. But we're not animals either.

## The Principles

### Ship It, But Don't Tank It

YOLO doesn't mean "push to prod and pray." It means:

- Don't spend 3 weeks architecting a feature that could take 2 days
- Perfect is the enemy of deployed
- Some breakage is acceptable — we're a startup, shit happens. Own it, fix it, crack on. No blame, no drama, just ship the fix and move on
- But also, "move fast and break things" is cringe when your users depend on you

### KISS (Keep It Stupid Simple)

- Some things are complex and have multiple moving parts — and that's fine. But if in doubt, write a doc inside the repo to explain the flow and complexity with diagrams. We shouldn't be scared of documentation. We need to be able to understand something later on
- If you need a whiteboard to explain your code, simplify it — or if it genuinely IS that complex, document it so nobody has to figure it out from scratch
- Clever code is bad code. Write code your future self (or your teammate at 2am) can read
- Don't just reach for a library because you can't be bothered writing 2 lines, or because the code isn't structured nicely. Ask yourself: is this library actually solving a problem, or am I just being lazy?

### YAGNI (You Ain't Gonna Need It)

- Don't build for hypothetical future requirements
- Today's over-engineering is tomorrow's legacy code nobody understands
- When in doubt, ship the simple thing and refactor later if you actually need to

### Don't Gold Plate, Don't Scope Creep

- Small tidying up — reformatting a function, leaving the code a bit nicer — go for it, that's just being a good citizen
- But "I'll just fix this" or "I'll refactor this to make it better" is a trap — do that on its own ticket, not your current ticket
- If it's an existing issue and not a P0, put it in the backlog — don't go chasing it during your current work
- If it's something you introduced with new code, fix it — we own our shit
- Triage together, don't solo decide what's important

### Code Is Read More Than It's Written

- Name stuff properly. `d` is not a variable name. `daysUntilExpiration` is.
- Comments should explain _why_, not _what_
- If your function needs a comment to explain what it does, rename the function

### Don't Repeat Yourself (But Also Don't Abstract Too Early)

- Especially if we're making a v2 of something — don't be scared to copy and paste code. Don't go editing v1 to work with v2, they should be separate! Each version stands on its own
- Duplicate code is cheaper than the wrong abstraction
- If you see the same pattern 3 times, then consider abstracting
- Premature abstraction is the root of all evil (or at least all confusing codebases)

### Test the Stuff That Matters

- We're not writing tests for the sake of coverage numbers
- Test the business logic, test the edge cases, test the things that break in production at 3am
- If you can't explain why a test exists, delete it
- If it's core business logic and vital to the product, go ham on tests. This is where we don't mess around
- You can descope features and cut corners (but we fix those corners later)
- You never cut tests. Ever. They are an instant decline on PRs
- If in doubt, Claude can write them — but that's not an excuse to skip them

### Commit Often, Push Early

- Small PRs > big PRs. Always
- Check the PR guidelines for your domain (mobile, backend, etc.) for line limits
- If it's a big chunk of work, use `gh stack` to split it up into smaller PRs — easier to review, easier to understand, and people are actually more likely to smash through it
- WIP branches are fine. Just name them sensibly
- Code reviews are not checkboxes — rubber stamping a PR is worse than no review at all. Actually read it, ask questions, challenge assumptions
- If you don't have time to review properly, say so — don't just approve and move on

### Be Kind to Your Future Self

- Leave the codebase better than you found it
- If you see a quick fix while working on something else, do it (but don't get sucked into a rabbit hole)
- Document the weird stuff. Future you will thank present you.

### Knowledge Is Shared, Not Hoarded

- If you're the only one who knows how something works, fix that — document it, write a runbook, or share it in the right repo
- Don't wait for someone to ask — if you have knowledge, proactively share it. It's a two-way street
- Every repo should be simple to start up — Makefile, Taskfile, whatever. If something changes, fix the README. New engineers should be able to clone and crack on (with some help on env vars if needed)
- Shadow people, jump on a 30 min call, ask questions. There are no stupid questions and it benefits everyone
- We should each be making an effort to learn — go out there and ask, don't sit in silence

### Speak Up

- If you don't know something, ask. If you see something wrong, say something
- There are no stupid questions. Ever. If someone judges you for asking, that's their ego problem — they need to check it at the door
- Pipe up, open your mouth, express your opinion. We can't fix what we don't know about

### Context Switching Kills

- This is a massive problem — don't juggle 5 things and do none of them well
- Feel comfortable saying no or pushing back on scope
- We have each other's backs — share the workload, don't let someone burn out
- We work what we can, and that's enough

### Don't Ship Mystery Boxes

- If something only works on your machine, say so upfront — don't pretend it's fine
- Test in shared environments before you claim it's done
- If you can't reproduce an issue, flag it immediately, don't hide it

### We're One Team

- Be someone you'd want on your team. Be kind, be constructive, and leave the ego at the door
- Don't get defensive over your code. It's not your baby, it's the team's code. If someone suggests a change, hear them out
- If there's a deadline and you're struggling, ask for help. Nobody's going to judge you — we'd rather know early than find out the day before
- We succeed together and we fail together. There is no single blame. If something goes wrong, we fix it as a team and learn from it
- Help each other out. Code review, pair programming, rubber ducking — we're all in this together

### Celebrate Wins

- We're always rushing to the next thing — stop and acknowledge what went well
- Shout people out. Give positives. A little recognition goes a long way
- If someone smashed it, say so

### Blameless Everything

- Not just postmortems — every conversation should be blameless
- Focus on "how do we fix it" not "who broke it"
- We're here to improve, learn, and fix — not to point fingers
- If shit breaks, we fix it together. Full stop.

## Error Handling

- Catch early, handle it, bubble it up. Don't let errors silently propagate through 10 layers of abstraction
- Don't swallow errors silently. If something fails, we need to know.
- User-facing errors should be helpful, not `Error: something went wrong`
- Log enough context to debug, but don't log secrets or PII

## When You Disagree

- If it's a style thing, pick one and move on. Life's too short.
- If it's an architecture thing — flows, system design, that sort of stuff — this should have been discussed at the start of the project/sprint. Don't be afraid to have a kick-off, get together, and work through it as a team before you start building
- If it's a hill you're willing to die on, make your case, then commit to the team's decision even if you disagree

---

_Remember: this isn't a rulebook written in stone. It's a vibe check. If something here feels wrong, speak up and let's evolve it together._
