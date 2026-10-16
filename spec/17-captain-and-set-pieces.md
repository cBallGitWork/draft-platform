# 17. Captain and set pieces

Feature 17 of [SPEC.md](../SPEC.md). Only Craig's answers, from `/grill captain and set-piece
takers` (16 Oct 2026). It sits on tactics ([5](05-tactics.md)).

## The captain

- The manager picks a captain from his starters, and a vice-captain from his starters.
- The captain leads by example, like a real club captain: a role-style adjustment, give and take,
  as a league rule. He gains for playing the full 90 and for his club winning; he loses more than
  usual for a yellow card, and far more for a red. The defaults are priced against last season, as
  roles are, so the armband pays only on a captain who suits it.
- His club's result is not a per-player stat in the feeds: it comes from the match's score, so
  scoring takes it in as a new category (`spec/14`).
- There is no points multiplier.
- The vice-captain takes the armband when the captain's match ends with him on 0 minutes: the same
  trigger as an auto-sub (`spec/05`).

## Set-piece takers

- Penalties, free kicks and corners each have a set-piece list: the manager's order of up to three
  of his players, pre-filled from FPL's order for that duty.
- A bench player can be on a list (a manager benches a player carrying a knock). He takes the duty
  only if an auto-sub brings him into the eleven.
- The first on the list who plays holds the duty for the whole match, and only he is paid for it.
  If no one on the list plays, the duty pays nothing.
- A taker earns role-style adjustments, give and take, as league rules: the penalty taker per
  penalty scored and missed; the free-kick taker for free-kick goals and set-piece chances; the
  corner taker for corners into the box and set-piece assists. These are per-match stats the
  Premier League's feed already gives, so they are categories already (`spec/14`).

## Both

- One player can be captain and hold several duties. All of it stacks on his role's adjustments.
- The club captain and FPL's takers show as hints on the player card and in the picker, as stars
  do. They never change points.
- The deadline locks the captain, the vice-captain and the lists with the rest of the lineup
  (`spec/05`).
