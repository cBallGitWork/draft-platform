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

`npm run verify` runs every gate: the tests, the typecheck and the hook checks.
