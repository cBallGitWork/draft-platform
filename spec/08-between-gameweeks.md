# 8. Between gameweeks

Feature 8 of [SPEC.md](../SPEC.md). Only Craig's answers.

- Waivers in the league's waiver order, then free agents, first come first served, until the deadline.
- Trades between managers: players and picks in the current draft, plus next season's picks in
  keeper and dynasty leagues.
- Trade review is a league setting: none, a commissioner veto, or a league vote.

## Waivers and free agency

From `/grill waivers and free agency` (5 Nov 2026). The words stay waivers, claim, drop and free
agent: "keep waivers since its known for draft" (Craig asked; yes).

- A dropped player goes on waivers for at least 24 hours before a run can take him.
- A manager with a full squad names who he drops with his claim; that player goes only if the claim
  succeeds.
- A manager puts in as many claims as he likes, ranked: if his first fails, his next is tried.
- The waiver order is reverse table order by default, or rotating (`spec/03`); corrected on 5 Nov
  2026, the same day:
  - Reverse table order is worked out again when a gameweek ends, the bottom of the table first. A
    team that wins a claim goes to the bottom until the next gameweek ends: "the table order resets
    only fully only when a gameweek ends".
  - Rotating: whoever last won a claim goes to the bottom, and it never resets: "rolling means
    whoever last made a waiver is at the bottom, that doesnt reset. you dont want to give the last
    pick in draft first waiver every week".
  - There is always a table ("theres always a table"), everyone on 0 at the start. Teams level in it
    go by its own tie-breaks, then by the reverse of the draft order, which is also rotating's
    starting order.
- Waivers run Wednesday and Thursday at 18:00 UK time, every new league's default "for now"; the
  commissioner can change it (`spec/03`).
- Both runs work alike: every player whose 24 hours are up is claimed in order. A drop on Tuesday
  at 10:00 makes Wednesday's run; one after 18:00 on Tuesday makes Thursday's.
- The window: from the first waiver run after a gameweek to the next deadline, when players are free
  agents ("i like the Window"). Before it opens, from the gameweek's last match to that run, managers
  drop players and put in claims, but nothing moves and there are no free agents: "theres a period
  where you cant make a waiver yet". For example, a Saturday to Monday gameweek: locked Saturday
  11:00 to Monday 22:00, claims and drops until Wednesday 18:00, then the window until the next
  deadline.
- From the deadline until the gameweek's last match is over, there are no claims, drops or free
  agent pickups. A run that falls in that time is skipped.
- A player nobody claims at a run is a free agent straight after it, first come first served, through
  the window.
- Picking up a free agent with a full squad names who goes, and both happen at once: "think of it
  like a trade with the waiver bin" (being dropped).
- Churning is stopped: a free agent picked up and dropped before the next deadline goes straight
  back to being a free agent, never onto waivers, so nobody holds players away from the league.
  Once he has been in the squad for a deadline, a drop sends him to waivers like anyone else.
  Dropping is never restricted: "he can drop him anytime he wants".
- A player new to the Premier League mid-season goes on waivers for the next run, as players nobody
  drafts do by default (`spec/04`).
- A claim that would break the squad's limits is refused at the run.
- A manager sees only his own pending claims; the commissioner sees everyone's. The league gets a
  Mail letter for each claim that succeeds, who came in and who went; a failed claim's letter goes
  only to its manager (`spec/16`).
- A failed claim's Mail letter says why: another team was ahead, his drop was already gone, or the
  squad's limits.
- No claim limits per season, week or team ("no limit"), and no can't-drop list.

## Trades

From `/grill trades` (25 Oct 2026).

- An offer holds any mix of players and picks on either side, in any numbers. A squad pushed past
  its limits is warned, as an assignment is (`spec/15`).
- An offer can carry a one-line note.
- The other manager accepts, rejects or counters with a changed offer, which closes the old one.
- An offer nobody answers closes at the next deadline.
- Review: under a commissioner veto, the commissioner has 24 hours to block an accepted trade, or
  it goes through. Under a league vote, the other managers have 24 hours, and it is blocked only if
  most of them vote against.
- Once a trade is through, its players move at once. A gameweek already under way keeps their
  points with the old team.
- A trade deadline is a league setting, off by default: no trades after a gameweek the
  commissioner picks.
- Trades come after the mini beta, by August, with the veto and the league vote (`spec/15`;
  the vote, Craig, 31 Oct 2026).
- Under a veto, the commissioner gets a Mail letter for each accepted trade, with Block in it;
  under a vote, each other manager gets one with Against in it. A blocked trade files a letter to
  the whole league; one that clears review files the usual trade letter (`spec/16`; 31 Oct 2026).
- Under a veto, a trade the commissioner is in goes to the co-commissioner, or to a league vote
  if there is none (31 Oct 2026).
- While a team is on the auto team (`spec/09`), no offer goes to or from it, and its open offers
  close when the auto team switches on; a trade already accepted and in review finishes it. Its
  manager doesn't vote: "most of them" is most of the managers still playing (31 Oct 2026).
