# 18. Premier League

Feature 18 of [SPEC.md](../SPEC.md). Only Craig's answers, from `/grill the real league`
(16 Oct 2026).

The real competitions, as their own section of the menu: "Football" (Craig, 10 Nov 2026, on
#1032). A league playing more than one competition reaches each from that one section, with a tab
for each competition it plays on the page (Premier League | Scottish Premiership); the page's
title is the tabs only (Craig, 10 Nov 2026, on #1032). A draft league's own table and head-to-head
fixtures are a different screen (`spec/12`, "table and fixtures").

## Fixtures and results

- One gameweek at a time, with the ◄ GW ► stepper, opening on the current gameweek.
- Live scores; each fixture opens its match page (`spec/10`).
- No fixture-difficulty colours here, and no count of owned players on a fixture.

## The table

- P W D L GF GA GD Pts, from Sportmonks' standings for each competition, not worked out by us
  (Craig, 9 Nov 2026, on #1196). `S18.2`
- Each club's mark before its name (`spec/12`, Club colours; 31 Oct 2026).
- Live during matches, provisional until they are final. While a gameweek is live, each club shows
  how many places it has moved since it began (Craig, 10 Nov 2026, on #1032: "Live table"). `S18.4`
- Lines mark the European places and relegation: "League table needs relegation/Europe lines"
  (Craig, 10 Nov 2026, on #1032). How many places each line marks is held per competition. `S18.5`
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
