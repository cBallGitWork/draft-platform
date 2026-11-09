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

- P W D L GF GA GD Pts, from Sportmonks' standings for each competition, not worked out by us
  (Craig, 9 Nov 2026, on #1196). `S18.2`
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
  Dropped 9 Nov 2026 (#1196): the table now comes from Sportmonks' standings. `S18.1 withdrawn`

## After the mini beta

- Club pages (the squad, who owns whom in the draft league, doubts) come after the mini beta. No
  set-piece takers: "we didthced set piece taker (unless its a role)" (Craig, 9 Nov 2026, on
  #1196). `S18.3`
