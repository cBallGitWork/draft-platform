# 5. Tactics

Feature 5 of [SPEC.md](../SPEC.md). Only Craig's answers: the first `/grill` and `/grill tactics`
(16 Oct 2026), `/grill the Tactics pitch` (31 Oct 2026), and his answers on the Tactics pictures
(1 Nov 2026).

**Contents:** [The pitch](#the-pitch) · [Moving players](#moving-players) ·
[What the pitch shows](#what-the-pitch-shows) · [Runs](#runs) ·
[Team instructions](#team-instructions) · [Saved plans](#saved-plans) · [Roles](#roles) ·
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
- Sweeper and libero are centre-back roles, offered to every centre-back whenever the formation
  has three or more centre-backs, on as many of them as the manager likes. There is no sweeper
  cell, no SW label and no drawing him deeper: "we could only allow it when theres 3 cbs,
  indivoduals cells is just getting in the way"; "no limits" (Craig, 4 Nov 2026). It replaces the
  sweeper's cell of 31 Oct 2026, and the role stays: "it's a real role, esp with classic
  formations".
- Presets only: the shape always comes from a preset or a classic, and no player moves into an
  empty cell. "we dont allow users to move the individual pieces around, we have lots of
  formations already"; "i think i just dont like hacing 2 cbs and fb for exampel"; "to me, presets
  just sort all this out" (Craig, 1 Nov 2026). Free placement, Championship Manager style, is
  dropped. The presets: 4-4-2, 4-3-3, 4-2-3-1, 4-1-4-1, 4-4-1-1, 4-3-1-2, 3-5-2, 3-4-3, 3-4-1-2,
  5-3-2, 5-4-1, 4-5-1, 4-2-2-2, 4-1-2-1-2, 4-3-2-1, 4-1-3-2, 4-2-4, 3-4-2-1, 3-1-4-2, 5-2-3,
  5-3-1-1, 3-6-1, all editable as league rules. Ten of them Craig added (28 Oct 2026): "no basics
  like 4-5-1"; 3-6-1 he added (1 Nov 2026: "also add 3-6-1"). Then, from Craig on 1 Nov 2026
  ("also formations with 2 at the back"): 2-3-5 and 2-3-2-3.
- There are no sweeper or libero presets, and a preset sets no player's role: sweeper and libero
  are centre-back roles only (above). "we made sweeper a role and liberio, ditched sweeper
  formations" (Craig, 5 Nov 2026), dropping the 5(SW)-3-2 and 3(L)-5-2 of 4 Nov 2026.
- 2-3-5 has two centre-backs, three central midfielders and all five attack lanes; 2-3-2-3 has the
  same back two and middle three, two central attacking midfielders and three central forwards
  (Craig, 4 Nov 2026: "yes").
- A starter leaves the pitch only by swapping with a bench player, so the eleven stay eleven. A
  refused move says why in the line under the toolbar where "Lineup saved" shows (Craig,
  4 Nov 2026, "yes" to Claude's recommendation).
- Classics are famous sides' formations, each a league rule like a preset, which the ready-made
  rules carry. A classic sets its shape, every slot's role and its team instructions, which
  Claude drafts and Craig edits (Craig, 1 Nov 2026). They include Keegan's Newcastle
  ("both wide mids whip in crossers, strikers going for hearders, cb and both cms attack"),
  Barcelona's tiki-taka and Hungary in the 50s.
- A manager can change a classic's roles or instructions, never its shape. Once he does, it
  becomes custom (Craig, 1 Nov 2026: "when a change is made it becomes custom, and it can be
  saved"; then "only preset formations ,but we can still save the strategy").
- Picking a preset reshapes the pitch and keeps the players: each starter moves to a slot of the
  new shape in his own area, if one is free, and anyone left over goes to the front of the bench.
  (Craig, 26 Oct 2026; #14).
- A starter with no free slot in his own area moves to the nearest free slot in any area his
  positions play, and only a player with none goes to the bench (Craig, 1 Nov 2026, after a
  4-4-2 turned 4-2-3-1 benched its midfield: "it just put players on the bench, left half the
  team out").
- Everyone takes a slot in his own area before anyone moves across, and of two areas as near, a
  player moving across takes the deeper (Craig, 1 Nov 2026). A plain CM or WM still goes to the
  bench in a 4-2-3-1, which has no midfield row.
- Then the bench fills the new shape's empty slots: each bench player, in bench order, takes a
  free slot he plays ("yes", Craig, 1 Nov 2026, #1025, asked whether the bench fills the empty
  slots it plays, in bench order).
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

- Tap a player and each player he can swap with lights up, with his stars there. Anything that
  would break the area limits stays unlit. Tap a lit player to swap them, or drag him onto one.
  There are no empty cells to move into: presets only (Craig, 1 Nov 2026).
- While a player is picked up, each lit starter's chip shows the picked-up player's stars for the
  role he would land on in that slot, marked as his, and goes back to the starter's own stars when
  he is put down. When a starter is picked up, each lit bench player shows his own stars for that
  starter's slot. The pitch only: the Selection table keeps each row's own Role fit (Craig, 7 Nov
  2026, on #11: "a" to all three). `S05.9`
- Dropping a player on another swaps them, starter for starter or bench for starter. Each lands on
  the role he has the most stars for in his new slot (Roles).
- The lineup saves itself after each valid move. A line by the deadline countdown says when it
  last did ("Lineup saved 14:02"; Craig, 1 Nov 2026).
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
  labels. "We don't need side specific, that's the game getting in the
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
- A role's run is held with the site's scoring set, beside the roles' adjustments, so an
  announced patch can change it, never drawn in the code: "Yes change role arrow allowed" (Craig,
  7 Nov 2026, on #886; "probably not but allow the capability?", 1 Nov 2026). `S05.8`
- Each role's real run needs its own research. Until then each moving role gets a rough first run
  from FM's nearest role, marked rough, for Craig to refine.
- The matchup's lineups show the runs too (`spec/10`).

## Team instructions

From Craig, 1 Nov 2026, brought into the mini beta from the second release; the list, the shapes
and how they score from Craig, 4 Nov 2026.

- A manager picks one attacking and one defensive instruction at a time. Craig was open to one in
  all ("no i can agree if we think its better") and kept one of each, so a team says how it
  attacks and how it defends.
- The default set, each a league rule like the presets, with a description held with it; Claude
  drafts them and Craig edits them. "more straigh froward tactics with charcter too, like boot ito
  the big man"; "we still need pressing/high line/clear it/pass out from the back":

  | | instruction | rewards | costs | needs |
  |---|---|---|---|---|
  | attacking | Play out from the back | the keeper's and defenders' passing | errors leading to a shot or goal | any shape |
  | | Boot it to the big man | headed goals, forwards' aerials won | the back line's failed long balls | one up top, no wingers |
  | | Get it wide | crosses | failed crosses | wide players or wing-backs on both flanks |
  | | Shoot on sight | goals and shots on target from outside the box | long shots off target or blocked | any shape |
  | | Gung-ho | goals and assists | goals conceded | two at the back |
  | defensive | Press high | possession won high and in midfield | fouls | three or more in midfield or attack |
  | | Hold a high line | defenders' offsides won and interceptions | goals conceded | a back three or four |
  | | Clear it | defenders' clearances and blocks | defenders losing the ball | any shape |
  | | Get stuck in | tackles and duels won | cards and fouls | any shape |
  | | Keep it tight early | a clean sheet at half-time | goals let in before half-time | any shape |
  | | Park the bus | the keeper's and defenders' clean sheets | goals and assists | five at the back |

- A formation offers every instruction its shape allows, so the shape decides the list: "we have
  to block it from certain formations". Each formation has a default attacking and a default
  defensive instruction.
- Changing formation keeps an instruction the new shape allows. One it blocks switches to the new
  formation's default for that side, and the line under the toolbar says so ("Park the bus needs 5
  at the back: switched to Keep it tight early"): "if you change formation, yuour invlaid tactic
  auto gets changed to a vlaid one". Loading a plan or picking a classic sets both instructions
  itself.
- An instruction is scored player by player, on each player's own club's real match, for every
  starter and every bench player who comes on. A clean sheet or a goal conceded is his club's
  while he was on the pitch, as in base scoring. It shows as its own line under his role's line on
  the matchup breakdown ("Park the bus: clean sheet +1").
- Like a role, it is whole points by thresholds, and the values come from backtesting. The first
  values are Claude's backtest of 26/27 gameweeks 1 to 9, in
  [roles-first-values.md](../docs/roles-first-values.md); Craig edits them by patch.
- Two at the back changes base scoring for its keeper and defenders whatever instruction is
  picked: a clean sheet is worth 3, and every goal conceded costs 1. "2 at the back wont have many
  and punsih goals conceded ... clean sheets is 3, every goal conceded -1" (Craig, 4 Nov 2026). It
  is held with the formation as a league rule, never in the code.

## Saved plans

From Craig, 1 Nov 2026.

- A plan is a formation, every slot's role and both team instructions, saved by name with the
  Tactics tab's Save plan button: "a saved plan is the formation and tactics". A custom
  formation can be saved as one.
- A plan never holds players: "Players change too much to save" (Craig, 1 Nov 2026).
- A manager keeps up to 5. Loading a plan reshapes the pitch keeping the players, as picking a
  preset does. A move after loading changes only this week's lineup; the plan changes only when
  he saves it again (Craig, 1 Nov 2026).

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
  DEFENCE          full-back       centre-back (sweeper, libero)  full-back
  GOALKEEPER                       goalkeeper
  ```

  A role adjusts scoring one category at a time: an attacking role might reward key passes more,
  a defensive one defensive actions.
- Whole points by thresholds, never per action or in decimals: "lets not do a decimals, not 1 per,
  lets use thresholds lie 1 for every 2/3 etc" (Craig, 4 Nov 2026). A role has a bonus and a cost.
  The bonus is a mix of its stats ("aerial + someting else *0.5 + something else") and earns +1 at
  each of up to three bars; the cost is one bad action and takes 1 at each of up to three bars. A
  role never costs for a good action (4 Nov 2026).
- So a role moves a player by at most 3 points a match either way: ±3, chosen over ±2 (Craig,
  5 Nov 2026). At ±2 more than a third of starts sat on the ceiling, so a good fit and a great fit
  scored the same.
- The bars count per match, whatever his minutes: a cameo's count as a full match's (Craig, 5 Nov
  2026: "Yes: bars count per match, whatever his minutes"). `S05.1`
- The player card's line for a role gives the net and each side that moved him: "Poacher: +1 (+2:
  1 goal in box, 1 shot on target in box; −1: 1 big chance missed)" (Craig, 5 Nov 2026: "One line
  with the net and each side"). `S05.2`
- Roles lift the slots that score less, as defcon does in FPL: "roles/tactics are essentially a
  dynamic defcon for each positon and role". Every slot has a target role bonus a start: half its
  gap in base points to strikers, plus 0.5 for every slot, as "i do want players to get points"
  and "goals/assists still should be the mainf actor" (Craig, 4 Nov 2026):

  | slot | ST | AM / W | WM | GK | WB / CM | FB / DM | CB |
  |---|---|---|---|---|---|---|---|
  | target role bonus a start | +0.5 | +0.6 | +0.8 | +0.9 | +1.0 | +1.1 | +1.2 |

  Every role in a slot aims at its slot's target, so picking the role that suits the player is
  the skill. The check: over the slot's real starts, each role's average lands within 0.25 points
  a match of its target. It replaces the check against base scoring of 26 Oct 2026. The check is a
  backtest over past seasons' real stats, never this season's gameweeks, so the other seasons'
  data comes first: "argh again your making it sound like "this project is live now so we test
  it" we try get other seasons data first to create the intiial backtest" (Craig, 5 Nov 2026).
  The past seasons are copied on Craig's Mac, plus small files the backtest reads ("You copy them
  on your Mac, plus small files"); a role stat a past season lacks takes its nearest past stat, or
  the role is marked not tested ("Nearest past stat, else "not tested""); a past start counts in
  the slot he started that match in ("Where he started that match"); and the scoring ships before
  the backtest ("Scoring first"; all Craig, 5 Nov 2026).
- The past seasons for the backtest live in Convex, where it reads them: "convex" (Craig, 7 Nov
  2026, on #1196). `S05.11`
- A role the backtest puts more than 0.25 points a start off its target fails it, and the build
  redrafts its values until it lands within 0.25. The new values go into the site's set as a patch
  from the next gameweek not begun, and the PR lists each role it changed, old against new, for
  Craig to check (Craig, 7 Nov 2026, on #10: "a"). `S05.10`
- Claude drafts the first values and Craig edits them by patch (26 Oct 2026). The first values,
  fitted to 26/27 gameweeks 1 to 9, are in [roles-first-values.md](../docs/roles-first-values.md).
  They went into the site's set as its starting rules, taking effect from the next gameweek that
  hadn't begun, with no letter; later changes go by patch (Craig, 5 Nov 2026: "put
  roles-first-values.md into the site's set now as the starting rules"). `S05.3`
- Roles' scoring adjustments are the site's, changed by patch (`spec/14`, 25 Oct 2026); the
  ready-made rules carry a default set.
- A patch changes a role's scoring but doesn't remove a role (Craig, 31 Oct 2026). If a role ever
  goes, each starter holding it moves to the role he would get dropped into that slot, when the
  change takes effect, and never has his lineup refused; the patch's letter tells each manager
  which of his starters changed role, from what to what (for example "Saka: shadow striker → poacher").
- The default set, drafted slot by slot with Craig on 4 and 5 Nov 2026 from FM's and real
  football's roles; it replaces the first list of 21 Oct 2026:
  - goalkeeper: shot-stopper, sweeper keeper, distributor, commanding keeper (added 5 Nov 2026).
    The shot-stopper earns for saves, so a busy keeper at a weaker club earns most (Craig, 5 Nov
    2026)
  - full-back: overlapping, underlapping, inverted, playmaking, defensive
  - wing-back: attacking, holding, complete, inverted, goalscoring ("munoz needs to be there,
    alonso back in the day")
  - centre-back: stopper, ball-playing, no-nonsense, attacking, and with three or more
    centre-backs sweeper (stays behind the line) and libero (steps out with the ball)
  - defensive midfield: metronome, quarterback, half-back (drops between the centre-backs),
    engine, tower (wins everything in the air), destroyer (gets stuck in, duels)
  - centre midfield: box-to-box, ball-winner, attacking 8, engine, late runner
  - wide midfield: wide workhorse, defensive winger, wide playmaker, crosser, touchline winger
  - attacking midfield, centre: number 10, shadow striker, maverick, carrier, pressing 10
  - attacking midfield, wide: touchline winger, dribbler, inside forward, wide playmaker, wide
    forward, pressing winger, tracking winger
  - attack: poacher, target man, in-behind striker, pressing forward, shadow striker, false 9

  There is no free role: "we ditched free role" (Craig, 5 Nov 2026), dropping the one per team of
  1 Nov 2026. The rest of the first list went as the slots were drafted. Craig cut the complete forward,
  deep-lying forward, enganche, tempo-setter and inside midfielder by name ("english wont know
  Trequartista and Enganche"); others were renamed, as the advanced forward became the in-behind
  striker, the classic winger the touchline winger and the wide midfielder the wide workhorse.
  The attacking centre-back is for Keegan's Newcastle.
- Each role says what it rewards and what it costs, as categories without values ("not a value,
  just what that role should reward/give minus too"; Craig, 1 Nov 2026). The values come from
  backtesting.
- Roles and team instructions add up, with no cap on the two together beyond the role's own ±3
  (Craig, 5 Nov 2026).
- Roles stack with team instructions: a pressing forward under a high press earns both
  adjustments, and a sweeper keeper suits a high defensive line.
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
- Every squad player not in the eleven is on the bench; there are no reserves: "ditch reserves. Just make bench bigger for bigger squads" (Craig, 1 Nov 2026).
- The manager sets the bench order with up and down on each bench player, or by dragging him
  along the bench (Craig, 26 Oct 2026; #14).
- The first player in the manager's bench order who can play the empty slot's area takes that
  slot and its role. If none can, the first who keeps the area limits legal comes on in his own
  area, on his best-star role, and the formation changes. If no one can come on without breaking the
  limits, no one does: the slot scores nothing.
- His best-star role is the one he had the most stars for when the lineup locked at the
  gameweek's deadline, so scoring the gameweek again never moves it: Saka at 4 stars as an inside
  forward at Saturday's deadline still comes on as an inside forward after Monday's match makes
  him a 4.5-star winger (Craig, 1 Nov 2026).
- A starter's slot left empty because he left the squad (dropped, traded or claimed away) is
  filled from the bench the same way, as if he hadn't played (Craig, 28 Oct 2026).
- A player in the lineup whom the football data no longer holds: "score him like he didnt play,
  we can always admin update later" (Craig, 31 Oct 2026; #810).
- An abandoned match counts as never played: "abndoned match is essentailly null like it didnt
  happen, so a player in an absondeoned match would get auto subbed" (Craig, 1 Nov 2026; #904).
- The feed marks a match abandoned, and the admin can mark it when the feed doesn't: "the feed
  should say it's abandoned", then "a" to the admin marking it as well (Craig, 7 Nov 2026, on
  #904), after "admin mark it but we need to get away from relying on FPL, doesn't scale other
  leagues" (2 Nov 2026). `S05.6`
- An abandoned match's player stats are deleted, and only its replay counts: "removed, first game
  never happened". A league's points overrides on it (`spec/14`) are deleted with it: "abandoned
  match essentially doesn't happen" (Craig, 7 Nov 2026, on #904). `S05.7`
- A postponed match counts as never played, so its players are auto-subbed, unless it is
  rearranged into the same gameweek: "postponed match should mean an auto subbed if the match is
  not rearranged to be in the gameweek" (Craig, 1 Nov 2026; #900). `S05.4`
- A goalkeeper is replaced only by a goalkeeper, and never comes on for an outfield player, even
  where the league's limits allow two in goal: "dont allow 2 in goal" (Craig, 1 Nov 2026; #900). `S05.5`
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
