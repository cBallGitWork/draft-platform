# 15. Admin tools

Feature 15 of [SPEC.md](../SPEC.md). Only Craig's answers: the first `/grill` and
`/grill admin tools` (16 Oct 2026). Two people run things: Craig as the platform **admin**, and
each league's **commissioner**.

## The admin (Craig)

- Creates each league and names its commissioner (`spec/01`), and keeps an override on every
  league.
- Sets positions for new signings and support strikers, corrects any player's positions, and
  tunes the position-change thresholds (`spec/06`).
- Sets the stat-correction window (`spec/07`).
- Can remove a manager from a league. The team stays, for the commissioner to hand to someone
  new (`spec/09`).
- A feeds view: when FPL's and the Premier League's feeds last answered, and whether scoring is
  behind. A feed that stops silently is the failure to catch.
- His actions are logged where only he sees them; a league gets a Mail letter only when its
  results change.

## The commissioner

- Everything the other features give the commissioner: the league's rules and scoring
  (`spec/03`, `spec/14`), the draft's schedule and controls (`spec/04`), trade vetoes where the
  league uses them (`spec/08`), the head-to-head fixtures, handing a team on and the auto team
  (`spec/09`), one-way letters (`spec/16`) and overriding a past score (`spec/14`).
- One commissioner per league; no co-commissioners.
- Every commissioner action files a Mail letter to the whole league: nothing changes quietly.

## Joining a league

- The commissioner enters a manager's email address and the app sends a sign-in link; or the
  commissioner shares the league's one invite link (say, in the group chat), and whoever opens it
  takes the next empty team. One manager runs one team.

## Assigning players

- The commissioner and the admin can both put any player on any team, one at a time (search, pick
  a team), move a player between teams, and release one to free agency.
- The league's squad limits warn but don't block.

## The mini beta

- Needed by then: creating a league and naming its commissioner, inviting managers, assigning
  players, editing the scoring set, overriding a score, correcting positions, and the feeds view.
  The rest (draft controls, trade veto, fixture editing, handing a team on, the auto team) by
  August.
