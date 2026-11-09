# To grill

**Contents:** [Picked by Craig](#picked-by-craig) · [Suggested, not yet picked](#suggested-not-yet-picked) · [Smaller pages, from Fantrax](#smaller-pages-from-fantrax) · [Keeping this list](#keeping-this-list)

Things Craig wants, or might, that no `/grill` has settled yet (from 16 Oct 2026). None of it is
the product until a grill puts it in [SPEC.md](../SPEC.md); then its line here goes. A suggestion
Craig hasn't picked says so.

## Picked by Craig

Each with the questions its grill starts from. The questions are Claude's.

**Awards**: history, Mail.
- Manager of the Month and Player of the Season. Team of the Week is off league home: "ditch team
  of the week" (Craig, 1 Nov 2026; `spec/12`).
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

**Overriding any player's or team's score, the rest**: who, what, when, undo and the team
override's place are settled in `spec/14` (Craig, 7 Nov 2026; #903). Still open:
- Whether each player's row on the matchup carries the player override too, as well as his card.
- Fantrax's Commissioner fixes (Smaller pages, below) may be part of this.

**Who's doubtful, on Tactics**: "obv we need that for tactics too" (Craig, 1 Nov 2026, on
Continue taking a manager to Tactics before the deadline so he can adjust his lineup).
- What marks a doubtful or out player: FPL's chance of playing (held per player), its reason
  ("Back injury - Unknown return date"), a blank gameweek, or all three.
- Where it shows: the pitch's starters, the bench, the squad list, or all of them.
- Whether its levels (75%, 50%, 25%, out) each look different, and what a phone shows.

**Formation descriptions**: the formation window shows each formation's and each classic side's
description, and the Guide would too.
- Where a formation's description lives: held with the formation, shown in the formation window
  and the Guide.
- Craig's own words for each: the classics' text is sample until he rewrites it (`spec/05`, The
  pitch), and the modern sides are still to list.

**Where the support striker sits**: `spec/06` has SS, and "Where SS sits is to grill: just behind
the forward, or as a forward (Craig: "maybe its forward?")". On the formation window Craig added
"maybe am becomes a ss (like a the 4-4-1-1)" (1 Nov 2026).
- Does the slot behind the striker in a 4-4-1-1 (and the other classics with one) always read SS,
  not CAM? "no not always, different roles" (Craig, 1 Nov 2026): it depends on the role played
  there, so what decides the label is still open.
- Does SS stay in both attacking midfield and attack (`spec/06`, Areas each position can play)?

**Saved alternative looks**: "gantry is intriguing, save that for now" (Craig, 1 Nov 2026). The
gantry look, drawn while the Tactics pictures were made, waits until Craig goes back over the look
once the pages' structure is designed (`docs/design/approved/README.md`: "once we design all the
apges as in the code/structure im happy to then go back and look at designs again").
- Which screens it would suit, when the look pass comes.

**League home's panels, from its approved picture**: Craig approved the main Home board, and the
other states' boards "as the plan for later" (1 Nov 2026: "yes to all";
`docs/design/approved/home/`). He took FM as the model: "fm and its widgets as inspo". The picture
places these; none says yet what it holds or does, and each is a placeholder until its grill.

**Home's tabs, Overview | News | Calendar**. News was settled on 8 Nov 2026
(`docs/design/approved/home/README.md`, The News tab).
- What Calendar holds: the league's gameweeks and deadlines, the draft, breaks (Break weeks,
  below) and waivers' runs (Run the league, below).

**The deadline strip**: the row of boxes under Home's tabs (GW9 locks, Your lineup, Claims close,
Table).
- Which boxes, and whether they change with the season's state (the pictures change them).
- What "Your lineup" says (the picture: "Saka doubtful"), and whether a box opens anything.
- Claims close needs waivers (`spec/08`), not built yet.

**Mail's Needs you tab on Home**: the Mail panel splits Needs you (3) | All.
- Which letters need a manager: a lineup to set, a trade offer, a claim's result. Is it the same
  list Continue walks through (`spec/12`, The frame)?
- Whether Mail itself gets the tab too.

