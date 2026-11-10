# The auto team, fixture swaps and availability

Routes, for #1209:

- My team's header band (`/team`, checked on `/team?preview=manager`): `1440.png`.
- Squads, the commissioner's (`/leagues/$leagueId/squads`, checked on
  `/leagues/preview-pro-league/squads?preview=commissioner`): `1440-squads.png`.
- Table's Fixtures, the commissioner's (`/table`, checked on `/table?preview=commissioner`):
  `1440-fixture-swap.png`.
- The admin dashboard's Availability tab (`/admin`, checked on `/admin?preview=admin`):
  `1440-availability.png`.

The rest of each screen keeps its own picture: My team's in [`team`](../team/README.md) and the
table's in [`table`](../table/README.md), whose live board already marks a team on the auto team.
Squads and the admin dashboard had no picture; these are their first.

## Approved

9 Nov 2026: Craig, "Approve". On the way there he placed each piece (9 Nov 2026, every
recommendation): the manager's switch in My team's header band, the commissioner's on Squads,
fixture swaps in Table's Fixtures widget, and availability as a new admin dashboard tab.

## The Football Manager idea

FM's holiday: hand the team to your assistant until a date you pick. FM's competition tools for
fixtures, and its data screens for the admin: a list on the left, the picked one's panel on the right.
Their organisation, never their colours.

## Interaction notes

- **Auto team cell (header band):** says Off, or On and until when; opens the Auto team panel.
- **Auto team panel:** one line on what it does (`spec/09`); a choice of until the end of a
  gameweek (from the next one not begun) or until I switch it off; Cancel, Switch on.
- **Squads, each team:** its manager, and Auto team Off/On (the commissioner sets no end gameweek;
  only the manager can). A team with no manager is locked On, "Until the team is handed on". A
  manager's own switch shows whose it is and until when.
- **Fixtures, editing (commissioner, a gameweek not begun):** each team is a button; pick one,
  then a team in another game to swap them; Save swap or Cancel. Only that gameweek changes.
- **Availability:** find a player; Set by hand lists every player set over the feed, with what the
  feed says and what he is set to; a row opens his panel on the right: The feed, Out, Doubtful,
  Available.

## Not drawn

- The league's average as a side to swap, in a league with an odd number of teams (`spec/09`).
- The header cell's On state ("On, to GW13").

## Canvas

<https://claude.ai/artifact/HjawmrL2GPJ3bJzT1m3Cap>, boards `AutoTeam-MyTeam`, `Squads-Commissioner`,
`AutoTeam-FixtureSwap` and `Admin-Availability`.
