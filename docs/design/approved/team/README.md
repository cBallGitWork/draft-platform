# My team: Tactics

**Contents:** [The pictures](#the-pictures) · [Approved](#approved) · [The Football Manager idea](#the-football-manager-idea) ·
[Interaction notes](#interaction-notes) · [Placeholders](#placeholders) · [Canvas](#canvas)

Route: `/team`, the Tactics tab, checked on `/team?preview=manager`.

## The pictures

- `1440.png`: the Tactics tab at rest, nobody tapped, just after a formation change (Tactics A10,
  source `TacticsA10.dc.html`).
- `1440-selected.png`: Caicedo tapped, his panel open on top of the right column, Rice and Tonali lit
  as swaps with Caicedo's stars on them (Tactics A10, source `TacticsA10-Selected.dc.html`).
- `1440-instructions-menu.png`: the Attacking ▾ open, the three 4-2-3-1 offers, each with its
  rewards and costs (Tactics A10, source `TacticsA10-Menu.dc.html`).
- `1440-formations.png`: the formation window opened from All formations, on Classics, with AC Milan
  picked and previewed (Formation card A8).
- `1440-formations-presets.png`: the same window on Your presets, with 4-3-3 press picked and
  previewed, and the Save preset… tile (Formation card A8, presets).
- `1440-role-card.png`: the role card opened from Caicedo's Role ▾, Metronome in use, Engine
  previewed, GW4 tapped (Role card B1, source `RoleCardB1.dc.html`).

On 1 Nov 2026 Craig floated that the slot behind the striker could read SS, the support striker,
as in the 4-4-1-1: "maybe am becomes a ss (like a the 4-4-1-1)". It isn't settled (to-grill: Where
the support striker sits). The formation pictures were taken again from the latest Formation card
A8 the same day and look as before: neither previews a 4-4-1-1, and the Arsenal Invincibles tile's
thumbnail has no labels.

## Approved

18 Nov 2026, Craig, of Tactics A10 (the tidy after the fresh-eyes test, #2446): "Approve A10". On the
way: a suspended bench player still lights as a swap, his mark showing ("Light him, flag shows");
Instructions stay as drawn when a player is picked ("Leave as drawn"); the saved time sits under
the toolbar ("Under the toolbar").

1 Nov 2026, Craig:

- Tactics: "9a better, happy with that for now" (A9a, replaced by A10). Earlier, of A8: "yes a8 looking better".
- The formation window: "ok presets much better, will do for now".
- The role card, 9 Nov 2026: "go ahead". On the way: preview then a button; the slot's fixed
  order; a tapped match shows what earned the role's points; his season per 90 for the role's
  stats, ranked ("6th"); where he moves on a small pitch; a word beside the stars; "Punishes" for
  the bad side; no notes on the obvious.

## The Football Manager idea

FM27's Tactics Overview: the pitch and the selection table side by side, so a manager sees his shape
and his whole squad at once, with the team's meters across the header (the deadline, the next
opponent, last gameweek, form, the table). Its organisation, never its colours.

## Interaction notes

- A player, on the pitch or in a row: picks him up and opens his panel on top of the right column,
  with his roles for the slot and Player card. Each player he can swap with lights at once, with his
  stars there in cyan, on the pitch and in the table; tap a lit player to swap them, or drag him
  onto one (`spec/05`, Moving players). There is no Move button. The cross closes it.
- The line under the toolbar: "Saved 14:02" and what the last change did; while a player is picked
  up, how to swap him. Undo and Quick Pick sit at its right.
- Up and Down, on a bench player's panel: move him one place along the bench.
- The Role ▾, on the pitch or in a row: opens the role card (`spec/05`, Roles).
- The Formation keys (4-4-2, 4-3-3 …): reshape the pitch to that formation.
- All formations: opens the formation window (below).
- Attacking ▾ and Defending ▾: each lists only the instructions the formation offers, with its
  rewards and costs (`spec/05`, Team instructions); the right column's Instructions show only the
  two picked.
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
  starter's role where his new slot offers it, as the Formation keys do; a starter whose new slot
  doesn't offer his role starts on his best-star role there (`spec/05`, Roles).
- The players stay: each moves to a slot of the new shape in his own area, and anyone left without
  a slot goes to the front of the bench (`spec/05`, The pitch).

### The role card

- A role's row: previews it on the right; the cyan bar and "In use" mark the role he has now.
- Play him as …: saves the role (#848); Cancel and the cross close with nothing changed.
- A match row: opens that match's role line under it (spec/05, `S05.2` wording).
- Star words: 5 Outstanding, 4 Very good, 3 Good, 2 Fair, 1 Poor; a half star rounds down.
- Still to draw from the spec: "No matches yet", "?" and "—" stars, read-only after the deadline.
- Still to settle at the build: who his stat ranks are against (drafted: everyone who plays the
  area with 3 or more matches, per 90 over the season).

## Placeholders

Each shows in its place and size until its data comes.

| Placeholder | Waits for | Where it's tracked |
|---|---|---|
| The formation window's Unlocks and Costs lines | per-formation team tactics aren't specced (SPEC.md, Second release) | to-grill: Team tactic per formation |
| A classic's text and its Gains and Loses lines (marked sample) | Craig's own words for each | to-grill: Formation descriptions |
| Preset names (marked sample names) | a manager's own saved presets | `spec/05`, The pitch |
| "Last 5 in role" | what it counts; scouts decide whose stars a manager sees (#375); Role fit and the panel's stars are built (#11) | #375 |
| The Next column and fixture chips' colours | where fixture difficulty comes from | to-grill: Where fixture difficulty comes from |
| The status chips after a name; Lineup check's booking lines | which statuses each chip reads, and a count of bookings; Lineup check lists each starter's FPL note word for word (`spec/12` S12.8; #1976) | to-grill: Status chips' data; to-grill: Who's doubtful, on Tactics |
| The formation window's group counts (Back 3 5, Back 4 12, Back 5 4, Classics 6) | the league's presets and the classics listed; the picture's counts are sample | `spec/05`, The pitch |
| The formation window's Modern row ("to come") | the modern sides to list | to-grill: Formation descriptions |

The issues that build the rest of the screen: #845 (the pitch's chips), #847 (the squad list),
#848 (the role card), #849 (Quick Pick and the next opponent), #857 (position labels).

## Canvas

<https://claude.ai/artifact/HjawmrL2GPJ3bJzT1m3Cap>
