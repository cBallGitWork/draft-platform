# Setting up

How to get the app running locally. The project's own docs are [SPEC.md](../SPEC.md),
[ARCHITECTURE.md](../ARCHITECTURE.md) and [CLAUDE.md](../CLAUDE.md).

## Start

You need:

1. Node 24.
2. Membership of the Convex team `craigdavidball14`: `npm run setup` is hardcoded to it.
3. A Resend account and its API key.

Clone, then:

```
npm install && npm run setup && npm run dev
```

`npm run setup` runs once, in a terminal you can type in: it signs you in to Convex (accept its
terms when asked), gives you your own cloud dev deployment of the `draft-platform` project and
writes `.env.local` (`env.example` says what lands there). A plain first `npm run dev` can land
on a deployment on your own machine instead, which proves nothing about Convex's servers.

After pulling a change to `package-lock.json`, run `npm ci`.

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
  `convex/email/email.ts`), which reaches only the Resend account's own address, so `ADMIN_EMAIL`
  must be that address and no one else gets a link yet.

The admin can sign in at once; anyone else is put on the allowed list first:
`npx convex run signIn/allowedEmails:add '{"email":"someone@example.com"}'`.

The admin creates a league from **Create a league** on the leagues page; its commissioner is
let sign in, and sent a link if they have no account. A commissioner adds managers from
**Invites and join requests** on the league's row of the leagues page. Removing managers,
renaming teams, the maximum and the co-commissioner have no screen yet, so they are run from the
CLI as the person allowed to, by their `_id` in the `users` table (without `--identity` the
server refuses):
`npx convex run leagues/teams:removeManager '{"leagueId":"…","teamId":"…"}' --identity '{"subject":"<their _id>|cli"}'`.

To see the screens without signing in, add `?preview=` to the address: `manager` (in two leagues),
`commissioner` (running them), `newcomer` (in none), `admin` (seeing every league) or `visitor`
(dev server only, with made-up figures). `npx vite` starts the app alone, without touching Convex,
and then only the previews work.

`npm run verify` runs every gate: the tests, the typecheck and the hook checks.

The app is in `src/` and the server in `convex/`, one folder per feature in each. Every test is in
`tests/`, mirroring them (`tests/convex/`, `tests/src/`, `tests/scripts/`), with the shared
harnesses and recorded feeds in `tests/support/` and the browser smoke suite in `tests/smoke/`.
