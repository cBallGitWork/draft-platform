# 22. Classic mode

Feature 22 of [SPEC.md](../SPEC.md). Only Craig's answers: the talk of 9 Nov 2026, his answers of
15 Nov 2026 (PR #2260) and `/grill classic mode` (16 Nov 2026).

A league with player and team tactics off, "essentially classic" (Craig, 9 Nov 2026). Not built
until Craig says to: "we dont build, we keep this work as a note for when we build" (9 Nov 2026).

## The switch

- The whole mode sits behind one league setting: "one feature flag" (Craig, 15 Nov 2026). The
  code's one place that asks what a league plays (#1582) is where it hangs. `S22.1`
- Classic or not is picked when the league is created, never switched mid-season: "classic/non
  classic is set up in league creation" (Craig, 15 Nov 2026). `S22.2`

## Lines

- Lines, not detailed positions: GK; DEF (CB, FB, WB); CM (CDM, CM, WM); AM (CAM, W); FWD (ST,
  SS). A second striker is FWD (Craig, 16 Nov 2026). `S22.3`
- Each player is hard-locked to one line: "dont allow am's to be cm's, just hard lock a player into
  a role" (Craig, 9 Nov 2026). `S22.4`
- Lines sit on top of the positions (`spec/06`), which stay the same in every league. A player's
  line starts as the line he has most starts in, over the last-38-starts window positions use.
  `S22.5`
- Recent starts win: "Like if itd 15 and 16 and the last 15 are at def" (Craig, 16 Nov 2026). A line
  change works as a position change does (`spec/06`, When positions change): after 3 starts in a
  row in another line the manager is warned, after 6 he moves there; the thresholds are
  admin-tunable, and the change counts from each league's own deadline, only between gameweeks.
  `S22.6`
- The admin can override a player's line. `S22.7`

## The lineup

- No formations: "classic mode doesnt use formations, its the classic fpl style drag players into
  valid formations etc, auto sub just fits them etc" (Craig, 15 Nov 2026). No presets, roles or
  team instructions. Any eleven that keep each line inside its limits stand. `S22.8`
- Each line's limits on the pitch start at GK exactly 1, DEF 3 to 5, CM 1 to 5, AM 0 to 4, FWD 1 to
  3 (Craig, 15 Nov 2026), and are a league rule the commissioner can change (Craig, 16 Nov 2026).
  `S22.9`
- The squad has no limits by line: "no squad limits" (Craig, 15 Nov 2026). `S22.10`
- An auto-sub brings on the first bench player, in bench order, who keeps the lineup valid. `S22.11`
- When no bench player keeps the lineup valid, the slot stays empty: "yes empty like classic fpl
  autosub logic" (Craig, 15 Nov 2026). `S22.12`

## Scoring

- Classic has its own base scoring set, by line (Craig, 9 Nov 2026): `S22.13`

  | | FWD | AM | CM | DEF | GK |
  |---|---|---|---|---|---|
  | Appearance | 1, or 2 at 60+ min | 1, or 2 at 60+ min | 1, or 2 at 60+ min | 1, or 2 at 60+ min | 1, or 2 at 60+ min |
  | Goal | 4 | 5 | 5 | 5 | 5 |
  | Assist | 3 | 3 | 3 | 3 | 3 |
  | Clean sheet (60+ min) | – | – | 2 | 4 | 4 |
  | Goals conceded | – | – | – | −1 per 2 | −1 per 2 |
  | Defcon | – | +1 per 5 midfield stat | +1 per 4 midfield stat | +1 per 4 defender stat | – |
  | Saves | – | – | – | – | +1 per 2 |

- The midfield stat is tackles + interceptions + blocked shots + ¼ recoveries. The defender stat is
  tackles + interceptions + blocked shots + ¼ clearances, Fantrax's DFP. Defcon counts per action,
  never FPL's all-or-nothing +2: "i dont like their defcon" (Craig, 9 Nov 2026). `S22.14`
- Every line: yellow card −1, red card −3, own goal −2, penalty missed −2, penalty saved +5
  (Craig, 16 Nov 2026). `S22.15`
- No FPL bonus. The super sub (SPEC.md, *Second release*) stays the reward for bench players.
  `S22.16`
- Goals conceded gives defenders a curve: "need defenders on mid table teams to stand out from
  lower tier still" (Craig, 9 Nov 2026). `S22.17`
- Appearance points are the classic 1, or 2 at 60 minutes: "its classic afterall" (Craig, 9 Nov
  2026). `S22.18`
- A player scores by his line's row, whatever slot he fills. `S22.19`

## Sportmonks' stats

- The rates stand on Sportmonks' stats: "we got the api back and it seemed fine" (Craig, 18 Nov
  2026). It sends the stats the midfield and defender stats are made of (tackles, interceptions,
  blocked shots, recoveries, clearances). The 9 Nov numbers came from five Premier League seasons
  (21-22 to 25-26) of FotMob and Sofascore counts. `S22.20`
