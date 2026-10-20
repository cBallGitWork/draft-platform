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
| The gate in CI | GitHub Actions on `ubuntu-latest`: `.github/workflows/verify.yml` runs `npm run verify` on every pull request to main and every push to main (Craig, 20 Oct 2026) | two pull requests that pass alone can break main together (#69 and #77); Linux is the cheapest runner, and the hook checks need only bash, Python, git and jq; no secrets, since no test touches a deployment |
| Email | Resend | free: 3,000 a month, **100 a day**, which is why a live draft sends no "on the clock" email |
| Money | free plans through the mini beta; Craig sets a monthly ceiling before August 2027 | |

**Before building on Convex:** a short test that its servers can fetch FPL's and the Premier
League's public APIs (only ever called from Vercel in London so far), and that a scheduled
function fires with no browser open. If either fails, the backend choice goes back to Craig;
Supabase was the runner-up.

**Tested, 19 Oct 2026 (#7): both passed.** `convex/feeds.ts`, run on the cloud dev deployment
`spotted-mosquito-905`:

- Both feeds answered Convex's servers, with a browser User-Agent: FPL's
  `/api/bootstrap-static/` (668 players) and the Premier League's
  `footballapi.pulselive.com/football/fixtures?comps=1&compSeasons=841` (380 fixtures).
- Squad numbers come from `/teams/{id}/compseasons/841/staff` (Arsenal: 29).
- A check scheduled 10 minutes ahead fired at 11:50:40 BST, 0.6 seconds after it was due, with
  no browser and no `convex dev` running.
- The stats per player per match, for roles: [docs/pl-match-stats.md](docs/pl-match-stats.md).

**The commentary stream (#37): read, not yet proven live.** spec/10's commentary stands on the
Premier League's `/fixtures/{id}/textstream/EN?pageSize=200&sort=desc`; the team stats on
`/stats/match/{id}`. Neither needs the `Origin` header the premierleague.com site sends (from
the Mac, 20 Oct 2026). Each line's `playerIds` are the team sheets' ids, so they map to FPL's
`code` as the sheets do (`convex/plCommentary.ts`). The 28 event types seen and what each line's men are:
[docs/pl-commentary.md](docs/pl-commentary.md). Four finished matches and one before kickoff are
recorded (`convex/recorded/commentary.payloads.ts`).

TODO after Fri 23 Oct 2026 (Ipswich v Nott'm Forest, fixture 128999, recorded by
`scripts/record-match.mjs`, and `feeds:commentaryCheck` run on Convex during it): how often the
stream updates live; whether it answers Convex's servers mid-match; when the lineups and the
team stats first arrive and whether the stats move during play; a recorded live match kept for
the tests. If the stream doesn't update live, or refuses Convex, the commentary goes back to Craig.
The steps (push the action to the dev deployment, run it twice, how to read what it prints) head
`commentaryCheck` in `convex/feeds.ts`.

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
| Sign-in | Convex Auth magic links, sent through Resend | the backend's own; beta, so read its current docs first |
| Components | shadcn/ui on Base UI, added with the first component that needs Base UI's behaviour (a menu, a dialog); the shell needs none | the code is copied into the repo, so it is ours to restyle |
| Styling | Tailwind 4 with our own design values | the defaults are the generic AI look Craig wants to get far from |
| Typeface | Archivo Narrow from Fontsource | plate.md's one face, served with the app: no call to Google from the sign-in page, and screenshots don't wait on a font server |
| Tables | TanStack Table and TanStack Virtual | unstyled, so they take Championship Manager density; v9 is newer than Claude's knowledge, so read its docs first |
| Tactics pitch | Pragmatic drag and drop, plus tap to swap | maintained; a phone needs taps anyway |
| Motion | Motion | live picks and ticking points |
| Forms | React Hook Form with Zod | the league-rules forms are large |
| Charts | Recharts | what shadcn's charts use |
| Tests | Vitest; `convex-test` with fake timers for the backend, on `@edge-runtime/vm`; Testing Library on jsdom for the app | the companion's runner; the draft clock can be tested without waiting; `convex-test` needs Convex's runtime mimicked; screens are tested by role and name, as a manager finds them |
| Screenshots | Playwright, on the Mac's Chrome (`scripts/shoot.mjs`) | the `ui-verifier` agent's camera, and the same tool as the Playwright MCP |

## Data

- The football layer (FPL and the Premier League's public APIs) is copied from epl-draft's
  `packages/core` when needed, not shared, and kept behind one seam so a paid feed can replace it
  for other leagues (SPEC, Later).
  The seam is `Football` in `convex/football.ts`; FPL's adapter is `convex/fpl.ts` (#21).
- Players are keyed on FPL's season-stable `code`, never the per-season `id`.
- The two feeds are matched on Opta's ids (`convex/feedIds.ts`): a Premier League fixture's
  `altIds.opta` is `g` + FPL's fixture `code`, and a man's is FPL's `opta_code`; one that matches
  nothing is reported, never dropped ([docs/pl-match-stats.md](docs/pl-match-stats.md#matching-the-two-feeds)).
- Clubs, players, fixtures and gameweeks refresh every six hours (`convex/crons.ts`): nothing
  held moves during a match, and what does (a signing, a rescheduled match) is known days ahead.
  Every run, failed or not, is a row in `footballSyncs`.
- Match stats (#27): one record per player per match in `playerMatchStats`, keyed on FPL's
  player and fixture codes, both feeds merged by spec/07's split
  ([docs/pl-match-stats.md](docs/pl-match-stats.md#one-record-per-player-per-match)).
  `convex/matchStatsSync.ts` reads each match the Premier League calls full time; every run,
  failed or not, is a row in `matchStatsSyncs`. A run reads ten matches at most, the least
  lately tried first (`matchStatsTries`), so ones that fail or wait every run hold up no newer
  match. The lock is a scheduled function, so it fires
  with no run due; the window is a row in `platformSettings`.
  **No cron runs it yet.** The suggestion is every 10 minutes: full time counts from the first
  read that finds it, so a match locks up to one interval after its true hour. A run with no
  match due reads no feed; one due reads about 40 Premier League URLs per match, and a locked
  match is read again hourly for a day to catch late corrections.
- Live stats (#28): a cron every minute (`liveStatsSync.tick`) reads each match being played,
  from kickoff until it is complete, or four hours on; outside those windows it reads no feed and
  writes no row. A cron, not a function rescheduling itself: a chain stops for good at the first
  tick that fails before scheduling the next (Convex runs a scheduled action at most once), with
  nothing to say so, and would need re-arming whenever a kickoff moved. Convex runs one tick at a
  time and skips one due while another runs; both feeds send running totals, so the next tick
  catches up any failed or skipped. Each tick that found a match live is a row in
  `liveStatsTicks`, failed or not ([docs/pl-match-stats.md](docs/pl-match-stats.md#during-a-match)).
  Outside matches it is one action and one indexed query a minute, about 43,000 calls a month;
  inside, each tick downloads FPL's ~1.8 MB bootstrap and reads about 40 Premier League URLs per
  match.
- League rules are rows, never constants; FPL's own rules can be constants.

## With the first code

Craig's picks from the guide videos (16 Oct 2026; [docs/research/guide-videos.md](docs/research/guide-videos.md)),
to land in the pull request that adds the first code, not later:

- [x] **Stop gate**: a session can't finish while the tests fail (copy sideband's
      `.claude/hooks/gate_on_stop.py`), and a `/verify` skill that runs every gate and reports the
      count (epl-draft's).
- [x] **Line ceiling**: a note when a file passes 250 and 300 lines (epl-draft's
      `.claude/hooks/line_ceiling.sh`, landed as `line_ceiling.py`).
- [x] **UI rules by path**: `docs/design/plate.md`'s "Never" list in `.claude/rules/` so it loads
      only when screen files are touched, and a UI verifier agent that shoots a screen at 390 and
      1440 and looks (epl-draft's `ui-verifier`). Landed as `.claude/rules/ui.md` and
      `.claude/agents/ui-verifier.md` (#19).
- [x] **MCPs**: Convex and Playwright, with the Convex test above.
- [ ] **The reviewer in CI**: sideband's `review.yml`, which needs the Claude GitHub app and a
      `CLAUDE_CODE_OAUTH_TOKEN` secret from Craig (`claude setup-token`). The gate alone already
      runs there (Services, above).
- [x] **`.env.example`** from the services above.
- [x] **One-command start**: clone, fill the env, run one command; the README says how
      (`docs/PHILOSOPHY.md`, *Knowledge Is Shared*).
- [ ] **Bug hunts as we go**: a hunt scoped to each feature as it lands, and a full one (split by
      area, a skeptic per finding, a token budget) at the mini beta.
- [ ] **One design skill tested**: Impeccable or the Taste skill run once against R3·1, kept only if
      it beats what we have.
- [ ] After a few build sessions: `/fewer-permission-prompts` to pre-approve safe commands.
