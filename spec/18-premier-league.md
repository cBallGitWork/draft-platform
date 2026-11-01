# 18. Premier League

Feature 18 of [SPEC.md](../SPEC.md). Only Craig's answers, from `/grill the real league`
(16 Oct 2026).

The real competition, as its own section of the menu: "Premier League". A draft league's own table
and head-to-head fixtures are a different screen (`spec/12`, "table and fixtures").

## Fixtures and results

- One gameweek at a time, with the ◄ GW ► stepper, opening on the current gameweek.
- Live scores; each fixture opens its match page (`spec/10`).
- No fixture-difficulty colours here, and no count of owned players on a fixture.

## The table

- P W D L GF GA GD Pts, worked out from the results.
- Each club's mark before its name (`spec/12`, Club colours; 31 Oct 2026).
- Live during matches, provisional until they are final.
- A club's points deduction: the admin overrides its total points (Craig, 1 Nov 2026: "you hard
  override the total points"; #898).
- Clubs level on points are split by the real competition's own tie-break order, held per
  competition as data, not built in: "but remember to scale for other leagues" (Craig, 1 Nov
  2026). The Premier League's is its rule C.17: points, goal difference, goals scored, then
  head-to-head between the tied clubs, then a play-off; if one of their matches is never played,
  head-to-head is skipped and they stay level (Craig, 1 Nov 2026: "Follow the real PL rule";
  #899). Another competition (SPEC.md, Later: Other leagues) brings its own order.

## After the mini beta

- Club pages (the squad, who owns whom in the draft league, set-piece takers, doubts) come after
  the mini beta.
