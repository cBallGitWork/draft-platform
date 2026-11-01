# To grill

**Contents:** [Picked by Craig](#picked-by-craig) · [Suggested, not yet picked](#suggested-not-yet-picked) · [Smaller pages, from Fantrax](#smaller-pages-from-fantrax) · [Keeping this list](#keeping-this-list)

Things Craig wants, or might, that no `/grill` has settled yet (from 16 Oct 2026). None of it is
the product until a grill puts it in [SPEC.md](../SPEC.md); then its line here goes. A suggestion
Craig hasn't picked says so.

## Picked by Craig

Each with the questions its grill starts from. The questions are Claude's.

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

**Status chips' data**: the squad table, the player card (`docs/design/plate.md`, Tables and panels).
- Craig wants CM's chips after a name (1 Nov 2026: "i like a CM like red/yellow cross/card for
  suspension etc"). Which FPL statuses each chip reads: injured, suspended, a knock.
- "One booking from a ban" needs the competition's yellow-card thresholds, held per competition as
  data, and a count of each player's bookings. Wanted now, or after the beta?

**Premier League club pages**: `spec/18`, *After the mini beta*.

**Cups and a plate**: after the beta (SPEC, *Later*; Craig, 20 Oct 2026). The plate here is a
competition, not the design plate (`docs/design/plate.md`).
- Who plays the plate: everyone knocked out of the cup, or the bottom of the table.
- Whether a plate win can earn next season's first pick, so losing never pays (commissioners set
  the draft order anyway, `spec/04`).
- Rounds, legs and ties, against the double-gameweek rule (`spec/03`). Draft Fantasy's cups and
  US consolation brackets: `docs/research/draft-competitors.md`.

**Formations, classics and team tactics**: the Tactics tab (`spec/05`). Craig, 1 Nov 2026:
"formation presets that include sweeper/liberio too", "also formations with 2 at the back",
"scoring itself not improtant right now".
- Presets with a sweeper or libero (the defence's centre cell, `spec/05`), and presets with two at
  the back. Which shapes; a two-at-the-back shape only fits a league whose defence minimum is two
  or fewer.
- Classics: "add the particular roles for each (newcastle keegan, both wide mids whip in
  crossers, strikers going for hearders, cb and both cms attack)". Which classics. Whether the
  default roles cover them: there is no attacking centre-back role yet (stopper, ball-playing).
  Whether a manager can change a classic's roles once picked, and if so whether it's still that
  classic.
- Team tactics: "each formation needs a couple of team tactics, both attach and defence". Is
  this the second release's team instructions (SPEC.md) brought forward? Picked and shown now,
  scoring later? Does each formation get its own few, or do they share one list? One attacking
  and one defensive tactic picked at once?
- Placing players freely: "im also thinking allowing the manager to just custom pick postions is
  a bad idea, or can we make it work?" `spec/05` allows any free cell today (built, #851). Keep
  that, allow presets only, or allow moves only where the shape still matches a preset?

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

