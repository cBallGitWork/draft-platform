# 20. Going live

Feature 20 of [SPEC.md](../SPEC.md). Only Craig's answers, from `/grill #203 deploy path`
(28 Oct 2026). How the site gets from a merge to the managers.

## The live site

- A live database of its own, beside the development one, in the same Convex project.
- It starts empty: the football sync fills in players and fixtures, and the league is made fresh.
  Nothing is copied from development, which holds test leagues.
- The domain is `fantasydraftmanager.net`, bought through Vercel. It is the site's address and
  the sign-in emails' sender, `signin@fantasydraftmanager.net`. Without a domain, sign-in
  links reach only the Resend account's own inbox.
- Craig is the admin on the live site.
- For the beta, the live site is the shared environment: a change is done only once it is seen
  working there. No staging site.

## Setting it up

- Craig's part: log in to Convex, Vercel and Resend once, pay for the domain, and make the deploy
  key on the Convex website.
- Everything else is one setup command, safe to run again, that Claude runs: it creates the live
  database, sets the five sign-in settings, puts the deploy key in Vercel, connects the domain,
  verifies it with Resend and runs the player-positions sync once.
- No secret is ever printed, to Craig or to Claude.

## Every release

- Each merge to `main` puts the site and the server code live together, with
  `npx convex deploy --cmd 'npm run build'` (Craig, 22 Oct 2026). Merges already wait for green
  checks.
- After each release, an automatic check opens the live site and signs in. If it fails, the run
  goes red and GitHub emails Craig. It goes red too when the hour's sign-in link limit stops it
  (Craig, 1 Nov 2026: "sure"; #908).
- No preview sites for unmerged changes, for now.

## Rolling back

- A release is undone by reverting its merge.
- Saved data changes shape only in safe steps: widen, fill in, then narrow (Craig, 22 Oct 2026).
- A backup is taken before any release that changes saved data's shape, because reverting code
  doesn't bring back changed data. Whether it is taken automatically or the release stops for
  one is Claude's call (Craig, 28 Oct 2026).

## Timed jobs

The same four run on the live site and on development:

- the football sync, every six hours;
- live stats, every minute;
- late stats, every 10 minutes (`spec/07`);
- clearing old run logs, daily.
