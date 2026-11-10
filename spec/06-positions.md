# 6. Positions

Feature 6 of [SPEC.md](../SPEC.md). Only Craig's answers: the first `/grill` and `/grill positions`
(20 Oct 2026).

**Contents:** [The labels](#the-labels) · [From real starts](#from-real-starts) ·
[The admin oversees them](#the-admin-oversees-them) · [New signings](#new-signings) ·
[When positions change](#when-positions-change) · [Availability](#availability)

## The labels

- Modern position labels, not FPL's four, which can be wrong. No side: a full back is a full back
  on either flank. The labels: GK, CB, FB (full back), WB (wing back), CDM, CM, WM (wide
  midfielder), CAM, W (winger), SS, ST.
- Areas each position can play (`spec/05`): GK in goal; CB and FB in defence; WB in defence and
  the wide lanes of defensive midfield and midfield; CDM in defensive midfield and midfield
  ("every CDM can play CM", Craig, 1 Nov 2026, after Wieffer and Lavia could only go in defensive
  midfield); CM in midfield; WM in midfield and the wide lanes of attacking midfield; CAM in
  attacking midfield, and in attack as false 9 only (`spec/05` Roles; "any AM", Craig, 9 Nov 2026,
  on #1196); W in attacking midfield and the wide lanes of midfield ("yes", Craig, 1 Nov
  2026, #1025, asked whether a W can fill a 4-4-2's wide-midfield slots and a WM the wide
  attacking-midfield ones); SS in attacking midfield and attack; ST in attack. `S06.6`
- A player can have more than one position.
- The same in every league. The admin corrects them; there is no per-league override.

## From real starts

- Taken from where players actually lined up in real matches (Sportmonks' lineups: formation
  position and detailed position, in place of the Premier League's team sheets; Craig, 9 Nov 2026,
  on #1196), not from a scraped site. `S06.2`
- A player gets a position after 3 starts there, counted over his last 38 starts, last season's
  and this. Coming on as a substitute gives no position.
- The starts are read once a day, early morning UK time (06:00); a run with matches still to read
  carries on straight away rather than waiting a day (Craig, 5 Nov 2026, #1194).
- Claude builds the table from a formation's places to labels from Sportmonks' lineups (formation
  position, detailed position): in a 4-2-3-1 the two deepest midfielders are CDM; in a 4-3-3 the
  three are CM. Craig checks the result on a list of last season's regulars before it is used.
  `S06.3`
- The rules follow Craig's depth chart work (starts only, 3 to get a position, a run elsewhere
  flags a change, his overrides win), not its engine.

## The admin oversees them

- At first, positions worked out from starts are proposals: they count once the admin approves
  them, a whole club or one player at a time. A setting later lets them count straight away, with
  only changes waiting for him.
- A position the admin sets stays until he removes it; starts can still add others.
- Support striker (SS): any forward (ST) or attacking midfielder (CAM, for now; not W) can play
  there, with its own scoring, rules and tactics (Craig, 22 Oct 2026). Nobody marks him by hand.
  Where SS sits is to grill: just behind the forward, or as a forward (Craig: "maybe its
  forward?").
- One admin dashboard in the beta ([15](15-admin-tools.md)): a queue (new signings, flagged and
  removed positions), search to correct any player, the thresholds, and the feeds page as a tab.

## New signings

- A new signing with no starts takes his position from Sportmonks' own label for him, and it
  counts at once, shown as unconfirmed until the admin confirms it. A clear label maps straight
  across (a full back is FB, a second striker SS); a vague one stays vague, giving every position
  it could mean ("Defender" counts as CB and FB). `S06.4`
- So does any player with fewer than 3 starts anywhere, or whose positions from starts the admin
  hasn't approved yet: he plays on his label until they are.
- A player no feed has placed yet: the admin sets his area, and he counts towards that area's
  minimum (`spec/03`) until a feed places him. With no area set he fills none: "admin set that"
  (Craig, 7 Nov 2026, on #911). `S06.1`
- The dashboard links to his Transfermarkt, FotMob and Understat pages for the admin to read;
  nothing fetches them.

## When positions change

- Positions change when a player's real-life role changes, gradually: the manager is warned first,
  then the position goes. The thresholds are admin-tunable (starting point: flagged after 3
  matches in a row elsewhere, removed after 6, only between gameweeks).
- A position change counts from each league's own deadline, never FPL's: "stop caring about fpl
  deadline, thats not improtant to us, we never use fpl deadline, thats their game" (Craig, 1 Nov
  2026; #895).
- Losing a position never makes a squad illegal. The player stays in his slot for the gameweek
  and the manager is warned.

## Availability

From `/grill the auto team and fixture edits` (5 Nov 2026).

- Every player has an availability of our own: out, doubtful or available. The auto team reads only
  that (`spec/09`): "we will need our own system for that, since that doesnt scale with leagues
  outside of prem".
- In every competition it is filled from Sportmonks' injuries and suspensions, in place of FPL's
  news and chance of playing: "ive heard its not great but lets see" (Craig, 9 Nov 2026, on
  #1196). How good it is gets judged in the Sportmonks trial. `S06.5`
- It comes from the feed, and the admin can set it by hand over the feed (`spec/15`).
