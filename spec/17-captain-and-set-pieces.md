# 17. Captain and set pieces

Feature 17 of [SPEC.md](../SPEC.md). Only Craig's answers, from `/grill captain and set-piece
takers` (16 Oct 2026). It sits on tactics ([5](05-tactics.md)).

## The captain

- The manager picks a captain from his starters, and a vice-captain from his starters.
- The captain leads by example, like a real club captain: a role-style adjustment, give and take,
  as a league rule. He gains for playing the full 90 and for his club winning; he loses more than
  usual for a yellow card, and far more for a red. The defaults are priced against last season, as
  roles are, so the armband earns only for a captain who suits it.
- His club's result is not a per-player stat in the feeds: it comes from the match's score, so
  scoring takes it in as a new category (`spec/14`).
- There is no points multiplier.
- The vice-captain takes the armband when the captain's match ends with him on 0 minutes: the same
  trigger as an auto-sub (`spec/05`).

## Set-piece takers

Dropped 9 Nov 2026 (#1196): "we didthced set piece taker (unless its a role)" (Craig). The four
answers below stay for the record.

- Penalties, free kicks and corners each have a set-piece list: the manager's order of up to three
  of his players, pre-filled from FPL's order for that duty. Dropped with the set-piece lists.
  `S17.1 withdrawn`
- A bench player can be on a list (a manager benches a player carrying a knock). He takes the duty
  only if an auto-sub brings him into the eleven. Dropped with the set-piece lists.
  `S17.2 withdrawn`
- The first on the list who plays holds the duty for the whole match, and only he earns its
  adjustment. If no one on the list plays, no one earns it. Dropped with the set-piece lists.
  `S17.3 withdrawn`
- A taker earns role-style adjustments, give and take, set by the site and changed by patch like
  roles' (`spec/14`, 25 Oct 2026; "maybe we dont use first"): the penalty taker per penalty scored
  and missed; the free-kick taker for free-kick goals and set-piece chances; the corner taker for
  corners into the box and set-piece assists. Dropped with the set-piece lists.
  `S17.4 withdrawn`
- A set-piece duty can come back only as a role (Craig, 9 Nov 2026, on #1196). `S17.5`

## Both

- The captain's adjustments stack on his role's adjustments. `S17.6`
- The club captain, from Sportmonks' lineups, shows as a hint on the player card and in the
  picker, as stars do. It never changes points (Craig, 9 Nov 2026, on #1196). `S17.7`
- The deadline locks the captain and the vice-captain with the rest of the lineup (`spec/05`).
  `S17.8`
