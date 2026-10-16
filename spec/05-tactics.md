# 5. Tactics

Feature 5 of [SPEC.md](../SPEC.md). Only Craig's answers: the first `/grill` and `/grill tactics`
(16 Oct 2026).

## The pitch

- Six areas, back to front: goalkeeper, defence, defensive midfield, midfield, attacking
  midfield, attack.
- Each area has five lanes across: left, left-centre, centre, right-centre, right. A slot is one
  cell of that grid; one player per cell; no rule about gaps.
- A wing-back plays in a wide lane of the defensive midfield or midfield row. There is no
  wing-back row.
- Free placement: drag a player into any free cell, Championship Manager style. Or pick a preset:
  4-4-2, 4-3-3, 4-2-3-1, 4-1-4-1, 4-4-1-1, 4-3-1-2, 3-5-2, 3-4-3, 3-4-1-2, 5-3-2, 5-4-1, all
  editable as league rules.
- Any player who plays in an area can fill any slot in it: the game should not get in the way of
  managers. A centre-back can fill a full-back's cell.
- Each area's minimum and maximum are league rules. There are no defaults yet: leagues get a lot
  of freedom.
- A lineup rolls over to the next gameweek if the manager doesn't touch it.

## Roles

- Every slot has a role, the goalkeeper's included, two or three to choose from, offered by the
  slot's area and lane. A wide defensive-midfield cell offers the wing-back roles; a wide
  midfield cell offers winger, defensive winger and attacking wing-back. A role adjusts scoring
  one category at a time: an attacking role might reward key passes more, a defensive one
  defensive actions.
- The effect is flat points per action (for example +1 per key pass, −1 per clean sheet): the
  working assumption, which Craig will edit.
- Every role gives something and takes something. Each is checked against last season's
  real stats: for an average player in its area it comes out close to the base scoring, so a role
  pays only for the player it suits.
- Roles and their adjustments are league rules; the ready-made rules carry a default set.
- The default set starts as a basic list, filled out later:
  - goalkeeper: shot-stopper, sweeper keeper
  - full-back: defensive, attacking
  - wing-back: attacking, holding
  - centre-back: stopper, ball-playing
  - defensive midfield: anchor, deep playmaker
  - centre midfield: box-to-box, playmaker, ball-winner
  - wide midfield: winger, defensive winger
  - attacking midfield, centre: number 10, shadow striker
  - attacking midfield, wide: inside forward, winger
  - attack: poacher, target man, pressing forward
- Roles stack with the second release's team instructions: a pressing forward under a high press
  is paid by both, and a sweeper keeper suits a high defensive line.
- A player dropped into a slot starts on the role he has the most stars for. The manager can
  change his slot and his role.
- Being better suited to a role comes out of the scoring: a full-back makes more of what an
  attacking full-back slot pays. There is no out-of-position penalty.
- Stars: a player's rating for a role ranks him against the other players in that area, on his
  stats scored under that role over the last 38 matches he played (last season counts until this
  one fills in). Five stars is the top 5%, in half-star steps below that; the exact cut points
  are tunable. A new signing with no data shows "—". Stars are a hint; they never change his
  points.
- The player card shows what his role did to his points ("Attacking full-back: +2, two key
  passes").
- Your tactics change only your own players' points, never your opponent's.

## The deadline

- One deadline per gameweek for every team, as in FPL: it locks the whole lineup, roles and formation
  included. Nothing locks player by player. Its time is a league rule; the default is FPL's own,
  90 minutes before the gameweek's first kickoff (every 2026/27 gameweek so far, checked against
  FPL's live data on 16 Oct 2026).

## Auto-subs

- A starter whose match ends with him on 0 minutes is replaced straight away, provisional like
  live points, final when the gameweek ends.
- The first player in the manager's bench order who can play the empty slot's area takes that
  slot and its role. If none can, the first who keeps the area limits legal comes on in his own
  area, on his best-star role, and the formation changes. If no one can come on without breaking the
  limits, no one does: the slot scores nothing.
- A goalkeeper is replaced only by a goalkeeper.
- In a double gameweek, a starter who plays in either match is not subbed.
- Auto-subs are always on, and there is no limit on them, ever.

## Squad numbers

- A manager can give his players numbers, shown on their shirts. They start from each player's
  real club number.