**The Premier League on Home**: "does home need some of the live footie too?" (Craig, 1 Nov 2026).
The picture lists this gameweek's matches with your players and your opponent's in each.
- Every match, or only those with your or your opponent's players.
- Live scores in matchday mode (the locked picture's Premier League today), or only kickoff times.
- What it adds beyond the Vidiprinter card's live screen (above).

**Your squad news on Home**: the picture lists your players who are injured, suspended, doubtful or
a booking from a ban.
- Which FPL statuses it reads, as Status chips' data and Who's doubtful, on Tactics (above) ask.
- Only your squad, or your starters first.

**Run the league**: a to-do list for the commissioner and co-commissioner on Home. Craig said "ok"
to the lineup count as a number only (1 Nov 2026): "Teams with no lineup yet 3", never whose, as
neither sees a lineup before the deadline (`spec/10`).
- What else is on the list: join requests, waivers to run, the draft order, next season.
- The commissioner's tools move here off Your leagues' rows, where they are built today
  (Gameweeks, Invites and join requests, Squads, League settings, deleting); the approved Your
  leagues picture has none on its rows (`docs/design/approved/leagues/`). Player scoring, on every
  manager's row today, leaves them too: where does it go?
- Whether Fantrax's Commissioner fixes (Smaller pages, below) join it.

**Home through the season**: the boards for each state, drawn as the plan for later, each grilled
when its feature is built (`docs/design/approved/home/`).
- Pre-season and the draft: the draft's countdown, your queue and pick, the empty table (`spec/04`).
- A new joiner: who took over a team, and the page while a join request waits (`spec/13`, Joining).
- The season over: the champions and the final table; the season's end book and honours board
  are in SPEC.md, *Later*; next season goes with *Carrying a league into next season*.
- The Monday after: the gameweek final, its result and the recap (#387).
- When each state starts and ends.

**Break weeks**: "when its international break, we lock everything and give the league a break"
(Craig, 1 Nov 2026; https://trello.com/c/YD6AFJW2).
- Claims, waivers and trades lock too: settled in `spec/13`, Gameweeks (Craig, 1 Nov 2026: "yes").
- Every international break, or the commissioner's pick, as gameweeks are ticked now.
- What Home and Mail say during one (the break picture).

**A league's name on Your leagues opens its League home**: the approved Your leagues picture
(Craig, 1 Nov 2026: "yes to all").
- Does it switch the current league too (`spec/13`, Several leagues)?

**A commissioner changing the rules mid-gameweek**: parked for its own talk (Craig, 6 Nov 2026,
on #454). Rules can change many times a season (`spec/03`); when a change takes effect isn't said.
- Can a commissioner change the league's rules after a gameweek's deadline, with games under way,
  such as clean-sheet points on a Saturday at 16:00? Does the change wait for the next gameweek?
- Can a manager contest a change, and who settles it?

**Classic scoring, a league with tactics off**: a note kept for when it's built (Craig, 9 Nov
2026: "we dont build, we keep this work as a note for when we build"). A league setting turns
player and team tactics off ("essentially classic"), and classic needs a base scoring set. Worked
out in a talk session against five Premier League seasons (21-22 to 25-26) of the
ai-carling-premiership match logs; the numbers there come from FotMob and Sofascore counts.
- Lines, not detailed positions: GK, DEF (CB, FB, WB), CM (CDM, CM, WM), AM (CAM, W), FWD (ST).
  Each player is hard-locked to one line ("dont allow am's to be cm's, just hard lock a player
  into a role").
- Craig's set:

  | | FWD | AM | CM | DEF | GK |
  |---|---|---|---|---|---|
  | Appearance | 1, or 2 at 60+ min | 1, or 2 at 60+ min | 1, or 2 at 60+ min | 1, or 2 at 60+ min | 1, or 2 at 60+ min |
  | Goal | 4 | 5 | 5 | 5 | 5 |
  | Assist | 3 | 3 | 3 | 3 | 3 |
  | Clean sheet (60+ min) | – | – | 2 | 4 | 4 |
  | Goals conceded | – | – | – | −1 per 2 | −1 per 2 |
  | Defcon | – | +1 per 5 midfield stat | +1 per 4 midfield stat | +1 per 4 defender stat | – |
  | Saves | – | – | – | – | +1 per 2 |

  The midfield stat is tackles + interceptions + blocked shots + ¼ recoveries. The defender stat
  is tackles + interceptions + blocked shots + ¼ clearances, Fantrax's DFP. Counted per action,
  never FPL's all-or-nothing +2 ("i dont like their defcon"). No FPL bonus. The super sub (SPEC,
  *Second release*) stays the reward for bench players.
- Goals conceded is there so defenders have a curve: "need defenders on mid table teams to stand
  out from lower tier still" (Craig, 9 Nov 2026). Without it the defcon lifts defenders at poor
  sides, who defend more. With it, a regular defender's season averages 47 at a top-6 side, 36 in
  mid-table and 23 in the bottom six (55, 47 and 36 without), and fewer defenders crowd the top 25.
- Appearance points are the classic 1, or 2 at 60 minutes: "its classic afterall" (Craig, 9 Nov
  2026). A regular sub scores about 59% of a nailed starter's points per appearance; the super
  sub is what makes bench players worth having.
- What it gives over the five seasons, per 60-minute start: FWD 3.65, AM 3.62, CM 3.65, DEF 3.23,
  GK 3.51; goals and assists are about 23% of all points. Defenders are the deepest pool (about
  78 regulars a season), so they sit lowest a start and the best still stand out. The 10th-best
  season by line is FWD 135, AM 153, CM 150, DEF 142, GK 138. Strikers are scarce (about 20
  regulars a season), so a good one is a scarcity pick rather than a big total. Keepers play
  every minute, so the 60-minute point lifts them most: up to 7 of 25-26's top 25. Top of 25-26:
  Haaland 196, Bruno Fernandes 174, Gabriel 170, Rice 165, Raya 163, Semenyo 163.
- Why lines and one line each: a player is scored by the slot he plays in (`spec/14`). With
  detailed positions, any slot that paid more for the same player (a deeper slot's clean sheet or
  defcon) drew attackers back; in the data no stat tells a W from a WM, or a CM from a DM.
- Questions for the grill:
  - Cards, own goals, missed and saved penalties: the talk assumed FPL's -1, -3, -2, -2 and +5.
  - How a player's one line is chosen (his most-started line, over what window), whether it can
    change mid-season, and whether the admin can override it.
  - Classic's lines against `spec/06`'s "the same in every league": a new rule on top of the
    positions, or a change to them.
  - The rates checked again against the Premier League feed once it's recorded, and whether that
    feed sends recoveries and blocked shots.

## Suggested, not yet picked

| What | Why |
|---|---|
| History | Past seasons, champions, league records; where awards live after Mail files them |
| The manager's profile | A record across every league on the platform |
| Where fixture difficulty comes from | The screens show it (plate.md, Fixture difficulty) but nothing holds it. FPL's fixtures feed carries a difficulty per side (`team_h_difficulty`, `team_a_difficulty` in `tests/support/recorded/fpl-fixtures.json`), which no table stores today; using it, or our own measure, is Craig's call, as FPL is a feed, never the rulebook. Until then its cells are placeholders |
| What each category counts | Every manager can read the scoring on Player scoring (`spec/14`); a glossary there of what each category counts |
| Your account | Display name, email preferences, your leagues; leaving a league; deleting the account |
| Match rating and Man of the Match | CM's Av R and MoM: a 1–10 rating from his points against his area; MoM the top scorer in each head-to-head |
| Stars and a dropped player's role, the gaps (`spec/05` Roles) | Found in review of stars part 2 (#11, 1 Nov 2026). (1) spec/05 still says "until stars are built, on the slot's first role"; stars are now built. (2) When the first lineup is picked again as the squad changes, a player still in the same cell keeps the role he had, and isn't re-picked by stars. That is Claude's reading, not an answer. (3) A player with stars for one of the slot's roles and "?" for another starts on the rated one, also unstated |
| Deadline stars lost to a failed keeping (`spec/05` Auto-subs) | Found in review of stars part 3 (#11, 1 Nov 2026). Each team's bench stars are kept at the deadline and asked for again until one of the gameweek's matches locks. If the keeping fails and a match locks before it succeeds, that gameweek's auto-subs play the slot's first role for good. Is that right, or should a later keeping use the stars as they stood at the deadline some other way? |
| Gameweeks to come after a team joins at a split | Once begun, a gameweek's fixtures are fixed (`spec/13`). Open: how the gameweeks still to come are drawn when a team joins at a split (`convex/table/playedFixtures.ts`, `scheduleAround`); goes with the split season above |
| The draft's start, the gaps (`spec/04` Starting it) | Found in review of the draft's start (#1089, 4 Nov 2026). (1) Answered on #1102: the commissioner gets a letter (`spec/04`). (2) The approved draft room picture says "Random, drawn Mon 3 Aug", but nothing is drawn on its own now; it needs redrawing in a `/design` session Craig watches ("Redraw it soon", 5 Nov 2026, on #1130). (3), (4) and (5) answered on #1130: "Draw at random" stays on League settings; the rounds and the squad rules count a waiting change (`spec/04`); a vacated team can be handed over after the start |
| Draft picks in Mail (`spec/04` The picks) | Found in review of a manager's pick (#1090, 4 Nov 2026). A pick is filed as an assignment, by the manager who made it, so Mail reads "Ann put Saka on Team 1" and the team's transactions say "assigned"; there is no "drafted" wording. What should a pick say in Mail and the transactions? |
| Where the admin marks an abandoned match (`spec/05` Auto-subs) | The feed marks it and the admin can when the feed doesn't (Craig, 7 Nov 2026, #904), but where he marks it (the feeds page, the admin dashboard, the match page) isn't said |
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
| Waiver order and the can't-drop list, on show | Makes the waiver rules visible. Waiver priority "can be in its section, or a sub header" (Craig, 1 Nov 2026), so not on Home's deadline strip |
| Who owned whom | A player's owners, gameweek by gameweek: for history and for his card |
| Commissioner fixes | Block one team from trading or claiming; adjust the standings |
| Polls | A league vote on a rule change. Check it isn't the chat that's out of scope |
| Help | How the game works, for a new manager |

## Keeping this list

- `/grill` deletes the lines it settles here, in the spec's PR.
