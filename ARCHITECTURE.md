# Architecture

**Contents:** [Services (Craig's)](#services-craigs) · [Libraries (Claude's)](#libraries-claudes) ·
[Data](#data) · [With the first code](#with-the-first-code)

How the product in [SPEC.md](SPEC.md) is built. Settled in the stack `/grill` (16 Oct 2026).

**Who decides:** Craig picks the services, because they cost money and are hard to leave. Claude
picks the libraries inside them, because they are cheap to change. Both are written here with a
reason, and a change to either changes this file.

## Services (Craig's)

| What | Choice | Why |
|---|---|---|
| Language | TypeScript | the football layer is copied from epl-draft's TypeScript `packages/core` |
| Backend | [Convex](https://docs.convex.dev): database, live queries, timers, sign-in | a pick's timer is saved with the pick, so pause and undo cancel it; live scores reach browsers with no extra service; one vendor, hard-capped free plan |
| Pages | Vercel, free (Hobby) plan | the companion's host |
| Timed work | Convex scheduled functions and crons | Vercel Hobby cron runs once a day and GitHub Actions cron can't hold a minute, so every timer lives with the data |
| The gate in CI | GitHub Actions on `ubuntu-latest`: `.github/workflows/verify.yml` runs `npm run verify` and then `npm run build`, and after them a `smoke` job runs `npm run smoke`, on every pull request to main and every push to main (Craig, 20 Oct 2026); the verify job checks out full history, so verify's add-only check on recorded payloads and goldens can compare with origin/main (22 Oct 2026); the smoke job runs in Playwright's own container image (`mcr.microsoft.com/playwright`), tagged with the Playwright version the verify job reads from `package-lock.json`, so Chromium and its OS packages come baked in: installing them on the runner failed about one run in four when apt couldn't fetch a package (exit 100), and a download once hung until the job's cancel (#281, #372) | two pull requests that pass alone can break main together (#69 and #77); Linux is the cheapest runner, and the hook checks need only bash, Python, git and jq; no secrets, since no test touches a deployment |
| Email | Resend | free: 3,000 a month, **100 a day**, which is why a live draft sends no "on the clock" email |
| Money | free plans through the mini beta; Craig sets a monthly ceiling before August 2027 | |

**Before building on Convex:** a short test that its servers can fetch FPL's and the Premier
League's public APIs (only ever called from Vercel in London so far), and that a scheduled
function fires with no browser open. If either fails, the backend choice goes back to Craig;
Supabase was the runner-up.

**Tested, 19 Oct 2026 (#7): both passed.** `convex/football/feeds.ts`, run on the cloud dev deployment
`spotted-mosquito-905`:

- Both feeds answered Convex's servers, with a browser User-Agent: FPL's
  `/api/bootstrap-static/` (668 players) and the Premier League's
  `footballapi.pulselive.com/football/fixtures?comps=1&compSeasons=841` (380 fixtures).
- Squad numbers come from `/teams/{id}/compseasons/841/staff` (Arsenal: 29).
- 841 is 2026/27's id, and 777 2025/26's: they change each summer. From 1 July after the season,
  every read naming one throws until they are updated in `convex/football/football.ts` (#201).
- A check scheduled 10 minutes ahead fired at 11:50:40 BST, 0.6 seconds after it was due, with
  no browser and no `convex dev` running.
- The stats per player per match, for roles: [docs/pl-match-stats.md](docs/pl-match-stats.md).

**The commentary stream (#37): read live on 23 Oct 2026.** spec/10's commentary stands on the
Premier League's `/fixtures/{id}/textstream/EN?pageSize=200&sort=desc`; the team stats on
`/stats/match/{id}`. Neither needs the `Origin` header the premierleague.com site sends (from
the Mac, 20 Oct 2026). Each line's `playerIds` are the team sheets' ids, so they map to FPL's
`code` as the sheets do (`convex/football/plCommentary.ts`). The 28 event types seen and what each line's men are:
[docs/pl-commentary.md](docs/pl-commentary.md). Four finished matches and one before kickoff are
recorded (`tests/support/recorded/commentary.payloads.ts`).

Ipswich 1–1 Nott'm Forest (fixture 128999), recorded every 30 s by `scripts/record-match.mjs`
and checked from Convex every 5 min with `football/feeds:commentaryCheck`. Convex's servers were
answered at every check, and the live poller never failed. The commentary is not append-only
(lines vanish and are reworded), so each read replaces what it shows: the live tick reads each
live match's stream with its points and stores the written lines whole, one row a match, delayed
when a read fails or the stream trails the clock (`COMMENTARY_BEHIND_MINUTES`)
(`convex/football/matchCommentary.ts`, #43). The timings and
counts: [docs/pl-commentary.md](docs/pl-commentary.md) and
[docs/pl-match-stats.md](docs/pl-match-stats.md). Three of its commentary reads and three of
its team stats reads are kept for the tests (`tests/support/recorded/pl-live-match.json`).

**When the free plans stop being enough:**

- Vercel Hobby is for non-commercial use: payments, ads, a donate button or anyone paid to work on
  it means Pro ($20 a month), and arguably so does opening signups to the public.
- Resend's 100 a day: sign-in links, a busy waiver night across several leagues, or a slow
  draft's emails,
  means Resend Pro or another sender.
- Before the mini beta, FPL's and the Premier League's terms are checked (SPEC, *What it is*; #79).

## Libraries (Claude's)

| What | Choice | Why |
|---|---|---|
| App | a Vite single-page React app with TanStack Router | Convex's main path, and the only setup its own sign-in officially supports; typed routes for filter-heavy tables; server rendering buys little where everyone is signed in and every screen is live. TanStack Start uses the same router if that changes |
| Sign-in | Convex Auth (`@convex-dev/auth`) magic links, with Auth.js's Resend provider (`@auth/core`, its required peer); the email is sent with one `fetch` to Resend's API, no Resend package | the backend's own; beta, so read its current docs first. The hourly and daily limits are counted in our own tables (the hour's in `convex/signIn/signInLinks.ts`, the day's in `convex/outbound/emailLimit.ts`), not `@convex-dev/rate-limiter`: a Convex mutation is one transaction, so the count can't race, and it's one component less to install |
| Components | shadcn/ui on Base UI, added with the first component that needs Base UI's behaviour (a dialog, or a true ARIA menu with arrow-key roving focus); a disclosure list like the league switcher (`src/frame/LeagueSwitcher.tsx`) is hand-built and needs none | the code is copied into the repo, so it is ours to restyle |
| Styling | Tailwind 4 with our own design values | the defaults are the generic AI look Craig wants to get far from |
| Typeface | Archivo Narrow from Fontsource | plate.md's one face, served with the app: no call to Google from the sign-in page, and screenshots don't wait on a font server |
| Tables | TanStack Table and TanStack Virtual | unstyled, so they take Championship Manager density; v9 is newer than Claude's knowledge, so read its docs first |
| Tactics pitch | Pragmatic drag and drop, plus tap to swap | maintained; a phone needs taps anyway |
| Motion | Motion | live picks and ticking points |
| Forms | React Hook Form with Zod, when a form needs them | the league-rules forms are large. The scoring editor (#30) didn't: its form is the scoring set itself, edited as data (`src/scoring/editing.ts`) and checked by the server's `validateScoringSet`, which a Zod schema would only repeat |
| Charts | Recharts | what shadcn's charts use |
| Tests | Vitest; `convex-test` with fake timers for the backend, on `@edge-runtime/vm`; Testing Library on jsdom for the app; a test that logs with `console.error` fails unless it calls `silenceConsoleError()` | the companion's runner; the draft clock can be tested without waiting; `convex-test` needs Convex's runtime mimicked; screens are tested by role and name, as a manager finds them |
| Coverage | `@vitest/coverage-v8`, at Vitest's exact version, since it names that one version as its peer, so the two are bumped together; `npm run coverage` prints four totals (statements, branches, functions, lines) counted over every file under `convex/`, `src/` and `scripts/`, where a file no test loads counts as 0%; `npm run coverage -- --coverage.reporter=text` lists each file | read, never gated: no thresholds, and neither `npm run verify` nor CI runs it, because we don't write tests for a coverage number ([docs/PHILOSOPHY.md](docs/PHILOSOPHY.md)); V8 counts natively, so no source is rewritten to count it, and it is Vitest's default (#155) |
| Screenshots | Playwright, on the Mac's Chrome (`scripts/shoot.mjs`) | the `ui-verifier` agent's camera, and the same tool as the Playwright MCP |
| Smoke tests | `@playwright/test` (`npm run smoke`, `tests/smoke/`), on the Mac's Chrome locally and Chromium in CI | loads the built app in a real browser on the preview sessions, no deployment needed |

Each is installed with the first feature that needs it; for now package.json has the app, sign-in,
styling, typeface, test, coverage, screenshot and smoke-test rows, and the rest are the plan.

## Data

- The football layer (FPL and the Premier League's public APIs) is copied from epl-draft's
  `packages/core` when needed, not shared, and kept behind one seam so a paid feed can replace it
  for other leagues (SPEC, Later).
  The seam is `Football` in `convex/football/football.ts`; FPL's adapter is `convex/football/fpl.ts` (#21).
- Players are keyed on FPL's season-stable `code`, never the per-season `id`.
- The two feeds are matched on Opta's ids (`convex/football/feedIds.ts`): a Premier League fixture's
  `altIds.opta` is `g` + FPL's fixture `code`, and a man's is FPL's `opta_code`; one that matches
  nothing is reported, never dropped ([docs/pl-match-stats.md](docs/pl-match-stats.md#matching-the-two-feeds)).
- Clubs, players, fixtures and gameweeks refresh every six hours (`convex/crons.ts`): nothing
  held moves during a match, and what does (a signing, a rescheduled match) is known days ahead.
  Every run, failed or not, is a row in `footballSyncs`.
- Match stats (#27): one record per player per match in `playerMatchStats`, keyed on FPL's
  player and fixture codes, both feeds merged by spec/07's split
  ([docs/pl-match-stats.md](docs/pl-match-stats.md#one-record-per-player-per-match)).
  `convex/stats/matchStatsSync.ts` reads each match the Premier League calls full time; every run,
  failed or not, is a row in `matchStatsSyncs`. A run reads ten matches at most, the least
  lately tried first (`matchStatsTries`), so ones that fail or wait every run hold up no newer
  match. The lock is a scheduled function, so it fires
  with no run due; the window is a row in `platformSettings`.
  A cron runs it every 10 minutes (spec/20): full time counts from the first
  read that finds it, so a match locks up to one interval after its true hour. A run with no
  match due reads no feed; one due reads about 40 Premier League URLs per match (its sheets,
  each named man's stats, and its team stats), and a locked match is read again hourly for a day
  to catch late corrections. Finding the due matches (`matchStats.due`) reads each of the
  season's matches kicked off so far and its status row, every run: about 760 reads a run by
  May, some 110,000 a day. Measure it on the Convex usage page before #199 bounds it.
- Live stats (#28): a cron every minute (`liveStatsSync.tick`) reads each match from kickoff
  until it is complete, or four hours on, and its team sheets alone in the hour before kickoff
  (#45); outside those windows it reads no feed and writes no row.
  A cron, not a function rescheduling itself, because Convex runs a scheduled action at most
  once: a chain would end, unseen, at the first tick that failed before scheduling the next, and
  need re-arming whenever a kickoff moved. Convex runs one tick at a time, skipping one due while
  another runs, and both feeds send running totals, so the next tick catches up any failed or
  skipped. Each tick that found a match live is a row in `liveStatsTicks`, failed or not
  ([docs/pl-match-stats.md](docs/pl-match-stats.md#during-a-match)). Outside matches: one
  action and one indexed query a minute, about 43,000 calls a month. Inside: FPL's ~1.8 MB
  bootstrap and about 40 Premier League reads per match, each tick: its sheets, each named
  man's stats, its commentary with the sheets again, and its five team stats (#45) in one read,
  kept as one row a match in `matchTeamStats` (`convex/football/matchTeamStats.ts`). In the hour
  before a kickoff: FPL's bootstrap (once a tick, shared with any live match), the gameweek's
  list and one read per match, its sheets, kept as one row a match in `matchTeamSheets`
  (`convex/football/matchTeamSheets.ts`); no tick row, as nothing is scored yet. The Premier
  League had them out 58 minutes before kickoff (docs/pl-commentary.md).
  Revisit the bootstrap read each tick when Convex usage nears the plan's limit, or when
  `liveStatsTicks` rows fail from throttling.
- Match scores (#49): each match's state, score and clock in `matchScores`, apart from
  `fixtures`, because two feeds write it: the football sync from FPL's fixtures, and the live tick
  (and the match-stats sync) from the Premier League's list it already reads, so it costs no extra
  read. The newest read wins, but a feed never moves a match back a state the other moved it on to
  (`convex/football/matchScores.ts`). A read that gives no score for a match (none sent once it has
  kicked off, or a status never seen) is a problem on that run's row, and the held score stands.
  `football/matchScores:ofGameweek` reads a gameweek's matches with their scores.
- The run logs (#146): `admin/runLogs:prune` deletes a run row 30 days after its run if it
  succeeded, and 180 days after if it failed (Craig, 22 Oct 2026). It always keeps each feed's
  newest five rows and its newest success. It goes in batches, `liveStatsTicks` first.
  A cron runs it daily (spec/20). A match-stats run with no match due is still a row: the feeds
  page needs it as a success to judge lateness, and pruning keeps a 10-minute cron's runs to
  about 4,300.
- The feeds page (#35): `admin/feeds:feeds` reads each run table back and calls a feed late
  when it has gone longer than its schedule allows without a success. Each feed's interval is in
  `convex/shared/feedSchedule.ts`, which `crons.ts` runs from; a feed no cron runs is "not
  scheduled", never late. The screen passes the time, a new minute each minute, since a query
  mustn't read the clock.
- Positions (#22): each player's in `playerPositions`, keyed on FPL's `code`, apart from
  `players` so no feed read touches the admin's say; `positionsSync` files each match's starts
  once (`positionSheets`) and is run by hand for now, each run a row in `positionsSyncs`
  ([docs/positions.md](docs/positions.md)).
- League rules are rows, never constants; FPL's own rules can be constants. Each league's are rows
  in `leagueRules`, one from each gameweek they changed in, copied at creation from
  `defaultLeagueRules` (#25), the squad maximum read instead from `squadMaximums` by the league's
  size (#316).
- Leagues (#24): `leagues`, `teams` and `leagueEvents`, people known by their email, so one can be
  named before they have an account; joining's rows are `invites`, `inviteLinks` and
  `joinRequests` (#73).
- Mail (#26): a letter is a row in `letters` for each person it's to, filed when it's sent, so
  someone who joins later doesn't get old ones.
- A deleted league is gone for good 24 hours on: `deleteForGood`, a scheduled function, removes
  it and every row keyed to it, in batches, archiving nothing (#75).
- Each ask for a sign-in link that was answered "check your email" is a row in `signInAsks`, a
  failed send kept with its error, and each day's emails are counted in `emailSends` against
  Resend's 100 (#20).
- When the admin was last emailed that a feed failed is a row in `feedFailureEmails`, one per
  feed, so he hears at most once a day for each (#319).
- The league each person used last is a row in `lastLeagues`, by email, not in the browser, so
  the app opens it on any device they sign in on (#76).
- Squads (#122): a `squadPlayers` row (league, team, FPL `code`) for each player on a team, one
  team per player per league (index `by_leagueId_and_playerCode`). Assigning, moving and
  releasing a player are filed as `leagueEvents` for Mail.
- Fixtures and the table (#129, #131, #137): a gameweek's fixtures are stored in
  `playedFixtures` once it begins, at the league's own deadline, and read from there ever after;
  the gameweeks still to come are drawn on every read, seeded by the league's id. The football
  sync's deadline recorder stores them, and a new team is never made without them stored first.

## With the first code

Craig's picks from the guide videos (16 Oct 2026; [docs/research/guide-videos.md](docs/research/guide-videos.md)),
meant to land with the first code; the ones still open are tracked in issues, linked below:

- [x] **Stop gate**: a session can't finish while the tests fail. `.claude/hooks/gate_on_stop.py`
      runs on Stop and SubagentStop; while the watched paths have uncommitted changes it runs
      `npm run verify`, and on a failure blocks the stop once. A `/verify` skill runs the local
      gate and reports the count (epl-draft's; [what it runs](.claude/skills/verify/SKILL.md)).
- [x] **Line ceiling**: a note when a file passes 250 and 300 lines (epl-draft's
      `.claude/hooks/line_ceiling.sh`, landed as `line_ceiling.py`).
- [x] **UI rules by path**: `docs/design/plate.md`'s "Never" list in `.claude/rules/` so it loads
      only when screen files are touched, and a UI verifier agent that shoots a screen at 390 and
      1440 and looks (epl-draft's `ui-verifier`). Landed as `.claude/rules/ui.md` and
      `.claude/agents/ui-verifier.md` (#19).
- [x] **MCPs**: Convex and Playwright, with the Convex test above.
- [ ] **The reviewer in CI** (#162): a workflow that runs when a pull request opens, is marked
      ready or reopens, or when someone with a seat on the repo writes "@claude" on one. It runs
      `pr-reviewer` as it stands on the base branch, read-only, and posts one comment; it never
      blocks or merges. Its permissions: read the code, write pull request and issue comments,
      and an id token for the app. It needs the Claude GitHub app and a `CLAUDE_CODE_OAUTH_TOKEN`
      secret from Craig (`claude setup-token`). The gate alone already runs there (Services, above).
      Lessons to build it to:
      - It never runs only on a mention: a reviewer that waited for one was skipped on every run.
      - It skips draft pull requests and comments from bots.
      - One review per pull request at a time (concurrency group `review-<PR>`, no cancelling).
      - The action restores `.claude/` from the base branch, so the pull request that adds the
        reviewer reads its agent from `.claude-pr/agents/pr-reviewer.md`.
      - Its comment never contains "@claude".
      - Its read-only tools are listed one by one, and on a failure it prints the commands it was
        refused.
      - With no `CLAUDE_CODE_OAUTH_TOKEN` it posts a notice and passes rather than fails.
- [x] **`env.example`** from the services above.
- [x] **One-command start**: clone, fill the env, run one command; docs/setup.md says how
      (`docs/PHILOSOPHY.md`, *Knowledge Is Shared*).
- [ ] **Bug hunts as we go** (#165): a hunt scoped to each feature as it lands, and a full one
      (split by area, a skeptic per finding, a token budget) at the mini beta.
- [ ] **One design skill tested** (#163): Impeccable or the Taste skill run once against R3·1,
      kept only if it beats what we have.
- [ ] After a few build sessions: `/fewer-permission-prompts` to pre-approve safe commands (#164).
