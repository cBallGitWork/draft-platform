# SPEC

Craig's answers from the first `/grill` (16 Oct 2026), and nothing else. A feature's detail is
settled by its own `/grill` before it is built, and lands here.

## What it is

A new fantasy draft product for the Premier League, made for many leagues. It is a
draft/EPL/Football Manager hybrid with real tactics: formations and roles change how a player
scores, so a player's value depends on the team he is in. A salary cap is part of the idea, and
it is the first thing cut if scope has to shrink. Web first, free for now, and a closed beta in
which Craig sets the leagues up; long term, anyone can. Live by August 2027 would be nice, but
it can go live at any time. The Tim Hortons Pro League is the first league on it.

## Features

| # | Feature | Status | Checked by |
|---|---|---|---|
| 1 | Leagues | not built | a league created from a ready-made rule set carries every rule in it |
| 2 | Sign-in | not built | a sign-in link works once and then expires |
| 3 | League rules | not built | the same week scores differently under two leagues' rules |
| 4 | The draft | not built | a timed-out pick takes the queue's best available player, then the default ranking's |
| 5 | Tactics | not built | the same player and match score differently in two roles |
| 6 | Positions | not built | a player flagged, then losing a position, at the admin's thresholds |
| 7 | Scoring | not built | a finished match's points match the league's rules for every category |
| 8 | Between gameweeks | not built | waiver claims resolve in priority order before free agency opens |
| 9 | Season admin | not built | an illegal lineup at lock is fixed by the auto team |
| 10 | Live matchday | not built | points move during a match and are marked provisional until it is final |
| 11 | Email | not built | the manager on the clock gets one email per pick |
| 12 | Screens | to grill | — |
| 13 | Setting up a league | to grill | — |
| 14 | Scoring categories | to grill | — |
| 15 | Admin tools | to grill | — |

### 1. Leagues

- Made for many leagues. In the closed beta Craig creates each league and names its commissioner,
  who runs it from then on. Craig keeps an admin override.
- A league starts from ready-made rules, and the commissioner can edit them. Two ship: the Tim
  Hortons Pro League's current rules, and one close to FPL's own scoring.

### 2. Sign-in

- An emailed sign-in link. No passwords.

### 3. League rules

The league's rules are data. Among them:

- Format: head-to-head, or total points.
- Playoffs: how many teams, how many legs.
- Carry-over: redraft, keeper (the league sets how many each team keeps; keeping costs nothing)
  or dynasty (the whole squad carries over).
- Lineup lock: each player at his own kickoff, or the whole squad at the gameweek deadline.
- Auto-subs from the bench.
- Double gameweeks: both matches count (the default), or best match.
- Waivers: when they run, set by the league; can be more than once a week.
- Roles and their scoring adjustments (see 5).
- The trade veto window (see 8).

### 4. The draft

- Held in the app, live. It starts on a date the commissioner sets, or when the commissioner
  presses start.
- Snake only.
- Each pick runs on a clock the league sets. A timeout picks for the manager: from their own
  queue first, then a default ranking.
- Before the draft, each manager ranks players into their queue.
- Draft order is a league setting: random, set by the commissioner, or last season's finish.
- The commissioner can pause the draft, undo a pick, and pick for a manager.
- In keeper and dynasty leagues, next season's draft is every player who was not kept, in the
  league's draft order.

### 5. Tactics

- Preset formations for ease, plus free placement of players on the pitch, Championship
  Manager style, within each area's minimum and maximum. Areas go beyond defence, midfield and
  attack: a 4-3-1-2 has its own.
- Any player who plays in an area can fill any slot in it. A centre-back can fill a full-back
  slot: the game should not get in the way of managers.
- Each slot has a role, two or three to choose from per outfield slot. A role adjusts scoring one
  category at a time: an attacking role might reward key passes more, a defensive one defensive
  actions. Every role gives something and takes something, so none is better in every way.
  The exact roles are settled by a later `/grill tactics`.
- Roles and their adjustments are league rules, and the ready-made rules carry a default set.
- Being better suited to a role comes out of the scoring: a full-back makes more of what an
  attacking full-back slot pays. There is no out-of-position penalty.
- Each player gets stars out of five for each role, worked out from his past stats priced under
  that role, as Football Manager shows role suitability. A hint only; it never changes his points.
- A role locks when its player locks.
- An auto-sub takes the slot and role of the player he replaces, while the formation stays within
  the league's area limits. How is still to be investigated.
- Your tactics change only your own players' points, never your opponent's.

### 6. Positions

- Modern position labels (RB, CB, CDM, CAM, LW, ST and so on), not FPL's four, which can be wrong.
- Taken from where players actually lined up in real matches (the Premier League's formation
  lines), not from a scraped site. A new signing with no matches is set by an admin.
- A player can have more than one position.
- The same in every league. An admin corrects them; there is no per-league override.
- Positions change when a player's real-life role changes, gradually: the manager is warned first,
  then the position goes. The thresholds are admin-tunable (starting point: flagged after 3
  matches in a row elsewhere, removed after 6, only between gameweeks).
- Losing a position never makes a squad illegal. The player stays in his slot for the gameweek
  and the manager is warned.

### 7. Scoring

- Only stats from the two free feeds: FPL's public API and the Premier League's public API.
- Points move live during matches, provisional until final.
- A player in a double gameweek scores per the league's rule (see 3).

### 8. Between gameweeks

- Waivers in priority order (reverse standings), then free agents, first come first served,
  until lock.
- Trades between managers: players only, plus next season's draft picks in keeper and dynasty
  leagues. A trade goes through after the league's veto window unless the commissioner vetoes it.

### 9. Season admin

- The platform generates the head-to-head fixtures as a round robin; the commissioner can edit them.
- The commissioner can hand a team to a new manager mid-season.
- Auto team, for a manager who stops playing: it sets the lineup only, never claims waivers or
  answers trades. The commissioner or the manager can switch it on, and the app does at lock time
  if a lineup is illegal. While it is on, trades with that team are paused; waivers carry on.

### 10. Live matchday

- Live scores during matches, for every league's head-to-head and table.

### 11. Email

- The only way the app reaches a manager: on the clock in the draft, and waiver results.

### 12–15. To grill

Screens (offered as throwaway mock-ups to pick from), setting up a league, the full list of
scoring categories, and admin tools. Each gets its own `/grill`.

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
