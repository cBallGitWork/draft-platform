# The player card

Route: `/leagues/$leagueId/players/$playerCode`, checked on
`/leagues/preview-pro-league/players/1?preview=manager`.

## The picture

- `1440.png`: Cole Palmer's card as a manager sees it: another team's player whom he has scouted, with
  GW8 selected so its breakdown shows on the right.

## Approved

7 Nov 2026: Craig, "approved for now but will need to scale for other leagues". Before it, his
changes: "This should just show stats like Fantrax/FPL does with base score/mins etc", "Would be nice
to get a player portrait too for some colour" and "Teams next fixtures could probably be in a single
row". His "looks good" took Claude's recommendations on the four calls below.

Scaling to other leagues is still to work out: the card names a Premier League club, its fixtures and
FPL's news, and another league's would read its own competition's.

## The Football Manager idea

FM's player profile: the player across the top with his actions, his roles and their stars down the
left, the detail in the middle and titled widgets down the right. With it, FPL's and Fantrax's game
log: one row a match, his minutes and each scoring stat, then his points. Their organisation, never
their colours.

## Interaction notes

- Back: returns to the page the card was opened from.
- His owner's name: opens that team.
- Add to shortlist, Send a scout, Offer a trade: the actions for another team's player he has
  scouted. A free agent's card offers Claim or Pick up in place of Offer a trade, and your own player's
  offers Drop (`spec/08`, `spec/12`). Send a scout shows how many of the team's three are free.
- The position keys (CAM, W): price every match at that position, back to front, opening on the first.
  A player with one position has none (`spec/12`).
- A match row: selects it, and its breakdown shows at the top of the right column. The newest match is
  selected when the card opens.
- A short code in the table's head (G, A, CS…): its full name on hover (`spec/14`, On screen). The
  columns are the site's scoring categories, so a patch that adds one adds a column.
- "Live" after the points: the match is still being played, its points provisional. "Overridden, was
  7": hover for the reason.
- A news note's source: opens the article. The admin also sees Hide on each note (`spec/21`).
- Older report: opens the scout's earlier report on him (`spec/19`; #375).
- A fixture cell: its difficulty in its colour, the words for screen readers and on hover.

## Placeholders

Each shows in its place and size until its data comes.

| Placeholder | Waits for | Where it's tracked |
|---|---|---|
| The portrait | FPL's photo of him (Craig, 7 Nov 2026: "a"), once FPL's terms allow it | #79, `spec/12` (S12.1) |
| Captain and set pieces | the hints after the mini beta | `spec/17`, Both |
| Role fit and the scout report | scouts: hidden for a player you haven't scouted | #375 |
| News notes | the news job | `spec/21` |
| The fixtures' colours | where fixture difficulty comes from | to-grill: Where fixture difficulty comes from |

## The four calls

Drawn as Claude recommended; Craig's "looks good", 7 Nov 2026:

- **Role fit**: every role for each of his positions, each with its position's chip.
- **His role's points**: only in the selected match's breakdown, as their own line, never a column.
- **Match order**: newest first.
- **No season total** on the card.

## Canvas

<https://claude.ai/artifact/HjawmrL2GPJ3bJzT1m3Cap>, under "Player card".
