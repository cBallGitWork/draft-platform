# Your leagues

Route: `/leagues`, checked on `/leagues?preview=manager`, `?preview=commissioner` for a deleted
league's Undo, and `?preview=newcomer` for the page with no league.

## The pictures

- `1440.png`: in two leagues, with a deleted league waiting out its 24 hours and a join request
  waiting on a commissioner (Your leagues, round 2).
- `1440-none.png`: signed in and in no league, told why an invite didn't bring him in (Your
  leagues, none).

## Approved

1 Nov 2026, Craig, "yes to all", answering Sign in, Your leagues, Create a league and Join.

## The Football Manager idea

FM's Load Game list: one row per save, its name first, then who you are in it and how far it's
got, with what's waiting beside it. Its organisation, never its colours.

## Interaction notes

- A league's name: opens its League home and makes it the current league (`spec/13` S13.10).
- Undo, on a deleted league: undoes the deletion (`spec/13`, Deleting).
- Your join request: reads only, until the commissioner answers (`spec/13`, Joining).
- No links on a row: the commissioner's tools (Gameweeks, Invites and join requests, Squads,
  League settings, deleting) move to a Commissioner item in the top menu, with the tabs Gameweeks |
  Invites | Squads | Settings, and Player scoring becomes a Scoring tab on Table (Craig, 16 Nov
  2026, the Run the league grill on #2267).
- The admin's Create a league and Admin dashboard: on the page for the admin (`spec/02`); drawn on
  Create a league's picture.

## Placeholders

Each shows in its place and size until its data comes.

| Placeholder | Waits for | Where it's tracked |
|---|---|---|
| Where the commissioner's tools and Player scoring go once off the rows | settled 16 Nov 2026: the Commissioner item in the top menu and a Scoring tab on Table; their pictures | #2267 |

## Canvas

<https://claude.ai/artifact/HjawmrL2GPJ3bJzT1m3Cap>
