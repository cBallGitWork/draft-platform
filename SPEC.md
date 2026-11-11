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
The draft (4) waits for the summer.

The football data comes from Sportmonks, a paid feed, in place of FPL's and the Premier League's
public APIs: "stop with fpl and prem, thats not scalable" (Craig, 9 Nov 2026, on #1196). Its
Starter plan's five leagues: England, Scotland, Italy, Spain and Germany ("not france, germany").
Sportmonks replaces everything those two feeds give (clubs, players, fixtures, team sheets, live
stats, commentary, the table), and players are keyed on Sportmonks' player id, with FPL's `code`
kept only to match past seasons copied from ai-carling-premiership. Points move during the match.
xG isn't needed. Its free plan's Scottish Premiership is read first (#1391), before the 14-day
paid trial and the switch ([spec/20](spec/20-going-live.md)).

The beta plays on the Premier League and the Scottish Premiership, "so we can handle multi
leagues" (Craig, 9 Nov 2026, on #1196). A league plays one or more of them and drafts
from those it picked, each player on one team only (Craig, 10 Nov 2026, on #1196: "we can mix and
match").

## Features

One file per feature in [spec/](spec/); this page is the index. A feature's status lives only in this table.

| # | Feature | Status | Checked by |
|---|---|---|---|
| 1 | [Leagues](spec/01-leagues.md) | the admin creates a league and names its commissioner (#24); it starts from the admin's default rules (#25); the platform's own rule sets come later | a league created from a ready-made rule set carries every rule in it |
| 2 | [Sign-in](spec/02-sign-in.md) | built, awaiting the live email proof | an email on the allowed list gets a link that works once within the hour; one not on it gets the same reply and no link |
| 3 | [League rules](spec/03-league-rules.md) | each league's rules held as data, changed from the next gameweek (#25), its format locked once its first gameweek has begun (#275); Player scoring built, the site's scoring for every league, read by all and edited by the admin (#30, #354); League settings built for the odd team out, games a gameweek, the squad's make-up (#341), the draft's settings (#1087), who reviews a trade and the trade deadline (#383), and the waiver order's type and runs (#1200); scoring starting in the gameweek the commissioner sets, or the next after the draft, on the server (#1097); a save over someone else's is refused; the first scoring set is FPL's (spec/14) | the same week's table differs under two leagues' League settings, and every league scores it by the site's set |
| 4 | [The draft](spec/04-the-draft.md) | the snake order and which players a pick may take, one leaving no legal finish greyed out (#1088); the draft's settings, the pick clock, the timeouts before auto-pick, where undrafted players go and the draft order, set or drawn at random, on League settings (#1087, #1089); the start, on the commissioner's date or his start, its order fixed and no team joining after (#1089); a manager's pick on his turn, the draft over at the last pick, its rounds and squad rules counting a change waiting for next gameweek (#1090, #1130); each pick on the league's clock, the draft picking when it runs out (#1147), timeouts counted and a team at the league's limit put on auto-pick (#1136); auto-pick from the queue, then the ranking, then last season's points under today's scoring, and taken back (#1100, #1164, #1167); each team's private queue and do-not-draft list (#1092), fed from the shortlist (#1137); the commissioner's pause and resume (#1135), undo, picking for any team and the pick time (#1101); each team's lineup saved when the draft ends (#1040); draft picks traded before the draft, one for one, the board marking them (#1096); letters for up next, the end and a pause (#1102); the draft room built: its state, whose turn, the clock and the board (#1098), the players list and Draft button (#1099), the queue, do-not-draft and auto-pick panels (#1100) and the commissioner panel (#1101); the admin's ranking uploaded, checked and read back on the server, its admin panel not yet (#1093) | an auto-pick takes the best player left in the manager's queue, then in the admin's ranking, skipping any greyed out or on his do-not-draft list; a finished squad always meets the league's squad rules |
| 5 | [Tactics](spec/05-tactics.md) | the pitch, the presets and the check of whether a lineup may stand (#8), the deadline (#9), a saved lineup (#8) and its "Lineup saved 14:02" line (#987), and a first lineup picked from the squad (#637, #836), built; the Tactics tab: placing players, the bench and its order, presets that reshape the pitch keeping the players and fill from the bench (#14, #1025), moves by tap or drag, each saving itself, with Undo (#851), presets only, by swaps, a refused drop saying why, 3-6-1 added (#1022), built; roles: each slot's roles picked and shown (#10), spec/05's default roles with a code, description, rewards and costs, sweeper and libero as roles for a back three's centre-backs (#989), scored in whole points by bars into the site's set (#10), and each role's run on the pitch (#846, #962), built; not yet the admin editing role adjustments, auto-subs beyond scoring the table (#12), or a removed role's starters moving to another role (31 Oct 2026); stars, each player's rating for every role in every area he plays, worked out again as matches lock and when scoring changes (#11), a dropped-in player and an auto-sub on their best-star role, stars on Role fit, the panel's roles and the lit cells and bench rows (#11), and Quick Pick filling the formation with the best eleven by stars (#849), built; each starter's chip, his role's code, stars and this week's opponents (#845), each slot's position label (#857), and the squad list leading with chip and role (#847), built; squad numbers a manager gives, his club's number until then (#13), and shirts in club colours, striped clubs in stripes (#839), built; the formation window to its picture with the two-at-the-back presets (#1159, #988), classics setting their shape, roles and instructions, custom once changed (#991), and saved plans as Your presets (#992), built; team instructions, one attacking and one defensive from those the formation offers, scored player by player, two at the back repricing its back line (#990), built; not yet the role card (31 Oct 2026) | the same player and match score differently in two roles, and an empty slot is filled by the first fitting sub |
| 6 | [Positions](spec/06-positions.md) | positions from real starts, labels and the admin's say built on the server (#22), and the admin dashboard: the queue, approving a club, how starts count and correcting any player (#126), and the admin's thresholds and positions changing with a role (#235) built; the sync run daily at 06:00 UK time (#1194); a manager told by Mail when his player is flagged at a position and when he loses it, and such a player marked on Tactics and Squad and named in the lineup check (#23) | a player flagged, then losing a position, at the admin's thresholds |
| 7 | [Scoring](spec/07-scoring.md) | a match's stats priced under a scoring set (#29), finished matches' stats read and locked (#27), late ones every 10 minutes (#513); each team's gameweek scored from its lineup, which every team has (#637), auto-subs and the site's set, live and provisional until its matches lock, into the table (#29), and stored once they all have (#418); scoring starting in the gameweek the commissioner sets, or the next after the draft (#1097); a postponed match's players auto-subbed unless it is rearranged into the gameweek (#900); roles (#10) and team instructions (#990) scored | a finished match's points match the league's rules for every category |
| 8 | [Between gameweeks](spec/08-between-gameweeks.md) | waivers and free agency built: a drop putting a player on waivers (#1197), ranked claims and the waiver run in the league's waiver order (#1198), then free agents first come first served in the window (#1199), all from the player card, with Scouting showing who is on waivers, pending claims on My team's Transactions tab and the waiver settings on League settings (#1200), none before the draft is over (#1326); trades built: offer, counter, accept, a commissioner veto or league vote, the move and the trade deadline, on the server and on the Trades screen (#383), and draft picks, one for one, before the draft (#1096); not yet next season's picks in keeper and dynasty leagues | waiver claims resolve in priority order before free agency opens |
| 9 | [Season admin](spec/09-season-admin.md) | the round robin over the gameweeks a league plays, the odd team out and the football table built (#33), and a gameweek's fixtures stored once it begins (#137); matchups scored and counted in the table, a gameweek that can't be scored named with why (#29, #287); the auto team setting a lineup at each deadline for a team whose manager stops playing, switched by him or the commissioner (#1207); the commissioner swapping a side between two games in a gameweek not yet begun (#1208); a player's availability our own, filled from FPL's flags and set by the admin by hand (#1206) | an illegal lineup at the deadline is fixed by the auto team |
| 10 | [Live matchday](spec/10-live-matchday.md) | stats read every minute during a match (#28); points move in the table during a match, marked provisional until it locks (#29); the matchup built to its approved picture (#1026): live, both sides' pitches once the deadline passes, each with its formation, named by its preset until edited (#878), each starter's slot label, role and run, and a sub's once he comes on (#799, #850), auto-subs shown and the bench greyed (#34), a tapped player's breakdown of his points (#798), a switch for each game of a two-game gameweek (#521), and the vidiprinter, a column per team, each line priced for the two lineups' men, with threshold lines and "Commentary delayed" (#44, #46, #917); every player's lines priced, owned or not, bench included, and a line for every point movement (#835); the match page from the team sheets about an hour before kickoff, with every man's points and an owned man's team (#771), the priced commentary and its five team stats, opened from the Premier League's fixtures and from the matchup (#45), its scoreboard on the clubs' colours with their crests (#840); league home live on matchdays, with its scored head-to-heads and vidiprinter (#387) | points move during a match and are marked provisional until it is final |
| 11 | [Email](spec/11-email.md) | the draft's on-the-clock email, sent only on a pick clock over 10 minutes (#1102), built; sign-in's and setting up a league's emails built with them (spec/02, spec/13); not yet waiver results by email | on a pick clock over 10 minutes the manager on the clock gets one email; under it, none |
| 12 | [Screens](spec/12-screens.md) | the frame and sign-in (#19), your leagues (#24), Mail and its count in the menu (#26), invites (#73), gameweeks (#74), squads (#31), Player scoring (#30), the admin dashboard (#126), the top bar's Feedback link (#357), Continue to Mail, then to the Tactics tab before the deadline (#526), then to a trade offer waiting for his answer (#1553), and the patch banner and Patch notes (#356), built; to their approved pictures: the table and fixtures, League and Cup tabs, the Cup an empty placeholder bracket until cups are grilled (#1029), League home's Overview, glance, recap, News of every team's moves and matchday mode (#387, #1356), the matchup (#1026), the player card with his game log, a match's breakdown, last season and his actions to scout, claim, pick up and drop, and his owner's squad read-only (#1027, #797, #381, #375, #1200), and the draft room (#1098 to #1101), built; Trades, its Offers and New offer tabs (#383), Scouting (#373, #375), and League settings (the odd team out, games a gameweek, the squad's make-up, the draft's settings and order, trade review and deadline, waivers; #341, #1087, #1089, #383, #1200), built; My team: its header band (1 Nov 2026), its Tactics tab to its approved picture, with the toolbar, Selection table, the selected player's panel, the opponent widget and the pitch's chips (#14, #845), its Squad tab to its approved picture, with the Stats, Schedule and Rules views, Started and Role points, squad numbers and Mail and news (#364, #1005, #1006, #13), its Fixtures tab (#365, #436) and its Transactions tab, with pending claims (#366, #1200), built; the Premier League's fixtures, results and table (#49, #50) and the match page (#45), with club crests (#840), built; Team of the Week dropped (1 Nov 2026); not yet the status chips, fixture difficulty, the rest of the Lineup check or the role card, placeholders until each is settled, Mail down the side of the Tactics tab (#14), or club pages (after the mini beta) | a signed-in manager lands on My team, with Mail's unread count in the menu |
| 13 | [Setting up a league](spec/13-setting-up-a-league.md) | leagues, teams and who runs them (#24), joining (#73), the gameweeks it plays (#74), deleting (#75), switching leagues (#76) and deletion emails past the daily limit waiting for the next day (#837) built | a league of four fills from two emailed invites and two approved join requests |
| 14 | [Scoring categories](spec/14-scoring-categories.md) | the catalogue (placeholder names), pricing by area or position, points limits and minutes (#111), own stats (#112), made in the rules editor (#262), and the first scoring set, FPL's (#25), built, with the rules editor (#30); the site owns the set, kept in versions by gameweek, and every league plays on it (#354), changed by patch with a week's notice or by fix (#355), each announced by a Mail letter, the banner and the patch notes (#356); the admin's patch screen: a draft patch announced from a gameweek, the versions listed and withdrawn (#368), a waiting patch moving with its gameweek's kickoff (#901); the rule balance lab, run on a draft patch, its report in the patch notes (#843); a commissioner's score override of one player in any match, or of a team's gameweek total, from the card or the matchup, each removable (#32, #903); a league's matches are scored for its table (#29); each category's points with why, on the player card's breakdown (#797), a player landing on a points limit noted (#863) | a match's stats priced under a set of rules give each category's points and the total, by the slot's area or position, within each rule's points limits |
| 15 | [Admin tools](spec/15-admin-tools.md) | creating a league and naming its commissioner (#24), inviting managers (#73), assigning players (#31), the positions dashboard (#126) and the feeds page (#35) with a failure email to the admin (#319), its team sheets before kickoff, team stats and threshold lines each a feed (#522), and managers' feedback on the dashboard (#357) built; removing a manager on the invites page, and a manager leaving from the top bar (#134); renaming teams, the maximum and the co-commissioner only from the CLI, and editing the scoring set (#30), its patch screen (#368) and balance lab (#843); the score override, from the player card, the admin's as the commissioner's (#32, #903); each club's colours and pattern set by the admin, a club with none queued and white (#838); a club's points total set for a deduction (#898); a player's availability set by hand (#1206); not yet the ranking's admin panel (#1093) or the admin's log | a commissioner's assignment puts the player on the team and files a Mail letter to the league |
| 16 | [Mail](spec/16-mail.md) | the letter store, letters about a league's events, the commissioner's letter, the Mail screen and its count built (#26), and letters from the site to everyone, such as a scoring patch (#356); a letter's times in the reader's zone (#912); down the side of the Tactics tab not yet (#14); each feature files its own letters | a claim, a drop and a trade each file one letter for every manager in the league |
| 17 | [Captain and set pieces](spec/17-captain-and-set-pieces.md) | after the mini beta; the captain and vice-captain stay, and the set-piece lists are dropped (9 Nov 2026) | the vice-captain takes the armband when the captain's match ends with him on 0 minutes |
| 18 | [Premier League](spec/18-premier-league.md) | fixtures and results built, a gameweek at a time with live scores, each opening its match page (#49, #45); the table beside them, worked out from the held results, live and marked provisional while a match is being played (#50), a club's points deduction set by the admin (#898); each club's crest before its code (#840); Sportmonks' Scottish Premiership read into its own tables (#1391), the Premier League still read from FPL's and its own feeds | a goal in a live match moves the Premier League table at once, marked provisional |
| 19 | [Scouting](spec/19-scouting.md) | the players list, in the menu in place of Players, filtered by who holds a player, his position and his club, sorted by name, club, season points or any catalogue or own stat (#910), and any two ticked compared side by side, built (#373); season points, each player's card total in the league at his main position with the league's overrides (#525), and last season's under today's scoring before the new season's first match (#956), built; Role fit stars, hidden outside the squad until a player is scouted (#11, #375); the shortlist (#374), Mail telling a manager when one is dropped or clears waivers, and feeding the draft queue (#1137), built; who is on waivers (#1200); scouts, three a team, sent from the player card, each report written 24 hours on, and Scouting's Scouts panel opening the reports (#375), built; the stat race's team season totals built (#808), its screen not yet (#800) | a scout's report is ready 24 hours after he is sent, and no other team can tell who was scouted |
| 20 | [Going live](spec/20-going-live.md) | the release (#517), the backup before a change to saved data's shape (#518), the after-release sign-in check (#517) and the setup command (#519) built; going live waits on Craig's setup run in docs/setup.md (#511, #512, #514) | a merge to `main` is live on `fantasydraftmanager.net` with its server code, and the check after it signs in there |
| 21 | [Player news](spec/21-player-news.md) | after the mini beta | an article about one player gives one note on his card, dated and linked to it, naming nothing of our game |

## Second release

- The super sub, as a league rule: a bench player who scores extra if he comes on in the real
  match, which makes bench players worth having.

## Later

- **Mock drafts**: managers practising before the real draft (Craig, 2 Nov 2026).
- **Undoing a waiver run**, for the commissioner (Craig, 5 Nov 2026; spec/08).
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
- **Other leagues**: leagues on Italy's, Spain's and Germany's football, on Sportmonks' Starter
  plan; the beta has the Premier League and the Scottish Premiership (*What it is*).
- **A richer feed** (StatsBomb, Opta, Sportradar), only if the redesigned roles feel flat (Craig,
  9 Nov 2026, on #1196).
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

- Set-piece lists and set-piece takers: "we didthced set piece taker (unless its a role)" (Craig,
  9 Nov 2026, on #1196). A set-piece duty can only come back as a role (spec/17).
- A sleep timer that pauses the pick clock overnight: the commissioner pauses and resumes by hand (spec/04).
- Trading draft picks while the draft is running: they can be traded before it starts (spec/04).
- A ranking per scoring system or per league, or one made by a commissioner: the draft's ranking is the admin's, one for the platform (spec/04).
- A cap on how often or how long the commissioner can pause the draft (spec/04).
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
- A lock on dropping a player soon after picking him up: dropping is never restricted (spec/08).
- Claim limits per season, week or team (spec/08).
- A can't-drop list (spec/08).
- Moving a game to another gameweek, or adding or removing one: a fixture edit only swaps opponents (spec/09).

## Glossary

The Avoid column's roster, soccer, standings, waiver wire, franchise, playoffs, uniform and cleats
are Craig's (1 Nov 2026: "Add all eight"; #950). Line-up, matchup, subs and skipper are Claude's
call, as Craig left them to it (7 Nov 2026: "your call"; #951): line-up is the UK spelling,
matchup stays, subs and auto-subs are allowed, and skipper stays avoided. Fixture is Craig's
(8 Nov 2026, #1333): a real Premier League match only, never a league's head-to-head, which is
"a matchup, or a game in a gameweek". New code
follows it; tables and fields already saved keep their names.

| Term | Meaning | Avoid |
|---|---|---|
| team | a fantasy side: a manager's draft team | |
| base points | what a player earns from the site's scoring set for what he did, as in FPL: so many for a goal, an assist, a clean sheet | |
| role adjustment | the points a starter's role adds or takes on top of his base points, in whole points by bars: +1 at each of up to three bars of the role's bonus stats, −1 at each of up to three bars of its one bad action, ±3 at most a match ([05](spec/05-tactics.md#roles)) | role bonus, multiplier, pays, paid |
| earns, loses | what a player does with points | pays, is paid |
| run | where a starter's role goes as if in a real match, drawn as a dashed arrow on the pitch; it never changes points | lean |
| chip | the coloured label under a shirt on the pitch, or at the start of a squad list row | plate, badge |
| role card | the card that opens from a starter's role: every role for his slot, with his stars, what each scores more and less for, its description and his recent matches under it | role picker, drop-down |
| scout | one of a team's scouts (three, a number the site sets), sent to one player; the report is ready 24 hours later | |
| report | a scout's judgement on a player, in a few plain sentences | |
| shortlist | a manager's own list of players for the season | watchlist |
| queue | a manager's ranked list of players for the draft; it is also his auto-pick list | draft list, pre-rank |
| do-not-draft list | the players a manager never wants auto-pick to take | |
| auto-pick | a pick the draft makes for a manager, from his queue first, then the admin's ranking | timeout pick, autodraft |
| ranking | the admin's one list of players by rank, uploaded for the draft's auto-pick | |
| patch | a new version of the site's scoring set, named like 26_27.1, announced a week before it takes effect | update |
| manager | the person who runs a team | player (for a person) |
| admin | Craig, running the whole platform | |
| commissioner | the person who runs one league, with or without a team in it | |
| co-commissioner | a league's second person, named by the commissioner or the admin, with the commissioner's powers except naming or removing either and deleting the league | |
| invite | the email a commissioner sends one person, carrying their sign-in link and the team it's for | |
| invite link | a league's one shareable link; opening it only asks to join | |
| join request | what opening the invite link makes, for the commissioner to approve or refuse | |
| club | a real Premier League club | team, franchise |
| club mark | the small square in a club's two colours before its code (spec/12) | badge, crest |
| position | where a player can play in real life (CB, FB, CAM, W); no side. A slot has one too, from its area and lane (spec/14) | right back, left winger |
| admin dashboard | the admin's one screen: the positions queue and corrections, thresholds, and the feeds page | |
| role | what you tell him to do in your slot, which changes his points | |
| trait | what he does in real life (inverted full-back, cuts inside) | style |
| slot | a place in your formation | |
| area | a band of the pitch a formation is built from: goalkeeper, defence, defensive midfield, midfield, attacking midfield, attack | line |
| lane | one of five columns across an area: left, left-centre, centre, right-centre, right | |
| deadline | the one moment each gameweek that locks every lineup | lock time |
| formation | how a lineup stands on the pitch's grid: a preset, a classic, or custom | shape |
| preset | a ready-made formation, such as 4-2-3-1 | |
| classic | a famous side's formation, with its roles and team instructions, such as Keegan's Newcastle | |
| custom | a classic the manager has changed | |
| team instruction | how the whole team plays, one attacking and one defensive, adjusting everyone's scoring | team tactic |
| plan | a saved formation, its roles and team instructions, never players | saved tactics, saved preset |
| category | one stat a league can score, such as goals or tackles won | |
| own stat | a stat the admin makes for the site's set by adding catalogue stats with weights | custom stat, formula |
| points limit | a rule's maximum or minimum points for one player in one match | cap (that is the salary cap), floor, ceiling |
| short code | a category's abbreviation in dense tables: G, A, CS, KP, TW | |
| line-up | a team's starters and bench for one gameweek | |
| squad | every player a team owns | roster |
| starter | a player in the lineup's eleven | |
| bench | the lineup's players who don't start, in the order auto-subs use | |
| draft league | a league on the platform, such as the Tim Hortons Pro League; on screen, "draft league" wherever the Premier League could be meant. "League" alone in the spec means one | fantasy league |
| Premier League | the real competition; its menu section is Football (10 Nov 2026) | league (alone) |
| match | a real Premier League match | |
| fixture | a real Premier League match, never a league's head-to-head | |
| matchup | a head-to-head between two teams in one gameweek; also "a game in a gameweek" (Craig, 8 Nov 2026) | match, fixture |
| commentary | the short lines that report a match or a matchup as it is played | feed (that is the data source) |
| vidiprinter | the matchup's running list of commentary, newest first | |
| gameweek | a date window from its deadline to the next gameweek's; a match counts in the gameweek it kicks off in, in every competition. Gameweek N is Sportmonks' round N as first scheduled | period |
| best match | in a double gameweek, only his higher-scoring match counts | best ball |
| auto team | the app setting an absent manager's lineup | |
| super sub | a bench player who scores extra if he comes on in the real match | |
| the market | money in the game: salaries, fees, wages, money in trades | |
| Mail | the inbox in the app | email |
| email | a message sent to a manager's own inbox | Mail |
| captain | the starter a manager picks to lead by example, whose own scoring the armband changes | skipper; armband (for the person) |
| vice-captain | the starter who takes the armband if the captain doesn't play | |
| club captain | the real club's captain, shown as a hint | captain (for the real one) |
| note | one item in a player's News: a match note or real news, dated and linked to its source (spec/21) | blurb, snippet |
| squad number | the number a manager gives a player, shown on his shirt ("shirt number" means the same) | |
| football | the game itself | soccer |
| table | a league's teams, or the Premier League's clubs, ranked by points | standings |
| waivers | the claims on a dropped player, made in the league's waiver order before he is a free agent | waiver wire |
| the window | from the first waiver run after a gameweek to the next deadline, when players are free agents (spec/08) | week, break, transfer window (the real one opens in January) |
| play-offs | the games after the season that settle the places a league plays them for | playoffs |
| kit | the shirts, shorts and socks a club or team wears | uniform |
| boots | what a player wears on his feet | cleats |
