# Setting up

How to get the app running locally. The project's own docs are [SPEC.md](../SPEC.md),
[ARCHITECTURE.md](../ARCHITECTURE.md) and [CLAUDE.md](../CLAUDE.md).

## Start

You need:

1. Node 24.
2. Membership of the Convex team `craigdavidball14`: `npm run setup` is hardcoded to it.
3. A Resend account and its API key.

To run the gates (`npm run verify`, `npm run smoke`) and ship: python3 and git, jq at /usr/bin/jq
(built into macOS 15+; the hook tests call that path), Google Chrome (local smoke and screenshots)
and the gh CLI signed in to the repo.

Clone, then:

```
npm install && npm run setup && npm run dev
```

`npm run setup` runs once, in a terminal you can type in: it signs you in to Convex (accept its
terms when asked), gives you your own cloud dev deployment of the `draft-platform` project and
writes `.env.local` (`env.example` says what lands there). A plain first `npm run dev` can land
on a deployment on your own machine instead, which proves nothing about Convex's servers.

After pulling a change to `package-lock.json`, run `npm ci`.

The hooks deny a commit, pull request, issue or comment naming a word on Craig's private list,
kept outside the repo at `~/.claude/private-words.txt`, one per line. A Claude Code cloud
environment has no such file: put the words in its settings as the environment variable
`DRAFT_PRIVATE_WORDS_LIST` (one per line or comma-separated). With neither, nothing is checked and
the hooks say so on every commit or pull request.

`npm run dev` pushes the Convex functions to your dev deployment, keeps pushing as they change,
and starts the app at <http://localhost:5173>: the sign-in page.

Sign-in needs five settings on the deployment (JWT_PRIVATE_KEY, JWKS, SITE_URL, ADMIN_EMAIL,
AUTH_RESEND_KEY), set once from the checkout `npm run setup` ran
in (its `.env.local` names your dev deployment):

- `npx @convex-dev/auth --web-server-url http://localhost:5173` sets Convex Auth's keys and
  `SITE_URL`, where the emailed links point. It then offers its code, which `convex/` already
  holds: it edits no file that exists, so answer yes to each "Ready to continue?", and
  `git status` should show nothing changed after.
- `npx convex env set ADMIN_EMAIL` names the admin, and `npx convex env set AUTH_RESEND_KEY`
  holds Resend's API key: pipe each value in, so it stays out of your shell history. Until there
  is a sending domain, mail comes from Resend's test sender (`onboarding@resend.dev`, set in
  `convex/outbound/email.ts`), which reaches only the Resend account's own address, so `ADMIN_EMAIL`
  must be that address and no one else gets a link yet.

The admin can sign in at once; anyone else is put on the allowed list first:
`npx convex run signIn/allowedEmails:add '{"email":"someone@example.com"}'`.

The admin creates a league from **Create a league** on the leagues page; its commissioner is
let sign in, and sent a link if they have no account. A commissioner adds managers from
**Invites and join requests** on the league's row of the leagues page, and removes one from its
**Teams** panel; a manager leaves from the foot of the top bar's league list. Renaming teams, the
maximum and the co-commissioner have no screen yet, so they are run from the CLI as the person
allowed to, by their `_id` in the `users` table (without `--identity` the server refuses), as
removing a manager still can be:
`npx convex run leagues/teams:removeManager '{"leagueId":"…","teamId":"…"}' --identity '{"subject":"<their _id>|cli"}'`.
The admin alone names a team's manager directly, the same way with the admin's `_id`:
`npx convex run leagues/teams:addManager '{"leagueId":"…","email":"someone@example.com"}' --identity '{"subject":"<admin's _id>|cli"}'`
(add `"teamId"` to hand them a vacated team).

To see the screens without signing in, add `?preview=` to the address: `manager` (in two leagues),
`commissioner` (running them), `newcomer` (in none), `admin` (seeing every league) or `visitor`
(dev server only, with made-up figures). `npx vite` starts the app alone, without touching Convex,
and then only the previews work.

`npm run verify` runs the local gate; the [verify skill](../.claude/skills/verify/SKILL.md) lists
what it checks and what CI runs besides.

The app is in `src/` and the server in `convex/`, one folder per feature in each. The tests are in
`tests/`, mirroring them (`tests/convex/`, `tests/src/`, `tests/scripts/`), with the shared
harnesses and recorded feeds in `tests/support/` and the browser smoke suite in `tests/smoke/`;
the hooks' own checks, and the recorded add-only check's, are in `.claude/hooks/tests/`.

## Restoring saved data

A release that changes saved data's shape backs it up first (`scripts/release.mjs`): its Vercel
build log says `Backup taken: snapshot <timestamp>`, and Convex keeps it on the production
deployment's **Backup & Restore** page, two at most on the free plan, each for 7 days. If the
backup fails the release stops, nothing goes live, and the log says why: with two already kept,
delete the older there and redeploy from Vercel.

To undo such a release with its data:

1. **Backup Now** on that page first: restoring wipes the deployment's data, including whatever
   managers saved since the release.
2. Restore the release's backup, the one named in its build log, from its row's menu, **Restore**.
   Or download it and run `npx convex import --prod --replace <file>.zip`.
3. Revert the release's merge. Its build log should say `Backup taken`, since the shape changes back.

Convex refuses a schema the saved data doesn't fit, so the order follows the step it undoes: undo a
widening (data saved since may not fit the old schema) by restoring, then reverting, as above;
undo a narrowing (the backup holds what the new schema dropped) by reverting, then restoring.
