# 8. Between gameweeks

Feature 8 of [SPEC.md](../SPEC.md). Only Craig's answers.

**Contents:** [Waivers and free agency](#waivers-and-free-agency) · [Trades](#trades)

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
  - Changed run times count only from the next one still ahead, so a new time already gone this
    week never runs at once: runs only happen at times managers were shown (Craig, 11 Nov 2026,
    #1468). `S08.10`
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
  - Only new claims are shut: a claim already in can still be withdrawn or re-ranked in that time
    (Craig, 11 Nov 2026, #1590). `S08.14`
- A run made late keeps its own check on now, and is skipped if its time fell in the lock (Craig,
  11 Nov 2026, #1470). `S08.11`
- A player nobody claims at a run is a free agent straight after it, first come first served, through
  the window.
- A free agent nobody picks up goes back on waivers at the deadline, so the next run hands him out
  by the waiver order like any dropped player (Craig, 11 Nov 2026, #1478). `S08.13`
- Picking up a free agent with a full squad names who goes, and both happen at once: "think of it
  like a trade with the waiver bin" (being dropped).
- Churning is stopped: a free agent picked up and dropped before the next deadline goes straight
  back to being a free agent, never onto waivers, so nobody holds players away from the league.
  Once he has been in the squad for a deadline, a drop sends him to waivers like anyone else.
  Dropping is never restricted: "he can drop him anytime he wants".
- The churn rule covers only the manager who picked him up: a player who reaches another team by
  trade or commissioner move goes onto waivers for 24 hours when that team drops him, like any
  other drop (Craig, 11 Nov 2026, #1479). `S08.6`
- A player new to the Premier League mid-season goes on waivers for the next run, as players nobody
  drafts do by default (`spec/04`). A player who comes back to the Premier League mid-season counts
  as new, whenever he left, so every league's managers get the same fair chance at him (Craig,
  11 Nov 2026, #1489). `S08.8`
- A claim that would break the squad's limits is refused at the run.
- A manager sees only his own pending claims; the commissioner sees everyone's. The league gets a
  Mail letter for each claim that succeeds, who came in and who went; a failed claim's letter goes
  only to its manager (`spec/16`).
- A failed claim's Mail letter says why: another team was ahead, his drop was already gone, or the
  squad's limits.
- A claim for a player his team already has, won by his own earlier claim in the same run or put
  there by the commissioner, goes quietly, with no letter (Craig, 11 Nov 2026, #1465). `S08.5`
- No claim limits per season, week or team ("no limit"), and no can't-drop list.
- Free agency and waivers open only once the league's draft is over: before it, pickups, drops and
  claims are refused and waiver runs are skipped ("refused until drafted"; Craig, 8 Nov 2026, #1326). `S08.1`

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
- An offer made during the trade deadline's gameweek closes once that gameweek's last match is
  over, when trades stop (Craig, 6 Nov 2026, #383). That time isn't known ahead, so the screen and
  the offer's letter say it in words, such as "After GW20's last match" (Craig, 11 Nov 2026,
  #1492). `S08.9`
- No player trades until the draft is over: while it is live, mid-season drafts included, no offer
  is made or accepted, as free agency and the commissioner's moves wait for it (Craig, 11 Nov
  2026, #1482). `S08.7`
- Trades come after the mini beta, by August, with the veto and the league vote (`spec/15`;
  the vote, Craig, 31 Oct 2026).
- Under a veto, the commissioner gets a Mail letter for each accepted trade, with Block in it;
  under a vote, each other manager gets one with Against in it. A blocked trade files a letter to
  the whole league; one that clears review files the usual trade letter (`spec/16`; 31 Oct 2026).
- Under a veto, a trade the commissioner is in goes to the co-commissioner, or to a league vote
  if there is none (31 Oct 2026).
- When the commissioner or co-commissioner changes during a review, whoever holds the role now
  reviews the trade: he gets the review letter with Block in it and sees it in To review, the one
  who left can't block it, and the 24 hours don't restart (Craig, 11 Nov 2026, #1472). `S08.12`
- While a team is on the auto team (`spec/09`), no offer goes to or from it, and its open offers
  close when the auto team switches on; a trade already accepted and in review finishes it. Its
  manager doesn't vote: "most of them" is most of the managers still playing (31 Oct 2026).
- A trade you review shows in a "To review" group at the top of Offers: its columns read as the two
  teams' sides, Waiting on shows "You", and Closes shows when the review ends. Selecting it opens
  its panel with both sides, the note, the review's end and Block behind a confirm. The Mail
  review letter's one link opens it (Craig, 10 Nov 2026, #383). `S08.2`
- An Against can be taken back until the 24 hours are up, in case of a typo: the button switches
  to "Take back" (Craig, 10 Nov 2026, #383). `S08.3`
- Nobody sees how a vote stands until the review ends: the blocked or made letter is the result,
  and each voter sees only his own vote (Craig, 10 Nov 2026, #383). `S08.4`
