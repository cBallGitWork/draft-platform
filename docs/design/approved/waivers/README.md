# Waivers

Routes: My team's Transactions tab (`/team`, checked on `/team?preview=manager`), and League
settings' Waivers tab (`/leagues/$leagueId/settings`, checked on
`/leagues/preview-pro-league/settings?preview=commissioner`). For #1200, stories 2 and 3.

## The pictures

- `1440.png`: superseded on 10 Nov 2026 by [`team-transactions`](../team-transactions/README.md),
  which binds the manager's Transactions tab. Kept as history: Saka Potatoes' Transactions tab, with Pending claims grouped by run and History
  below. Wednesday's claim 2 (Eze) is selected, and its panel is at the top of the right column.
- `1440-commissioner.png`: the same tab as the commissioner sees it, switched from Mine to Every
  team: each team with claims, in waiver order.
- `1440-settings.png`: League settings, its Waivers tab: the order type and the runs.

## Approved

8 Nov 2026: Craig, "Approve". On the way there:

- His answers on #1200 (6 Nov 2026): a change of order type applies at once, from today's order;
  everyone sees the whole waiver order; a claim's drop can be changed, and the claim keeps its rank;
  Scouting shows the run that can first take a player on waivers.
- He asked Claude to check other fantasy sites. ESPN keeps pending claims on My Team, where you
  drag them into order. Yahoo keeps them on the team page and lists them by processing date. Fantrax
  keeps them under Transactions. On "Your call", Claude moved the claims from a Scouting tab to My
  team's Transactions tab. They are grouped by run and ranked within each run, since a run can only
  take the players it clears, and each row has a drag handle.
- Failed claims stay out of History: Mail tells the manager ("1 no").
- The drag handle and Move up and Move down both stay: the handle for a mouse, the buttons for a
  keyboard (Claude's call).
- League settings gets tabs on its title plate now ("tabs for now"). UI 10 (#1034) redraws it whole.
- The commissioner's Every team view is read-only ("4 no").

## The Football Manager idea

FM's transfer screens keep your bids on your club, with the detail of the one you pick in a side
panel. From ESPN, Yahoo and Fantrax: pending claims on the team's own page, reordered by drag or
rank, grouped by when they process. Their organisation, never their colours.

## Interaction notes

- **Pending claims:** each run's claims are tried in your rank. Drag a row by its handle to
  reorder within its run. Clicking a row selects it, and its panel opens on the right:
  - the run;
  - a clash in orange ("Claim 1 also drops Calvert-Lewin");
  - a **Drop** picker (changing the drop keeps the rank);
  - **Move up**, **Move down** and **Withdraw**;
  - **Player card ›**.
- **Fails if claim 1 wins:** a claim whose drop an earlier claim in the same run also names.
- **History:** the team's claims won, free agents picked up, drops and the commissioner's
  assignments, newest first, from the same events Mail files (spec/12). Trades join it once they
  are built.
- **Waiver order:** every team, with its table place and points, so reverse table order can be
  checked. Under Rotating, the note says whoever last won a claim drops to the bottom and it never
  resets.
- **Runs:** the next runs, UK time, and when free agency opens: from the first run after a
  gameweek to the next deadline.
- **Mine / Every team** shows only for the commissioner. Every team lists only teams with claims;
  the plate counts the rest.
- **League settings, Waivers:** Reverse table order or Rotating, each explained. The runs are day
  and time rows, with Remove and Add a run; at least one run, and no time twice. Save stays muted
  until something changes. The waiver order on the right previews a change of type before Save.

## Finding your claims

Claims start in Scouting and are managed on My team, so two marks join them up (Craig, 8 Nov
2026: "Yes 1 and 2"):

1. **A count on the tab.** While claims are pending, My team's Transactions tab carries their count
   ("Transactions 3"), so a claim riding on Wednesday's run isn't forgotten.
2. **Your claim on the player.** In Scouting, the panel of a player you've claimed says so: "Your
   claim 2, Wed run", with a link to Transactions.

Neither is drawn: each is one word or line on an approved picture (Transactions here, Scouting's
player panel in `approved/scouting/`).

## Not drawn

- Claims closed: after the deadline until the gameweek's last match, and before the draft ends
  (`spec/08`, S08.1). The Pending claims panel says so in a word. In the lock the Drop picker is
  shut, but the drag handles, Move up, Move down and Withdraw stay: only new claims are shut (Craig,
  11 Nov 2026, on #1590). Before the draft ends the handles and buttons go.
