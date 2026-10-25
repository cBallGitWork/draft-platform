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
| 3 | [League rules](spec/03-league-rules.md) | each league's rules held as data, changed from the next gameweek (#25); Player scoring, the scoring editor, built (#30); League settings built for the odd team out, games a gameweek and the squad's make-up (#341); a save over someone else's is refused; the first scoring set is FPL's (spec/14) | the same week scores differently under two leagues' rules |
| 4 | [The draft](spec/04-the-draft.md) | not built | a timed-out pick takes the queue's best available player, then the default ranking's |
| 5 | [Tactics](spec/05-tactics.md) | the pitch, eleven presets and the check of whether a lineup may stand (#8), and the deadline (#9) built; not yet a saved lineup or its screen (#14), roles (#10, #11), auto-subs (#12) or squad numbers (#13) | the same player and match score differently in two roles, and an empty slot is filled by the first fitting sub |
| 6 | [Positions](spec/06-positions.md) | positions from real starts, labels and the admin's say built on the server (#22), and the admin dashboard: the queue, approving a club, how starts count and correcting any player (#126); not yet the thresholds and positions changing with a role (#23), and nothing runs the sync on a schedule | a player flagged, then losing a position, at the admin's thresholds |
| 7 | [Scoring](spec/07-scoring.md) | a match's stats priced under a scoring set (#29), finished matches' stats read and locked (#27, no cron yet); nothing scores a league's matches yet | a finished match's points match the league's rules for every category |
| 8 | [Between gameweeks](spec/08-between-gameweeks.md) | not built | waiver claims resolve in priority order before free agency opens |
| 9 | [Season admin](spec/09-season-admin.md) | the round robin over the gameweeks a league plays, the odd team out and the football table built (#33), and a gameweek's fixtures stored once it begins (#137); the table stays all noughts until matchups are scored; not yet the commissioner editing fixtures or the auto team | an illegal lineup at the deadline is fixed by the auto team |
| 10 | [Live matchday](spec/10-live-matchday.md) | stats read every minute during a match (#28); no points move yet, and no matchup, match page or commentary on screen | points move during a match and are marked provisional until it is final |
| 11 | [Email](spec/11-email.md) | not built | on a pick clock over 10 minutes the manager on the clock gets one email; under it, none |
| 12 | [Screens](spec/12-screens.md) | the frame and sign-in (#19), your leagues (#24), Mail and its count in the menu (#26), table and fixtures (#33), invites (#73), gameweeks (#74), squads (#31), Player scoring (#30), League settings (the odd team out, games a gameweek and the squad's make-up, #341) and the admin dashboard (#126) built; spec'd, not yet built: My team, where a manager lands (#14), matchup (#34), match (#45), Premier League (#49), the draft room (waits for the summer) and club pages (after the mini beta); to grill: home, players, player card, trades, and My team's Squad, Fixtures and Transactions tabs (from the mock-up, not the spec) | a signed-in manager lands on My team, with Mail's unread count in the menu |
| 13 | [Setting up a league](spec/13-setting-up-a-league.md) | leagues, teams and who runs them (#24), joining (#73), the gameweeks it plays (#74), deleting (#75) and switching leagues (#76) built | a league of four fills from two emailed invites and two approved join requests |
| 14 | [Scoring categories](spec/14-scoring-categories.md) | the catalogue (placeholder names), pricing by area or position, points limits and minutes (#111), own stats (#112) and the first scoring set, FPL's (#25), built on the server, and the rules editor (#30), but not yet making an own stat in it (#262); not yet a score override (#32), or anything scoring a league's matches | a match's stats priced under a set of rules give each category's points and the total, by the slot's area or position, within each rule's points limits |
| 15 | [Admin tools](spec/15-admin-tools.md) | creating a league and naming its commissioner (#24), inviting managers (#73), assigning players (#31) and the positions dashboard (#126) built; removing a manager on the invites page, and a manager leaving from the top bar (#134); renaming teams, the maximum and the co-commissioner only from the CLI, and editing the scoring set (#30); not yet a score override (#32), the feeds page (#35) or the admin's log | a commissioner's assignment puts the player on the team and files a Mail letter to the league |
| 16 | [Mail](spec/16-mail.md) | the letter store, letters about a league's events, the commissioner's letter, the Mail screen and its count built (#26); down the side of My team waits for My team; each feature files its own letters | a claim, a drop and a trade each file one letter for every manager in the league |
| 17 | [Captain and set pieces](spec/17-captain-and-set-pieces.md) | after the mini beta | the first on a set-piece list who plays is paid for the duty for the whole match, and no one else on the list is |
| 18 | [Premier League](spec/18-premier-league.md) | not built | a goal in a live match moves the Premier League table at once, marked provisional |

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
- **Cups**, after the beta, with a plate competition beside them (Craig, 20 Oct 2026). Their
  own `/grill` then (`docs/to-grill.md`).
- **Other leagues**: Scotland and the rest of Europe. None has a free public feed like the
  Premier League's; a paid feed (Sportmonks, API-Football) covers them all. The football data is
  built so a feed can plug in.
- **Licensed data**: a licensed feed if FPL's and the Premier League's terms, checked before the
  mini beta (above), don't allow a public product.
- **Traits** (what a player does in real life), if a source for them turns up.
- **The platform's own scoring sets**, designed once the first scoring set has been played.
- **A landing page** for the public, when signups open to anyone; its own `/grill` then.
- **Carrying a league into next season**, a different thing from spec/03's carry-over rule
  (redraft, keeper, dynasty).
- **Archiving a league**: deleting is for good for now (`spec/13`).

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
- FPL's bonus points, and a ready-made FPL-style or Fantrax-copy scoring set for a league to pick.
  The mini beta's first set starts from FPL's values as a draft Craig changes (spec/14).
- A limit on a player's whole match, or on a team's gameweek total.
- A lock at each player's kickoff: there is one deadline per gameweek.

## Glossary

| Term | Meaning | Avoid |
|---|---|---|
| team | a fantasy side: a manager's draft team | |
| manager | the person who runs a team | player (for a person) |
| admin | Craig, running the whole platform | |
| commissioner | the person who runs one league, with or without a team in it | |
| co-commissioner | a league's second person, named by the commissioner or the admin, with the commissioner's powers except naming or removing either and deleting the league | |
| invite | the email a commissioner sends one person, carrying their sign-in link and the team it's for | |
| invite link | a league's one shareable link; opening it only asks to join | |
| join request | what opening the invite link makes, for the commissioner to approve or refuse | |
| club | a real Premier League club | team |
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
| own stat | a stat a league makes by adding catalogue stats with weights | custom stat, formula |
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
| squad number | the number a manager gives a player, shown on his shirt ("shirt number" means the same) | |
