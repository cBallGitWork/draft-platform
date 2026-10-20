# 14. Scoring categories

Feature 14 of [SPEC.md](../SPEC.md). Only Craig's answers, from `/grill scoring categories`
(16 Oct 2026).

## The catalogue

- Every stat the two free feeds give per player per match (confirmed by #7), each with a plain
  name and a short code. A league can score any of them; roles (`spec/05`) draw on the same list.
  The names and codes are written with the first scoring set; until then stats are stored under
  the feeds' own names (`/grill match stats`, 20 Oct 2026).
- No FPL bonus points.

## How a rule scores

- A player is scored by the **area of the slot he starts in** for that team (`spec/05`): a
  centre-back played in midfield scores as a midfielder. A league sets values per area.
- Three kinds of rule:
  - per action (+3 per assist);
  - per number of actions (+1 per 3 saves);
  - bands by threshold (2 for 60+ minutes, +2 for 10+ defensive actions). Each band rule either
    stacks or pays only its highest band.
- A stat the feed hasn't sent yet for a finished match shows "—", and the match stays
  provisional until it arrives. Nothing is guessed. "—" means a player's whole record for the
  match hasn't arrived; once it has, a stat it leaves out is 0 (`/grill match stats`, 20 Oct 2026).

## Changes and corrections

- A commissioner can change the scoring mid-season; it applies from the next gameweek. Past
  gameweeks are locked.
- A commissioner can override one player's points for one match, with a reason. It re-scores that
  head-to-head and sends Mail to the whole league saying what changed and why.

## The first scoring set

- The mini beta runs on one first scoring set: a draft written from the catalogue, starting from
  the Tim Hortons Pro League's own values so it feels familiar, which Craig edits before the beta.
  It carries the starting list of roles (`spec/05`). The platform's real sets are designed later.

## On screen

- The player card breaks each match down by category (goals 5, assists 3, minutes 2, role +2).
- Bench players' points show greyed on the card and the matchup, and count only if the player is
  subbed on (`spec/05`).
- Dense tables use short codes (G goals, A assists, CS clean sheet, KP key passes, TW tackles
  won) with the full name on hover; the rules editor uses full names.
