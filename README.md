# draft-platform

Draft Manager (working name): a fantasy draft game for the Premier League, made for many leagues,
with Football Manager-style tactics. Private.

- [SPEC.md](SPEC.md): what it is and every feature, from Craig's answers.
- [ARCHITECTURE.md](ARCHITECTURE.md): the stack and why.
- [CLAUDE.md](CLAUDE.md): how work is done here.
- The build queue is the GitHub issues.

## Start

Node 24. Clone, then:

```
npm install && npm run setup && npm run dev
```

`npm run setup` runs once, in a terminal you can type in: it signs you in to Convex (accept its
terms when asked), gives you your own cloud dev deployment of the `draft-platform` project and
writes `.env.local` (`.env.example` says what lands there). A plain first `npm run dev` can land
on a deployment on your own machine instead, which proves nothing about Convex's servers.

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
  holds Resend's API key: pipe each value in, so it stays out of your shell history.

The admin can sign in at once; anyone else is put on the allowed list first:
`npx convex run allowedEmails:add '{"email":"someone@example.com"}'`.

To see the screens without signing in, add `?preview=` to the address: `manager` (in a league),
`newcomer` (in none), `admin` or `visitor` (dev server only, with made-up figures). `npx vite`
starts the app alone, without touching Convex, and then only the previews work.

`npm run verify` runs every gate: the tests, the typecheck and the hook checks.
