# Mail

Route: `/mail`, the menu's Mail with its unread count (`spec/16`), checked on `/mail?preview=manager`.
For #1030.

## The pictures

- `1440.png`: Mail on All, its letters down the left grouped by day, newest first, and Kroos
  Control's trade offer open on the right, read for the first time. The viewer is the
  commissioner, so Write to the league shows.

## Approved

9 Nov 2026: Craig, "Yes, approve it". On the way there:

- FM split: the letters on the left, the open letter on the right ("FM split").
- Mail follows the league picked in the top bar; no inbox across leagues (`spec/16`).
- A letter ends with one link to where you act on it (`spec/16`).
- Needs you holds a lineup to set, a trade offer to you and a trade to review; the deadline
  letter says how your lineup stands (`spec/16`).
- He asked whether it should look more like an email box. It already has a mail client's
  reading-pane layout; an email box's preview line under the subject, search and stars aren't
  specced, so they wait for him to ask.
- The panel's fixes: one unread mark (the orange edge and a bold subject), the open letter only
  tinted; the plate's repeated unread count dropped; a doubt says whose player; the close date
  white with its countdown cyan; the letter's link the secondary action; the top bar as Home's.

## The Football Manager idea

FM's Messages: All, Tasks and Unread over a list grouped under date headers, sender over subject,
the time at the right, and the message open beside it. From CM's news screen, a letter's headline
over its body. Their organisation, never their colours.

## Interaction notes

- **All | Needs you | Unread**: the tabs filter the list; Needs you and Unread carry their counts.
- **A letter's row**: its kind (the same chips as Home's Mail panel), who it's from, its subject and
  the time. Unread rows have the orange edge and a bold subject. Selecting one opens it on the
  right and marks it read; the open one has the cyan edge.
- **The open letter**: its kind, sender and when on the plate, then the headline and its facts.
  A trade offer shows both sides, the one-line note, when it closes with the countdown, and how
  it's reviewed: that row only when the league reviews trades, saying "Commissioner veto" or
  "League vote".
- **The one link**: the letter's last line, to where you act on it: Open the offer in Trades, a
  result's matchup, a claim's Waivers. Block (veto) and Against (vote) are on Trades, reached the
  same way.
- **The deadline letter** (not drawn): the lock time with its countdown, and how your lineup
  stands ("Lineup set, 1 doubt in your eleven"), linking to Tactics.
- **Older**: the next page of letters.
- **Write to the league**: the commissioner's and the admin's; opens the letter to write in the
  right-hand panel, as built (`src/mail/WriteToLeague.tsx`).

## Placeholders

None: every fact on the picture is held.

Canvas: <https://claude.ai/artifact/HjawmrL2GPJ3bJzT1m3Cap>, board "Mail · a trade offer open (UI 6)".
