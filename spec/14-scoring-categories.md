# 14. Scoring categories

Feature 14 of [SPEC.md](../SPEC.md). Only Craig's answers, from `/grill scoring categories`
(16 Oct 2026), `/grill scoring options` (21 Oct 2026) and `/grill scoring the site owns`
(25 Oct 2026).

## Who owns it

- The site owns the scoring set: the categories and their values, points limits, minutes, whole
  points only, roles' adjustments (`spec/05`) and the gap rule. "At first its better for us to be
  games master" (Craig, 25 Oct 2026): the admin and the site's staff run it, and leagues don't
  edit it. Each league keeps the rest of its rules in League settings (`spec/03`).
- Every manager can read the scoring on Player scoring; only the admin changes it.
- The site's first set is the first scoring set below, and every league plays on it.

## The catalogue

- Every stat the two free feeds give per player per match (confirmed by #7), each with a plain
  name and a short code. A league can score any of them; roles (`spec/05`) draw on the same list.
  The names and codes are written with the first scoring set (`/grill match stats`, 20 Oct 2026).
  For now they are placeholders copied from the feeds' own names, for Craig to refine later
  (21 Oct 2026).
- No FPL bonus points.

## How a rule scores

- A player is scored by the **slot he starts in** for that team (`spec/05`), never by his own
  positions: a centre-back played at full-back scores as a full-back.
- Each rule chooses how finely it is priced: the same for all, by area, or by position. A slot's
  position comes from its area and lane, left and right alike:

  | Area | Wide lanes | Centre lanes |
  |---|---|---|
  | goalkeeper | | GK |
  | defence | FB | CB |
  | defensive midfield | WB | CDM |
  | midfield | WM | CM |
  | attacking midfield | W | CAM |
  | attack | ST | ST |

  SS will have its own price, so a support striker can score differently (Craig, 22 Oct 2026);
  how a slot becomes SS is to grill (`spec/06`).
- Three kinds of rule:
  - per action (+3 per assist);
  - per number of actions (+1 per 3 saves);
  - bands by threshold (2 for 60+ minutes, +2 for 10+ defensive actions). Each band rule either
    stacks or pays only its highest band.
- A rule can also carry, each optional:
  - points limits: a maximum and a minimum on the points it pays one player in one match (FPL's
    defensive contribution pays at most 2);
  - the minutes he must play before it pays anything (a clean sheet only at 60+).

  Each is one number for the rule, or set by area or position like its values. A points limit
  holds only the rule's own points: a role's adjustment is added on top.
- Points can be fractions (0.5 per tackle), kept in tenths so totals never drift. The site's set can
  choose whole points only (25 Oct 2026; once each league's choice): a fractional value is then
  refused with the reason, and an own stat counts whole actions, rounded down (tackles + 0.5 ×
  clearances = 3.5 counts 3). Whole points only starts off.
- A stat the feed hasn't sent yet for a finished match shows "—", and the match stays
  provisional until it arrives. Nothing is guessed. "—" means a player's whole record for the
  match hasn't arrived; once it has, a stat it leaves out is 0 (`/grill match stats`, 20 Oct 2026).

## Own stats

- The admin can make an own stat, as part of the site's set ("lets us invent a category too for
  when we need it"), by adding catalogue stats, each with a weight, which can be
  negative: tackles + 0.5 × clearances; shots − shots on target. Stats are only added, never
  multiplied or divided by each other, and are only catalogue stats, never another own
  stat.
- It then works like any category: any of the three kinds of rule, roles can use it, and it has
  its own name and short code in the category tables. An own stat whose name or short code
  matches a catalogue stat's, ignoring case and spaces, is refused when saved (22 Oct 2026).

## Changes and corrections

- The site's set changes by **patch**, "like a league of legends patch" (Craig, 24 Oct 2026). A
  patch is a new version of the set, named for the season and its number, `26_27.1`, the number
  starting again at 1 each season. Only the admin makes one.
- The admin saves a patch as a draft, then announces it with the deadline it takes effect from, at
  least 7 days after it is announced ("week notice for updates"). Patches can land mid-season.
- Gameweeks already played keep the version in force in them, and a re-score never applies a later
  patch: past gameweeks are "locked in as a relic" (25 Oct 2026).
- A mistake in a value can be fixed at once, without the week's notice, announced as a fix; it
  still never touches a gameweek already played.
- A patch is announced by a Mail letter to every manager (`spec/16`), and by a site banner from the
  announcement until it takes effect, which each manager can dismiss. The banner links to the patch
  notes, a page listing every version's changes.
- A commissioner can override one player's points for one match, with a reason. It re-scores that
  head-to-head and sends Mail to the whole league saying what changed and why.

## The first scoring set

- The mini beta runs on one first scoring set: FPL's own scoring without bonus points, for now (21
  Oct 2026; it replaces starting from the Tim Hortons Pro League's values). Craig changes it in the
  rules editor, by patch. FPL has only GK, DEF, MID and FWD, so all three midfield areas take MID's
  values, and every position takes its area's.
- It carries the starting list of roles (`spec/05`). The platform's real sets are designed later.

## The rules editor

- It is in the mini beta. It is the admin's editor for the site's set (25 Oct 2026); for everyone
  else Player scoring only shows the rules.
- What it opens on is simple: each category with one value. Pricing by area or position, the
  points limits, the minutes and stacking sit behind checkboxes. Its look is two panes, picked
  from three mock-ups (Craig, 22 Oct 2026): the categories down the left, the chosen one on the
  right (#30).
- Two people editing the rules at once: the second save warns rather than silently replacing the
  first (Craig, 22 Oct 2026). It is refused, naming who saved and when; their edits stay on
  screen, with the latest rules offered in their place.

## On screen

- The player card breaks each match down by category (goals 5, assists 3, minutes 2, role +2).
- Bench players' points show greyed on the card and the matchup, and count only if the player is
  subbed on (`spec/05`).
- Dense tables use short codes (G goals, A assists, CS clean sheet, KP key passes, TW tackles
  won) with the full name on hover; the rules editor uses full names.
