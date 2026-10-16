# SPEC

Craig's answers from the first `/grill` (16 Oct 2026), and nothing else. A feature's detail is
settled by its own `/grill` before it is built, and lands here.

## What it is

A new fantasy draft product for the Premier League, made for many leagues. It is a
draft/EPL/Football Manager hybrid with real tactics: formations and roles change how a player
scores, so a player's value depends on the team he is in. A salary cap is part of the idea, and
it is the first thing cut if scope has to shrink. Web first, free for now, and a closed beta in
which Craig sets the leagues up; long term, anyone can. Live by August 2027 would be nice, but
it can go live at any time. The Tim Hortons Pro League is the first league on it. A goal: a mini
beta over the last three or four weeks of the 2026/27 season, to iron out kinks.

## Features

One file per feature in [spec/](spec/); this page is the index. A feature's status lives only in this table.

| # | Feature | Status | Checked by |
|---|---|---|---|
| 1 | [Leagues](spec/01-leagues.md) | not built | a league created from a ready-made rule set carries every rule in it |
| 2 | [Sign-in](spec/02-sign-in.md) | not built | a sign-in link works once and then expires |
| 3 | [League rules](spec/03-league-rules.md) | not built | the same week scores differently under two leagues' rules |
| 4 | [The draft](spec/04-the-draft.md) | not built | a timed-out pick takes the queue's best available player, then the default ranking's |
| 5 | [Tactics](spec/05-tactics.md) | not built | the same player and match score differently in two roles |
| 6 | [Positions](spec/06-positions.md) | not built | a player flagged, then losing a position, at the admin's thresholds |
| 7 | [Scoring](spec/07-scoring.md) | not built | a finished match's points match the league's rules for every category |
| 8 | [Between gameweeks](spec/08-between-gameweeks.md) | not built | waiver claims resolve in priority order before free agency opens |
| 9 | [Season admin](spec/09-season-admin.md) | not built | an illegal lineup at lock is fixed by the auto team |
| 10 | [Live matchday](spec/10-live-matchday.md) | not built | points move during a match and are marked provisional until it is final |
| 11 | [Email](spec/11-email.md) | not built | the manager on the clock gets one email per pick |
| 12 | Screens | to grill | — |
| 13 | Setting up a league | to grill | — |
| 14 | Scoring categories | to grill | — |
| 15 | Admin tools | to grill | — |

Features 12–15 get their file from their own `/grill`.

## Second release

- Team-wide instructions on top of formation and roles.
- The super sub, as a league rule: a bench player who scores extra if he comes on in the real
  match, which makes bench players worth having.

## Later

- **The salary cap**, the first thing cut if scope must shrink.
- **The market**, its own feature with its own `/grill` when the salary cap comes in. Craig's
  ideas so far, not decisions: free agents take a signing-on fee and higher wages, waivers take a
  fee, trades can involve money, and the market could take a more footballing shape, like a
  transfer market. Auction drafts and bidding waivers go with it.
- **Payments**, its own feature.
- **Other leagues**: Scotland and the rest of Europe. None has a free public feed like the
  Premier League's; a paid feed (Sportmonks, API-Football) covers them all. The football data is
  built so a feed can plug in.
- **Licensed data**: before signups open to anyone, check FPL's and the Premier League's terms,
  and switch to a licensed feed if they don't allow a public product.
- **Traits** (what a player does in real life), if a source for them turns up.

## Out of scope

- The paper, cups and player intel from the companion. It is a new product, not a companion app.
- Chat. Managers talk elsewhere.
- Push notifications and native apps.
- Payments, for now.
- Storylines (morale, contracts, conduct).
- Two roles per player (in and out of possession, as in FM26).
- A role penalty for playing out of position.

## Glossary

| Term | Meaning | Avoid |
|---|---|---|
| team | a fantasy side: a manager's draft team | |
| club | a real Premier League club | team |
| position | where a player can play in real life (CB, CAM) | |
| role | what you tell him to do in your slot, which changes his points | |
| trait | what he does in real life (inverted full-back, cuts inside) | style |
| slot | a place in your formation | |
| area | a band of the pitch a formation is built from (defence, defensive midfield, ...) | line |
| best match | in a double gameweek, only his higher-scoring match counts | best ball |
| auto team | the app setting an absent manager's lineup | |
| super sub | a bench player who scores extra if he comes on in the real match | |
| the market | money in the game: salaries, fees, wages, money in trades | |
