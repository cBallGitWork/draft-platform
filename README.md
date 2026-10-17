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
npm install && npm run dev
```

The first `npm run dev` asks you to sign in to Convex and writes `.env.local` itself
(`.env.example` says what lands there). `npm run verify` runs every gate: the tests, the
typecheck and the hook checks.
