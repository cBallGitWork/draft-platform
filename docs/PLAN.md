# Draft platform: fix plan

Adopted by Craig 2 Nov 2026. Where this plan and `CLAUDE.md` disagree, `CLAUDE.md` still binds until the matching replacement is switched on; each hook is retired only after its GitHub replacement works.

## Contents

- [The principle](#the-principle)
- [Problems and fixes](#problems-and-fixes)
- [Removing the bottleneck](#removing-the-bottleneck)
- [The pipeline](#the-pipeline)
- [The beta: a working product](#the-beta-a-working-product)
- [Speeding up the work](#speeding-up-the-work)
- [Order of work](#order-of-work)
- [Built for hundreds of users](#built-for-hundreds-of-users)
- [Draft room design](#draft-room-design)
- [Hooks to keep and retire](#hooks-to-keep-and-retire)
- [Beta-ready checks](#beta-ready-checks)
- [Craig's setup list](#craigs-setup-list)
- [Decisions for Craig](#decisions-for-craig)
- [Costs to watch](#costs-to-watch)
- [Moving off the Mac](#moving-off-the-mac)
- [Checked against the guide videos](#checked-against-the-guide-videos)
- [What stays with Craig](#what-stays-with-craig)

## The principle

Craig decides what to build and how it should feel; machines check that it was built right. Today Craig is asked to check things a tool could check, and the hooks police process rather than outcomes. That is why there have been 602 merges but only 62 features.

- **Swap gates for signals.** A merge should wait only on things a machine can judge: tests, types, lint, visual diffs and a preview link. Craig's yes moves to a batched daily or weekly review.
- **Decide once, in batches.** Questions for Craig arrive as a list with a recommended default for each, not as one-off stops mid-build.
- **Hide what isn't ready.** Unfinished work ships behind a flag, so it never needs a gate to keep it off screen.

## Problems and fixes

Each problem from the two reviews has one fix, one tool where a tool helps, and one thing Craig stops doing.

| Problem | Fix | Tool | Craig stops |
| --- | --- | --- | --- |
| Live data comes from FPL's and the Premier League's unofficial feeds (`convex/football/football.ts`) | The terms check and a licensed feed's price wait until outsiders are due to join; the beta runs on the feeds as they are (Craig, 2 Nov 2026). The swap is wider than `footballSync.ts`: the live and match-stats readers change too, and players need a mapping from the new feed's ids to FPL's `code` | Sportmonks, API-Football or Opta, priced side by side | Nothing: this decision is his |
| No monitoring: a dead scheduled job or a stuck pick clock goes unseen | Every error reported with its league; every scheduled job in `convex/crons.ts` sends a heartbeat | Sentry, Healthchecks.io | Finding out about breakages from players |
| Process eats the effort: 24 hooks, about 7,700 lines of scripts, 43 chores to 62 features | Retire the gates GitHub can do itself (see Hooks to keep and retire); keep the ones that stop real mistakes | GitHub branch protection, merge queue, CODEOWNERS | Babysitting gates |
| Built screens lag their approved pictures; Home is far behind | Rebuild Home early, then each screen as its picture lands | Argos for side-by-side diffs | Reading the numbered differences table on every screen PR |
| No layout layer: colours and fonts, but no grid, spacing scale or shared components | A full-width page grid, a spacing scale and five components (panel, table, chip, stat strip, empty state), shown together on one reference page | None needed | Approving each screen's spacing separately |
| Placeholder boxes read as broken | Hide unbuilt parts behind flags, including from Continue and Mail; one standard "coming" mark where a gap must show | PostHog feature flags | Judging half-built screens |
| Admin is one email in an environment variable with every power in every league (`adminEmail()` in `convex/signIn/allowedEmails.ts`, about 39 call sites) | An admins table, an audit row for every admin write, and a decision on what admin may read in leagues it isn't in | Role tests in CI | Nothing |
| The draft, waivers and trades have no tables yet | Draft room built for the beta (see Draft room design); waivers and free agency next | Convex scheduler | Nothing: he plays it |
| Craig is the bottleneck: every grill, picture and screen merge waits for him | See the next section | Claude Code GitHub Action, scheduled tasks | Most of the stops |

## Removing the bottleneck

Most of Craig's stops can become a batch he clears in one sitting, or a default that applies unless he objects. Each kind of work goes in one of three lanes.

| Lane | What goes in it | How it runs |
| --- | --- | --- |
| Runs alone | Fixes, refactors, tests, dependency updates, docs, back-end work on rules already in the spec, screens built to an approved picture with no visual difference | Merges itself when CI and the visual diff are green. Craig sees it in a daily digest |
| Default unless vetoed | Grill answers where Claude has a strong recommendation; small look calls; work behind a flag. At most 5 a week, nothing a user sees, each easy to undo and logged in `docs/decisions.md` | Claude writes each question and its default into the weekly decisions doc. Silence for 48 hours lets the default stand |
| Needs Craig | The one-way doors (scoring, the shape of saved data) once the beta holds a real league (until then they merge on green: Craig, 5 Nov 2026, "Yes, until real leagues"), the pipeline's own guards, new screen pictures, the feed, going live, money. Spec'd features, the draft room included, build and merge without him (Craig, 4 Nov 2026: "speeding up") | Batched into one weekly session of about an hour. Enforced by CODEOWNERS on scoring and the schema once a real league exists (until then they merge on green, Craig, 4 Nov 2026; #1123 puts them back), by `lane-auto.yml` withholding its approval from a pull request not opened by Craig's account that touches `.claude/` or `.github/` (Craig, 4 Nov 2026: "for a feature ive helped build, i dont need to review it"), plus fixed-result tests that fail if outcomes change |

What this changes:

- **Grills become async.** A scheduled Claude task reads `docs/to-grill.md` each week and drafts the questions, each with its options and a recommended answer. Craig answers the doc's comments on his phone; the next run turns the answers into spec lines and issues.
- **Screen pictures come in batches.** Claude draws all the remaining screens (Matchup, Table, Scouting, Premier League and so on) in one go, as one canvas. Craig approves the set in one sitting rather than one per day.
- **The approval label only guards the risky lane.** Once screens use the shared components and sit behind flags, a visual difference on an unreleased screen no longer needs his label.

## The pipeline

An issue becomes merged code without Craig unless it lands in the needs-Craig lane. Nothing waits for Craig to start a build or to merge one in the runs-alone lane (Craig, 2 Nov 2026).

How it runs on its own:
1. **Triage.** Every new issue gets a lane label from a rule: an issue whose files fall under `.github/CODEOWNERS`, or that the lane table puts under "Needs Craig", is `lane:craig`; every other issue is `lane:auto`.
2. **Build.** The lead (`lead.yml`, every 30 minutes, 5 Nov 2026) keeps up to 4 builds running all day. It gives a red or flagged builder pull request one fix round, resumes an unfinished build once, then starts the oldest ready issues, and never runs two builds in the same spec file at once. At 01:37 UTC it sweeps the next 10 ready issues for open rules, so Craig answers them in one morning batch and daytime builds don't stop to ask. Craig's `build` label still starts one by hand.
3. **Merge.** A build's pull request has auto-merge turned on by the build's workflow (a step, not the agent) and merges when `verify`, `smoke` and the visual diff are green. The branch need not hold all of `main`: the nightly CI run on `main` catches two pull requests that clash, and a red one opens the `nightly-ci` issue (Craig, 3 and 4 Nov 2026). A pull request that touches a code-owner path cannot merge without Craig's review, so the lane label is not the only guard.
4. **Digest.** What merged, what failed and what waits on Craig goes in one daily message.

Autonomous merging starts only after Code Owners review is switched on in the `main` ruleset and the dry run has passed, so the guard exists before the thing it guards.

The Claude Code GitHub Action does the build, opening pull requests through the Claude GitHub App so CI runs on them. Each run is Opus, with 150 turns, a 75-minute timeout and one concurrency group per issue, and bills to Craig's Claude subscription first (a token from `claude setup-token`), then runs again on an Anthropic API key with a monthly cap only if the subscription build never started (no model answered, or it failed to authenticate) or the token is not set; a build that started and failed goes red rather than being paid for twice, and the 75-minute timeout covers both attempts. A build that runs out of turns or is cut off leaves its work as a draft pull request on a `wip/issue-N-<run>` branch, and the next build of that issue carries on from it (4 Nov 2026, after #989's build used all 60 turns and left nothing). The build takes instructions only from the issue's body and the repo owner's comments, since the repo is public; its actions are pinned to commit SHAs. Merges go to staging first; production is a manual promote, with a backup before every production deploy. Every pull request from this repository gets the one approval the ruleset needs from a GitHub Actions bot (`lane-auto.yml`), with no label needed (Craig, 4 Nov 2026); the bot is not a Code Owner, so outcome paths still wait for Craig; it never approves a pull request not opened by Craig's account that touches `.claude/` or `.github/` (so the build must keep opening its pull requests as the Claude GitHub App, never with Craig's token); and `lane:craig` withholds it (adding `lane:craig` later dismisses the bot's approval). Each pull request gets one fresh-eyes review from `review.yml` (Sonnet, pr-reviewer's brief), posted as a comment that never blocks the merge. A red check goes back to Claude, never to Craig.

A build's first turns are the rules check (it replaced the Analyst, `analyst.yml`, on 4 Nov 2026): it reads the issue, its spec lines and every owner comment on it and its sibling issues, and if a product rule is unsettled it posts one `## Open rules` comment, labels the issue `rules:open` and stops without coding; otherwise it removes `rules:open` and builds. The PM dashboard shows the open rules to Craig. An owner comment on an issue labelled `rules:open` starts the build again, so an answered issue builds itself.

## The beta: a working product

The beta is a complete season loop for real leagues: sign up, draft live, set a lineup, score, and manage the squad week to week. Anything outside that loop waits.

| In the beta | Parked until after |
| --- | --- |
| Sign-in, creating a league, invite links and joining (finishing `joinByInvites`) | Stars and role depth beyond what is built |
| **The draft room**: lobby with date, countdown and who's here; live snake draft, pick clock, queue, auto-pick (spec 04) | Team instructions and saved plans |
| Commissioner draft controls: pause, undo, pick for a team | Captain and set pieces (spec 17) |
| "You're on the clock" emails, on Resend's free tier for the beta (paid before outsiders join) | Player news (spec 21) |
| Squads and lineups, with the preset formations | Salary cap |
| Live scoring, matchups and the league table | The phone design |
| Free agency and waivers (spec 08) | Storybook, PostHog session replay, Chromatic |
| Trades, including traded picks (spec 08) |  |
| A one-page "how this game works" for roles and stars |  |
| Mail basics, admin tools, Premier League fixtures and table |  |

Trades are in the beta (Craig, 2 Nov 2026), though the spec had them after it and two reviewers would cut them: they add one to two weeks. Your league is mid-season with assigned squads, so a re-draft fits a split or a new season, so the running season is not interrupted. See Decisions for Craig.

## Speeding up the work

The aim is to keep several builds moving at once, overnight as well as by day, with each one waiting on less.

- **Parallel builders.** Run 3 to 4 Claude Code builds at once, each on one issue in its own feature folder. The draft back end, the draft screen, the UI components and waivers can move side by side.
- **Overnight builds.** The nightly schedule builds the runs-alone issues with no labelling by hand, so merged work is waiting in the morning (see The pipeline).
- **Keep the full test suite on every PR.** It takes about 25 seconds (`vitest.config.ts`, 31 Oct). Running only affected tests is unsafe here, because the Convex test harness loads every function at once.
- **One review round.** A second `pr-reviewer` round only for outcome-changing work.
- **Shorter spec reads.** Turn the `SPEC.md` status column into short bullets, so each session reads less before it starts.
- **Grills with answers attached.** Claude proposes an answer to each question; Craig replies yes or changes it.
- **A bot league.** Seeded bot managers, so a draft and a whole gameweek can be tested at any hour; mock drafts open to real users too.

## Order of work

About seven weeks to a beta with a live draft and trades, or five without trades. Streams run side by side from week 1.

1. **Week 1: the safety net and the pipeline.** In this order:
  - Branch protection: required checks (a branch need not be up to date with main; the nightly CI run on main catches clashes), CODEOWNERS on outcome paths, auto-merge.
  - Staging and production Convex projects; production promote needs approval; a backup before each deploy.
  - Sentry and heartbeats on every scheduled job.
  - Claude GitHub App and the build workflow, then one dry run on a throwaway issue; then Code Owners review on in the ruleset, then the nightly schedule, triage and auto-merge.
  - Screenshots moved to the Playwright container, with new baselines, then Argos.
  - Hooks retired. Draft grill answered; the draft room's picture drawn.
2. **Weeks 2 and 3: the draft room.**
  - Tables, the pick mutation, the clock, auto-pick, pause and undo (see Draft room design).
  - The lobby, the draft screen on the new grid and components, and pick emails.
  - Home rebuilt to its picture.
  - Nightly bot drafts.
3. **Week 4: waivers and free agency,** with their Mail letters, plus the "how this game works" page.
4. **Weeks 5 and 6: trades,** including traded picks, the review window and the commissioner veto.
  - The remaining beta screens built to their pictures, drawn in batches of up to 5.
5. **Week 7: the beta.**
  - The full loop rehearsed on the bot league until every Beta-ready check passes.
  - Craig's setup run in `docs/setup.md`; his league keeps this season and drafts at its next split or new season.
6. **Before anyone outside your league joins:** the feed's terms checked and a licensed feed chosen if needed, the admins table in place, and Resend on a paid tier.
7. **Before going wide:** per-league splitting of the 4 jobs that read across leagues, and a 500-league seeded test.

## Built for hundreds of users

**Beta scale (Craig, 2 Nov 2026): one or two leagues.** The rows below are the size to grow into, not the beta's. For the beta, defer the paid Resend tier, Convex Pro, the 500-league test and per-league job splitting; keep staging, Sentry, the heartbeats, the feed's terms and a privacy notice before any outsider signs up.

Hundreds of users means roughly 20 to 50 leagues: small for Convex. The risks at that size are email, sign-up, access and environments, not raw scale.

| Area | Today | What breaks | Foundation |
| --- | --- | --- | --- |
| Email | Resend free tier: 100 emails a day; sign-in by emailed link | Sign-ins, pick alerts and trade letters exceed it | Free tier is enough for one or two leagues; paid Resend before outsiders join; sessions that last weeks; league events in one daily email |
| Sign-up | An allowed-email list kept from the command line | Craig adds every user by hand | Finish invite-link joining (`joinByInvites` in `convex/auth.ts`) so commissioners bring their own managers |
| Admin | One email in an environment variable, every power everywhere | Strangers' leagues open to one account | Admins table, audit rows, decided read limits |
| Environments | Per-developer dev deployments and production; no staging; free-plan backups only on schema changes (2 kept, 7 days) | A bad release hits every league mid-gameweek | Staging plus production; Convex Pro for preview deployments and scheduled backups |
| Cross-league jobs | 4 jobs read across every league, capped at 200 (`finalScores.ts`, `teamSeasonStats.ts`, `positionSettings.ts`, `starsRefresh.ts`) | Only past 200 leagues | Split per league after the beta; `finalScores.ts` already has a per-league path |
| Live scoring | One feed read a minute; scores worked out live in queries, so every league updates by itself | Nothing at this size | Leave as it is |
| Drafts | No tables | Many leagues drafting on one evening | The design below; 50 seeded drafts in one test |
| Data feed | Unofficial feeds | Being cut off with outsiders depending on it | Licensed feed before outsiders join |
| Privacy | Not covered | UK GDPR needs a privacy notice, account deletion and analytics consent | Privacy notice, terms, delete-my-account, cookie consent. Worth a short legal check |
| Costs | Free tiers | Bills arrive unannounced | Spending alerts on Convex, Vercel, Resend and Anthropic; a cost estimate at 500 users |

Load is proved with a seeded `convex-test` run of 500 leagues rather than an outside load-testing tool, because the risk is in the scheduled jobs, not web traffic.

## Draft room design

The draft runs on Convex's transactions and scheduler, so a double click or a clock-versus-human race can never make two picks.

- **Tables:**
  - `drafts`: league, status, current pick number, when the clock ends, paused time left, the scheduled auto-pick.
  - `draftPicks`: one row per pick slot, with its original team and current owner. This is also what makes traded picks possible.
  - `draftQueue`: each team's ranked list.
  - A stored default ranking, worked out ahead of time.
- **Making a pick:** the mutation carries the pick number it expects and is rejected if the draft has moved on. It writes the pick and the squad row, moves the draft on, and schedules the next auto-pick for when the clock ends.
- **Auto-pick:** does nothing if its pick number is stale. That check, not cancelling jobs, is the guarantee.
- **Pause and undo:** pause stores the time left and cancels the job; resume reschedules it; undo clears the last pick and steps back.
- **On screen:** one small draft-state query everyone watches, plus a per-team queue query; the timer counts down on the device from the clock's end time.
- **Tests:** fake timers in `convex-test`, including the race between the clock and a human pick.

## Hooks to keep and retire

Keep the hooks that stop real mistakes; retire the gates GitHub or a schedule now does.

| Keep | Retire, and what replaces it |
| --- | --- |
| `guard_bash.py`, cut to no commits on main and no stage-everything | `drift_due.py`, `drift_gate.py`: the weekly drift pass (`drift-pass.yml`), retired 4 Nov 2026 |
| `guard_github.py`, `read_only.py` | `checks_gate.py`, `follow_main.py`: GitHub's up-to-date rule and merge queue; `main_writes.py`: the ruleset refuses pushes to main (4 Nov 2026) |
| `private_words.py`, `line_ceiling.py` | `approval_gate.py`: CODEOWNERS |
| `guard_ask.py`: a question to Craig that one of his standing answers settles (merges, alpha data, the phone, small look details, fixes) is denied with the answer (5 Nov 2026: 7 of 18 questions in an hour were these) |  |
| `guard_mode.py` with `last_prompt.py`: talk is talk; filing, starting or shipping work and editing the spec wait for a message of Craig's that says to (5 Nov 2026: theory-crafting on scoring became a build). `guard_sessions.py`: one session per project, none messages another. `guard_ask.py` also asks a question once a week at most, five to a batch |  |
| The shared helpers and `test.sh` | `gate_on_stop.py`: CI |
| `pr_body.py`, `pull_request.py`, `screen_routes.py`, only if the cloud builds use them | `tidy_after_merge.py`, `tidy_branch.py`: GitHub deletes merged branches |
|  | `setup_current.py`: only applies on the Mac |

The matching lines in `CLAUDE.md` and `docs/REFACTORING.md` go with them.

First wave retired (2 Nov 2026): `checks_gate.py`, `follow_main.py`, `gate_on_stop.py`, `tidy_after_merge.py` and `tidy_branch.py`, once the ruleset, CI and branch auto-delete were on and working.

## Beta-ready checks

The beta starts when all eight pass, not on a date.

- [ ] Sentry and heartbeats green for 7 days on staging, and an alert reaches Craig within 15 minutes.
- [ ] 50 bot drafts in a row, with live and slow clocks, auto-pick, pause and undo, all end with legal squads.
- [ ] A manager's pick email arrives within a minute of his turn.
- [ ] A new invitee goes from the email to a set lineup without help from Craig.
- [ ] Two full gameweeks on the bot league match the fixed scoring totals.
- [ ] Waivers and free agency run one full cycle with the right Mail letters.
- [ ] No beta screen shows a placeholder box; each matches its picture or sits behind a flag.
- [ ] A backup restored once, and league access passing role tests. (The feed's terms are confirmed in writing before outsiders join, not before the beta.)

## Craig's setup list

These need Craig's accounts, so no build can do them:

- [x] An Anthropic API key with a monthly spend cap, for the build workflow.
- [x] Install the Claude GitHub App on `cBallGitWork`.
- [ ] Convex deploy keys for preview and production, added to Vercel and GitHub; decide on Convex Pro.
- [ ] Sentry, Healthchecks.io and Argos accounts, with their keys added as secrets.
- [ ] The release-check secrets in `docs/setup.md`. The paid Resend tier waits until outsiders join (Craig, 2 Nov 2026).
- [ ] Spending alerts on Convex, Vercel, Resend and Anthropic.
- [x] Push access to the repo for this work.

## Decisions for Craig

1. **Re-draft or new league?** Your league is mid-season with assigned squads. Your league keeps this season. It first uses the draft room at its next split or when the next season starts, the natural points for a re-draft. The beta does not wait on it.
2. **Trades in the beta, or straight after?** Kept in by your call; cutting them brings the beta forward about two weeks.
3. **Licensed feed:** which provider, once the terms check is back. Not needed for the beta.
4. **Convex Pro:** needed for preview deployments and scheduled backups.

## Costs to watch

Vercel's bill was $47 in the month to 2 Nov 2026, on the Pro plan. The new site is static and costs next to nothing; the money was the older companion app (`epl-draft`), where `AutoRefresh.tsx` calls `router.refresh()` on a timer on every open page, nearly every page re-renders every 30 seconds, and portraits go through Vercel's image optimizer. Craig is dealing with that in the companion's repo.

## Moving off the Mac

Four parts of today's setup only work on Craig's Mac; each needs moving before the pipeline can run without it. They go into week 1.

| Today, on the Mac | Where it moves |
| --- | --- |
| Each builder runs against its own local Convex deployment (`docs/research/guide-videos.md`) | Builds test against `convex-test` in memory, which the suite already uses. A preview needs a Convex preview deployment per pull request, made by CI with a deploy key |
| Screenshots and `ui-verifier` use the Mac's Chrome (`scripts/shoot.mjs`, `scripts/design/shoot-board.mjs`) | Playwright's own Chromium in its container, with new baselines, since fonts render differently on Linux |
| Recording live matches keeps the Mac awake with `caffeinate` (`scripts/record-match.mjs`) | A Convex scheduled job on match days |
| The decision not to use cloud threads for builds rested on that local Convex setup (`guide-videos.md`, Not taken) | Reversed by this plan. One ticket, one branch, one PR still holds: each cloud build takes one issue |

## Checked against the guide videos

The plan fits what the repo took from the 12 guide videos, with one deliberate change.

- **Kept:** grilling before building, with a recommendation per question (D, F, G, A); a short CLAUDE.md (I, F, A); session-sized tickets (D); a reviewer on a different model (D, F); `/retro` (D, A, J).
- **Kept, narrowed:** "hooks over rules" (F, I, D). Hooks that stop a real mistake stay. The gates retired here police process, not mistakes.
- **Changed:** the "Not taken" entry on cloud threads (K, L), for the reason in the table above.
- **Still open:** the videos' practice of testing a skill against no skill (K) applies to the hooks too. Each hook should earn its place the same way.

## What stays with Craig

About an hour a week of decisions, plus playing the game. These are the calls no tool should make:

- What the game is: new features, scoring rules, the draft's rules.
- How it looks: the approved pictures, in batches.
- Business and risk: the data feed, terms, money and when to go live.
- Anything that touches saved league data or scoring results.
- Playing it and reporting what feels wrong. The beta's best tester is the commissioner.
