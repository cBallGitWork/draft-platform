# 8. Between gameweeks

Feature 8 of [SPEC.md](../SPEC.md). Only Craig's answers.

- Waivers in the league's waiver order, then free agents, first come first served, until the deadline.
- Trades between managers: players and picks in the current draft, plus next season's picks in
  keeper and dynasty leagues.
- Trade review is a league setting: none, a commissioner veto, or a league vote.

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
