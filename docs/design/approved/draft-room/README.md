# The draft room

Route: `/draft`, checked on `/draft?preview=manager`. The draft room is in the menu, as "Draft",
from the moment the league is set up (`spec/04`, Starting it).

## The pictures

All three are drawn from one board, `DraftRoom.dc.html`, whose `state` switch picks the state; the
other two files are copies with a different default.

- `1440.png`: the draft live, you on the clock at round 4, pick 3, with 0:48 left and B. Fernandes
  selected.
- `1440-before.png`: before the start: the order drawn, where you pick, the countdown to the start,
  and the commissioner's start controls. No Draft button; the queue works.
- `1440-slow.png`: a slow draft: the same as live, on an 8-hour clock.

## Approved

4 Nov 2026: Craig's "Approved", to "Approve the three draft room boards?", after draft 3 and the
Overview stats change.

## The Football Manager idea

FM's Squad and Recruitment pages: one full-width table with a view picker, and a right-hand column
of titled widgets, the selected player's panel on top. With it, the draft board of Sleeper and
FPL Draft: a column a team, a row a round. Their organisation, never their colours.

## Interaction notes

- Board: six rounds show, the pick on the clock outlined in cyan; Whole board shows all the rounds.
  A traded pick shows the team that owns it now and "via" the team it came from.
- Position tabs (All, GK to ST) filter the players list; Find searches by player or club.
- Stats: Overview ▾: opens Scouting's stat box (`spec/19`) to pick the list's stats. It opens on
  the short Overview.
- A column head sorts the list by it; the list opens sorted by the site's ranking.
- A row: opens his panel on top of the right column. A row greyed with "Club full" can't be drafted
  and stays in its place.
- Draft <name>, the big button in his panel, only while you are on the clock: makes the pick. For
  10 seconds after, the button becomes Undo with the seconds left (not drawn).
- Add to queue, Do not draft, in his panel: add him to either list. Player card opens his card.
- Your queue: drag a row to reorder it; the cross takes him off. Add from your Scouting shortlist
  opens Scouting's shortlist.
- Do not draft: the cross takes him off.
- Turn auto-pick on: puts you on auto-pick; while on, the button takes control back.
- Commissioner (only the commissioner sees it): Pause the draft, Undo last pick and Pick for <team>
  while live; Start the draft now, Change the start and I'll pick for <team> before it. Pick time
  can be changed only while paused, or before the start.

## Placeholders

None. The rank column shows the admin's ranking when one is uploaded, else last season's points
(`spec/04`, The queue and the ranking).

## Canvas

<https://claude.ai/artifact/HjawmrL2GPJ3bJzT1m3Cap>, boards "Draft room, on the clock", "before
the start" and "slow draft" (draft 3).
