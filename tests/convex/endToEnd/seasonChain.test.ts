import { test } from "vitest";
import { chainToGameweekSeven } from "../../support/convex/seasonChain.harness";
import { SLOW_TEST } from "../../support/convex/test.harness";

// One season chain through the entry points the app and the crons call (#2131), each step checked
// as it goes (../../support/convex/seasonChain.harness.ts). Two gameweeks, so it runs on every pull
// request; the in-memory backend only.

test("a season chain: the draft's end, first lineups, the auto team, gameweek 6 scored, the table, a waiver run and the claimed man's points", SLOW_TEST, async () => {
  await chainToGameweekSeven();
});