**A project manager tool**: for how we build, not the game (Craig, 27 Oct 2026: "a tool where
can define what you're building add project scaffolding to mvp and audit what agents actually did
to get you there"). It lives in this repo; the rest is open.
- What we hand-built here, made into one tool: defining (`SPEC.md`, `/grill`),
  scaffolding (CLAUDE.md, hooks, `/verify`) and auditing (`pr-reviewer`).
- Who it's for: Craig across his own projects, or other people too.
- Its shape: files and skills copied into each repo, a command-line tool, or a web app.
- What auditing checks first: the spec against the tests (#454), work beyond what's been
  grilled, the hard rules, or a readable log of what each agent session did and why.

**Two colour and live-screen cards, from the ideas board**: Craig left the pick to Claude
(31 Oct 2026: "Your call on cards"). The design research page behind them:
https://claude.ai/artifact/UJC3f6ixFg3ZUQzBuEPiVq. The palette, club colours and crests were
grilled on 31 Oct 2026 (`spec/12`; crests in SPEC.md, *Later*); these two are low priority until
the site works (Craig, 31 Oct 2026).

**Colour that means something** (https://trello.com/c/kt83WyFm).
- Which of these: W/D/L form squares (league home shows each team's form already, `spec/12`), a
  colour per position line, points shaded by band.
- Where a band's edges come from, if points are shaded by band.

**Vidiprinter strip, score box, every matchup on one live screen**
(https://trello.com/c/Ep5eR42z).
- League home's matchday mode already has every head-to-head moving and a league-wide vidiprinter
  (`spec/12`). What the card adds beyond it: a strip of every match's lines, not only those that
  move a head-to-head; a score box, and where; a live screen of its own, or league home is enough.

**Team colours on the page** (Craig, 1 Nov 2026: "i notice on fm that they plates change colour
depeding on team… go on my draft team and ive got primary colour of purple, or go to see
liverpools team, and it goes red and white"; then "put on to do list").
- Which surfaces take a team's colours: the page's team header and a stripe only, or the title
  plates too. Today `spec/12` says the player card's title plate stays the plate's colour, and
  plate.md's contrast figures are all measured on indigo.
- The meaning colours (yellow figures, cyan readings, orange events, the difficulty fills) never
  sit on a team colour? Text on one is white or black by contrast, falling back to indigo below
  4.5:1?
- A matchup shows two teams: a split header, and what happens when their colours are close.
- Managers' own team colours: who picks them (the manager, the commissioner), when (with crests,
  SPEC.md *Later*), and stored on the team. Once managers have picked, it can't simply be taken
  back.
- Premier League clubs' colours come from the admin's club colours (`spec/15`).

**Overriding any player's or team's score, in any gameweek**: "should be for indovoduals players
or a team score in any gameweek, fantrax has this, i can override any player score or any team
score from any week," (Craig, 1 Nov 2026; #903). Today `spec/14` has one player's points for one
match, overridden by the commissioner.
- Who can override a team's score: the admin, the commissioner, the co-commissioner.
- A team's override: its gameweek total, or one head-to-head's score; does it move the table, and
  does a later re-score or stat correction leave it standing?
- "Any week": a gameweek already final included, against a final gameweek's saved total
  (`spec/07`) and patches never touching a played gameweek (`spec/14`)?
- A player's override in a match that hasn't locked yet: allowed, or only once it locks (as built,
  #439)? Overriding him twice replaces the first; is there an undo?
- A player the football data has lost (#812): can he still be overridden?
- Where the form lives: the player card only (as built), or the matchup and the team too.
- Fantrax's Commissioner fixes (Smaller pages, below) may be part of this.

**Who's doubtful, on Tactics**: "obv we need that for tactics too" (Craig, 1 Nov 2026, on
Continue taking a manager to Tactics before the deadline so he can adjust his lineup).
- What marks a doubtful or out player: FPL's chance of playing (held per player), its reason
  ("Back injury - Unknown return date"), a blank gameweek, or all three.
- Where it shows: the pitch's starters, the bench, the squad list, or all of them.
- Whether its levels (75%, 50%, 25%, out) each look different, and what a phone shows.

## Suggested, not yet picked

| What | Why |
|---|---|
| History | Past seasons, champions, league records; where awards live after Mail files them |
| The manager's profile | A record across every league on the platform |
| Where fixture difficulty comes from | The screens show it (plate.md, Fixture difficulty) but nothing holds it. FPL's fixtures feed carries a difficulty per side (`team_h_difficulty`, `team_a_difficulty` in `tests/support/recorded/fpl-fixtures.json`), which no table stores today; using it, or our own measure, is Craig's call, as FPL is a feed, never the rulebook. Until then its cells are placeholders |
| What each category counts | Every manager can read the scoring on Player scoring (`spec/14`); a glossary there of what each category counts |
| Your account | Display name, email preferences, your leagues; leaving a league; deleting the account |
| Going on holiday | CM's holiday: the manager switches the auto team on himself until a gameweek he names (`spec/09` lets him switch it on; the end date is the new part) |
| Match rating and Man of the Match | CM's Av R and MoM: a 1–10 rating from his points against his area; MoM the top scorer in each head-to-head |
| Stars and a dropped player's role, the gaps (`spec/05` Roles) | Found in review of stars part 2 (#11, 1 Nov 2026). (1) spec/05 still says "until stars are built, on the slot's first role"; stars are now built. (2) When the first lineup is picked again as the squad changes, a player still in the same cell keeps the role he had, and isn't re-picked by stars. That is Claude's reading, not an answer. (3) A player with stars for one of the slot's roles and "?" for another starts on the rated one, also unstated |
| Saved tactics | FM's: a few formations kept to switch between, say one for a double gameweek |
| Gameweeks to come after a team joins at a split | Once begun, a gameweek's fixtures are fixed (`spec/13`). Open: how the gameweeks still to come are drawn when a team joins at a split (`convex/table/playedFixtures.ts`, `scheduleAround`); goes with the split season above |
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
| Waiver order and the can't-drop list, on show | Makes the waiver rules visible |
| Who owned whom | A player's owners, gameweek by gameweek: for history and for his card |
| Mock draft | Practice before the real one |
| Commissioner fixes | Block one team from trading or claiming; adjust the standings |
| Polls | A league vote on a rule change. Check it isn't the chat that's out of scope |
| Help | How the game works, for a new manager |

## Keeping this list

- `/grill` deletes the lines it settles here, in the spec's PR.
