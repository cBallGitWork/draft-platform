# To grill

**Contents:** [Picked by Craig](#picked-by-craig) · [Suggested, not yet picked](#suggested-not-yet-picked) · [Smaller pages, from Fantrax](#smaller-pages-from-fantrax) · [Keeping this list](#keeping-this-list)

Things Craig wants, or might, that no `/grill` has settled yet (from 16 Oct 2026). None of it is
the product until a grill puts it in [SPEC.md](../SPEC.md); then its line here goes. A suggestion
Craig hasn't picked says so.

## Picked by Craig

Each with the questions its grill starts from. The questions are Claude's.

**The shortlist**: scouting.
- A season-long watchlist. Mail already files every claim and drop (`spec/16`); the new part is
  the personal list and a letter when a shortlisted player is dropped or clears waivers.

**Scouting, a strong focus**: its own section. "It's a more detailed league."
- Scouting advises; Mail never does (`spec/16`). Settle where advice is allowed.
- Whether the Players screen (`spec/12`) becomes part of it.
- Scout reports, and comparing two players side by side.

**Awards**: history, Mail.
- Manager of the Month, Team of the Week, Player of the Season. Where they live once Mail has
  filed them (see History, below).

**Our own home stadiums**: the pitch view, the matchup.
- Each team names its ground; the pitch view shows it with the team's logo.
- Where the logo goes on the pitch: the centre circle, or boards along the touchline.
- Room for sponsors later, on those boards and the stadium's name: shown with the team's or the
  league's own logo until then, so the pitch needn't be redrawn. Money goes with Payments (SPEC,
  *Later*).
- The head-to-head fixtures have no home and away yet (`spec/09`). Is a matchup played at the
  home team's ground?
- A team's own logo: nothing covers one. Uploading it means storing files, a stack question for
  `ARCHITECTURE.md`.

**Premier League club pages**: `spec/18`, *After the mini beta*.

**Cups and a plate**: after the beta (SPEC, *Later*; Craig, 20 Oct 2026). The plate here is a
competition, not the design plate (`docs/design/plate.md`).
- Who plays the plate: everyone knocked out of the cup, or the bottom of the table.
- Whether a plate win can earn next season's first pick, so losing never pays (commissioners set
  the draft order anyway, `spec/04`).
- Rounds, legs and ties, against the double-gameweek rule (`spec/03`). Draft Fantasy's cups and
  US consolation brackets: `docs/research/draft-competitors.md`.

**A split season or a redraft**: "a season is long" (Craig, 20 Oct 2026).
- Whether a team can join at a split, in a league with splits (Craig, 22 Oct 2026; `spec/13`
  Joining).
- A whole redraft or a short top-up draft; at the January window or elsewhere.
- Do keepers or some players stay; does the table reset or carry on. FPL Draft allows up to three
  redrafts that "do not affect the current league standings"
  (premierleague.com/en/news/4363847).

**Our own gameweeks, not FPL's** (Craig, 22 Oct: "think we need to make our own gameweeks at
somepoint").
- A league's gameweek begins at its own deadline already (`spec/13` Gameweeks); what an own
  gameweek is beyond that, and how it maps to FPL's rounds.

