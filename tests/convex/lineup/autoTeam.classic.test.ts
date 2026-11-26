import { expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import { lineupInGameweek } from "../../../convex/lineup/lineups";
import { setLines } from "../../support/convex/footballRows.harness";
import { holdGameweeks } from "../../support/convex/leagueRules.harness";
import { actingAs, ANN, freshLeague } from "../../support/convex/leagues.harness";
import { FIRST_SUB } from "../../support/convex/lineup.harness";
import { FOUR_FOUR_TWO, holdSquad, NEXT, passNextDeadline, sent } from "../../support/convex/lineupSquad.harness";

// The auto team in a classic league (spec/09, The auto team; spec/22, The lineup): a starter who is
// out is swapped for the first bench player, in bench order, whose line keeps the lineup inside
// the league's line limits, as an auto-sub comes on.

const [OUT_DEFENDER] = FOUR_FOUR_TWO.starters.filter(({ area }) => area === "defence").map(({ playerCode }) => playerCode);
/** First on the bench, but a second GK would pass GK's limit of exactly one. */
const BENCH_KEEPER = FIRST_SUB;
/** Next on the bench, a CM: a fifth CM is inside CM's limit of five. */
const BENCH_MIDFIELDER = FIRST_SUB + 1;

test("S22.11 an out defender is swapped for the first bench player whose line keeps the lineup valid: the bench keeper is passed over", async () => {
  const { t, leagueId, teams: [annsTeam] } = await freshLeague({ managers: [ANN], classic: true, before: (t) => holdGameweeks(t, { next: NEXT }) });
  await holdSquad(t, leagueId, annsTeam);
  await t.run((ctx) => setLines(ctx, new Map([[BENCH_KEEPER, "GK"]])));
  const ann = await actingAs(t, ANN);
  await ann.mutation(api.lineup.lineups.save, { leagueId, lineup: sent(FOUR_FOUR_TWO) });
  await ann.mutation(api.lineup.autoTeam.set, { leagueId, teamId: annsTeam, on: true });
  await t.run(async (ctx) => {
    const player = (await ctx.db.query("players").withIndex("by_code", (q) => q.eq("code", OUT_DEFENDER)).unique())!;
    await ctx.db.patch("players", player._id, { availability: "out" });
  });

  await passNextDeadline(t);
  vi.advanceTimersByTime(0);
  await t.finishInProgressScheduledFunctions();

  const { starters, bench } = await t.run((ctx) => lineupInGameweek(ctx, leagueId, annsTeam, NEXT));
  const codes = starters.map(({ playerCode }) => playerCode);
  expect(codes).toContain(BENCH_MIDFIELDER);
  expect(codes).not.toContain(OUT_DEFENDER);
  expect(bench).toContain(BENCH_KEEPER);
});
