# Architecture

**Contents:** [Services (Craig's)](#services-craigs) · [Libraries (Claude's)](#libraries-claudes) ·
[Data](#data) · [Where code lives](#where-code-lives) · [With the first code](#with-the-first-code)

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
| Releases | a merge to `main` is a Vercel production build, whose build command (`vercel.json`) is `node scripts/release.mjs`, which runs `npx convex deploy --cmd 'npm run build'`: the server code goes live on the live Convex deployment, then the site is built against it (Craig, 22 Oct 2026). Before deploying, it backs up saved data if the release changes its shape (spec/20, Rolling back): it fingerprints `convex/schema.ts`'s tables and document types (bundled with esbuild, pinned to the version `convex` uses so there is one copy, and read through Convex's own serialised schema), and compares that with the fingerprint the last release left on the live deployment as the `LIVE_SCHEMA_FINGERPRINT` environment variable. A difference, no record yet, or a schema it can't read means `npx convex export` first, which has Convex keep a snapshot on the deployment's Backup & Restore page; if that fails, nothing deploys and the build says why. The same shape deploys with no backup. How to restore: [docs/setup.md](docs/setup.md#restoring-saved-data). Nothing else deploys: `git.deploymentEnabled` turns off every branch but `main`, and `scripts/release.mjs` refuses, before anything else and saying why in the build log, a build whose `VERCEL_ENV` is set and isn't `production`, or one without `CONVEX_DEPLOY_KEY` (Vercel holds it for production only), so a preview, from git or the CLI, can never deploy Convex. vercel.json has no `ignoreCommand`: `[ "$VERCEL_ENV" != production ]` there cancelled every production build after #731, Vercel saying "The deployment was canceled because the Ignored Build Step command is configured to skip this build." (30 Oct 2026, #512) | one step ships site and server together, and reverting the merge undoes both; no preview sites for now (spec/20); the backup is automatic because the free plan allows it: "Periodic backups require a Convex Pro plan", but "On the Free/Starter plan, up to two backups can stored per deployment at a time", each "accessible for up to 7 days" (docs.convex.dev/database/backup-restore, 28 Oct 2026), and Convex keeps it, since a Vercel build's files are thrown away; Convex documents no way to read a deployment's schema back, so the release records its own |
| The after-release check | `.github/workflows/release-check.yml`, on Vercel's `vercel.deployment.success` dispatch for production (which Vercel sends only while the project's `gitProviderOptions.disableRepositoryDispatchEvents` is off: it was on, so no check ran by itself; `npm run setup:live` turns it off, #512), and by hand, where `site` points it elsewhere: `tests/live/signIn.live.spec.ts` (`playwright.live.config.ts`) opens the live site in Playwright's container image, asks for a sign-in link for its own address, reads the email back through Resend's receiving API (`scripts/sign-in-inbox.mjs`), opens the link and sees Sign out; a failure turns the run red. Its two secrets: `RELEASE_CHECK_EMAIL`, an address Resend receives for the account (`<anything>@<id>.resend.app`, so no mailbox or MX record), put on the live site's allowed list; and `RELEASE_CHECK_RESEND_KEY`, a full-access Resend key, the only kind that reads received emails. While either is missing it skips and says so | it signs in exactly as a manager does, so the live site has no test-only way in; each run spends two of Resend's 3,000 a month, the link sent and then received (Resend's pricing page: "each received email counts towards your transactional emails quota", 28 Oct 2026), and one sent of its 100 a day; the address is a secret, since anyone who knew it could spend the day's emails asking for links; past the hour's three links for its address (a run of releases) it skips, saying so, rather than go red, until Craig decides |
| Timed work | Convex scheduled functions and crons | Vercel Hobby cron runs once a day and GitHub Actions cron can't hold a minute, so every timer lives with the data |
| The gate in CI | GitHub Actions on `ubuntu-latest`: `.github/workflows/verify.yml` runs `npm run verify` and then `npm run build`, and after them a `smoke` job runs `npm run smoke`, on every pull request to main and every push to main (Craig, 20 Oct 2026); the verify job checks out full history, so verify's add-only check on recorded payloads and goldens can compare with origin/main (22 Oct 2026), as its tests-kept check does (`scripts/tests-kept.mjs`, #156); the smoke job runs in Playwright's own container image (`mcr.microsoft.com/playwright`), tagged with the Playwright version the verify job reads from `package-lock.json`, so Chromium and its OS packages come baked in: installing them on the runner failed about one run in four when apt couldn't fetch a package (exit 100), and a download once hung until the job's cancel (#281, #372) | two pull requests that pass alone can break main together (#69 and #77); Linux is the cheapest runner, and the hook checks need only bash, Python, git and jq; no secrets, since no test in it touches a deployment: the only secrets in GitHub are the after-release check's (below), and only its workflow reads them |
| Email | Resend | free: 3,000 a month, **100 a day**, which is why a live draft sends no "on the clock" email |
| AI | Anthropic's API, Claude Haiku 5.5, with a $10 monthly spending cap in Anthropic's console (Craig, 29 Oct 2026); first used by player news (spec/21) | the cheapest big lab's price, $0.10 in and $0.50 out per million tokens (Anthropic's model table, as of 6 Oct 2026), from a model able to name the right player from an article; a note is the player's, so the bill follows players, not leagues |
| Money | free plans through the mini beta; Craig sets a monthly ceiling before August 2027 | |

**Before building on Convex:** a short test that its servers can fetch FPL's and the Premier
League's public APIs (until then only ever called from Vercel in London), and that a scheduled
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
`code` as the sheets do (`convex/football/premierLeague/plCommentary.ts`). The 28 event types seen and what each line's men are:
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
| Components | shadcn/ui on Base UI, added with the first component that needs Base UI's behaviour (a dialog, or a true ARIA menu with arrow-key roving focus); a disclosure list like the league switcher (`src/frame/topBar/LeagueSwitcher.tsx`) is hand-built and needs none | the code is copied into the repo, so it is ours to restyle |
| Styling | Tailwind 4 with our own design values | the defaults are the generic AI look Craig wants to get far from |
| Typeface | Archivo Narrow from Fontsource, and Archivo's variable font with its width axis (`@fontsource-variable/archivo`, `wdth.css`) | plate.md's two faces, served with the app: no call to Google from the sign-in page, and screenshots don't wait on a font server. The variable font is one file for the heavy wide titles (weight 800, width 125), where static files would need a width the package doesn't ship |
| Tables | hand-built `<table>`s styled with Tailwind, such as Scouting's players list (`src/scouting/PlayersTable.tsx`), sorted by the server; TanStack Table and TanStack Virtual when a table needs virtualising | a plain table takes Championship Manager density with no library to learn; TanStack's are unstyled, so they would too, and its Table v9 is newer than Claude's knowledge, so read its docs first |
| Tactics pitch | the browser's own drag and drop (`draggable`, in `src/myTeam/tactics/pitch/Pitch.tsx` and `src/myTeam/tactics/SquadTable.tsx`), plus a tap, click or Enter to pick a player up and another to place him, both reaching one `onPlace` | a phone and a keyboard need the tap anyway, so drag is only the desk's shortcut and needs no package; Pragmatic drag and drop if drag ever needs more than the browser gives |
| Motion | considered, not needed yet: Motion when a screen needs animating | the live points change without it |
| Forms | React Hook Form with Zod, when a form needs them | the league-rules forms are large. The scoring editor (#30) didn't: its form is the scoring set itself, edited as data (`src/scoring/editing.ts`) and checked by the server's `validateScoringSet`, which a Zod schema would only repeat |
| Charts | Recharts | what shadcn's charts use |
| Tests | Vitest; `convex-test` with fake timers for the backend, on `@edge-runtime/vm`; Testing Library on jsdom for the app; a test that logs with `console.error` fails unless it calls `silenceConsoleError()`; Vitest's on-disk module cache is off (`fsModuleCache: false`) | the companion's runner; the draft clock can be tested without waiting; `convex-test` needs Convex's runtime mimicked; screens are tested by role and name, as a manager finds them; the cache kept a typed `import.meta.glob`'s file list from before a file was added, and a full `npm test` took about 25s with or without it (31 Oct 2026, #766) |
| Coverage | `@vitest/coverage-v8`, at Vitest's exact version, since it names that one version as its peer, so the two are bumped together; `npm run coverage` prints four totals (statements, branches, functions, lines) counted over every file under `convex/`, `src/` and `scripts/`, where a file no test loads counts as 0%; `npm run coverage -- --coverage.reporter=text` lists each file | read, never gated: no thresholds, and neither `npm run verify` nor CI runs it, because we don't write tests for a coverage number ([docs/PHILOSOPHY.md](docs/PHILOSOPHY.md)); V8 counts natively, so no source is rewritten to count it, and it is Vitest's default (#155) |
| Lint | ESLint with `eslint-plugin-react-hooks`, its two rules only (`rules-of-hooks`, `exhaustive-deps`, both errors), over `src/` and its tests (`eslint.config.js`), parsed by `@typescript-eslint/parser` with no type-aware rules; `npm run lint`, inside `npm run verify`, so CI runs it, and any warning fails it (#154) | a dependency list is written by hand and a missing entry shows stale data with no error, which no test or typecheck catches; this plugin is React's own and ESLint is its only host; no style rule sets, so it adds no churn. `convex/` and its tests import no React, and their harnesses' `use...Deployment()` set up Vitest hooks, so they aren't linted. `rules-of-hooks` sees `useX()` and `React.useX()` but not `seam.useX()` (a lowercase object), so a seam hook after an early return stays a review check |
| Screenshots | Playwright, on the Mac's Chrome (`scripts/shoot.mjs`) | the `ui-verifier` agent's camera, and the same tool as the Playwright MCP |
| Smoke tests | `@playwright/test` (`npm run smoke`, `tests/smoke/`), on the Mac's Chrome locally and Chromium in CI | loads the built app in a real browser on the preview sessions, no deployment needed |
| Going live | the Vercel CLI (`vercel`, a devDependency pinned to one version), driven by `npm run setup:live` (`scripts/live-setup/`, docs/setup.md) with the Convex CLI and one `fetch` per call to Resend's API | Craig signs in to each CLI once and the setup command does the rest, with no token of ours to keep; pinned because the command's flags were read from that version's `--help` |

Each is installed with the first feature that needs it; for now package.json has the app, sign-in,
styling, typeface, test, coverage, lint, screenshot, smoke-test and going-live rows. Tables and the
Tactics pitch are built with no package, and components, motion, forms and charts are the plan.

## Data

- The football layer (FPL and the Premier League's public APIs) is copied from epl-draft's
  `packages/core` when needed, not shared. Clubs, players, fixtures, gameweeks and scores sit
  behind one seam so a paid feed can replace them for other leagues (SPEC, Later): `Football` in
  `convex/football/football.ts`, filled only by FPL's adapter (`readFpl` and `mapFpl` in
  `convex/football/fpl/fpl.ts`, #21) and read only by `convex/football/footballSync.ts`. Nothing
  else goes through it. These read FPL's and the Premier League's own shapes directly, so a paid
  feed would replace them too: the adapters in `convex/football/fpl/` and
  `convex/football/premierLeague/`; in `convex/football/`, `feedIds.ts`, `scoreReads.ts`,
  `commentary.ts`, `feeds.ts`, `matchTeamSheets.ts`, `matchCommentary.ts` and `matchTeamStats.ts`;
  `convex/stats/matchStatsSync.ts`, `convex/stats/liveStatsSync.ts` and `convex/stats/matchRecords.ts`;
  and `convex/positions/positionsSync.ts`.
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
  May, some 110,000 a day (28 Oct 2026, counted by hand from `matchStats.due`). Measure it on
  the Convex usage page before #199 bounds it.
- Live stats (#28): a cron every minute (`liveStatsSync.tick`) reads each match from kickoff
  until it is complete, or four hours on, and its team sheets alone in the hour before kickoff
  (#45); outside those windows it reads no feed and writes no row. A complete match whose
  commentary still lacks its full-time line is read on, whole, for up to `FULL_TIME_LINE_WAIT_MS`
  after full time (the stream's lag allowance, `COMMENTARY_BEHIND_MINUTES`), as "Match ends" can
  reach the stream after the status flips (#917).
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
  The tick's side reads, the team sheets before kickoff and each live match's team stats and
  threshold steps, are each a feed of their own (#522; `convex/admin/sideRuns.ts`): a row a run
  with a match to work on, in `teamSheetsRuns`, `teamStatsRuns` and `thresholdStepsRuns`, so
  one failing is "failing" on the feeds page and emails the admin, and is never only a log line.
  They stay off the tick's row, as they never stop a match's points. The match-stats sync's
  full-time team stats write a `teamStatsRuns` row too. That is two more rows each live tick,
  however many matches it reads, and one a minute in the hour before a kickoff; none grows with
  leagues or teams, and the run logs' prune clears them as it does the tick's.
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
  newest five rows and its newest success. It goes in batches, the live tick's tables first.
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
  size (#316). The scoring set moved out of them to the site's scoring (#354, below): a row saved
  before then still carries one, which is ignored (`heldRules` in
  `convex/rules/leagueRulesShape.ts`).
- The site's scoring (#354-#356): every league plays on one scoring set, which only the admin
  changes. Each version is a row in `siteScoring`, announced as a patch or a fix, and found by
  `takesEffectAt`, so a past gameweek keeps the set it was played under (`convex/scoring/siteVersions.ts`);
  with none, the first set (`convex/scoring/firstScoring.ts`). A gameweek's first kickoff is kept once it passes, in
  `gameweekStarts` (#414), so the version it plays on can't change if that match moves. The
  admin's unannounced patch is the one row in `siteScoringDraft`, and who dismissed a waiting
  patch's banner is a row a person and version in `patchBannerDismissals`, so it stays dismissed on
  every device (`convex/scoring/siteScoring.ts`).
- Lineups (#8): a row in `lineups` for each gameweek a team's lineup was saved from, its first
  lineup's included: that one (`firstLineup: true`) is picked again on each squad change until the
  manager saves (`convex/lineup/lineups.ts`). A league's deadline for a gameweek is kept once it passes, in
  `passedDeadlines` (#150, `convex/gameweeks/deadlineRecorder.ts`), so it stays put if the first
  match is then postponed. The gameweek a manager last opened Tactics in is `tacticsOpenedInGameweek`
  on his team's row, so Continue stops leading him there on every device (#526,
  `convex/lineup/lineupDue.ts`); a new manager of a vacated team starts without it.
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
  Each team's points in a gameweek are worked out on every read until every match in it has
  locked, then stored in `finalScores` (#418, `convex/table/finalScores.ts`) and read from there,
  while the gameweek holds the matches they were scored from. `rescore` drops a gameweek's stored
  scores and stores them again, for when scoring code or a player's positions change after.
- Points overrides (#32): a commissioner's override of one player's points in one locked match is a
  row in `pointsOverrides`, a second replacing the first, and it rescores that gameweek
  (`convex/table/pointsOverrides.ts`).
- Season totals: each player's stats for a season are a row in `playerSeasonStats`, kept in step as
  each match record is written, so Scouting sorts by any stat without reading a season of records
  (`convex/stats/seasonStats.ts`).
- Season points (#525): each player's base points this season, summed at every position, are a row
  in `playerSeasonPoints`, set afresh from his records just after a record write changes what one
  counts or a played match leaves the feed or moves gameweek, so Scouting lists every player's
  without pricing a season of records; it picks his main position and puts the league's overrides
  in on each read (`convex/stats/seasonPoints.ts`). A deployment whose season totals show a played
  match but no row starts the rebuild by itself at the next football sync or record write
  (`convex/stats/seasonPointsQueue.ts`); a match move never stops the sync
  (`convex/stats/seasonPointsMoves.ts`).
- The stat race (#800): each team's season stats, counting only its starters and the bench players
  who came on, are a row in `teamSeasonStats`, the sum of its rows in `teamGameweekStats`, one a
  team and final gameweek, kept so a gameweek reopened takes away what it added. A match's lock
  adds in each league's newly final gameweeks, one a run (`convex/stats/teamSeasonStats.ts`); the
  race reads them through `convex/stats/teamSeasonTotals.ts`.
- The shortlist (#374): each team's own list of players for the season, a row each in
  `shortlistPlayers` by FPL's `code`, read and changed only by its manager
  (`convex/scouting/shortlist.ts`).
- Feedback (#357): each message to the admin is a row in `feedback`, kept for him to read on his
  dashboard (`convex/feedback/feedback.ts`).
- Each person's time zone, as their browser last named it, is a row in `timeZones` by email, so
  what they read tells time in it (#442, `convex/signIn/timeZone.ts`).
- Changing a saved shape (#147): a shape only widens in place, a field added optional, as
  every deployment's rows must still pass the schema on the next push. To narrow or rename one:
  widen it, run a backfill `internalMutation` on each deployment, then narrow it. A pull request
  may do it in one step only while no deployment holds such rows, and its Merge danger says which
  case applies. Never delete rows or turn off schema validation to get a push through.

## Where code lives

The homes the folder pass set (29 Oct 2026), so new code has one place to go:

- `src/shared/`: non-visual code every screen uses: the hooks, refusal handling, the common words.
- `src/ui/`: `docs/design/plate.md`'s controls and panel parts that no feature owns. It imports only
  `src/shared/` and convex's pure modules.
- Code one feature owns but others import stays with its owner: `src/matchup/MatchupLink.tsx`,
  `src/leagues/LeagueLinks.tsx`, `src/mail/DateBlock.tsx`.
- `src/app/`: how the app starts. `src/routes/`: the routes and the router. `src/`'s top level
  keeps only `main.tsx` and `styles.css`. The tokens stay in `styles.css`; a screen's own long
  utilities sit beside it and `styles.css` imports them (`src/myTeam/tactics/pitch/pitch.css`, 31 Oct 2026),
  as it does the controls' shared styles (`src/ui/controls.css`: the action, keys, boxes, the tick well).
- `convex/schema/`: the schema's tables, one file per feature, imported only by `convex/schema.ts`.
  `convex/stars/`: stars, which role suits a player (#11): the rating, its stored rows and their
  refresh, the reads, the role a player dropped into a slot starts on, and each
  deadline's kept copy that picks an auto-sub's role.
  `convex/gameweekScorer/`: the gameweek scorer.
- The feed adapters: `convex/football/fpl/` and `convex/football/premierLeague/`, copies of
  epl-draft's, never shared.
- `convex/table/` keeps its name, because the browser and the scheduler call its functions.
- Sub-folders: past about 12 files, a job with its own files and name gets a sub-folder
  (`src/frame/topBar/`, `src/myTeam/tactics/`, `src/scouting/shortlist/`, and the Tactics pitch's
  drawing in `src/myTeam/tactics/pitch/`, 1 Nov 2026). A folder over 12 that is one job, or whose
  tests mirror its sources, stays flat.

**The rules**, from how the folder pass left the code (29 Oct 2026, counts from `find src convex`):

1. One name per feature, the same in `src/`, `convex/`, `tests/src/` and `tests/convex/`
   (`playerCard`). Folders are camelCase, no hyphens; a component is `PascalCase.tsx`, anything
   else `camelCase.ts`.
2. A feature folder's parts carry fixed names: the screen `<Name>Page.tsx`; `seam.ts`, what the
   screen reads and does, so tests can stand in; `live<Feature>.ts`, the Convex side of the seam;
   `preview.ts`; `words.ts`, everything it says. The server's numbers sit in
   `convex/<feature>/<name>Limits.ts`, which `words.ts` imports, never retypes. A sub-folder uses
   the same names (23 `words.ts`, 20 `seam.ts`, 20 `preview.ts` on 31 Oct 2026, the sub-folders
   `src/myTeam/tactics/` and `src/scouting/shortlist/` among them).
3. The top level holds only entry files: `src/` keeps `main.tsx` and `styles.css`; `convex/` keeps
   `auth.config.ts`, `auth.ts`, `crons.ts`, `http.ts`, `process.d.ts` and `schema.ts`.
4. Imports run one way: a feature, then `src/ui/`, then `src/shared/`, then convex's pure modules.
   A feature imports another only through what that one offers others (its Link component, its
   seam's types), never its insides. No import cycles (`tests/convex/importCycles.test.ts`).
5. Something two features use stays with its owner; at the third, it moves to `shared/` or `ui/`.
6. A file stops at 300 lines and is split along a seam; a folder past about 12 files gets a
   sub-folder (above).
7. A test mirrors its source's path; setup two test files share lives in `tests/support/convex/`
   or `tests/support/src/`, by feature.
8. Moving a Convex file whose functions the browser or the scheduler call keeps a thin re-export at
   the old path (`docs/REFACTORING.md`, "Function paths").

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
