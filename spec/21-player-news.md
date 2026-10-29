# 21. Player news

Feature 21 of [SPEC.md](../SPEC.md). Only Craig's answers, from `/grill player news` (29 Oct 2026).

A note on every player, as Fantrax has: "a news snipped for each player that updats with player
performance and news". After the mini beta. It must hold for many leagues, up to about 80 teams.

## Notes

- Two kinds of note in one feature: a match note on how he did, and real news (an injury, a
  manager's words at a press conference, a transfer).
- A match note is written once his match's score is final, and only if he played.
- Real news comes from an AI reading public news feeds, read every hour; not a paid feed.
- A note states facts only, in our own words, and never advises.
- A note never mentions our game: no fantasy terms, no managers or owners, no points.
- Every note carries its date and a link to the article it came from.
- When two sources disagree, both notes show, each with its link.
- A note is the player's, written once and read by every league, so its cost doesn't grow with
  teams or leagues.

## Where notes show

- The player card's News: FPL's injury news and chance of playing (`spec/12`), and his three
  latest notes, newest first.
- Mail: a letter for each real-news note about a player in your squad. Not your next opponent's
  players, and not match notes (`spec/16`).

## Running it

- The AI is Claude Haiku 5.5, with a monthly spending cap of $10 set in Anthropic's console
  (`ARCHITECTURE.md`, Services).
- Claude picks the news sites, from feeds published for reuse; the admin's feeds page lists them.
- If the news job stops, it shows late on the feeds page like any feed (`spec/20`), and the card
  keeps its last notes.
- Only the admin hides a wrong note, with a Hide button on the note on the player card, shown only
  to the admin. A hidden note is gone from every league.
