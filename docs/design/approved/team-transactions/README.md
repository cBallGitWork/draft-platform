# My team, Transactions

Route: My team's Transactions tab (`/team`, checked on `/team?preview=manager`). For #1031.
It redraws the Transactions picture in [`waivers`](../waivers/README.md), which still holds the
commissioner's Every team view and League settings' Waivers tab.

## The picture

- `1440.png`: Saka Potatoes before Wednesday's run. Pending claims grouped by run, with
  Wednesday's claim 2 (Eze) selected and its panel at the top of the right column. History, newest
  first, now holds trades. Waiver order and Runs are under the panel.
- `Transactions-Trades.dc.html`: its source from the canvas.

## Approved

10 Nov 2026: Craig, "Approve". On the way there:

- "Add trades to History" (trades are built, #383; picks one for one before the draft, #1096).
- He asked for FM, Draft Fantasy and other fantasy sports to be checked first. Sleeper lists a trade
  as what each side receives and sends; Fantrax and Sleeper filter by kind; Yahoo hides vetoed
  trades. Nothing was found on how FM or Draft Fantasy show a trade in a history.
- A blocked trade stays out of History: nothing moved, and Mail tells the league ("Leave it out").
- A filter on History: "Add it".
- "waiver order just put 1st-x. and dont need to say x in the table": each row reads "8th, 9 pts".
- "top right widget looks unclear, not sure sure going in/out": the claim panel now has In and Out
  rows, and Pending claims' columns read In and Out too.
- Runs: "Keep, add counts". Pts: "Keep as Pts" (the claimed player's points over the last 6
  gameweeks, in its title).
- The review panel's clear-cut fixes, over two rounds: a traded pick as plain text, no chip (an
  outline is the placeholder mark); one 28px line for each player in a trade; By reads "With Hull
  Hearts"; the filter as keys, not a select; the clash as the "Fails if claim 1 wins" chip, not a
  sentence; the tab's count ("Transactions 3") back; a Drop row in History.

## The Football Manager idea

FM's transfer screens keep your bids on your club with the picked one's detail in a side panel.
From Sleeper: a trade is one entry, what came in and what went out. Their organisation, never their
colours.

## Interaction notes

- **Pending claims:** as in `waivers`: grouped by run, ranked in each, dragged by the handle;
  clicking a row selects it.
- **Claim panel:** In, the claimed player, with Player card ›. Out, the drop picker (changing it
  keeps the rank). "Fails if claim 1 wins" when an earlier claim in the run drops the same player.
  Move up, Move down, Withdraw.
- **History:** claims won, free agents, drops, commissioner assignments and trades, newest first.
  A trade is one row: every player or pick it brought in under In, every one it sent under Out,
  one 28px line each, and the other team in By ("With Hull Hearts"). A pick is named by the team
  whose pick it is ("Pickford Pirates' round 4 pick"). Only trades that went through.
- **Show:** keys on History's plate: All, Claims, Free agents, Drops, Trades, Assigned.
- **Waiver order:** every team, its table place and points ("8th, 9 pts").
- **Runs:** each run with its claim count, the next marked; when free agency opens.

## Placeholders

None.

## Not drawn

- Claims closed, and no claims: as in `waivers`.
- The commissioner's Every team view stays the `waivers` picture.

Canvas: <https://claude.ai/artifact/HjawmrL2GPJ3bJzT1m3Cap>, board "My team, Transactions: trades in
History (#1031)".
