# SPEC

**Contents:** [What it is](#what-it-is) · [Features](#features) · [Second release](#second-release) · [Later](#later) · [Out of scope](#out-of-scope) · [Glossary](#glossary)

Craig's answers from his `/grill` sessions (from 16 Oct 2026), and nothing else. A feature's detail is
settled by its own `/grill` before it is built, and lands here.

## What it is

A new fantasy draft product for the Premier League, made for many leagues. It is a
draft/EPL/Football Manager hybrid with real tactics: formations and roles change how a player
scores, so a player's value depends on the team he is in. A salary cap is part of the idea, and
it is the first thing cut if scope has to shrink. Web first, free for now, and a closed beta in
which Craig sets the leagues up; long term, anyone can. Live by August 2027 would be nice, but
it can go live at any time. The Tim Hortons Pro League is the first league on it. A goal: a mini
beta in the 2026/27 season, with no hard date: as early as it's ready (Craig, 17 Oct 2026). It
irons out kinks: a quick league of about four, with players assigned to teams rather than
drafted, for the basics. It needs:
features 1, 2, 3, 5, 6, 7, 10, 12, 14, 16 and 18, and the admin tools listed in
[spec/15's The mini beta](spec/15-admin-tools.md#the-mini-beta). Live commentary and the match
page (10) are in it if the live stream is proven, and among the first things dropped if late.
The draft (4) waits for the summer. Before it starts, FPL's and the Premier League's terms are
checked (Craig, 20 Oct 2026; issue #79).

## Features

One file per feature in [spec/](spec/); this page is the index. A feature's status lives only in this table.

| # | Feature | Status | Checked by |
|---|---|---|---|
| 1 | [Leagues](spec/01-leagues.md) | the admin creates a league and names its commissioner (#24); it starts from the admin's default rules (#25); the platform's own rule sets come later | a league created from a ready-made rule set carries every rule in it |
| 2 | [Sign-in](spec/02-sign-in.md) | built, awaiting the live email proof | an email on the allowed list gets a link that works once within the hour; one not on it gets the same reply and no link |
| 3 | [League rules](spec/03-league-rules.md) | each league's rules held as data, changed from the next gameweek (#25); Player scoring built, the site's scoring for every league, read by all and edited by the admin (#30, #354); League settings built for the odd team out, games a gameweek and the squad's make-up (#341); a save over someone else's is refused; the first scoring set is FPL's (spec/14) | the same week's table differs under two leagues' League settings, and every league scores it by the site's set |
| 4 | [The draft](spec/04-the-draft.md) | not built | a timed-out pick takes the queue's best available player, then the default ranking's |
| 5 | [Tactics](spec/05-tactics.md) | the pitch, twenty-one presets and the check of whether a lineup may stand (#8), the deadline (#9), a saved lineup (#8), and before one is saved the team's first lineup, a 4-4-2 picked from its squad (#637), each pick going onto the pitch as it is made, the first preset the squad fills when the 4-4-2 can't be, and a pick with no positions kept on the bench (#836), but not yet "then any shape" or a league whose limits rule out a 4-4-2 (#866), and the Tactics tab's pitch, placing players, the bench and the save, with the countdown, the bench order, set by up and down or by dragging, and the presets, which reshape the pitch keeping the players (#14), built; moving by tap, where a picked-up player's free cells and swaps light up under the area limits, swapping, each move saving itself in place of the Save button, and Undo back through every move since the tab was opened (#851), built; each slot's roles, picked for each starter and shown on the pitch (#10), built; role adjustments scored, once a patch brings them, from Claude's draft (#10), built; and the role's line on the player card (#10), built; not yet the admin editing role adjustments, which waits on the patch screen (#368), stars (#11), auto-subs (#12) beyond scoring the table; squad numbers a manager gives, on the Squad tab and the pitch, built (#13), the pitch's shirts in each club's colours, a keeper in its second, built, but not yet real club numbers to start from, which wait on the Premier League feed being recorded; not yet a removed role's starters moving to another role (31 Oct 2026); the sweeper, his roles offered in the defence's centre cell and drawn a little deeper (#844), built; spec'd, not yet built: stars on the lit cells (#11), Quick Pick, the pitch's chips, position labels (SW included, #857) and opponents, runs and the role card (31 Oct 2026) | the same player and match score differently in two roles, and an empty slot is filled by the first fitting sub |
| 6 | [Positions](spec/06-positions.md) | positions from real starts, labels and the admin's say built on the server (#22), and the admin dashboard: the queue, approving a club, how starts count and correcting any player (#126), and the admin's thresholds and positions changing with a role (#235) built; nothing runs the sync on a schedule yet | a player flagged, then losing a position, at the admin's thresholds |
| 7 | [Scoring](spec/07-scoring.md) | a match's stats priced under a scoring set (#29), finished matches' stats read and locked (#27), late ones every 10 minutes (#513); each team's gameweek scored from its lineup, which every team has (#637), auto-subs and the site's set, live and provisional until its matches lock, into the table (#29), and stored once they all have (#418) | a finished match's points match the league's rules for every category |
| 8 | [Between gameweeks](spec/08-between-gameweeks.md) | not built | waiver claims resolve in priority order before free agency opens |
| 9 | [Season admin](spec/09-season-admin.md) | the round robin over the gameweeks a league plays, the odd team out and the football table built (#33), and a gameweek's fixtures stored once it begins (#137); matchups scored and counted in the table, a gameweek that can't be scored named with why (#29, #287); not yet the commissioner editing fixtures or the auto team | an illegal lineup at the deadline is fixed by the auto team |
| 10 | [Live matchday](spec/10-live-matchday.md) | stats read every minute during a match (#28); points move in the table during a match, marked provisional until it locks (#29); the matchup on screen, live, both lineups once the deadline passes, auto-subs shown and the bench greyed (#34); the matchup's vidiprinter, each line priced for the two lineups' men, with threshold lines and "Commentary delayed" (#44, #46); the match page from the team sheets about an hour before kickoff, with every man's points and an owned man's team, the others reading "Free agent" (#771), the priced commentary and its five team stats, opened from the Premier League's fixtures and from a player's status on the matchup (#45); every player's lines priced, owned or not, bench included, own goals priced, and a line for every point movement up or down: minutes, clean sheets, goals conceded (#835); not yet each starter's role on the matchup's lineups, or a player's breakdown from the matchup; not yet the match page's scoreboard in club colours (31 Oct 2026) | points move during a match and are marked provisional until it is final |
| 11 | [Email](spec/11-email.md) | not built | on a pick clock over 10 minutes the manager on the clock gets one email; under it, none |
| 12 | [Screens](spec/12-screens.md) | the frame and sign-in (#19), your leagues (#24), Mail and its count in the menu (#26), table and fixtures (#33), invites (#73), gameweeks (#74), squads (#31), Player scoring (#30), League settings (the odd team out, games a gameweek and the squad's make-up, #341), the admin dashboard (#126), the top bar's Feedback link (#357), the patch banner and Patch notes (#356), and the player card, opened from Scouting, its shortlist, the squads page and My team's Squad and Transactions tabs, each match at his base points, each category's line saying why and the version it was scored under (#797), a switch for a player with more than one position, and his role's line when his team started him (#10, #560), without last season's line, its stars and report, or its other actions (a scout, claim or drop, a trade; #381), league home's glance, squad moves and pinned letter, not yet its matchday mode, Team of the Week or recap (#387), My team's Tactics tab, with the bench order, presets, roles and shirts in club colours, but not yet the role's line, stars or Mail down the side (#14), its Fixtures tab, each game's result as the table scores it, live while provisional, opening its matchup (#365, #436), its Transactions tab, the commissioner's assignments, moves and releases until claims and trades exist (#366), its Squad tab, each player's points what his team got from him (#364, #595) and his squad number to change (#13), the matchup, opened from the table's fixtures, league home's head-to-heads and My team's Fixtures tab, with its vidiprinter (#34, #46), and the Premier League's fixtures and results beside its table, each opening its match page (#49, #50), and the match page, opened from them and from a player's status on the matchup, with its five team stats and both team sheets from about an hour before kickoff (#45) built; spec'd, not yet built: the rest of My team's Tactics tab (the role's line, stars and Mail down the side, #10, #11, #14), trades (after the mini beta), the draft room (waits for the summer) and club pages (after the mini beta); not yet club colours beyond plain shirts: striped shirts, the club mark (31 Oct 2026) | a signed-in manager lands on My team, with Mail's unread count in the menu |
| 13 | [Setting up a league](spec/13-setting-up-a-league.md) | leagues, teams and who runs them (#24), joining (#73), the gameweeks it plays (#74), deleting (#75), switching leagues (#76) and deletion emails past the daily limit waiting for the next day (#837) built | a league of four fills from two emailed invites and two approved join requests |
| 14 | [Scoring categories](spec/14-scoring-categories.md) | the catalogue (placeholder names), pricing by area or position, points limits and minutes (#111), own stats (#112) and the first scoring set, FPL's (#25), built on the server, and the rules editor (#30), but not yet making an own stat in it (#262); the site owns the set, kept in versions by gameweek, and every league plays on it (#354), changed by patch with a week's notice or by fix on the server (#355), each announced by a Mail letter to every manager, with the banner and the patch notes (#356), but not yet the admin's patch screen (#368); a commissioner's score override of one player in one match, from his card, re-scoring the gameweek with a Mail letter to the league (#32); a league's matches are scored for its table (#29); each category's points with why, which the player card's breakdown says (#797); not yet the rule balance lab (31 Oct 2026) | a match's stats priced under a set of rules give each category's points and the total, by the slot's area or position, within each rule's points limits |
| 15 | [Admin tools](spec/15-admin-tools.md) | creating a league and naming its commissioner (#24), inviting managers (#73), assigning players (#31), the positions dashboard (#126) and the feeds page (#35) with a failure email to the admin (#319), its team sheets before kickoff, team stats and threshold lines each a feed (#522), and managers' feedback on the dashboard (#357) built; removing a manager on the invites page, and a manager leaving from the top bar (#134); renaming teams, the maximum and the co-commissioner only from the CLI, and editing the scoring set (#30); the score override, from the player card, the admin's as the commissioner's (#32); not yet the admin's log; not yet the admin owning club colours, with a club missing them in the queue (31 Oct 2026) | a commissioner's assignment puts the player on the team and files a Mail letter to the league |
| 16 | [Mail](spec/16-mail.md) | the letter store, letters about a league's events, the commissioner's letter, the Mail screen and its count built (#26), and letters from the site to everyone, such as a scoring patch (#356); down the side of My team not yet (#14); each feature files its own letters | a claim, a drop and a trade each file one letter for every manager in the league |
| 17 | [Captain and set pieces](spec/17-captain-and-set-pieces.md) | after the mini beta | the first on a set-piece list who plays earns the duty's adjustment for the whole match, and no one else on the list does |
| 18 | [Premier League](spec/18-premier-league.md) | fixtures and results built, a gameweek at a time with live scores, each opening its match page (#49, #45); the table beside them, worked out from the held results, live and marked provisional while a match is being played (#50); not yet the club mark in the table (31 Oct 2026) | a goal in a live match moves the Premier League table at once, marked provisional |
| 19 | [Scouting](spec/19-scouting.md) | the players list, in the menu in place of Players, filtered by who holds a player, his position and his club, sorted by name, club or season points, any catalogue stat shown as a season total and sorted by, and any two ticked compared side by side, built (#373); season points read "—" because Scouting doesn't fill them yet (#525), and role fit waits on stars and scouts (#11, #375); the shortlist, built (#374): a manager adds a player from his card and takes him off there or on Scouting, and Mail tells him when one is released; not yet a letter when one clears waivers (spec/08) or feeding the draft queue (spec/04); scouts after the mini beta; the stat race's team season totals built (#808), its screen not yet (#800) | a scout's report is ready 24 hours after he is sent, and no other team can tell who was scouted |
| 20 | [Going live](spec/20-going-live.md) | the release (#517), the backup before a change to saved data's shape (#518), the after-release sign-in check (#517) and the setup command (#519) built; going live waits on Craig's setup run in docs/setup.md (#511, #512, #514) | a merge to `main` is live on `fantasydraftmanager.net` with its server code, and the check after it signs in there |
| 21 | [Player news](spec/21-player-news.md) | after the mini beta | an article about one player gives one note on his card, dated and linked to it, naming nothing of our game |

## Second release

- Team instructions on top of formation and roles. One can target an area (a high press: forwards
  score more for tackles won and interceptions) or the whole team ("get stuck in" rewards everyone).
- The super sub, as a league rule: a bench player who scores extra if he comes on in the real
  match, which makes bench players worth having.

## Later

- **The salary cap**, the first thing cut if scope must shrink.
- **The market**, its own feature with its own `/grill` when the salary cap comes in. Craig's
  ideas so far, not decisions: free agents take a signing-on fee and higher wages, waivers take a
  fee, trades can involve money, and the market could take a more footballing form, like a
  transfer market. Auction drafts and bidding waivers go with it.
- **Payments**, its own feature.
- **League home's later ideas**, in Craig's order: fixture of the week, talking points, power
  rankings, title race and season phases, lineups in, Manager of the Month, rivalries, records
  board, honours board, the season's end book, AI voices (spec/12).
- **A trade block**: players a manager will listen to offers for, shown to the league (spec/08).
- **Scouting searches**: a scout sent to find a kind of player ("a CAM under 25"), not only one
  player (spec/19).
- **Saved views** on Scouting's players list (spec/19).
- **Another team's My team tabs**, read-only, for scouting rivals (spec/12; `docs/to-grill.md`, Every squad on one page). Before the deadline they show his squad, never his lineup (spec/10).
- **Makeshift positions**, after the rest is built: a player outside his areas, at a penalty, so a
  good side's forward isn't parked at the back for easy clean sheets. Craig's starting point, "a 2
  area rule": his own area and the next, no further (spec/05; `docs/to-grill.md`).
- **Cups**, after the beta, with a plate competition beside them (Craig, 20 Oct 2026). Their
  own `/grill` then (`docs/to-grill.md`).
- **Other leagues**: Scotland and the rest of Europe. None has a free public feed like the
  Premier League's; a paid feed (Sportmonks, API-Football) covers them all. The football data is
  built so a feed can plug in.
- **Licensed data**: a licensed feed if FPL's and the Premier League's terms, checked before the
  mini beta (above), don't allow a public product.
- **Traits** (what a player does in real life), if a source for them turns up.
- **A landing page** for the public, when signups open to anyone; its own `/grill` then.
- **Carrying a league into next season**, a different thing from spec/03's carry-over rule
  (redraft, keeper, dynasty).
- **Archiving a league**: deleting is for good for now (`spec/13`).
- **A player's card across a move**: his matches before he changed teams show what his old team
  got from him; a move changes only his owner, never his history (Craig, 28 Oct 2026; spec/12).
- **A matchup's saved totals when its detail can't be worked out**: the totals the table shows,
  with the player-by-player detail marked unavailable, in place of "can't be scored" (Craig,
  29 Oct 2026; spec/07).
- **Player news**: a note on every player, from his matches and from real news (spec/21).
- **Preview sites** for unmerged changes (spec/20).
- **A staging site**, if real leagues arrive (spec/20).
- **A team's total explained** on the matchup: who started, and who came off the bench for whom
  (spec/10).
- **A lineup graphic** at the deadline, AI-made, like the team sheets clubs post on social media
  (Craig, 31 Oct 2026; spec/10).
- **A crest for each team**: "i just think this is low priorituy when the site
  doesnt work yet" (Craig, 31 Oct 2026). His answers so far: an AI crest builder ("why dont we just
  make this an ai builder rather than a shield?"), a few words and two colours giving four crests in
  one house style, kept or remade, at most 20 makes a team a season; uploads too ("fantrax allows
  uploads"); until one is made, a drawn shield in two colours no other team in the league has; the
  commissioner can remove any; shown before the team's name in the table, league home, the matchup
  and the league list, the matchup's sides on their teams' colours; set on a Club tab of My team.
  The image service is his pick when it comes; Claude's research found Recraft the fit (not
  picked). A team's kit, nickname and
  fans' name come after it; its ground goes with our own home stadiums (`docs/to-grill.md`).
- **Real shirt packs and away kits**, which the admin owning club colours leaves room for
  (spec/15, 31 Oct 2026).
- **A colour-blind setting**: "lets not focus on colour blind, we can have a colour blind setting
  later" (Craig, 31 Oct 2026).

## Out of scope

- The paper and player intel from the companion. It is a new product, not a companion app.
- Chat. Managers talk elsewhere.
- Push notifications and native apps.
- Storylines (morale, contracts, conduct).
- Two roles per player (in and out of possession, as in FM26).
- A captain's points multiplier: the captain leads by example instead (spec/17).
- A line in the commentary for an auto-sub: whether a player played is known only after his match (spec/10).
- Fixture-difficulty colours, and a count of owned players, on the Premier League's fixtures (spec/18).
- A role penalty for playing out of position.
- Injured reserve.
- A limit on auto-subs, or a switch to turn them off.
- Public league pages: no league is visible without signing in.
- FPL's bonus points, and any scoring set for a league to pick: there is one set, the site's,
  changed by patch (spec/14, 25 Oct 2026). It starts from FPL's values as a draft Craig changes.
- A limit on a player's whole match, or on a team's gameweek total.
- A lock at each player's kickoff: there is one deadline per gameweek.
- A squad ceiling above a Premier League squad's 25 (spec/03).
- A maximum per area in a squad: above each area's minimum, a squad holds whatever its manager likes (spec/03).
- Warning managers before a league is deleted: they hear once it is gone (spec/13).
- A league's own scoring: the site owns the scoring set and patches it (spec/14).
- A commissioner's own stats: only the admin makes one (spec/14).
- Emailing a patch: Mail and the site banner announce it (spec/14).
- Hiding public stats until a player is scouted: scouting rations judgement, never numbers
  (spec/19).
- Showing other teams who a manager scouts (spec/19).
- A league home each manager rearranges: we design it (spec/12).
- A page of a player's older news notes: his card shows his three latest (spec/21).
- A note on a bench player's breakdown that he's on the bench: the pitch shows it (spec/10).
- The commissioner or the admin seeing a lineup before the deadline (spec/10).
- A position label that names a side on the pitch: a label names the position only (spec/05, spec/06).

## Glossary

| Term | Meaning | Avoid |
|---|---|---|
| team | a fantasy side: a manager's draft team | |
| base points | what a player earns from the site's scoring set for what he did, as in FPL: so many for a goal, an assist, a clean sheet | |
| role adjustment | the points a starter's role adds or takes on top of his base points, per action (+1 a key pass, −1 a clean sheet) | role bonus, multiplier, pays, paid |
| earns, loses | what a player does with points | pays, is paid |
| run | where a starter's role goes as if in a real match, drawn as a dashed arrow on the pitch; it never changes points | lean |
| chip | the coloured label under a shirt on the pitch, or at the start of a squad list row | plate, badge |
| role card | the card that opens from a starter's role: every role for his slot, with his stars, what each scores more and less for, its description and his recent matches under it | role picker, drop-down |
| scout | one of a team's scouts (three, a number the site sets), sent to one player; the report is ready 24 hours later | |
| report | a scout's judgement on a player, in a few plain sentences | |
| shortlist | a manager's own list of players for the season | watchlist |
| patch | a new version of the site's scoring set, named like 26_27.1, announced a week before it takes effect | update |
| manager | the person who runs a team | player (for a person) |
| admin | Craig, running the whole platform | |
| commissioner | the person who runs one league, with or without a team in it | |
| co-commissioner | a league's second person, named by the commissioner or the admin, with the commissioner's powers except naming or removing either and deleting the league | |
| invite | the email a commissioner sends one person, carrying their sign-in link and the team it's for | |
| invite link | a league's one shareable link; opening it only asks to join | |
| join request | what opening the invite link makes, for the commissioner to approve or refuse | |
| club | a real Premier League club | team |
| club mark | the small square in a club's two colours before its code (spec/12) | badge, crest |
| position | where a player can play in real life (CB, FB, CAM, W); no side. A slot has one too, from its area and lane (spec/14) | right back, left winger |
| admin dashboard | the admin's one screen: the positions queue and corrections, thresholds, and the feeds page | |
| role | what you tell him to do in your slot, which changes his points | |
| trait | what he does in real life (inverted full-back, cuts inside) | style |
| slot | a place in your formation | |
| area | a band of the pitch a formation is built from: goalkeeper, defence, defensive midfield, midfield, attacking midfield, attack | line |
| lane | one of five columns across an area: left, left-centre, centre, right-centre, right | |
| deadline | the one moment each gameweek that locks every lineup | lock time |
| formation | how a lineup stands on the pitch's grid, preset or placed freely | shape |
| preset | a ready-made formation, such as 4-2-3-1 | |
| category | one stat a league can score, such as goals or tackles won | |
| own stat | a stat the admin makes for the site's set by adding catalogue stats with weights | custom stat, formula |
| points limit | a rule's maximum or minimum points for one player in one match | cap (that is the salary cap), floor, ceiling |
| short code | a category's abbreviation in dense tables: G, A, CS, KP, TW | |
| lineup | a team's starters and bench for one gameweek | |
| squad | every player a team owns | |
| starter | a player in the lineup's eleven | |
| bench | the lineup's players who don't start, in the order auto-subs use | subs |
| draft league | a league on the platform, such as the Tim Hortons Pro League; on screen, "draft league" wherever the Premier League could be meant. "League" alone in the spec means one | fantasy league |
| Premier League | the real competition, and the menu section of that name | league (alone) |
| match | a real Premier League match | |
| matchup | a head-to-head between two teams in one gameweek | match |
| commentary | the short lines that report a match or a matchup as it is played | feed (that is the data source) |
| vidiprinter | the matchup's running list of commentary, newest first | |
| gameweek | one round of Premier League fixtures, as FPL numbers them | period |
| best match | in a double gameweek, only his higher-scoring match counts | best ball |
| auto team | the app setting an absent manager's lineup | |
| super sub | a bench player who scores extra if he comes on in the real match | |
| the market | money in the game: salaries, fees, wages, money in trades | |
| Mail | the inbox in the app | email |
| email | a message sent to a manager's own inbox | Mail |
| captain | the starter a manager picks to lead by example, whose own scoring the armband changes | skipper; armband (for the person) |
| vice-captain | the starter who takes the armband if the captain doesn't play | |
| club captain | the real club's captain, shown as a hint | captain (for the real one) |
| set-piece list | a manager's order of up to three players for one duty: penalties, free kicks or corners | |
| set-piece taker | the player holding a duty in a match: the first on its list who plays | |
| note | one item in a player's News: a match note or real news, dated and linked to its source (spec/21) | blurb, snippet |
| squad number | the number a manager gives a player, shown on his shirt ("shirt number" means the same) | |
