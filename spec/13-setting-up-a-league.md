# 13. Setting up a league

Feature 13 of [SPEC.md](../SPEC.md). Only Craig's answers: `/grill setting up a league`
(20 Oct 2026). Who runs a league is in [15. Admin tools](15-admin-tools.md); this is how one
comes to exist, fills, changes and ends.

**Contents:** [Creating a league](#creating-a-league) · [Teams](#teams) ·
[Who runs it](#who-runs-it) · [Joining](#joining) · [Leaving](#leaving) ·
[Gameweeks](#gameweeks) · [Several leagues](#several-leagues) · [Deleting](#deleting)

## Creating a league

- The admin creates a league and sets its name, its maximum number of teams (2 to 20) and its
  commissioner's email. Naming a commissioner who has no account yet sends them a sign-in link.
- The commissioner then ticks the gameweeks the league uses and edits its rules.
- The commissioner can raise or lower the maximum later, never below the teams already there.

## Teams

- A team is made each time a manager is approved, up to the maximum. A team whose manager leaves
  stays, for the commissioner to hand to the next person.
- A team starts as "Team 1", "Team 2" and so on, and its manager renames it. Names are unique
  within the league, up to 30 characters.
- The admin can name a team's manager directly, from the command line; the commissioner and
  co-commissioner invite instead (22 Oct 2026).

## Who runs it

- The admin is Craig, by his email address set on the server, not a setting in the app. It is
  the only role across the whole platform.
- Commissioner is a role in one league: the same person can be commissioner in one league and a
  manager in another. The commissioner can run a team in the league, joining like anyone, or
  none.
- A league may have one **co-commissioner**, named by the commissioner or the admin, with every
  commissioner power except naming or removing a commissioner or co-commissioner, and deleting
  the league.

## Joining

- An emailed invite names the team it is for, or a new team, and the person joins on first
  sign-in with no approval. It lasts 7 days, and the commissioner can cancel or resend it. An
  invite needs no more guarding than that: if someone joins who shouldn't, the commissioner
  removes them.
- Someone whose invite expired, was cancelled or couldn't be used, and who is in no league, is told
  so on signing in, with why, and to ask the commissioner for a new one (22 Oct 2026).
- The commissioner can switch the league's invite link off, or replace it with a new one; the old
  one then stops working.
- The commissioner approves or refuses each join request. A person has at most one request
  waiting, sees that it is waiting for the commissioner, and gets an email once approved.
  Refusing files no Mail letter.
- Until invites are built, a sign-in link goes only to emails the admin puts on an allowed list;
  invites add to that list once they exist. The invite link lets anyone who opens it sign in to
  ask to join (`/grill sign-in`): it's a beta, and a leak needs no guarding.
- Invites past the email service's daily limit (100 a day for now) wait for the next day, and the
  commissioner is told.

## Leaving

- The admin or the commissioner can remove a manager. A removed manager loses the league at once
  and can be invited back later. The team keeps its name.
- A manager can leave a league themselves. It works like a removal, and files a Mail letter.

## Gameweeks

- The commissioner ticks the gameweeks the league uses, all 38 by default: a league can end early
  or take a break, such as at Christmas.
- After the season starts, only gameweeks that haven't begun can be ticked or unticked.
- An unticked gameweek scores nothing and has no head-to-head; its lineups don't matter. Waivers,
  free agency and trades carry on through it.
- The head-to-head round robin ([9. Season admin](09-season-admin.md)) is drawn over the ticked
  gameweeks only, and a change reshuffles only fixtures not yet played.

## Several leagues

- A manager in several leagues switches between them from a list in the top bar, and the app
  opens the one they used last.

## Deleting

- The admin or the league's commissioner can delete a league; the co-commissioner can't.
- For 24 hours it can be undone. In that time the league is frozen and hidden from its managers,
  and each gets an email saying it will be deleted, and when. When the admin deletes it, its
  commissioner still sees it and can undo it (22 Oct 2026).
- After 24 hours it is gone for good, not archived.
