# 6. Positions

Feature 6 of [SPEC.md](../SPEC.md). Only Craig's answers: the first `/grill` and `/grill positions`
(20 Oct 2026).

**Contents:** [The labels](#the-labels) · [From real starts](#from-real-starts) ·
[The admin oversees them](#the-admin-oversees-them) · [New signings](#new-signings) ·
[When positions change](#when-positions-change)

## The labels

- Modern position labels, not FPL's four, which can be wrong. No side: a full back is a full back
  on either flank. The labels: GK, CB, FB (full back), WB (wing back), CDM, CM, WM (wide
  midfielder), CAM, W (winger), SS, ST.
- Areas each position can play (`spec/05`): GK in goal; CB and FB in defence; WB in defence and
  the wide lanes of defensive midfield and midfield; CDM in defensive midfield; CM and WM in
  midfield; CAM and W in attacking midfield; SS in attacking midfield and attack; ST in attack.
- A player can have more than one position.
- The same in every league. The admin corrects them; there is no per-league override.

## From real starts

- Taken from where players actually lined up in real matches (the Premier League's formation
  data), not from a scraped site.
- A player gets a position after 3 starts there, counted over his last 38 starts, last season's
  and this. Coming on as a substitute gives no position.
- Claude builds the table from a formation's places to labels from the recorded team sheets: in a
  4-2-3-1 the two deepest midfielders are CDM; in a 4-3-3 the three are CM. Craig checks the
  result on a list of last season's regulars before it is used.
- The rules follow Craig's depth chart work (starts only, 3 to get a position, a run elsewhere
  flags a change, his overrides win), not its engine.

## The admin oversees them

- At first, positions worked out from starts are proposals: they count once the admin approves
  them, a whole club or one player at a time. A setting later lets them count straight away, with
  only changes waiting for him.
- A position the admin sets stays until he removes it; starts can still add others.
- Support striker (SS) is a position. Lineups alone can't tell him from a number 10, so the admin
  marks him; SS is added to his positions, and a recount never removes it.
- One admin dashboard in the beta ([15](15-admin-tools.md)): a queue (new signings, possible
  support strikers, flagged and removed positions), search to correct any player, the
  thresholds, and the feeds page as a tab.

## New signings

- A new signing with no starts takes his position from the Premier League's own label for him,
  and it counts at once, shown as unconfirmed until the admin confirms it.
- The dashboard links to his Transfermarkt, FotMob and Understat pages for the admin to read;
  nothing fetches them.

## When positions change

- Positions change when a player's real-life role changes, gradually: the manager is warned first,
  then the position goes. The thresholds are admin-tunable (starting point: flagged after 3
  matches in a row elsewhere, removed after 6, only between gameweeks).
- Losing a position never makes a squad illegal. The player stays in his slot for the gameweek
  and the manager is warned.
