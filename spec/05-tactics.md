# 5. Tactics

Feature 5 of [SPEC.md](../SPEC.md). Only Craig's answers: the first `/grill` and `/grill tactics`
(16 Oct 2026), `/grill the Tactics pitch` (31 Oct 2026), and his answers on the Tactics pictures
(1 Nov 2026).

**Contents:** [The pitch](#the-pitch) · [Moving players](#moving-players) ·
[What the pitch shows](#what-the-pitch-shows) · [Runs](#runs) · [Roles](#roles) ·
[The deadline](#the-deadline) · [Auto-subs](#auto-subs) ·
[Captain and set pieces](#captain-and-set-pieces) · [Squad numbers](#squad-numbers)

## The pitch

- Six areas, back to front: goalkeeper, defence, defensive midfield, midfield, attacking
  midfield, attack.
- Each area has five lanes across: left, left-centre, centre, right-centre, right. A slot is one
  cell of that grid; one player per cell; no rule about gaps.
- A wing-back plays in a wide lane of the defensive midfield or midfield row. There is no
  wing-back row. He is a defender, standing further forward than a full-back would; on the pitch
  a defensive midfielder and a wing-back stand in the same row (Craig, 26 Oct 2026).
- A sweeper plays the centre cell of the defence row, drawn a little deeper than the line, as a
  wing-back is a defender drawn further forward. There is no sweeper row, so the six areas, their
  limits and the presets stand. Any player who plays centre-back can play sweeper: "we need a
  sweeper position, it's a real role, esp with classic formations" (Craig, 31 Oct 2026).
- That centre cell offers the centre-back roles and the sweeper roles. It is a sweeper's cell,
  labelled SW and drawn deeper, only while its player is on a sweeper role, so a back three keeps a
  plain centre-back in the middle (Craig, 31 Oct 2026).
- Free placement: drag a player into any free cell, Championship Manager style. Or pick a preset:
  4-4-2, 4-3-3, 4-2-3-1, 4-1-4-1, 4-4-1-1, 4-3-1-2, 3-5-2, 3-4-3, 3-4-1-2, 5-3-2, 5-4-1, 4-5-1,
  4-2-2-2, 4-1-2-1-2, 4-3-2-1, 4-1-3-2, 4-2-4, 3-4-2-1, 3-1-4-2, 5-2-3, 5-3-1-1, all editable as
  league rules. The last ten Craig added (28 Oct 2026): "no basics like 4-5-1".
- Picking a preset reshapes the pitch and keeps the players: each starter moves to a slot of the
  new shape in his own area, if one is free, and anyone left over goes to the front of the bench.
  The shape's empty slots show where to drag (Craig, 26 Oct 2026; #14).
- A manager can save his own presets: "no home away silly but saved presets good. They include
  formation and roles. Players change too much to save" (Craig, 1 Nov 2026). A saved preset holds
  the formation and each slot's role, never players. Applying one reshapes the pitch as above and
  puts each slot on its role. They come from FM's saved tactics, a to-grill row this settles.
- The formation window keeps classic sides as ready-made formation-plus-roles, and the modern ones
  too: "4 yes and re write" (Craig, 1 Nov 2026, asked whether to keep the classic and modern
  formations). Their text is sample until Craig rewrites it.
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
- A team has a lineup from the moment it has its squad: "you don't save to create, you save to
  edit". The first is a 4-4-2 filled in draft selection order, each slot by the first player
  picked who plays there, and the rest on the bench in that order (Craig, 29 Oct 2026). Each pick
  goes onto the pitch as the team drafts (Craig, 31 Oct 2026: "its ny draft order, so when a team is
  drafting they just start filling the pitch"): into the deepest open slot he can play; with none open, onto the
  bench in pick order; with no positions yet, onto the bench until his manager moves him. If the
  4-4-2 leaves a slot empty, the first lineup takes the first formation the squad fills completely
  within the league's area limits, from the league's presets in order (Craig, 31 Oct 2026:
  "or find a legal formatin with 2 defenders"; then, 1 Nov 2026, on which shapes: "just the first
  that works from our preset list"; #866). Only if none fits does a slot stay empty: it
  scores nothing, and never makes the lineup illegal or switches the auto team on.

## Moving players

From `/grill the Tactics pitch` (Craig, 31 Oct 2026), unless dated otherwise.

- Tap a player and everywhere he can go lights up: each free cell he can take and each player
  he can swap with, with his stars there. Anything that would break the area limits stays unlit.
  Tap a lit cell to move him, or a lit player to swap them. Dragging still works.
- Dropping a player on another swaps them, starter for starter or bench for starter. Each lands on
  the role he has the most stars for in his new slot (Roles).
- The lineup saves itself after each valid move. There is no Save button.
- Undo goes back through every move since the manager opened the Tactics tab this visit. A save
  doesn't clear it: "save doesn't mean we leave the page" (Craig, 31 Oct 2026).
- Quick Pick fills the current shape with the best eleven by stars.

## What the pitch shows

From `/grill the Tactics pitch` (Craig, 31 Oct 2026).

- Each starter's shirt, a little bigger than today's, as on FM's, CM's, FPL's and Draft Fantasy's
  pitches.
- Under it, a chip in his area's colour (goalkeeper, defence, midfield, attack) with his role's
  short code, his stars for that role, his name, and his real opponent this gameweek ("COV (H)")
  in the fixture-difficulty colour: both opponents in a double gameweek, none in a blank one.
- A role's code is at most three letters, one per role, held with the role. The pitch shows the
  code at every width; the squad list and the role card show the full name.
- Each slot shows its position label, which names the position, never its side: `spec/06`'s
  labels, plus SW for the sweeper. "We don't need side specific, that's the game getting in the
  way."
- The team's next head-to-head opponent shows on the Tactics tab.
- Everything settled here is built on the desk first, then cut from the real page: "show ALL
  info first and then refactor from there... I need the context of our full pages built so we can
  then see what's needed".

## Runs

From `/grill the Tactics pitch` (Craig, 31 Oct 2026).

- A starter's role has a run: where he goes as if it were a real match, drawn as a dashed arrow
  from his place, as old FM drew them. An attacking full-back's runs forward; a crosser's, a
  sweeper's and a pressing forward's each have their own line. "The arrow isn't about points."
- A role that holds its place has no run.
- On the desk every moving role's run shows, with a switch to hide them. On a phone only the
  tapped player's run shows.
- A role's run is held with the role and can change by patch with it, never drawn in the code.
- Each role's real run needs its own research. Until then each moving role gets a rough first run
  from FM's nearest role, marked rough, for Craig to refine.
- The matchup's lineups show the runs too (`spec/10`).

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
  DEFENCE          full-back       centre-back; sweeper (centre)  full-back
  GOALKEEPER                       goalkeeper
  ```

  A role adjusts scoring one category at a time: an attacking role might reward key passes more,
  a defensive one defensive actions.
- The effect is flat points per action (for example +1 per key pass, −1 per clean sheet): the
  working assumption, which Craig will edit. Claude drafts the first numbers; Craig edits them
  later, by patch (26 Oct 2026).
- Every role gives something and takes something. Each is checked against last season's
  real stats: for an average player in its area it comes out within 0.25 points a match of the
  base scoring, so a role helps only the player it suits. Roles are built before the check
  can run, as last season's stats aren't recorded yet; the check comes once they are (26 Oct
  2026).
- Roles' scoring adjustments are the site's, changed by patch (`spec/14`, 25 Oct 2026); the
  ready-made rules carry a default set.
- A patch changes a role's scoring but doesn't remove a role (Craig, 31 Oct 2026). If a role ever
  goes, each starter holding it moves to the role he would get dropped into that slot, when the
  change takes effect, and never has his lineup refused; the patch's letter tells each manager
  which of his starters changed role, from what to what (for example "Saka: shadow striker → poacher").
- The default set starts as this list, made long before roles are built: every area and lane gets
  as many roles as fit, for Craig to cut much later (21 Oct 2026):
  - goalkeeper: shot-stopper, sweeper keeper
  - full-back: defensive, attacking
  - wing-back: attacking, holding
  - centre-back: stopper, ball-playing
  - sweeper, offered in the defence row's centre cell beside the centre-back roles: sweeper
    (stays behind the line), libero (steps out with the ball), added by Craig (31 Oct 2026)
  - defensive midfield: anchor, deep playmaker
  - centre midfield: box-to-box, playmaker, ball-winner
  - wide midfield: winger, defensive winger
  - attacking midfield, centre: number 10, shadow striker
  - attacking midfield, wide: inside forward, winger
  - attack: poacher, target man, pressing forward, shadow striker, false 9
- Roles stack with the second release's team instructions: a pressing forward under a high press
  earns both adjustments, and a sweeper keeper suits a high defensive line.
- A player dropped into a slot starts on the role he has the most stars for; until stars are
  built, on the slot's first role. The manager can change his slot and his role; the pitch shows
  each starter's role under his name (26 Oct 2026). He changes the role on the role card, opened
  by tapping the role on the pitch or in the squad list (Craig, 31 Oct 2026).
- The role card shows every role for his slot, each with his stars, what it scores more and less
  for, its description, and what he would have scored under it in his recent matches. Each role's
  description is held with the role. Explaining the game's own mechanics is wanted; only the
  basics any fantasy manager knows go unsaid: "when I say don't explain the game, I mean the absolute basic things
  like 'this is a league, round robin'; explaining game mechanics is highly encouraged" (Craig,
  31 Oct 2026).
- Being better suited to a role comes out of the scoring: a full-back makes more of an
  attacking full-back slot's role adjustment. There is no out-of-position penalty.
- Stars: a player's rating for a role ranks him against the other players in that area, on his
  stats scored under that role over the last 38 matches he played (last season counts until this
  one fills in). Five stars is the top 5%, in half-star steps below that; the exact cut points
  are tunable. A new signing with no data shows "—"; a player with fewer than 3 matches shows
  "?", with a tooltip saying we aren't sure yet. Stars start on this season's matches held so
  far; last season's join once recorded (26 Oct 2026). Stars are a hint; they never change his
  points. Once scouts exist, a manager sees them for their own squad and for players they have
  scouted; until then, for every player (`spec/19`).
- How stars are worked out (Craig, 1 Nov 2026):
  - A match counts once its stats are final, if he got on the pitch: cameos count, an unused
    substitute's doesn't.
  - He is ranked on his points per match played.
  - The players he is ranked against are everyone who can play that area with at least 3 counted
    matches; "?" and "—" players are left out.
  - Early in a season, while few have played, the pool fills from last season's matches: "use past
    data".
  - He has one rating per role per area, so a shadow striker at number 10 and up front are rated
    apart, and he is rated for every role in every area his positions play.
  - His matches are priced under today's scoring, so a patch re-rates everyone when it takes
    effect.
  - Half a star is the lowest. The first cut points: five stars for the top 5%, then 4.5 from the
    85th percentile, 4 from the 75th, 3.5 from the 65th, 3 from the 55th, 2.5 from the 45th, 2 from
    the 35th, 1.5 from the 25th, 1 from the 15th, and half a star below that.
  - Where two roles tie for his most stars, or he shows "?" or "—", he starts on the slot's first role.
  - Every placement is a drop into a slot: dragging or swapping him, the first lineup and each
    draft pick going onto the pitch, a preset moving him to a slot that doesn't offer his role,
    and an auto-sub coming on in his own area.
- The player card shows what his role did to his points ("Attacking full-back: +2, two key
  passes").
- Your tactics change only your own players' points, never your opponent's.

## The deadline

- One deadline per gameweek for every team, as in FPL: it locks the whole lineup, roles and formation
  included. Nothing locks player by player. Its time is a league rule; the default is FPL's own,
  90 minutes before the gameweek's first kickoff (every 2026/27 gameweek so far, checked against
  FPL's live data on 16 Oct 2026). Once passed, a deadline stays where it fell, even if the
  gameweek's first match is then postponed, as in FPL (20 Oct 2026). A gameweek FPL stops sending
  keeps its last deadline (Craig, 1 Nov 2026: "Keeps its last deadline"; #202).
- A gameweek begins at the league's own deadline, never FPL's: "ours, we arent fpl so stop copying
  them" (22 Oct 2026).
- A player who joins the squad goes to the end of the bench, in the order he joined, until the
  manager moves him (Craig, 28 Oct 2026).

## Auto-subs

- A starter whose match ends with him on 0 minutes is replaced straight away, provisional like
  live points, final when the gameweek ends.
- Every squad player not in the eleven is on the bench, in the manager's order. There are no
  reserves: "ditch reserves. Just make bench bigger for bigger squads" (Craig, 1 Nov 2026).
- The manager sets the bench order with up and down on each bench player, or by dragging him
  along the bench (Craig, 26 Oct 2026; #14).
- The first player in the manager's bench order who can play the empty slot's area takes that
  slot and its role. If none can, the first who keeps the area limits legal comes on in his own
  area, on his best-star role, and the formation changes. If no one can come on without breaking the
  limits, no one does: the slot scores nothing.
- A starter's slot left empty because he left the squad (dropped, traded or claimed away) is
  filled from the bench the same way, as if he hadn't played (Craig, 28 Oct 2026).
- A player in the lineup whom the football data no longer holds: "score him like he didnt play,
  we can always admin update later" (Craig, 31 Oct 2026; #810).
- An abandoned match counts as never played: "abndoned match is essentailly null like it didnt
  happen, so a player in an absondeoned match would get auto subbed" (Craig, 1 Nov 2026; #904).
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
