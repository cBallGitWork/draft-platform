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
| Releases | a merge to `main` is a Vercel production build, whose build command (`vercel.json`) is `node scripts/release.mjs`, which runs `npx convex deploy --cmd 'npm run build'`: the server code goes live on the live Convex deployment, then the site is built against it (Craig, 22 Oct 2026). Before deploying, it backs up saved data if the release changes its shape (spec/20, Rolling back): it fingerprints `convex/schema.ts`'s tables and document types (bundled with esbuild, pinned to the version `convex` uses so there is one copy, and read through Convex's own serialised schema), and compares that with the fingerprint the last release left on the live deployment as the `LIVE_SCHEMA_FINGERPRINT` environment variable. A difference, no record yet, or a schema it can't read means `npx convex export` first, which has Convex keep a snapshot on the deployment's Backup & Restore page; if that fails, nothing deploys and the build says why. The same shape deploys with no backup. How to restore: [docs/setup.md](docs/setup.md#restoring-saved-data). Nothing else deploys: `git.deploymentEnabled` turns off every branch but `main`, and `scripts/release.mjs` refuses, before anything else and saying why in the build log, a build whose `VERCEL_ENV` is set and isn't `production`, or one without `CONVEX_DEPLOY_KEY` (Vercel holds it for production only), so a preview, from git or the CLI, can never deploy Convex. vercel.json has no `ignoreCommand` (#512) | one step ships site and server together, and reverting the merge undoes both; no preview sites for now (spec/20); the backup is automatic because the free plan allows it: "Periodic backups require a Convex Pro plan", but "On the Free/Starter plan, up to two backups can stored per deployment at a time", each "accessible for up to 7 days" (docs.convex.dev/database/backup-restore, 28 Oct 2026), and Convex keeps it, since a Vercel build's files are thrown away; Convex documents no way to read a deployment's schema back, so the release records its own |
| The after-release check | `.github/workflows/release-check.yml`, on Vercel's `vercel.deployment.success` dispatch for production (sent only while the project's `gitProviderOptions.disableRepositoryDispatchEvents` is off, which `npm run setup:live` sees to, #512), and by hand, where `site` points it elsewhere: `tests/live/signIn.live.spec.ts` (`playwright.live.config.ts`) opens the live site in Playwright's container image, asks for a sign-in link for its own address, reads the email back through Resend's receiving API (`scripts/sign-in-inbox.mjs`), opens the link and sees Sign out; a failure turns the run red. Its two secrets: `RELEASE_CHECK_EMAIL`, an address Resend receives for the account (`<anything>@<id>.resend.app`, so no mailbox or MX record), put on the live site's allowed list; and `RELEASE_CHECK_RESEND_KEY`, a full-access Resend key, the only kind that reads received emails. While either is missing it skips and says so | it signs in exactly as a manager does, so the live site has no test-only way in; each run spends two of Resend's 3,000 a month, the link sent and then received (Resend's pricing page: "each received email counts towards your transactional emails quota", 28 Oct 2026), and one sent of its 100 a day; the address is a secret, since anyone who knew it could spend the day's emails asking for links; a release within 60 minutes of the last sign-in run (`SIGN_IN_GAP_MINUTES`) skips, saying so, and a run by hand always signs in; otherwise the hour's sign-in link limit turns it red, like any failure (spec/20, Every release; #908) |
| Timed work | Convex scheduled functions and crons | Vercel Hobby cron runs once a day and GitHub Actions cron can't hold a minute, so every timer lives with the data |
| The gate in CI | GitHub Actions on `ubuntu-latest`: `.github/workflows/verify.yml` runs the steps of `npm run verify` and `npm run build` in one `verify` job with one `npm ci` (types and lint first), beside `npm run smoke` (Craig, 4 Nov 2026), on every pull request to main (Craig, 20 Oct 2026), and on main once a night (03:30 UTC) and by hand from the Actions tab, not on every merge (Craig, 4 Nov 2026); a failed nightly run turns main's last commit red and opens or comments on the `nightly-ci` issue; a pull request that changes only docs, spec, `.claude/`, markdown or the agents' prompt workflows skips the unit tests, build and smoke, but still runs the tests that read a doc (`npm run test:docs`, #1556), and the jobs `verify` and `smoke` are the results the ruleset requires (Craig, 3 Nov 2026), with `look-approved` (`.github/workflows/look-gate.yml`), the approved-picture check, the third (Craig, 5 Nov 2026), which lists layout differences for the UI reskin and holds no merge (Craig, 7 Nov 2026); the verify job checks out full history, so verify's add-only check on recorded payloads and goldens can compare with origin/main, as its tests-kept check does (`scripts/tests-kept.mjs`, #156); the smoke job runs in Playwright's own container image (`mcr.microsoft.com/playwright`), tagged with the Playwright version the changes job reads from `package-lock.json`, so Chromium and its OS packages come baked in (#281, #372) | two pull requests that pass alone can break main together (#69 and #77), which the nightly run catches once a branch need not hold all of main; Linux is the cheapest runner, and the hook checks need only bash, Python, git and jq; no secrets, since no test in it touches a deployment: the secrets in GitHub are the after-release check's (below), read only by its workflow, and `CLAUDE_CODE_OAUTH_TOKEN`, Craig's Claude subscription, read only by `.github/workflows/claude-build.yml`, which builds an issue when Craig puts the `build` label on it and opens a pull request (docs/PLAN.md, "The pipeline"; Craig, 2 Nov 2026), and by `review.yml`; no workflow reads the metered `ANTHROPIC_API_KEY` since 11 Nov 2026, which `verify` enforces |
| Error reports | Sentry, from the browser only (`@sentry/react`, `src/app/errorReports.tsx`): on only when the build has `VITE_SENTRY_DSN`, errors only, no tracing or replays, every report scrubbed of the signed-in user, email addresses and sign-in codes before it leaves | docs/PLAN.md, "No monitoring": a breakage would otherwise reach us from players; the beta's managers are friends, so nothing personal goes to a third party |
| Job heartbeats | Healthchecks.io (`convex/heartbeats/heartbeat.ts`): each of spec/20's timed jobs in `convex/crons.ts` pings its check when it finishes, `/fail` when it throws, once `HEALTHCHECKS_PING_URL` is set; a feed's failed read is caught inside the job and goes on its run row and the admin's failure email, so it still pings as finished. Craig makes each job's check in Healthchecks, `waiver-runs` and `trade-offers` included (#1346). The lead (`lead.yml`) pings `lead-pass` every pass and `main-merged` when something merged in the last day, from the `HEALTHCHECKS_PING_URL` GitHub secret. GitHub's schedule drops the lead's passes, so a Convex cron on the development deployment (`convex/heartbeats/leadWake.ts`) also runs it every half hour, once `LEAD_WAKE_GITHUB_TOKEN` is set there (Craig, 7 Nov 2026: a Convex cron over cron-job.org; 8 Nov 2026, after the CTO review: on dev, so the live site holds no GitHub token and the pipeline's wake-up never shows as a product error). The wake-up is the one cron with no check of its own: a dead one (a token never set, expired or refused) shows as the lead's missing `lead-pass` pings, which Healthchecks emails Craig about after 3 hours | docs/PLAN.md, "No monitoring": a dead scheduled job would otherwise go unseen; on 5 Nov 2026 the lead never ran on GitHub's schedule and nobody knew for hours |
| The pipeline's account | CBHelper180, a GitHub account with write on this repo only, whose classic token (`repo`, `workflow`) is the `BUILD_TOKEN` secret: a build run from a branch, and an unfinished build's draft, push and open their pull requests as it | a push with the job's own token runs no CI, and lane-auto (approving as the github-actions bot) can't approve that bot's own pull request; the Claude app's token is refused for a workflow that differs from main's (5 Nov 2026) |
| Football data | Sportmonks, in place of FPL's and the Premier League's public APIs, on its Starter plan's five leagues (England, Scotland, Italy, Spain, Germany) once paid (SPEC, *What it is*). For now the free plan's Scottish Premiership only, read into its own tables only where `SPORTMONKS_API_TOKEN` is set, which the live deployment isn't (#1391; Data, below); FPL and the Premier League still feed the site | "stop with fpl and prem, thats not scalable" (Craig, 9 Nov 2026, on #1196): one feed for every league the product will run |
| Email | Resend | free: 3,000 a month, **100 a day**, which is why a live draft sends no "on the clock" email |
| AI | Anthropic's API, Claude Haiku 5.5, with a $10 monthly spending cap in Anthropic's console (Craig, 29 Oct 2026); called with one `fetch` to the Messages API and no SDK (`convex/outbound/claude.ts`), its key the deployment's `ANTHROPIC_API_KEY`; used by a scout's report (spec/19, `convex/scouting/scoutReports.ts`) and League home's weekly recap (#387, `convex/home/recaps.ts`) | the cheapest big lab's price, $0.10 in and $0.50 out per million tokens (Anthropic's model table, as of 6 Oct 2026), from a model able to name the right player from an article; a note is the player's, so the bill follows players, not leagues |
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
- 841 is 2026/27's id, and 777 2025/26's: they change each summer, so each run picks them from
  the Premier League's list of seasons, following FPL's season (#300). A season the list lacks
  fails the read with a red line on the Feeds tab naming the season looked for.
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
- Sportmonks, a paid feed, replaces FPL's and the Premier League's (SPEC, *What it is*; Craig, 9 Nov 2026).

## Libraries (Claude's)

| What | Choice | Why |
|---|---|---|
| App | a Vite single-page React app with TanStack Router | Convex's main path, and the only setup its own sign-in officially supports; typed routes for filter-heavy tables; server rendering buys little where everyone is signed in and every screen is live. TanStack Start uses the same router if that changes |
| Sign-in | Convex Auth (`@convex-dev/auth`) magic links, with Auth.js's Resend provider (`@auth/core`, its required peer); the email is sent with one `fetch` to Resend's API, no Resend package | the backend's own; beta, so read its current docs first. The hourly and daily limits are counted in our own tables (the hour's in `convex/signIn/signInLinks.ts`, the day's in `convex/outbound/emailLimit.ts`), not `@convex-dev/rate-limiter`: a Convex mutation is one transaction, so the count can't race, and it's one component less to install |
| Components | shadcn/ui on Base UI, added with the first component that needs Base UI's behaviour (a dialog, or a true ARIA menu with arrow-key roving focus); a disclosure list like the league switcher (`src/frame/topBar/LeagueSwitcher.tsx`) is hand-built and needs none | the code is copied into the repo, so it is ours to restyle |
| Styling | Tailwind 4 with our own design values | the defaults are the generic AI look Craig wants to get far from |
| Typeface | Archivo Narrow from Fontsource, and Archivo's variable font with its width axis (`@fontsource-variable/archivo`, `wdth.css`) | plate.md's two faces, served with the app: no call to Google from the sign-in page, and screenshots don't wait on a font server. The variable font is one file for the heavy wide titles (weight 800, width 125), where static files would need a width the package doesn't ship |
| Tables | hand-built `<table>`s styled with Tailwind, such as Scouting's players list (`src/scouting/PlayersTable.tsx`), sorted by the server; TanStack Table and TanStack Virtual when a table needs virtualising | a plain table takes Championship Manager density with no library to learn; TanStack's are unstyled, so they would too, and its Table v9 is newer than Claude's knowledge, so read its docs first |
| Tactics pitch | the browser's own drag and drop (`draggable`, in `src/myTeam/tactics/pitch/Pitch.tsx` and `src/myTeam/tactics/SelectionTable.tsx`), plus a tap, click or Enter to pick a player up and another to place him, both reaching one `onDrop` | a phone and a keyboard need the tap anyway, so drag is only the desk's shortcut and needs no package; Pragmatic drag and drop if drag ever needs more than the browser gives |
| Motion | considered, not needed yet: Motion when a screen needs animating | the live points change without it |
| Forms | React Hook Form with Zod, when a form needs them | the league-rules forms are large. The scoring editor (#30) didn't: its form is the scoring set itself, edited as data (`src/scoring/editing.ts`) and checked by the server's `validateScoringSet`, which a Zod schema would only repeat |
| Charts | Recharts | what shadcn's charts use |
| Tests | Vitest; `convex-test` with fake timers for the backend, on `@edge-runtime/vm`; Testing Library on jsdom for the app; a test that logs with `console.error` fails unless it calls `silenceConsoleError()`; Vitest's on-disk module cache is off (`fsModuleCache: false`) | the companion's runner; the draft clock can be tested without waiting; `convex-test` needs Convex's runtime mimicked; screens are tested by role and name, as a manager finds them; the cache kept a typed `import.meta.glob`'s file list from before a file was added, and a full `npm test` took about 25s with or without it (31 Oct 2026, #766) |
| Coverage | `@vitest/coverage-v8`, at Vitest's exact version, since it names that one version as its peer, so the two are bumped together; `npm run coverage` prints four totals (statements, branches, functions, lines) counted over every file under `convex/`, `src/` and `scripts/`, where a file no test loads counts as 0%; `npm run coverage -- --coverage.reporter=text` lists each file | read, never gated: no thresholds, and neither `npm run verify` nor CI runs it, because we don't write tests for a coverage number ([docs/PHILOSOPHY.md](docs/PHILOSOPHY.md)); V8 counts natively, so no source is rewritten to count it, and it is Vitest's default (#155) |
| Lint | ESLint with `eslint-plugin-react-hooks`, its two rules (`rules-of-hooks`, `exhaustive-deps`, both errors), over `src/` and its tests (`eslint.config.js`), and ESLint's own `no-restricted-syntax` failing a string in `src/` with an arbitrary Tailwind colour or px value (`[#`, `-[Npx]`) and, in `src/` and `convex/`, a rule written out by hand where a named helper holds it (one entry per helper, its message naming the helper and its file; #1806), parsed by `@typescript-eslint/parser` with no type-aware rules; knip (`knip.json`, run by `scripts/unused-exports.mjs`) over the app, `convex/` and `scripts/`, for exports nothing reads, against a baseline that only shrinks (`scripts/unused-exports.baseline.txt`), run by hand until one tested pipeline change adds it to `npm run verify` and CI's `verify.yml` together (#1811); `scripts/named-literals.mjs`, run by `npm run lint` after ESLint, failing a string in `convex/` or `src/` that retypes a stat key, locale or id prefix another file exports as a named constant (#1808); `npm run lint`, inside `npm run verify`, so CI runs it, and any warning fails it (#154) | a dependency list is written by hand and a missing entry shows stale data with no error, which no test or typecheck catches; this plugin is React's own and ESLint is its only host; no style rule sets, so it adds no churn; the arbitrary-value rule keeps every design value a token in `src/styles.css`, plate.md's one source. `convex/` gets the helper entries but not the hook rules: it imports no React. Its tests aren't linted, as their harnesses' `use...Deployment()` set up Vitest hooks. `rules-of-hooks` sees `useX()` and `React.useX()` but not `seam.useX()` (a lowercase object), so a seam hook after an early return stays a review check. knip finds exports nobody reads, which tsc's `noUnusedLocals` and ESLint never look at; it runs `--production`, since the tests' `import.meta.glob` marks every Convex export as read |
| Screenshots | Playwright, on the Mac's Chrome (`scripts/shoot.mjs` for the running app; `scripts/design/shoot-board.mjs` for a canvas board, after `scripts/design/expand.mjs`) | the `ui-verifier` agent's camera and the `/design` skill's render check, and the same tool as the smoke tests |
| Smoke tests | `@playwright/test` (`npm run smoke`, `tests/smoke/`), on the Mac's Chrome locally and Chromium in CI | loads the built app in a real browser on the preview sessions, no deployment needed |
| Going live | the Vercel CLI (`vercel`, a devDependency pinned to one version), driven by `npm run setup:live` (`scripts/live-setup/`, docs/setup.md) with the Convex CLI and one `fetch` per call to Resend's API | Craig signs in to each CLI once and the setup command does the rest, with no token of ours to keep; pinned because the command's flags were read from that version's `--help` |

Each is installed with the first feature that needs it; for now package.json has the app, sign-in,
styling, typeface, test, coverage, lint, screenshot, smoke-test and going-live rows. Tables and the
Tactics pitch are built with no package, and components, motion, forms and charts are the plan.

## Data

- The football layer (FPL and the Premier League's public APIs) is copied from epl-draft's
  `packages/core` when needed, not shared. Clubs, players, fixtures, gameweeks and scores sit
  behind one seam so a paid feed can replace them for other leagues (SPEC, Later): `Football` in
  `convex/football/football.ts`, filled by FPL's adapter (`readFpl` and `mapFpl` in
  `convex/football/fpl/fpl.ts`, #21), read by `convex/football/footballSync.ts` into the tables the
  site reads, and by Sportmonks' adapter (below) into its own. Nothing else goes through it. These read FPL's and the Premier League's own shapes directly, so a paid
  feed would replace them too: the adapters in `convex/football/fpl/` and
  `convex/football/premierLeague/`; in `convex/football/`, `feedIds.ts`, `scoreReads.ts`,
  `commentary.ts`, `feeds.ts`, `matchTeamSheets.ts`, `matchCommentary.ts` and `matchTeamStats.ts`;
  `convex/stats/matchStatsSync.ts`, `convex/stats/liveStatsSync.ts` and `convex/stats/matchRecords.ts`;
  and `convex/positions/positionsSync.ts`. Sportmonks replaces both feeds (SPEC, *What it is*);
  until it does, these are what runs.
- Players are keyed on Sportmonks' player id; FPL's season-stable `code` is kept only to match past
  seasons (SPEC, *What it is*; Craig, 9 Nov 2026, on #1196). Until the switch lands, every table
  but the `sportmonks*` ones still keys players on FPL's `code`.
- The two feeds are matched on Opta's ids (`convex/football/feedIds.ts`): a Premier League fixture's
  `altIds.opta` is `g` + FPL's fixture `code`, and a man's is FPL's `opta_code`; one that matches
  nothing is reported, never dropped ([docs/pl-match-stats.md](docs/pl-match-stats.md#matching-the-two-feeds)).
- Clubs, players, fixtures and gameweeks refresh every six hours (`convex/crons.ts`): nothing
  held moves during a match, and what does (a signing, a rescheduled match) is known days ahead.
  Every run, failed or not, is a row in `footballSyncs`.
- Sportmonks (#1391, slice 1 of the switch off FPL and the Premier League): a second adapter fills
  the same `Football` seam, in `convex/football/sportmonks/`, reading each competition on the
  `sportmonksCompetitions` list that is on (#1414; seeded with the Scottish Premiership, league
  501, on, and the Premier League, 8, off until the paid plan covers it) into its own
  `sportmonks*` tables, keyed on Sportmonks' ids, every row naming its competition; nothing the
  site shows reads them yet. Each competition's run is its own row on the feeds page, so one the
  plan refuses fails alone. A daily positions read (#1419,
  `convex/football/sportmonks/sportmonksPositionsSync.ts`), for the Scottish Premiership alone,
  files each played match's lineups once (`sportmonksLineupsRead`) into each man's newest starts
  and Sportmonks' label for him (`sportmonksPlayerStarts`), each run a row in
  `sportmonksPositionsSyncs`. Our commentary lines from a match's events are worded in
  `convex/football/sportmonksCommentary.ts` (#1418), which nothing calls yet. Its three crons do
  nothing where `SPORTMONKS_API_TOKEN` isn't set (the live deployment). Calls, per competition that is on, against the plan's 2,000 an entity an hour
  (Sportmonks' plan page and livescores docs, checked 9 Nov 2026, as league 501 was): a six-hourly
  run makes three (the league with its current season, the season's clubs with their squads in
  one page, the season's schedule), one more per 50 clubs past the first 50; the live tick makes
  none with none of its matches on and one a minute while any is, all of a round's matches in one
  `fixtures/multi` read with their lineups, `lineups.details` and events, so 60 an hour on the
  fixture entity at most for each competition with a match on, five such well inside its 2,000
  and Sportmonks' "no faster than 10 seconds". Each catalogue stat's Sportmonks type, or that it has none:
  `convex/football/sportmonks/sportmonksStats.ts`.
- Match stats (#27): one record per player per match in `playerMatchStats`, keyed on FPL's
  player and fixture codes, both feeds merged by spec/07's split
  ([docs/pl-match-stats.md](docs/pl-match-stats.md#one-record-per-player-per-match)).
  `convex/stats/matchStatsSync.ts` reads each match the Premier League calls full time; every run,
  failed or not, is a row in `matchStatsSyncs`. Each match's place in the window, provisional to
  locked, is its row in `matchStatsStatus`, and a correction seen after it locked a row in
  `lateStatCorrections` (`convex/schema/matchStats.ts`). A run reads ten matches at most, the least
  lately tried first (`matchStatsTries`), so ones that fail or wait every run hold up no newer
  match. The lock is a scheduled function, so it fires
  with no run due; the window is a row in `platformSettings`.
  A cron runs it every 10 minutes (spec/20): full time counts from the first
  read that finds it, so a match locks up to one interval after its true hour. A run with no
  match due reads no feed; one due reads about 40 Premier League URLs per match (its sheets,
  each named man's stats, and its team stats), and a locked match is read again hourly for a day
  to catch late corrections. Finding the due matches (`matchStatsDue.due`, #199) reads only
  what can still be due: this season's status rows not yet locked, those locked within the day's
  watch, each with its match, and the matches kicked off since the oldest one not yet read at
  full time, or a week back (`matchStatsUnseenFrom`, one row), each with its status row, and
  each match due's last try: at most about 100 reads a run on a weekend of ten matches, whenever
  in the season, where it was about 760 a run by May (counted 28 Oct 2026). Both are hand
  counts from the code, not measurements. The new one (31 Oct 2026) adds up to 20 status rows
  open or watched and their 20 matches, 10 to 20 matches from the week (the read reaches a week
  and one run back, so it holds the last weekend's matches only when they kicked off inside
  that) and their status rows, and up to 20 tries. It stays unverified until the Convex usage
  page shows it, once the code is live. It grows only while a match stays unread: one the feed never calls full time holds the fixtures' read at
  its kickoff until it is. The leagues' count changes none of it.
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
  A live read's threshold steps are rows in `thresholdStepReads`, a capped number a row (#871),
  so a match's rows stay about as few as its reads.
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
  once (`positionSheets`) and runs daily from a cron (#1194), each run a row in `positionsSyncs`
  ([docs/positions.md](docs/positions.md)). How starts count, and change a position, is the one
  row in `positionSettings`, absent until the admin first sets it. Each warning Mail has sent a manager about a player's
  position, flagged and then lost (#23), is a row in `positionWarnings` while it stands, so each
  step is told once (`convex/positions/positionWarnings.ts`).
- League rules are rows, never constants; FPL's own rules can be constants. Each league's are rows
  in `leagueRules`, one from each gameweek they changed in, copied at creation from
  `defaultLeagueRules` (#25), the squad maximum read instead from `squadMaximums` by the league's
  size (#316). A row holds the whole rules or only the parts its save changed, stacked on the row
  before when read (`savedForm`, `convex/rules/rulesHistory.ts`, #1617). The scoring set moved out of them to the site's scoring (#354, below): a row saved
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
  match is then postponed; one FPL stopped sending keeps its last deadline in `keptDeadlines`
  (#202) until it passes. A feed's round's first kickoff, as first seen, is a row a season and
  round in `roundStarts` (#1416, `convex/gameweeks/roundStarts.ts`), so a later move never shifts
  a gameweek's window. The one deadline alarm pending, site-wide, is the one row in
  `deadlineAlarms` (#1329), so it is kept or cancelled by its id. The gameweek a manager last opened Tactics in is `tacticsOpenedInGameweek`
  on his team's row, so Continue stops leading him there on every device (#526,
  `convex/lineup/lineupDue.ts`); a new manager of a vacated team starts without it. Each team's
  saved plans (#992), a formation and every slot's role by name, never players, are rows in
  `savedPlans` (`convex/lineup/savedPlans.ts`).
- Leagues (#24): `leagues`, `teams` and `leagueEvents`, people known by their email, so one can be
  named before they have an account; joining's rows are `invites`, `inviteLinks` and
  `joinRequests` (#73).
- Mail (#26): a letter is a row in `letters` for each person it's to, filed when it's sent, so
  someone who joins later doesn't get old ones.
- A deleted league is gone for good 24 hours on: `deleteForGood`, a scheduled function, removes
  it and every row keyed to it, in batches, archiving nothing (#75). Each person who couldn't be
  emailed that it was deleted is a row in `unemailedDeletions` (#320), naming the league, until
  it ages out (`convex/leagues/deletionNotices.ts`, #897).
- Each ask for a sign-in link that was answered "check your email" is a row in `signInAsks`, a
  failed send kept with its error, and each day's emails are counted in `emailSends` against
  Resend's 100 (#20).
- When the admin was last emailed that a feed failed is a row in `feedFailureEmails`, one per
  feed, so he hears at most once a day for each (#319).
- The league each person used last is a row in `lastLeagues`, by email, not in the browser, so
  the app opens it on any device they sign in on (#76).
- Squads (#122): a `squadPlayers` row (league, team, FPL `code`) for each player on a team, one
  team per player per league (index `by_leagueId_and_playerCode`). Assigning, moving and
  releasing a player are filed as `leagueEvents` for Mail, and so is a draft pick, as an
  assignment; each pick is also a `draftPicks` row (league, pick number, team, `code`), and the
  draft's row in `drafts` (#1089, one a league at most) keeps the squad rules its picks follow
  (#1090). The admin's ranking that auto-pick takes from is the one row in `draftRanking` (#1093).
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
  (`convex/table/pointsOverrides.ts`). His override of one team's total in one gameweek (#903) is a
  row a league, gameweek and team in `teamOverrides`, standing over the player overrides and any
  later correction (`convex/table/teamOverrides.ts`).
- Fixture edits (#1208): a commissioner's edit of a gameweek not yet begun is a row a league and
  gameweek in `fixtureEdits`, held while the gameweek still draws as it did when edited; a change
  that redraws it replaces them, and once it begins it is stored as edited
  (`convex/table/fixtureEdits.ts`).
- Season totals: each player's stats for a season are a row in `playerSeasonStats`, kept in step as
  each match record is written (`convex/stats/seasonStats.ts`). Scouting's list reads
  `scoutingPlayers` (#1559), one row a player copying his `players` row, his positions and his
  newest season's totals, so it sorts by any stat reading one row a player
  (`convex/scouting/scoutingPlayers.ts`).
- Stars (#11): each player's points per match under each role he is rated for, and his stars for
  each, are a row in `playerRoleStars`, one a player with a counted match, so no read prices every
  player under every role. A match's lock sets its players' rows afresh and ranks everyone again;
  a version of the site's scoring taking effect does every player's. A player gone from the
  Premier League keeps his row while a squad in any league holds him
  (`convex/stars/starsRefresh.ts`). Each bench player's stars at a league's deadline, with the
  lineup's men, clubs and positions then, are a row a league, gameweek and team in
  `deadlineStars`, so scoring the gameweek again never moves an auto-sub's role
  (`convex/stars/deadlineStars.ts`).
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
- The draft queue and do-not-draft list (#1092): each team's, one row in `draftLists` holding both
  as lists of FPL's `code`, the queue in its order, read and changed only by its manager
  (`convex/draft/draftLists.ts`).
- Trades (#383): each offer still open or in review is a row in `tradeOffers`, with any draft picks
  in it (#1096) and who reviews it once accepted; one that closes, goes through or is blocked
  leaves the table, and Mail and the squad moves it files say what happened. One that ended
  without going through is kept as it was made, with when and why, in `closedTradeOffers`
  (`convex/trades/`).
- Waivers (#1197, #1198): each player on waivers in a league is a row in `waiverPlayers`, by FPL's
  `code`, with when a run may first take him; a player no team holds and with no row is a free
  agent. A manager's pending claims, in his order, are rows in `waiverClaims`, gone once a run
  tries them. A league's order between runs and its last run are one row in `waiverOrders`, and
  the order it starts from after its commissioner changes the order type one row in
  `waiverStarts` (#1200) (`convex/waivers/`).
- Scouts (#375): each time a team sends a scout to a player is a row in `scouts`, kept for good so
  its report stays readable with its date, read only by its manager; Claude writes the report
  (`convex/scouting/scouts.ts`, `convex/scouting/scoutReports.ts`).
- Recaps (#387): League home's weekly recap is a row a league and gameweek in `recaps`, written by
  Claude from facts once every match of the gameweek is final, and never rewritten
  (`convex/home/recaps.ts`).
- Availability (spec/06): the admin's say over the feed's, out, doubtful or available, is a row a
  player in `availabilitySettings`, by FPL's `code`, apart from `players` so no feed read touches
  it; clearing it deletes the row (`convex/availability/availability.ts`).
- Past seasons (#1113, #1114): each match a player played in a past season, copied once from
  ai-carling-premiership by `scripts/past-season.mjs`, is a row in `pastPlayerMatchStats`, by FPL's
  `code`, the season and the kickoff; each player's points in that season under the site's set as
  it stands are a row in `pastSeasonPoints`, priced afresh whenever the set changes
  (`convex/pastSeasons/`). The balance lab (#843) backtests a draft patch on them and saves nothing.
- Club data beside the feed's: each club's colours and shirt pattern, set by the admin (#838), are a
  row in `clubColours`; a club's points total in a season's Premier League table, which the admin
  sets for a deduction (#898), a row in `plPointsOverrides`; and each player's number at his club,
  from the Premier League's squad lists (#13), a row in `clubNumbers`; all by FPL's `code`.
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

- The studio kit: the files `.studio/kit.json` lists (hook helpers and checks every studio project shares)
  are copies from the private `cBallGitWork/studio` repository, pinned to the commit it names.
  Change them there and copy the kit in again (`node bin/copy-kit.mjs <this checkout>` in studio);
  `scripts/studio-kit.mjs`, in verify, fails a copy edited here (11 Nov 2026).

- `src/shared/`: non-visual code every screen uses: the hooks, refusal handling, the common words.
- `src/ui/`: `docs/design/plate.md`'s controls and panel parts that no feature owns. It imports only
  `src/shared/` and convex's pure modules.
- Code one feature owns but others import stays with its owner: `src/matchup/MatchupLink.tsx`,
  `src/leagues/LeagueLinks.tsx`, `src/mail/DateBlock.tsx`.
- `src/rules/`: the editing kit the two rules screens share, League settings (`src/leagueSettings/`)
  and Player scoring (`src/scoring/`): a part's edits and its save (`rulesEdits.ts`), a box left
  blank (`blank.ts`), `NumberBox.tsx`, `SaveBar.tsx`, and their words and preview.
- `src/frame/menu.ts`: the top menu, its sections' tabs and the sections' paths (`HOME_PATH`,
  `MY_TEAM_PATH` and the rest); a feature's `paths.ts` builds its own pages' paths from them.
- `src/app/`: how the app starts. `src/routes/`: the routes and the router. `src/`'s top level
  keeps only `main.tsx` and `styles.css`. The tokens stay in `styles.css`; a screen's own long
  utilities sit beside it and `styles.css` imports them (`src/myTeam/tactics/pitch/pitch.css`, 31 Oct 2026),
  as it does the controls' shared styles (`src/ui/controls.css`: the action, keys, boxes, the tick well, the radio well).
- `convex/schema/`: the schema's tables, one file per feature, imported only by `convex/schema.ts`.
  `convex/stars/`: stars, which role suits a player (#11): the rating, its stored rows and their
  refresh, the reads, the role a player dropped into a slot starts on, and each
  deadline's kept copy that picks an auto-sub's role.
  `convex/gameweekScorer/`: the gameweek scorer.
  `convex/draft/`: the draft (spec/04): the snake order, and which players a pick may take (#1088);
  the draft settings' limits and kinds, and the commissioner's draft order (#1087); the admin's
  ranking, its file read and checked and the one row it is stored as (#1093); the draft's row,
  its start date, start and read, and the order drawn at random (#1089); a manager's pick (#1090);
  each team's queue and do-not-draft list (#1092); and the live room's clock, pause, timeouts,
  auto-pick, board and letters.
- The feed adapters: `convex/football/fpl/` and `convex/football/premierLeague/`, copies of
  epl-draft's, never shared; `convex/football/sportmonks/`, Sportmonks' (#1391), the one to replace
  them.
- Every other feature folder, one job each. Server (`convex/`): `admin` (the feeds page, run logs,
  failure emails, platform settings), `availability` (a player's availability, #1211), `balanceLab`
  (the rule balance lab, #843), `feedback`, `football` (the feeds and what they fill), `gameweeks`
  (deadlines, a league's gameweeks, the scoring start), `heartbeats` (Healthchecks pings and the
  lead's wake-up), `home` (League home: the glance, matchday, news and recaps), `joining`, `leagues`,
  `lineup` (a team's lineup: its pitch, roles, instructions, saved plans and auto-subs), `mail`,
  `match` (one Premier League match's page), `matchup`, `outbound` (what leaves the app: email
  through Resend, Claude, the deployment's settings), `pastSeasons` (past seasons' copy and points,
  #1113), `playerCard`, `positions`, `rules` (a league's rules: its settings, their checks, history
  and locks), `scoring` (the site's scoring set, its versions and patches, and a team's points),
  `scouting` (the players list, compare, shortlist, scouts and the stat race), `shared` (helpers
  every feature uses), `signIn`, `squads` (a team's squad: its limits, numbers and transactions),
  `stats` (match records and their totals), `table` (the table, its fixtures, final scores and
  points overrides), `trades` (#383) and `waivers` (waivers and free agents, #1197). Screens
  (`src/`): `admin` (the admin's dashboard), `draft` (the draft room), `feedback`, `gameweeks` (the
  commissioner's gameweeks, #74), `home` (League home and its news), `joining`, `leagues`,
  `leagueSettings` (League settings), `mail`, `matchup`, `myTeam` (squad, tactics and waiver claims
  in `claims/`), `patches` (patch notes, the banner, the lab's report), `playerCard`,
  `premierLeague`, `scoring` (Player scoring), `scouting` (with `shortlist/` and `scouts/`),
  `signIn`, `squads` (a league's squads, #31), `table` (the table, fixtures and cup) and `trades`
  (offers, #383).
- `convex/table/` keeps its name, because the browser and the scheduler call its functions.
- Where a screen's feature and its server split their jobs differently, they have different names
  (rule 1 holds for every other feature):

  | Screens (`src/`) | Server (`convex/`) |
  |---|---|
  | `src/myTeam` | `convex/lineup` and `convex/squads` |
  | `src/myTeam/claims` | `convex/waivers` |
  | `src/patches` (the lab's report) | `convex/balanceLab` |
  | `src/leagueSettings` | `convex/rules` |
  | `src/patches` | `convex/scoring/patch*` (`patchChanges.ts`, `patchKickoffs.ts`, `patchNotes.ts`) |
  | `src/premierLeague` | `convex/football` and `convex/match` |
- Sub-folders: past about 12 files, a job with its own files and name gets a sub-folder
  (`src/frame/topBar/`, `src/myTeam/header/`, `src/myTeam/squad/`, `src/myTeam/tactics/`,
  `src/scouting/shortlist/`, `src/scouting/scouts/`, `src/myTeam/claims/`, and inside Tactics the pitch's drawing in `pitch/`, the formation window
  in `formationWindow/` and its panels in `widgets/`, 1 Nov 2026, and the role card in `roleCard/`). A folder over 12 that is one job, or whose
  tests mirror its sources, stays flat.

**The rules**, from how the folder pass left the code (29 Oct 2026, counts from `find src convex`):

1. One name per feature, the same in `src/`, `convex/`, `tests/src/` and `tests/convex/`
   (`playerCard`). Folders are camelCase, no hyphens; a component is `PascalCase.tsx`, anything
   else `camelCase.ts`.
2. A feature folder's parts carry fixed names: the screen `<Name>Page.tsx`; `seam.ts`, what the
   screen reads and does, so tests can stand in; `live<Feature>.ts`, the Convex side of the seam;
   `preview.ts`, its stand-in data for previews and tests; `paths.ts`, its pages' paths beyond its
   section's own in `src/frame/menu.ts`; `words.ts`, everything it says. The server's numbers sit
   in `convex/<feature>/<name>Limits.ts`, which `words.ts` imports, never retypes. A sub-folder
   uses the same names (27 `words.ts`, 22 `seam.ts`, 21 `preview.ts` and 16 `paths.ts` on
   8 Nov 2026, the sub-folders `src/myTeam/tactics/` and `src/scouting/shortlist/` among them).
3. The top level holds only entry files: `src/` keeps `main.tsx` and `styles.css`; `convex/` keeps
   `auth.config.ts`, `auth.ts`, `crons.ts`, `http.ts`, `process.d.ts` and `schema.ts`.
4. Imports run one way: a feature, then `src/ui/`, then `src/shared/`, then convex's pure modules.
   A feature imports another only through what that one offers others, never its insides: its
   Link component, its seam's types, its `paths.ts`, its `live<Feature>.ts` (into another's
   `live<Feature>.ts`, or `src/app/liveApp.tsx`, which joins them) and its `preview.ts` (into
   another's `preview.ts`). A `words.ts` never re-exports another feature's words: words two
   features say move to `src/shared/words.ts` (#1330). `tests/convex/featureImports.test.ts`
   holds both, with the imports still to move on a list that only shrinks (#1581). No import
   cycles (`tests/convex/importCycles.test.ts`).
5. Something two features use stays with its owner; at the third, it moves to `shared/` or `ui/`.
   `tests/convex/oneHome.test.ts` fails a type, a function body of 3 or more lines or an object of
   only literals written in 3 or more files under `convex/`, and a test restating a value a
   `tests/support/` harness exports, with today's copies on lists that only shrink (#1813).
6. A file stops at 300 lines and is split along a seam; a folder past about 12 files gets a
   sub-folder (above). `convex/lineup` (21 files), `convex/scoring` (21) and `convex/stats` (17)
   stay flat (8 Nov 2026): each is one job (a team's lineup, the site's scoring set, the match
   records and their totals), the browser and the scheduler call their functions, so a move
   leaves re-exports behind (rule 8).
7. A test mirrors its source's path; setup two test files share lives in `tests/support/convex/`
   or `tests/support/src/`, by feature.
8. Moving a Convex file whose functions the browser or the scheduler call keeps a thin re-export at
   the old path (`docs/REFACTORING.md`, "Function paths").

## With the first code

Craig's picks from the guide videos (16 Oct 2026; [docs/research/guide-videos.md](docs/research/guide-videos.md)),
meant to land with the first code; the ones still open are tracked in issues, linked below:

- [x] **Verify gate**: retired as a Stop hook on 2 Nov 2026 (`docs/PLAN.md`); CI runs
      `npm run verify` on every pull request and the `main` ruleset requires it. A `/verify` skill
      runs the local gate and reports the count (epl-draft's;
      [what it runs](.claude/skills/verify/SKILL.md)).
- [x] **Line ceiling**: a note when a file passes 250 and 300 lines (epl-draft's
      `.claude/hooks/line_ceiling.sh`, landed as `line_ceiling.py`).
- [x] **UI rules by path**: `docs/design/plate.md`'s "Never" list in `.claude/rules/` so it loads
      only when screen files are touched, and a UI verifier agent that shoots a screen at 1440
      (390 when asked) and looks (epl-draft's `ui-verifier`). Landed as `.claude/rules/ui.md` and
      `.claude/agents/ui-verifier.md` (#19).
- [x] **MCPs**: Convex, with the Convex test above, its `envSet` and `envRemove` tools off (`.mcp.json`) so no session changes a deployment's settings. Playwright's was dropped (4 Nov 2026): nothing used it, as `ui-verifier` and `/design` shoot through `scripts/shoot.mjs` and `scripts/design/shoot-board.mjs`.
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
