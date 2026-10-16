# Architecture

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
| Email | Resend | free: 3,000 a month, **100 a day**, which is why a live draft sends no "on the clock" email |
| Money | free plans through the mini beta; Craig sets a monthly ceiling before August 2027 | |

**Before building on Convex:** a short test that its servers can fetch FPL's and the Premier
League's public APIs (only ever called from Vercel in London so far), and that a scheduled
function fires with no browser open. If either fails, the backend choice goes back to Craig;
Supabase was the runner-up.

**When the free plans stop being enough:**

- Vercel Hobby is for non-commercial use: payments, ads, a donate button or anyone paid to work on
  it means Pro ($20 a month), and arguably so does opening signups to the public.
- Resend's 100 a day: a busy waiver night across several leagues, or a slow draft's emails,
  means Resend Pro or another sender.
- Before signups open to anyone, FPL's and the Premier League's terms are checked (SPEC, Later).

## Libraries (Claude's)

| What | Choice | Why |
|---|---|---|
| App | a Vite single-page React app with TanStack Router | Convex's main path, and the only setup its own sign-in officially supports; typed routes for filter-heavy tables; server rendering buys little where everyone is signed in and every screen is live. TanStack Start uses the same router if that changes |
| Sign-in | Convex Auth magic links, sent through Resend | the backend's own; beta, so read its current docs first |
| Components | shadcn/ui on Base UI | the code is copied into the repo, so it is ours to restyle |
| Styling | Tailwind 4 with our own design values | the defaults are the generic AI look Craig wants to get far from |
| Tables | TanStack Table and TanStack Virtual | unstyled, so they take Championship Manager density; v9 is newer than Claude's knowledge, so read its docs first |
| Tactics pitch | Pragmatic drag and drop, plus tap to swap | maintained; a phone needs taps anyway |
| Motion | Motion | live picks and ticking points |
| Forms | React Hook Form with Zod | the league-rules forms are large |
| Charts | Recharts | what shadcn's charts use |
| Tests | Vitest; `convex-test` with fake timers for the backend | the companion's runner; the draft clock can be tested without waiting |

## Data

- The football layer (FPL and the Premier League's public APIs) is copied from epl-draft's
  `packages/core` when needed, not shared, and kept behind one seam so a paid feed can replace it
  for other leagues (SPEC, Later).
- Players are keyed on FPL's season-stable `code`, never the per-season `id`.
- League rules are rows, never constants; FPL's own rules can be constants.
