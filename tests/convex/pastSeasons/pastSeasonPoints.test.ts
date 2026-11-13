import { beforeEach, expect, test } from "vitest";
import { internal } from "../../../convex/_generated/api";
import type { ScoringSet } from "../../../convex/scoring/scoringSet";
import type { StoredScoringSet } from "../../../convex/scoring/scoringSetShape";
import { PLAYERS_PAGE } from "../../../convex/stats/matchRecords";
import { ARSENAL, insertClubs, insertPlayers, type HeldPlayer } from "../../support/convex/footballRows.harness";
import { EXAMPLE_SET, GOAL_AND_ASSIST } from "../../support/convex/scoring.example";
import { holdSiteScoring } from "../../support/convex/siteScoring.harness";
import { freshConvex, type TestConvex } from "../../support/convex/test.harness";

// Last season's points under the site's set as it stands (#1114; spec/19, spec/04's fallback): a
// row a player in the copied season, his matches priced at every position, re-priced in pages.

const SEASON = 2025;
const player = (code: number, name: string): HeldPlayer => ({ code, name, fullName: name, clubCode: ARSENAL.code, positions: ["ST"] });
const PALMER = player(1, "Palmer");
const BENCHED = player(2, "Benched");
const NEWCOMER = player(3, "Newcomer");
const match = (kickoff: number) => ({ kickoff, startingPosition: "ST", stats: GOAL_AND_ASSIST });
const PATCHED = { ...EXAMPLE_SET, rules: EXAMPLE_SET.rules.map((rule) => (rule.stat === "goals_scored" ? { ...rule, values: { all: 9 } } : rule)) } as ScoringSet;

let t: TestConvex;
const holdSet = (scoring: ScoringSet, number: number, at: number) =>
  t.run((ctx) => holdSiteScoring(ctx, { scoring: structuredClone(scoring) as StoredScoringSet, kind: "fix", season: SEASON, number, at }));
const reprice = async () => {
  await t.mutation(internal.pastSeasons.pastSeasonPoints.reprice, { cursor: null });
  await t.finishAllScheduledFunctions(() => {});
};
const kept = async () =>
  new Map(
    (await t.run((ctx) => ctx.db.query("pastSeasonPoints").collect())).map(({ playerCode, season, points }) => [playerCode, { season, points }]),
  );

beforeEach(async () => {
  t = freshConvex();
  await t.run(async (ctx) => {
    await insertClubs(ctx, [ARSENAL]);
    await insertPlayers(ctx, [PALMER, BENCHED, NEWCOMER]);
    await ctx.db.insert("pastPlayerMatchStats", { season: SEASON, playerCode: PALMER.code, fplPosition: 4, match: match(1) });
    await ctx.db.insert("pastPlayerMatchStats", { season: SEASON, playerCode: PALMER.code, fplPosition: 4, match: match(2) });
    await ctx.db.insert("pastPlayerMatchStats", { season: SEASON, playerCode: BENCHED.code, fplPosition: 1, match: null });
  });
  await holdSet(EXAMPLE_SET, 1, 0);
});

test("each player in last season's data gets a row at every position; one who played none has no points, a newcomer no row", async () => {
  await reprice();
  const rows = await kept();
  // A goal and an assist in 90 minutes, twice: 9 up front and 11 at CAM each time.
  expect(rows.get(PALMER.code)).toEqual({ season: SEASON, points: expect.objectContaining({ ST: 18, CAM: 22 }) });
  expect(rows.get(BENCHED.code)).toEqual({ season: SEASON, points: {} });
  expect(rows.has(NEWCOMER.code)).toBe(false);
});

test("a re-price after the set changes moves the rows to the set as it stands", async () => {
  await reprice();
  await holdSet(PATCHED, 2, 1);
  await reprice();
  // A goal now 9 everywhere: 9 + 3 + 2 a match up front.
  expect((await kept()).get(PALMER.code)?.points.ST).toBe(28);
});

test("a player no longer in the copied season loses his row", async () => {
  await reprice();
  await t.run(async (ctx) => {
    for (const row of await ctx.db.query("pastPlayerMatchStats").collect()) if ("playerCode" in row && row.playerCode === BENCHED.code) await ctx.db.delete(row._id);
  });
  await reprice();
  expect((await kept()).has(BENCHED.code)).toBe(false);
});

test("pages on through every player, PLAYERS_PAGE at a time", async () => {
  const many = Array.from({ length: PLAYERS_PAGE * 2 + 1 }, (_, index) => player(100 + index, `Player ${index}`));
  await t.run(async (ctx) => {
    await insertPlayers(ctx, many);
    for (const { code } of many) await ctx.db.insert("pastPlayerMatchStats", { season: SEASON, playerCode: code, fplPosition: 4, match: null });
  });
  await reprice();
  expect((await kept()).size).toBe(many.length + 2);
});

test("with no past season copied, nothing is written", async () => {
  await t.run(async (ctx) => {
    for (const row of await ctx.db.query("pastPlayerMatchStats").collect()) await ctx.db.delete(row._id);
  });
  await reprice();
  expect((await kept()).size).toBe(0);
});