**Scoring the site owns, patched like League of Legends** (Craig, 24 Oct 2026: "i might just
hardcode it for the site, set standards to follow and we control that"; "like a league of legends
patch, old scores locked in, site wide announcement with week notice for udpates").
- Which rules the site owns (category values, the gap rule below) and which stay each league's
  (formations, area limits, roles: `spec/03`). Today every league edits its own scoring set
  (`spec/14`).
- Kept as data the site locks, not code (CLAUDE.md: the league's rules are data), so a patch is
  a new version, not a deploy.
- A patch takes effect from a deadline a week after it's announced; gameweeks already played keep
  the rules in force in them, as League settings already do (#276).
- Where the announcement lives: a Mail letter to every manager, patch notes, or both.

**Anyone can play anywhere, the gap rule** (Craig, 24 Oct 2026: stop Haaland at centre-back
getting "his clean sheet points AND goals", but not "oh he didnt play cb so no points", and "i like
the fun idea of putting someobdy as a make shift striker").
- Claude's proposal: a player earns the slot's price for each category, but where the slot pays
  more than his own position would, he gets only part of the gap: all of it in his own area, then
  less the further away the slot is (75%, 50%, 25% makeshift, as a starting point).
- He counts as natural for a match when the real team sheet put him in that line
  (`docs/pl-match-stats.md`, Where a man lined up), so a centre-back who fills in at DM loses
  nothing.
- It reopens three answers: scoring by the slot, never his own positions (`spec/14`); no
  out-of-position penalty (`spec/05`); the areas each position can play (`spec/06`).
- A substitute's team sheet says nowhere where he played (`docs/pl-match-stats.md`): does a
  sub who comes on count as natural, or by his own positions?
- What else punishes an extreme shape, such as two at the back. FM blocks no shape; it punishes
  through the match engine, tactical familiarity (a new shape starts "awkward",
  passion4fm.com/how-to-maximize-tactical-familiarity), position familiarity (SI's FM22 manual,
  Players page) and staff warnings (footballmanager.com, FM26 in and out of possession). Options for ours: goals conceded cost more in a thin area, a new
  shape earns role points at a fraction for its first gameweeks, and a warning on the board before
  the deadline, never a block.

## Suggested, not yet picked

| What | Why |
|---|---|
| History | Past seasons, champions, league records; where awards live after Mail files them |
| The manager's profile | A record across every league on the platform |
| The rules, readable by every manager | Only the commissioner's settings screen shows them now. With a glossary of what each category counts |
| Your account | Display name, email preferences, your leagues; leaving a league; deleting the account |
| Going on holiday | CM's holiday: the manager switches the auto team on himself until a gameweek he names (`spec/09` lets him switch it on; the end date is the new part) |
| Match rating and Man of the Match | CM's Av R and MoM: a 1–10 rating from his points against his area; MoM the top scorer in each head-to-head |
| Saved tactics | FM's: a few formations kept to switch between, say one for a double gameweek |
| One player on several teams | Not now; maybe later (Craig, 20 Oct 2026). A draft is normally one owner per league; some leagues do one per division. The draft, waivers, trades and "owned in the league" all assume one owner |
| Frozen fixtures | `spec/13`: "a change reshuffles only fixtures not yet played". A gameweek's fixtures are stored once it begins (#137). Open: a rule change from its `fromGameweek`, the commissioner's fixture edits (`spec/09`: "the commissioner can edit them"), how the gameweeks to come are drawn after a team joins at a split (`convex/table/playedFixtures.ts`, `scheduleAround`), and the gameweeks a league made mid-season has from before it existed, which are drawn, never stored (#282) |
| How the admin hears a feed or sync failure | `spec/15`: "A feed that stops silently is the failure to catch." The feeds page only (#35), or email too, out of Resend's "100 a day" (`ARCHITECTURE.md`)? |
| How a player's areas count against a squad's limit per area | `spec/03` Squad make-up. The limits are saved and validated by `leagueRulesCheck` but not checked by `squadWarnings` |
| The platform's squad ceiling of 60 | `convex/leagues/leagueLimits.ts`: `MOST_IN_SQUAD = 60`, "The most players one team can hold, whatever the league's own squad limits". A league's squad maximum above it is refused when saved (`spec/03`). Is 60 the right ceiling? (#213) |
| A screen whose read fails | What it shows, and whether it shows the server's words. `docs/PHILOSOPHY.md`: "Don't swallow errors silently. If something fails, we need to know." |
| Retry deletion warnings past the day's email limit | A manager the 100-a-day limit stopped is marked "not told" and never retried. Left as it is for the beta (Craig agreed, 22 Oct 2026) |

The rows from frozen fixtures down are open questions from the repo audits of 21 and 22 Oct
2026, details the spec doesn't settle rather than new features.

Also Claude's suggestions, from the audit of 21 Oct 2026:
- #117's undo sends no email, so managers told "will be deleted" never hear it was undone.

Thought of and set aside, as they clash with what's settled: board confidence and the sack
(storylines are out of scope), counter-tactics (your tactics never touch your opponent's points),
loans (wait for the market).

Researched and not picked: a classic, FPL-style game where every manager can own the same
players. Craig asked out of curiosity (20 Oct 2026; `docs/research/draft-competitors.md`).

## Smaller pages, from Fantrax

From Fantrax's page list (16 Oct 2026), less what the spec already covers: joining (`spec/15`),
handing a team on and the auto team (`spec/09`), and a log of commissioner actions (Mail files
every one, `spec/15`). Suggested, not yet picked; ranked by Claude, most useful first. Some may
be tabs on screens `spec/12` already lists rather than pages of their own.

| Page | Why |
|---|---|
| Import from Fantrax | The league moves from Fantrax: its squads and its history come with it |
| Trade block | Players a manager will listen to offers for; the cheapest way to start trades |
| Draft board and draft results | The pick grid during the draft, and the record after it, by round and by team |
| Matchup preview | The week's head-to-head before the deadline: both lineups, fixtures, doubts |
| Every squad on one page | For scouting rivals |
| A new season from the last | Copy the league, its rules and its managers into next season |
| Stat corrections | What moved after a match, and why (the window is `spec/07`'s) |
| Category tables | The league's leaders in each scoring category, by team |
| Waiver order and the can't-drop list, on show | Makes the waiver rules visible |
| Who owned whom | A player's owners, gameweek by gameweek: for history and for his card |
| Mock draft | Practice before the real one |
| Commissioner fixes | Block one team from trading or claiming; adjust the standings |
| Polls | A league vote on a rule change. Check it isn't the chat that's out of scope |
| Help | How the game works, for a new manager |

## Keeping this list

- `/grill` deletes the lines it settles here, in the spec's PR.
