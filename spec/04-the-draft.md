# 4. The draft

Feature 4 of [SPEC.md](../SPEC.md). Only Craig's answers.

## Starting it

- Held in the app. It starts on a date the commissioner sets, or when the commissioner
  presses start. Most leagues draft online, not in one room (Craig, 20 Oct 2026).
- The draft runs with the teams that exist, even when the league has fewer than its maximum
  (Craig, 2 Nov 2026).
- Draft order is a league setting: random, set by the commissioner, or last season's finish. A
  random order is drawn before the draft starts, so managers have time to plan (Craig,
  2 Nov 2026).

## The picks

- Snake only. The number of rounds is the league's maximum squad size.
- A pick that would break the squad's rules is greyed out and can't be made (Craig, 2 Nov 2026):
  - a player whose club the team is already at the league's maximum for;
  - a player whose pick would leave too few picks to reach an area's minimum: with 2 picks left and
    2 goalkeepers still needed, every outfielder is greyed out.

  So every finished squad is legal.
- Each pick runs on a clock the league sets, from seconds (live) to hours (a slow draft over
  days), and the clock can pause.
- Picks in the current draft can be traded in every league, before the draft starts only (Craig,
  2 Nov 2026).
- A drafted player who leaves the Premier League brings his team nothing in return (Craig,
  20 Oct 2026). He keeps his place in the squad, shown as not available, like an FPL red flag.
- Players nobody drafts go to waivers or straight to free agents: a league setting, waivers by
  default (Craig, 2 Nov 2026).

## Auto-pick

- Auto-pick is a pick made for a manager by the draft, not by him (Craig, 2 Nov 2026).
- It takes the best player left in his queue; when the queue is out, the best in the admin's
  ranking. It skips anyone greyed out or on his do-not-draft list.
- A league setting says how many timeouts a manager gets before he goes on auto-pick, 2 unless
  the league changes it, or "never": then the clock runs for every pick (Craig, 2 Nov 2026). He can
  take control back himself.
- A team with no manager is on auto-pick from the start. Before the draft starts, the commissioner
  can mark such a team "I'll pick for this one", and then picks for it himself.

## The queue and the ranking

- Before the draft, each manager ranks players into his queue; his Scouting shortlist feeds
  it (`spec/19`). The queue is also his auto-pick list. It needn't be complete.
- He also keeps a do-not-draft list, which auto-pick never takes from.
- A manager's queue and do-not-draft list are private to him (Craig, 2 Nov 2026).
- The admin's ranking is a file the admin uploads, a list of players with a rank number, from
  research the admin does himself. It is one ranking for the whole platform. Last season's points
  won't do alone, since players join the league each season (Craig, 2 Nov 2026).
- With no ranking uploaded, auto-pick falls back to last season's points under the site's scoring
  (`spec/14`), newcomers last by name (Craig, 2 Nov 2026).

## The commissioner

- The commissioner can pause the draft, undo a pick, and pick for a manager.
- Pausing and resuming are by hand; a pause keeps the time left on the clock.
- While the draft is paused, he can change the pick time; the new time applies when it resumes.
- Undo takes back the last pick only, and can be repeated to go back further.
- There is no cap on how often or how long he can pause (Craig, 2 Nov 2026).

## After the draft

- In keeper and dynasty leagues, next season's draft is every player who was not kept, in the
  league's draft order.
