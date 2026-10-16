# SPEC

Craig's answers from his `/grill` sessions (from 16 Oct 2026), and nothing else. A feature's detail is
settled by its own `/grill` before it is built, and lands here.

## What it is

A new fantasy draft product for the Premier League, made for many leagues. It is a
draft/EPL/Football Manager hybrid with real tactics: formations and roles change how a player
scores, so a player's value depends on the team he is in. A salary cap is part of the idea, and
it is the first thing cut if scope has to shrink. Web first, free for now, and a closed beta in
which Craig sets the leagues up; long term, anyone can. Live by August 2027 would be nice, but
it can go live at any time. The Tim Hortons Pro League is the first league on it. A goal: a mini
beta over the last three or four weeks of the 2026/27 season, to iron out kinks: a quick league
of about four, with players assigned to teams rather than drafted, for the basics. By then:
features 1, 2, 3, 5, 6, 7, 10, 12, 14 and 16, and the mini beta's admin tools
(15: creating a league, inviting managers, assigning players, a score override, positions, the
feeds page). Live commentary and the match page (10) are in it if the live stream is proven,
and among the first things dropped if late. The draft (4) waits for the summer.

## Features

One file per feature in [spec/](spec/); this page is the index. A feature's status lives only in this table.

| # | Feature | Status | Checked by |
|---|---|---|---|
| 1 | [Leagues](spec/01-leagues.md) | not built | a league created from a ready-made rule set carries every rule in it |
| 2 | [Sign-in](spec/02-sign-in.md) | not built | a sign-in link works once and then expires |
| 3 | [League rules](spec/03-league-rules.md) | not built | the same week scores differently under two leagues' rules |
| 4 | [The draft](spec/04-the-draft.md) | not built | a timed-out pick takes the queue's best available player, then the default ranking's |
| 5 | [Tactics](spec/05-tactics.md) | not built | the same player and match score differently in two roles, and an empty slot is filled by the first fitting sub |
| 6 | [Positions](spec/06-positions.md) | not built | a player flagged, then losing a position, at the admin's thresholds |
| 7 | [Scoring](spec/07-scoring.md) | not built | a finished match's points match the league's rules for every category |
| 8 | [Between gameweeks](spec/08-between-gameweeks.md) | not built | waiver claims resolve in priority order before free agency opens |
| 9 | [Season admin](spec/09-season-admin.md) | not built | an illegal lineup at the deadline is fixed by the auto team |
| 10 | [Live matchday](spec/10-live-matchday.md) | not built | points move during a match and are marked provisional until it is final |
| 11 | [Email](spec/11-email.md) | not built | on a pick clock over 10 minutes the manager on the clock gets one email; under it, none |
| 12 | [Screens](spec/12-screens.md) | not built | a signed-in manager lands on My team, with Mail's unread count in the menu |
| 13 | Setting up a league | to grill | — |
| 14 | [Scoring categories](spec/14-scoring-categories.md) | not built | a match's stats priced under a set of rules give each category's points and the total, by the slot's area |
| 15 | [Admin tools](spec/15-admin-tools.md) | not built | a commissioner's assignment puts the player on the team and files a Mail letter to the league |
| 16 | [Mail](spec/16-mail.md) | not built | a claim, a drop and a trade each file one letter for every manager in the league |
| 17 | [Captain and set pieces](spec/17-captain-and-set-pieces.md) | after the mini beta | the first on a set-piece list who plays is paid for the duty for the whole match, and no one else on the list is |

Feature 13 gets its file from its own `/grill`.

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
- **Other leagues**: Scotland and the rest of Europe. None has a free public feed like the
  Premier League's; a paid feed (Sportmonks, API-Football) covers them all. The football data is
  built so a feed can plug in.
- **Licensed data**: before signups open to anyone, check FPL's and the Premier League's terms,
  and switch to a licensed feed if they don't allow a public product.
- **Traits** (what a player does in real life), if a source for them turns up.
- **The platform's own scoring sets**, designed once the first scoring set has been played.
- **A landing page** for the public, when signups open to anyone; its own `/grill` then.

## Out of scope

- The paper, cups and player intel from the companion. It is a new product, not a companion app.
- Chat. Managers talk elsewhere.
- Push notifications and native apps.
- Storylines (morale, contracts, conduct).
- Two roles per player (in and out of possession, as in FM26).
- A captain's points multiplier: the captain leads by example instead (spec/17).
- A role penalty for playing out of position.
- Injured reserve.
- A limit on auto-subs, or a switch to turn them off.
- Public league pages: no league is visible without signing in.
- Co-commissioners (a league has one commissioner).
- FPL's bonus points, and a ready-made FPL-style or Fantrax-copy scoring set.
- A lock at each player's kickoff: there is one deadline per gameweek.

## Glossary

| Term | Meaning | Avoid |
|---|---|---|
| team | a fantasy side: a manager's draft team | |
| manager | the person who runs a team | player (for a person) |
| admin | Craig, running the whole platform | |
| commissioner | the manager who runs one league | |
| club | a real Premier League club | team |
| position | where a player can play in real life (CB, CAM) | |
| role | what you tell him to do in your slot, which changes his points | |
| trait | what he does in real life (inverted full-back, cuts inside) | style |
| slot | a place in your formation | |
| area | a band of the pitch a formation is built from: goalkeeper, defence, defensive midfield, midfield, attacking midfield, attack | line |
| lane | one of five columns across an area: left, left-centre, centre, right-centre, right | |
| deadline | the one moment each gameweek that locks every lineup | lock time |
| formation | how a lineup stands on the pitch's grid, preset or placed freely | shape |
| preset | a ready-made formation, such as 4-2-3-1 | |
| category | one stat a league can score, such as goals or tackles won | |
| short code | a category's abbreviation in dense tables: G, A, CS, KP, TW | |
| lineup | a team's starters and bench for one gameweek | |
| squad | every player a team owns | |
| starter | a player in the lineup's eleven | |
| bench | the lineup's players who don't start, in the order auto-subs use | subs |
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
