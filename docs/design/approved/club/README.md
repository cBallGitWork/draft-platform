# Football: a club's page

Route: `/premier-league/club/$clubCode`, checked on `/premier-league/club/$clubCode?preview=manager`.
For #1935.

## The picture

- `1440.png`: Arsenal's Squad tab after GW10: every current player, grouped GK, DEF, MID, AM, FWD
  by his first position, with his owner in this league, season points, GW6 to GW10, starts and
  minutes. Next match and Top scorers on the right.
- `1440-fixtures.png`: the Fixtures tab: all 38 Premier League matches, results to GW10, GW11 (the
  next) lit.
- `Club.dc.html`, `ClubFixtures.dc.html`: their sources from the canvas.

## Approved

16 Nov 2026: Craig, "Club - a" (approve as drawn), to the Squad and Fixtures boards after the
review panel. On the way there:

- 12 Nov 2026: the header's ownership line came out ("you already have that info in table").
- Each player shows all his positions; a gameweek he didn't play shows "—" (S18.8).
- Top scorers keeps each player's owner in this league.

Small calls Claude made, not spec lines: a group runs by season points, most first; your own
players read "(you)" on a lit row, as elsewhere; groups are split by a heavier line, never a
group row (plate.md, Tables and panels).

## The Football Manager idea

FM's club screen: the club's identity, place and form on the title plate, its squad as one
full-width table, and a right-hand column of widgets (next match, top scorers). Its organisation,
never its colours.

## Interaction notes

- **Football ◄:** back to the Football page.
- **Squad | Fixtures:** the two tabs.
- **A player's name or row:** opens the player card, where claims and pick-ups live; the page has
  no buttons of its own (S18.8).
- **An owner's team:** opens that team.
- **A club's name** (an opponent, the next match): opens that club's page; its mark doesn't (S18.6).
- **A fixture's result or kick-off:** opens its match page (S18.9).

## Placeholders

- The doubt chip after each name: an empty outline until the status chips are settled
  (`docs/to-grill.md`, S18.8).

Canvas: <https://claude.ai/artifact/HjawmrL2GPJ3bJzT1m3Cap>, the "Football · Arsenal's club page" boards.
