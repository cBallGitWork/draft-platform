# To grill

**Contents:** [Picked by Craig](#picked-by-craig) · [Suggested, not yet picked](#suggested-not-yet-picked) · [Smaller pages, from Fantrax](#smaller-pages-from-fantrax) · [Keeping this list](#keeping-this-list)

Things Craig wants, or might, that no `/grill` has settled yet (from 16 Oct 2026). None of it is
the product until a grill puts it in [SPEC.md](../SPEC.md); then its line here goes. A suggestion
Craig hasn't picked says so.

## Picked by Craig

Each with the questions its grill starts from. The questions are Claude's.

**Cutting the role set**: tactics (`spec/05` Roles; from #10's review, 26 Oct 2026).
- A saved lineup can hold a role a later cut removes. Does it fall back to the slot's first role,
  or is the lineup refused until the manager picks again? Today it is refused at the next save,
  and the pitch quietly shows the slot's first.

**Awards**: history, Mail.
- Manager of the Month and Player of the Season (Team of the Week is on league home, `spec/12`).
  Where they live once Mail has filed them (see History, below).

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

**Makeshift positions, after the rest is built** (Craig, 24-25 Oct 2026; SPEC.md, Later). For now
a player fills only his own areas, and only a keeper plays in goal, both ways (`spec/05`).
- What it must stop: "we want to stop people just playing players in good teams at the back to get
  easy clean sheets", but not "oh he didnt play cb so no points"; "i like the fun idea of putting
  someobdy as a make shift striker".
- Craig's starting point: "maybe a 2 area rule, like haaland could go am (still a penalty) but
  further than that, same for cb, could go dm i guess, needs a think".
- Claude's earlier proposal, the gap rule: the slot's price, but where it's priced higher than his own
  position, only part of the gap. Craig took these as starting points (25 Oct 2026): his own
  position's price is the best of his positions ("some players will have multi roles"); where the
  slot's priced lower, he gets the slot's lower price; he is natural where the real team sheet put him
  (`docs/pl-match-stats.md`); a sub counts by his own positions; auto-subs take the first bench
  player who can play the area, as now. Other punishments for an extreme shape wait until it plays.
- It reopens three answers: scoring by the slot (`spec/14`), no out-of-position penalty
  (`spec/05`), the areas each position can play (`spec/06`). The site owns it (`spec/14`).

## Suggested, not yet picked

| What | Why |
|---|---|
| History | Past seasons, champions, league records; where awards live after Mail files them |
| The manager's profile | A record across every league on the platform |
| What each category counts | Every manager can read the scoring on Player scoring (`spec/14`); a glossary there of what each category counts |
| Your account | Display name, email preferences, your leagues; leaving a league; deleting the account |
| Going on holiday | CM's holiday: the manager switches the auto team on himself until a gameweek he names (`spec/09` lets him switch it on; the end date is the new part) |
| Match rating and Man of the Match | CM's Av R and MoM: a 1–10 rating from his points against his area; MoM the top scorer in each head-to-head |
| Saved tactics | FM's: a few formations kept to switch between, say one for a double gameweek |
| Gameweeks to come after a team joins at a split | Once begun, a gameweek's fixtures are fixed (`spec/13`). Open: how the gameweeks still to come are drawn when a team joins at a split (`convex/table/playedFixtures.ts`, `scheduleAround`); goes with the split season above |
| A league's deletion email past the day's email limit | Managers are told only once a league is gone (`spec/13`). One the 100-a-day limit stops is never told: retried, or left? Craig left the old warnings as they were for the beta (22 Oct 2026) |
| Commentary pricing scope | The matchup prices lines for men in its two lineups, bench included (#44); spec/10 says "for a player owned in the league". Open: every owned man or the two lineups; own goals priced; whether minutes bands get threshold lines ("~1' Saka: 1 minutes") |
| Trade review letters | `spec/08`'s 24-hour veto and vote windows: does the commissioner or each voter get a letter to act on, and does a blocked or expired review file one (`spec/16`)? |
| Trades with the auto team, and when the vote ships | `spec/09` pauses trades for a team on the auto team; `spec/08` doesn't say so. Trades come by August "with the veto": does the league vote come then too? |
| One player on several teams | Not now; maybe later (Craig, 20 Oct 2026). A draft is normally one owner per league; some leagues do one per division. The draft, waivers, trades and "owned in the league" all assume one owner |

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
