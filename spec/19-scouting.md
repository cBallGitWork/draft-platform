# 19. Scouting

Feature 19 of [SPEC.md](../SPEC.md). Only Craig's answers, from `/grill players and scouting`
(25 Oct 2026). The research behind it: [Scouting and recruitment: what others
do](https://claude.ai/artifact/5PV38c1qDtyNuqkeGh2i62).

**Scouting** is its own section of the menu, in place of Players: everything about finding
players. A scout's report judges a player; Mail only reports (`spec/16`).

## What's open to everyone

- Every stat stays open to everyone. Scouting rations judgement, never numbers.

## The players list

- Every Premier League player, filtered to free agents, on waivers or owned, by position and by
  club, sortable by any stat, with season points under the site's scoring (`spec/14`).
- Before the new season's first match, Scouting's season totals are last season's (Craig, 30 Oct
  2026: "ok you do it", to the recommendation on #647).
- A player's season points are at his main position, as his player card opens on: "Has to be his
  main as that's consistent week to week" (Craig, 1 Nov 2026).
- They take in the league's overrides: Scouting shows the same total his player card does in that
  league (Craig, 1 Nov 2026).
- Last season's, shown before the new season's first match, are priced under the site's scoring as
  it stands now (Craig, 1 Nov 2026).
- Two players side by side, to compare.
- By the mini beta.

## The stat race

- A teams view in Scouting's stats: each team's season total in every scoring category, ranked by
  the one the manager picks to sort by (Craig, 31 Oct 2026: "yeah that's fine in stats").
- It counts only what counted: a team's starters, and the bench players who came on.
- Raw stats ("7 clean sheets"), not points. A table only, with no trophy.

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
  has scouted, and stay shown for the season. For everyone else they are hidden, once scouts
  exist; until then they show for every player (25 Oct 2026).
