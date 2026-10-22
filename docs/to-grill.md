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
- A whole redraft or a short top-up draft; at the January window or elsewhere.
- Do keepers or some players stay; does the table reset or carry on. FPL Draft allows up to three
  redrafts that "do not affect the current league standings"
  (premierleague.com/en/news/4363847).

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
| The first rules' guessed defaults | `convex/rules/firstRules.ts` guesses them, each marked "guess": head-to-head; a squad of 11 to 14; every area 0 to 10 but exactly one goalkeeper; tie-breaks `["pointsFor"]` alone, of the three there are (points for, head-to-head, points against); waivers Tuesday 23:00 in reverse standings, and "the doc's live 23-hour minimum waiver period has no rule here". Tie-breaks also open: PR #129's "Your call", item 5 |
| More games a gameweek than opponents | `convex/table/roundRobin.ts`: "A league asking for more plays as many as there are." It caps them without saying so; should it refuse, or meet the same team twice? |
| When a gameweek has begun | The league's deadline, FPL's, or whichever is first. `convex/gameweeks/nextGameweek.ts` takes the first ("whose league deadline, and FPL's own, are both still ahead"); `convex/gameweeks/leagueGameweeks.ts` checks FPL's only ("FPL's deadline decides when a gameweek has begun"). #138 |
| An own stat named like a catalogue stat | `convex/scoring/ownStats.ts` requires "a key, a name and a short code of its own, none a catalogue stat's", but checks names and codes only against other own stats. May one be called Minutes, or M? Keys: #136 |
| A league name's length | A team's name has one (`convex/shared/leagueAccess.ts`: "A team's name is up to ${TEAM_NAME_MAX} characters.", 30 in `convex/leagues/leagueLimits.ts`); `leagues.create` refuses only a blank name ("Give it a name."). Should a league's have a maximum? |
| Frozen fixtures | `spec/13`: "a change reshuffles only fixtures not yet played". Open: a team joining mid-season, a rule change from its `fromGameweek`, and the commissioner's fixture edits (`spec/09`: "the commissioner can edit them"). #137 |
| How the admin hears a feed or sync failure | `spec/15`: "A feed that stops silently is the failure to catch." The feeds page only (#35), or email too, out of Resend's "100 a day" (`ARCHITECTURE.md`)? |
| How a player's areas count against a squad's limit per area | `spec/03` Squad make-up. The limits are saved and validated by `leagueRulesCheck` but not checked by `squadWarnings`, and `convex/rules/firstRules.ts` guesses 0–10 per area with exactly one goalkeeper |
| A screen whose read fails | What it shows, and whether it shows the server's words. `docs/PHILOSOPHY.md`: "Don't swallow errors silently. If something fails, we need to know." |

The rows from the first rules' defaults down are open questions from the repo audit of 21 Oct
2026, details the spec doesn't settle rather than new features.

Also Claude's suggestions, from the same audit:
- #117's undo sends no email, so managers told 'will be deleted' never hear it was undone.
- A person the 100-a-day limit stopped is marked 'not told' and never retried.

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
