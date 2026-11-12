# Trades

Route: `/trades`, the menu's Trades (`spec/12`), its Offers and New offer (`/trades/new`) tabs,
checked on `/trades?preview=manager`. For #383.

## The pictures

- `1440.png`: Offers, with Kroos Control's offer to you selected, and its panel on the right
  holding Accept, Counter and Reject. Closed offers are below.
- `1440-sent.png`: the same tab, with your offer to Rovers XI selected, in a league-vote league:
  its one action is Withdraw.
- `1440-new.png`: New offer: your squad and theirs, ticked, and your offer summed up on the right.

## Approved

8 Nov 2026: Craig, "Approve". On the way there:

- His answers on #383 (6 Nov 2026):
  - an offer can be withdrawn until it's accepted;
  - players in a trade under review are held;
  - open offers close at the trade deadline or a break, and a review finishes;
  - a new league reviews by commissioner veto;
  - the trade deadline is off by default;
  - an offer closes when one of its players leaves the squad.
- A trade's players show only their position and club: no points ("1 pos club").
- Reject is the danger action ("surely red?"). The plate's danger action is orange-edged on the
  alert fill, since red is the injury and red-card chips' colour, so the picture draws that. A red
  of its own would be a new token, for the UI reskin.
- Accepting a trade that breaks your squad's limits warns you first, in the offer's panel, and still
  lets you accept (`spec/15`; "3 yes").
- Sleeper, ESPN, Yahoo and Fantrax were checked: a trades area at the top of the league, both
  rosters side by side, a review before sending, and cancelling only until accepted.

## The Football Manager idea

FM's transfer offers screen: incoming and outgoing bids in one list, the selected bid's terms in
a side panel with Accept, Negotiate and Reject. From Sleeper, both rosters side by side to build
an offer. Their organisation, never their colours.

## Interaction notes

- **Offers** are grouped To you, From you and In review. Each row shows who it's with, You get,
  You give, Waiting on and Closes. Selecting a row opens its panel. Closed offers lists rejected,
  countered, withdrawn and closed ones this season.
- **An offer to you:**
  - both sides;
  - the one-line note;
  - your squad after it, with a warning line if a limit breaks;
  - how it's reviewed;
  - when it closes.
  - **Accept** (under a review, it starts the 24 hours), **Counter** (New offer, filled with this
    offer: sending it closes this one), **Reject** (behind a confirm).
- **An offer from you:** the same, with **Withdraw** until it's accepted.
- **In review:** who is reviewing and until when, with no actions. Block (veto) and Against (vote)
  stay in their Mail letters (`spec/08`).
- **New offer:** pick the team in Their squad's plate (a team on the auto team isn't offered).
  Tick players on either side; a player held in a trade under review can't be ticked. Your offer
  shows what you get, what you give, a one-line note and both squads after it. Then **Send offer**.
- **Picks:** not drawn. A league trades this season's picks only before its draft, one for one
  (`spec/04`), and next season's only in keeper and dynasty leagues (`spec/08`). The first build is
  players only; picks join with the draft, as a Picks block under each squad.
