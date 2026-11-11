# src/ui: the shared controls and panel parts

What every screen draws the same way, built once (`ARCHITECTURE.md`, Where code lives). Each line
names the [plate.md](../../docs/design/plate.md) section it draws; the values are the tokens in
`src/styles.css`. Before building a control or a panel part, look here for it.

## Components

- `Panel.tsx`, `Panel`: a panel under its title plate, a team's name in the second face (Shape; Type).
- `Panel.tsx`, `PageSection`: a page's section under its page title plate (Shape).
- `Panel.tsx`, `Problem`: why the last change was refused, in the alert strip (Colour roles: alert, event).
- `Panel.tsx`, `Notice`: a standing warning in the alert strip (Colour roles: alert, event).
- `Panel.tsx`, `Status`: a live region for a passing word (Colour roles).
- `Panel.tsx`, `Loading`, `PanelNote`, `LiveNote`: a muted line: loading, a hint, live points (Colour roles: muted).
- `Panel.tsx`, `PANEL_BODY`, `PANEL_LIST_ROW`, `PAGE_STACK`, `PANEL_COLUMNS`: panels' insides and their 8px gaps (Shape).
- `Panel.tsx`, `TOP_BAR`, `TOP_BAR_ROW`: the top bar's plate and row (Colour roles: bar; Shape).
- `FindPlayerPanel.tsx`: the "Find a player" panel, a name box and the players found, each its caller's row (Shape; Controls), on the admin's dashboard and Squads.
- `ColumnHeads.tsx`: a data table's head band, short words with long ones as tooltips (Colour roles: column head).
- `TickBox.tsx`: a tick box, the sunken well and drawn tick (Controls: Tick box).
- `Choice.tsx`: one of a few options, butted keys (Controls: Keys).
- `SectionTabs.tsx`: a section's butted tabs under the top bar, on the frame, the admin's dashboard and Scoring (`sectionTabClasses`, `SectionTab`), and the count after a tab's name (`CountBadge`), on Mail and Transactions (Shape; Colour roles: event).
- `PlateTabs.tsx`: a page's tabs on its title plate after the title, the chosen one pressed (Shape), on Table and Scouting.
- `Confirm.tsx`: a confirm whose yes is the danger action (Colour roles: danger action; Decided: Destructive confirms).
- `GameweekStepper.tsx`: CM's `◄ GW ►` stepper (Colour roles: stepper).
- `OwnerName.tsx`: a player's owner, or a muted "Free agent" (Colour roles: fact, muted).
- `PositionChip.tsx`: one position's coloured chip.
- `PositionCodes.tsx`: position codes, each named in full on hover, in a line or `spaced` as a table's chips (Tables and panels: Roles in full).
- `StarRating.tsx`: a player's stars for a role, in half-star steps, or "?" and "—" unrated (Marks: Stars).
- `ClubName.tsx`: a club's name, or its three letters (`ClubShort`), and its mark (`ClubMark`): its crest, or its two colours where that won't load (Marks: A club's mark).
- `StatBox.tsx`: the stat box, every stat of the catalogue and the site's own, as a box or a title-bar button (Controls), on Scouting and the draft room.
- `AutoTeamChip.tsx`: a team on the auto team, the event chip after its name, its hover saying what it does (Colour roles: event), on the table and the matchup.
- `Placeholder.tsx`: data not held yet, a 1px muted outline in its place and size, its hover saying what will show (Marks: A placeholder).

## Utilities in controls.css

- `action`: Continue, a page's one main button (Colour roles: action).
- `action-idle`: the action with nothing to do, Save with nothing to save (Colour roles: action; Controls: Discard and Save).
- `secondary-action`: Sign out, Discard, Undo (Colour roles: secondary action).
- `danger-action`: the yes on a confirm that deletes or removes (Colour roles: danger action).
- `alert-strip`: something that needs you, under its orange edge (Colour roles: alert).
- `text-box`: a box to type in (Controls).
- `number-box`: a box for one number of a rule, in the figure colour (Colour roles: figure).
- `tick-well`: the tick box's well (Controls: Tick box).
- `key`: one of a row of butted keys, the chosen one pressed in (Controls: Keys).
- `text-align-inherit`: a button's words keep its cell's side (Tables and panels).

`display-face`, the second face (Type), and the row height `h-row` (Type, `--spacing-row`) live in
`src/styles.css`.
