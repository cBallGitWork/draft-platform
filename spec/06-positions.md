# 6. Positions

Feature 6 of [SPEC.md](../SPEC.md). Only Craig's answers.

- Modern position labels (RB, CB, CDM, CAM, LW, ST and so on), not FPL's four, which can be wrong.
- Taken from where players actually lined up in real matches (the Premier League's formation
  lines), not from a scraped site. A new signing with no matches is set by an admin.
- A player can have more than one position.
- Support striker (SS) is a position. Lineups alone can't tell him from a number 10, so an admin
  marks him, as with a new signing.
- Areas each position can play (`spec/05`): RB, CB, LB in defence; RWB and LWB in defence and
  the wide lanes of defensive midfield and midfield; CDM in defensive midfield; CM, RM, LM in
  midfield; CAM, RW, LW in attacking midfield; SS in attacking midfield and attack; ST in attack.
- The same in every league. An admin corrects them; there is no per-league override.
- Positions change when a player's real-life role changes, gradually: the manager is warned first,
  then the position goes. The thresholds are admin-tunable (starting point: flagged after 3
  matches in a row elsewhere, removed after 6, only between gameweeks).
- Losing a position never makes a squad illegal. The player stays in his slot for the gameweek
  and the manager is warned.
