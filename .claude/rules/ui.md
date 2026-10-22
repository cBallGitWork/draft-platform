---
paths:
  - "src/**"
  - "tests/src/**"
  - "index.html"
---

# Screens

Read `docs/design/plate.md` before drawing anything: it is the look, and every value the built
screens use is a token in `src/styles.css`; a screen needing a plate.md value with no token yet
(the pitch, fixture difficulty) adds it there. Use the tokens (`bg-plate`, `text-figure`,
`text-data`); a hex value or a stock Tailwind utility in a component is a finding. Tailwind's own
palette, radii, shadows and type scale are switched off there, so a stock utility
(`bg-slate-900`, `rounded-lg`) draws nothing.

After any change a manager can see, run the `ui-verifier` agent: it shoots 390 and 1440 and looks.

Where tests go, and what `tests/support/` holds (harnesses, setup files, goldens):
`tests/README.md`.

## Never

From `docs/design/plate.md` (its "Never" list, copied here so it loads with the screen files;
change both together). The tells that make a screen look AI-made:

1. Rows of stat tiles, a card for every section, small tracked uppercase labels over big numbers.
2. Pills and tinted badges; a chip, where one is needed, is square and solid.
3. Indigo or slate grounds with lavender-grey text and a neon accent; gradient buttons.
4. `·` strings, floating rows, ★ typed as text, the same 16px gutter around everything.
