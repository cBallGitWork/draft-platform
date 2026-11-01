# My team: Tactics

Route: `/team`, the Tactics tab, checked on `/team?preview=manager`.

## The pictures

- `1440.png`: the Tactics tab at rest, nobody tapped (Tactics A9a).
- `1440-selected.png`: Caicedo tapped, his panel open on top of the right column, his row and his
  pitch cell marked (Tactics A9a, selected).
- `1440-formations.png`: the formation window opened from All formations, on Classics, with AC Milan
  picked and previewed (Formation card A8).
- `1440-formations-presets.png`: the same window on Your presets, with 4-3-3 press picked and
  previewed, and the Save preset… tile (Formation card A8, presets).

## Approved

1 Nov 2026, Craig:

- Tactics: "9a better, happy with that for now". Earlier, of A8: "yes a8 looking better".
- The formation window: "ok presets much better, will do for now".

## The Football Manager idea

FM27's Tactics Overview: the pitch and the selection table side by side, so a manager sees his shape
and his whole squad at once, with the team's meters across the header (the deadline, the next
opponent, last gameweek, form, the table). Its organisation, never its colours.

## Interaction notes

- A player, on the pitch or in a row: opens his panel on top of the right column, with his roles
  for the slot, the team tactic's line for him, and Move and Player card. The cross closes it.
- Move: picks him up, and his legal cells light (`spec/05`, Moving players): tap a lit cell to move
  him, or a lit player to swap them.
- Up and Down, on a bench player's panel: move him one place along the bench.
- The Role ▾, on the pitch or in a row: opens the role card (`spec/05`, Roles).
- The Formation keys (4-4-2, 4-3-3 …): reshape the pitch to that formation.
- All formations: opens the formation window (below).
- The Team tactic ▾: opens the team tactics the formation unlocks.
- A preset key (4-2-3-1 balanced …): applies its formation and each slot's role.
- Save preset…: saves the formation and each slot's role in use now, never the players.
- Undo: back through every move since the tab was opened (`spec/05`).
- Quick Pick: fills the current shape with the best eleven by stars (`spec/05`).
- The Runs tick: shows or hides every starter's run (`spec/05`, Runs).
- The opponent's name, in the header or the GW opponent box: opens the matchup.

### The formation window

- Left, the groups: Your presets, then Formations (Back 3, Back 4, Back 5), Classics, Modern.
- Middle, the group's tiles; tapping one picks it.
- Right, the picked one's preview: its pitch with each slot's role, and its lines.
- Use this applies the pick; Cancel and the cross close the window with nothing changed.
- A preset or a classic applies its formation and all eleven roles. A plain formation keeps each
  starter's role where his new slot offers it, as the Formation keys do.
- The players stay: each moves to a slot of the new shape in his own area, and anyone left without
  a slot goes to the front of the bench (`spec/05`, The pitch).

## Placeholders

Each shows in its place and size until its data comes.

| Placeholder | Waits for | Where it's tracked |
|---|---|---|
| Team tactic: the ▾, the pitch bar's name, the right column's "4-2-3-1 unlocks" box, the pink marks on the Anchors, the panel's team tactic line | Team tactics aren't specced: they are the second release's team instructions (SPEC.md, Second release) | to-grill: Team tactic per formation |
| The formation window's Unlocks and Costs lines | the same | to-grill: Team tactic per formation |
| A classic's text and its Gains and Loses lines (marked sample) | Craig's own words for each | to-grill: Formation descriptions |
| Preset names (marked sample names) | a manager's own saved presets | `spec/05`, The pitch |
| Role fit stars, the panel's stars and "Last 5 in role" | stars on screen (#11); scouts decide whose a manager sees (#375) | #11, #375 |
| The Next column and fixture chips' colours | where fixture difficulty comes from | to-grill: Where fixture difficulty comes from |
| The status chips after a name, and Lineup check's lines (doubt, booking, injured, suspended) | which FPL statuses each chip reads, and a count of bookings | to-grill: Status chips' data; to-grill: Who's doubtful, on Tactics |
| The formation window's Modern row ("to come") | the modern sides to list | to-grill: Formation descriptions |

The issues that build the rest of the screen: #845 (the pitch's chips), #847 (the squad list),
#848 (the role card), #849 (Quick Pick and the next opponent), #857 (position labels).

## Canvas

<https://claude.ai/artifact/HjawmrL2GPJ3bJzT1m3Cap>
