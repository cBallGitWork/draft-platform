import { beforeEach, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Lineup } from "../../../convex/lineup/lineup";
import { lineupRefusals } from "../../../convex/lineup/lineupWords";
import { lineupInGameweek } from "../../../convex/lineup/lineups";
import { rowInForce } from "../../../convex/lineup/lineupRows";
import { holdGameweeks } from "../../support/convex/leagueRules.harness";
import { expectRefused } from "../../support/convex/test.harness";
import { actingAs, ANN, freshLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { FOUR_FOUR_TWO, holdSquad, NEXT, REVERSED_BENCH, saved, sent } from "../../support/convex/lineupSquad.harness";

// Tactics open in two tabs (spec/05 `S05.55`, #2350): a save says what it was made from, and one
// made from a lineup another tab has saved over since is refused, so the older tab reloads rather
// than replace the other's moves.

let t: TestConvex;
let leagueId: Id<"leagues">;
let annsTeam: Id<"teams">;
beforeEach(async () => {
  ({ t, leagueId, teams: [annsTeam] } = await freshLeague({ managers: [ANN], before: (t) => holdGameweeks(t, { next: NEXT }) }));
  await holdSquad(t, leagueId, annsTeam);
});

/** Ann's Tactics tab `tab`: the row's mark it loads (tactics.ts hands it on as `lineupEdit`), and a
 *  save from it. */
const tabOf = async (tab: string) => {
  const ann = await actingAs(t, ANN);
  const load = () => t.run(async (ctx) => (await rowInForce(ctx, leagueId, annsTeam, NEXT))?.edit);
  let seen = await load();
  return {
    save: (lineup: Lineup) => ann.mutation(api.lineup.lineups.save, { leagueId, lineup: sent(lineup), basedOn: { tab, ...(seen !== undefined && { seen }) } }),
    reload: async () => {
      seen = await load();
    },
  };
};
const annsLineup = () => t.run((ctx) => lineupInGameweek(ctx, leagueId, annsTeam, NEXT));

/** The first two on the bench swapped: a move tab A makes. */
const SWAPPED: Lineup = (() => {
  const [first, second, ...rest] = FOUR_FOUR_TWO.bench;
  return { ...FOUR_FOUR_TWO, bench: [second, first, ...rest] };
})();

test("S05.55: a save from a tab loaded before another tab saved is refused, and the other tab's moves stand", async () => {
  await (await actingAs(t, ANN)).mutation(api.lineup.lineups.save, { leagueId, lineup: sent(FOUR_FOUR_TWO) });
  const tabA = await tabOf("A");
  const tabB = await tabOf("B");

  expect(await tabA.save(SWAPPED)).toBe(NEXT);
  await expectRefused(tabB.save(REVERSED_BENCH), lineupRefusals.changedElsewhere);
  expect(await annsLineup()).toEqual(saved(SWAPPED, NEXT));

  // Reloaded, tab B makes its move on tab A's lineup.
  await tabB.reload();
  const bothMoves: Lineup = { ...SWAPPED, bench: SWAPPED.bench.toReversed() };
  expect(await tabB.save(bothMoves)).toBe(NEXT);
  expect(await annsLineup()).toEqual(saved(bothMoves, NEXT));
});

test("S05.55: a tab's own saves one after another all land, before its read catches up with them", async () => {
  const tab = await tabOf("A");
  expect(await tab.save(FOUR_FOUR_TWO)).toBe(NEXT);
  expect(await tab.save(SWAPPED)).toBe(NEXT);
  expect(await tab.save(REVERSED_BENCH)).toBe(NEXT);
  expect(await annsLineup()).toEqual(saved(REVERSED_BENCH, NEXT));
});
