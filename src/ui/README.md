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
- `ColumnHeads.tsx`: a data table's head band, short words with long ones as tooltips (Colour roles: column head).
- `TickBox.tsx`: a tick box, the sunken well and drawn tick (Controls: Tick box).
- `Choice.tsx`: one of a few options, butted keys (Controls: Keys).
- `Confirm.tsx`: a confirm whose yes is the danger action (Colour roles: danger action; Decided: Destructive confirms).
- `GameweekStepper.tsx`: CM's `◄ GW ►` stepper (Colour roles: stepper).
- `OwnerName.tsx`: a player's owner, or a muted "Free agent" (Colour roles: fact, muted).
- `PositionCodes.tsx`: position chips, each named in full on hover (Tables and panels: Roles in full).
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
