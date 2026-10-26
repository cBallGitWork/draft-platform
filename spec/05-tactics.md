# 5. Tactics

Feature 5 of [SPEC.md](../SPEC.md). Only Craig's answers: the first `/grill` and `/grill tactics`
(16 Oct 2026).

**Contents:** [The pitch](#the-pitch) · [Roles](#roles) · [The deadline](#the-deadline) ·
[Auto-subs](#auto-subs) · [Captain and set pieces](#captain-and-set-pieces) ·
[Squad numbers](#squad-numbers)

## The pitch

- Six areas, back to front: goalkeeper, defence, defensive midfield, midfield, attacking
  midfield, attack.
- Each area has five lanes across: left, left-centre, centre, right-centre, right. A slot is one
  cell of that grid; one player per cell; no rule about gaps.
- A wing-back plays in a wide lane of the defensive midfield row. He is a defender, standing
  further forward than a full-back would; on the pitch a defensive midfielder and a wing-back
  stand in the same row (Craig, 26 Oct 2026). There is no wing-back row.
- Free placement: drag a player into any free cell, Championship Manager style. Or pick a preset:
  4-4-2, 4-3-3, 4-2-3-1, 4-1-4-1, 4-4-1-1, 4-3-1-2, 3-5-2, 3-4-3, 3-4-1-2, 5-3-2, 5-4-1, all
  editable as league rules.
- Picking a preset reshapes the pitch and keeps the players: each starter moves to a slot of the
  new shape in his own area, if one is free, and anyone left over goes to the front of the bench.
  The shape's empty slots show where to drag (Craig, 26 Oct 2026; #14).
- Any player who plays in an area can fill any slot in it: the game should not get in the way of
  managers. A centre-back can fill a full-back's cell.
- For now that is the hard rule: a player fills only slots in the areas his positions play (Craig,
  25 Oct 2026: "for now im happy to just do hard rules on poisitons while we build the rest").
  Makeshift play comes later (SPEC.md, Later).
- Only a keeper plays in goal, and a keeper plays only in goal, always: "only keeper goes keeper"
  (25 Oct 2026).
- Each area's minimum and maximum are league rules. There are no defaults yet: leagues get a lot
  of freedom.
- A lineup rolls over to the next gameweek if the manager doesn't touch it.

## Roles

- Every slot has a role, the goalkeeper's included, chosen from the default set's list for the
  position the slot stands for (Craig, 26 Oct 2026):

  ```
                   LEFT            MIDDLE THREE                   RIGHT
  ATTACK           poacher, target man, pressing forward, shadow striker, false 9 (every slot)
  ATT. MIDFIELD    attacking       attacking midfield, centre     attacking
                   midfield, wide                                 midfield, wide
  MIDFIELD         wide midfield   centre midfield                wide midfield
  DEF. MIDFIELD    wing-back       defensive midfield             wing-back
  DEFENCE          full-back       centre-back                    full-back
  GOALKEEPER                       goalkeeper
  ```

  A role adjusts scoring one category at a time: an attacking role might reward key passes more,
  a defensive one defensive actions.
- The effect is flat points per action (for example +1 per key pass, −1 per clean sheet): the
  working assumption, which Craig will edit. Claude drafts the first numbers; Craig edits them
  later, by patch (26 Oct 2026).
- Every role gives something and takes something. Each is checked against last season's
  real stats: for an average player in its area it comes out within 0.25 points a match of the
  base scoring, so a role pays only for the player it suits. Roles are built before the check
  can run, as last season's stats aren't recorded yet; the check comes once they are (26 Oct
  2026).
- Roles' scoring adjustments are the site's, changed by patch (`spec/14`, 25 Oct 2026); the
  ready-made rules carry a default set.
- The default set starts as this list, made long before roles are built: every area and lane gets
  as many roles as fit, for Craig to cut much later (21 Oct 2026):
  - goalkeeper: shot-stopper, sweeper keeper
  - full-back: defensive, attacking
  - wing-back: attacking, holding
  - centre-back: stopper, ball-playing
  - defensive midfield: anchor, deep playmaker
  - centre midfield: box-to-box, playmaker, ball-winner
  - wide midfield: winger, defensive winger
  - attacking midfield, centre: number 10, shadow striker
  - attacking midfield, wide: inside forward, winger
  - attack: poacher, target man, pressing forward, shadow striker, false 9
- Roles stack with the second release's team instructions: a pressing forward under a high press
  is paid by both, and a sweeper keeper suits a high defensive line.
- A player dropped into a slot starts on the role he has the most stars for; until stars are
  built, on the slot's first role. The manager can change his slot and his role, on the Tactics
  tab's squad list, which has a role column for the starters; the pitch shows each starter's role
  under his name (26 Oct 2026).
- Being better suited to a role comes out of the scoring: a full-back makes more of what an
  attacking full-back slot pays. There is no out-of-position penalty.
- Stars: a player's rating for a role ranks him against the other players in that area, on his
  stats scored under that role over the last 38 matches he played (last season counts until this
  one fills in). Five stars is the top 5%, in half-star steps below that; the exact cut points
  are tunable. A new signing with no data shows "—"; a player with fewer than 3 matches shows
  "?", with a tooltip saying we aren't sure yet. Stars start on this season's matches held so
  far; last season's join once recorded (26 Oct 2026). Stars are a hint; they never change his
  points. Once scouts exist, a manager sees them for their own squad and for players they have
  scouted; until then, for every player (`spec/19`).
- The player card shows what his role did to his points ("Attacking full-back: +2, two key
  passes").
- Your tactics change only your own players' points, never your opponent's.

## The deadline

- One deadline per gameweek for every team, as in FPL: it locks the whole lineup, roles and formation
  included. Nothing locks player by player. Its time is a league rule; the default is FPL's own,
  90 minutes before the gameweek's first kickoff (every 2026/27 gameweek so far, checked against
  FPL's live data on 16 Oct 2026). Once passed, a deadline stays where it fell, even if the
  gameweek's first match is then postponed, as in FPL (20 Oct 2026).
- A gameweek begins at the league's own deadline, never FPL's: "ours, we arent fpl so stop copying
  them" (22 Oct 2026).

## Auto-subs

- A starter whose match ends with him on 0 minutes is replaced straight away, provisional like
  live points, final when the gameweek ends.
- The manager sets the bench order with up and down on each bench player, or by dragging him
  along the bench (Craig, 26 Oct 2026; #14).
- The first player in the manager's bench order who can play the empty slot's area takes that
  slot and its role. If none can, the first who keeps the area limits legal comes on in his own
  area, on his best-star role, and the formation changes. If no one can come on without breaking the
  limits, no one does: the slot scores nothing.
- A goalkeeper is replaced only by a goalkeeper.
- In a double gameweek, a starter who plays in either match is not subbed.
- Auto-subs are always on, and there is no limit on them, ever.

## Captain and set pieces

- The captain, the vice-captain and the set-piece lists: [17](17-captain-and-set-pieces.md).

## Squad numbers

- A manager can give his players numbers, shown on their shirts. They start from each player's
  real club number.
- A manager changes them on My team's Squad tab, any number from 1 to 99. Two of a team's players
  may wear the same number. A player who moves to another team starts afresh there, on his real
  club number (Craig, 26 Oct 2026; #13).
