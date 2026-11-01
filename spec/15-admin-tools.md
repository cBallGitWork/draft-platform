# 15. Admin tools

Feature 15 of [SPEC.md](../SPEC.md). Only Craig's answers: the first `/grill` and
`/grill admin tools` (16 Oct 2026). Two people run things: Craig as the platform **admin**, and
each league's **commissioner**.

## The admin (Craig)

- Creates each league and names its commissioner (`spec/01`), and keeps an override on every
  league.
- Approves, sets and corrects positions on one admin dashboard (`spec/06`): new signings, support
  strikers, positions worked out from starts, any player; and tunes the position-change thresholds.
  The feeds page below is a tab of it (`/grill positions`, 20 Oct 2026).
- Sets the stat-correction window (`spec/07`).
- Can remove a manager from a league. The team stays, for the commissioner to hand to someone
  new (`spec/09`).
- Owns the site's scoring set and changes it by patch (`spec/14`, 25 Oct 2026).
- Owns each club's colours and shirt pattern on the admin dashboard (`spec/12`), for any club at
  any time, any colour; a file gives every club its first. A club with none waits in the dashboard's queue
  beside clubs to approve, with no email, its shirt and mark white until set (Craig, 31 Oct 2026:
  "soething that we could flag to the admin that a team doenst have a colour, then we can set
  on admin"; the admin owning them leaves room for real shirt packs and away kits later).
- Reads managers' feedback: a Feedback link in the top bar opens one text box, and what is sent
  lands in a list on the admin dashboard, with no email (25 Oct 2026).
- A feeds page: when FPL's and the Premier League's data last arrived, and whether scoring is
  behind. A feed that stops silently is the failure to catch. A feed or sync that fails also
  emails the admin, at most once a day for each feed (24 Oct 2026). The page also shows a stat
  correction that arrives after a match's points have locked ([7](07-scoring.md#match-stats)).
- One league whose rules are broken never stops the football feed for the other leagues: it is
  skipped, named in the log and emailed to the admin, and the others carry on (Craig, 1 Nov 2026:
  "no", to whether one league's broken rules should stop the feed for every league; #896).
- His actions are logged where only he sees them. One files a Mail letter in a league when it
  changes a score, a squad or who runs a team there; a position correction doesn't, since managers
  already get its warning (`spec/06`). (Craig left this to Claude.)

## The commissioner

- Everything the other features give the commissioner: the league's rules (`spec/03`; the scoring is
  the site's, `spec/14`), the draft's schedule and controls (`spec/04`), trade vetoes where the
  league uses them (`spec/08`), the head-to-head fixtures, handing a team on and the auto team
  (`spec/09`), one-way letters (`spec/16`) and overriding a past score (`spec/14`).
- Can remove a manager from the league, as the admin can ([13](13-setting-up-a-league.md#leaving)).
- One commissioner per league, and at most one co-commissioner with every commissioner power
  except naming or removing either and deleting the league (`/grill setting up a league`,
  20 Oct 2026, which replaced "no co-commissioners"; see [13](13-setting-up-a-league.md)).
- Every commissioner action files a Mail letter to the whole league: nothing changes quietly.
  Refusing a join request files none ([13](13-setting-up-a-league.md#joining)).

## Joining a league

How invites, the invite link and join requests work in detail is in
[13. Setting up a league](13-setting-up-a-league.md#joining).

- The commissioner enters a manager's email address and the app sends a sign-in link; or the
  commissioner shares the league's one invite link (say, in the group chat). Opening the link only
  asks to join: the commissioner approves each request and picks which team the person gets, a
  vacated one included. A leaked link lets no one in. One manager runs one team.

## Assigning players

- The commissioner and the admin can both put any player on any team, one at a time (search, pick
  a team), move a player between teams, and release one to free agency.
- The league's squad limits warn but don't block.
- A squad holding a player the football data no longer has: a notice says the data is broken, and
  his row stays, as an error message (Craig, 31 Oct 2026, #323: "b but dont hide the row, mabe an
  error message. easier to spot/debug").

## The mini beta

- Needed by then: creating a league and naming its commissioner, inviting managers, assigning
  players, editing the scoring set, overriding a score, approving and correcting positions, and the feeds page.
  The rest (draft controls, trade veto, fixture editing, handing a team on, the auto team) by
  August.
