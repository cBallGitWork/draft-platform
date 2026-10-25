# 19. Scouting

Feature 19 of [SPEC.md](../SPEC.md). Only Craig's answers, from `/grill players and scouting`
(25 Oct 2026). The research behind it: [Scouting and recruitment: what others
do](https://claude.ai/artifact/5PV38c1qDtyNuqkeGh2i62).

**Scouting** is its own section of the menu, in place of Players: everything about finding
players. Scouting advises; Mail never does (`spec/16`).

## What's open to everyone

- Every stat stays open to everyone. Scouting rations judgement, never numbers.

## The players list

- Every Premier League player, filtered to free agents, on waivers or owned, by position and by
  club, sortable by any stat, with season points under the site's scoring (`spec/14`).
- Two players side by side, to compare.
- By the mini beta.

## The shortlist

- A manager's own list of players for the season.
- It feeds the draft queue (`spec/04`).
- Mail tells the manager when a shortlisted player is dropped or clears waivers (`spec/16`).
- By the mini beta.

## Scouts

- Each team has 3 scouts, a number the site sets, as it does the scoring (`spec/14`).
- A scout is sent to one player, any player, one another team owns included. The report is ready
  24 hours after the scout is sent.
- Who a manager scouts is hidden from the other teams.
- Mail says when a report is in, and nothing more.
- After the mini beta.

## The report

- A few plain sentences, written by AI, judging: his fit with the manager's shape and roles under
  the site's scoring; his form trend; his job security (will he keep starting); his fixtures ahead.
- It keeps the date it was written; sending a scout to him again writes a new one.

## Role stars

- A player's role stars (`spec/05`) show for the manager's own squad and for players the manager
  has scouted, and stay shown for the season. For everyone else they are hidden.
