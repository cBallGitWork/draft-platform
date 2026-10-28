import { expect, test } from "vitest";
import type { MutationCtx } from "../../../convex/_generated/server";
import { currentFixturesByCode, seasonRecords } from "../../../convex/stats/seasonRecords";
import { freshConvex } from "../../support/convex/test.harness";

// A player's records this season, each with its match (seasonRecords): a match the feed still
// sends is this season's, a dropped one a past season's, one with no gameweek postponed and not
// yet played, and a record whose match isn't held is bad data, which throws.

const PLAYER = 4242;
const HOME = 1;
const AWAY = 2;
const GAMEWEEK = 6;
const KICKOFF = Date.parse("2026-10-11T13:00:00Z");
const CURRENT_MATCH = 100;
const PAST_MATCH = 200;
const POSTPONED_MATCH = 300;
const UNUSED_MATCH = 400;
const UNHELD_MATCH = 500;

const holdMatch = (ctx: MutationCtx, code: number, extra: { gameweek?: number | null; droppedAt?: number } = {}) =>
  ctx.db.insert("fixtures", { code, gameweek: GAMEWEEK, homeClubCode: HOME, awayClubCode: AWAY, kickoff: KICKOFF, ...extra });

const holdRecord = (ctx: MutationCtx, fixtureCode: number, played = true) =>
  ctx.db.insert("playerMatchStats", {
    playerCode: PLAYER,
    fixtureCode,
    started: played,
    played,
    arrived: { fpl: true, pl: true },
    stats: {},
    state: "provisional" as const,
  });

test("only this season's played matches are his: a past season's, a postponed one and an unused substitute's are left out", async () => {
  const t = freshConvex();
  await t.run(async (ctx) => {
    await holdMatch(ctx, CURRENT_MATCH);
    await holdMatch(ctx, PAST_MATCH, { droppedAt: KICKOFF });
    await holdMatch(ctx, POSTPONED_MATCH, { gameweek: null });
    await holdMatch(ctx, UNUSED_MATCH);
    for (const code of [CURRENT_MATCH, PAST_MATCH, POSTPONED_MATCH]) await holdRecord(ctx, code);
    await holdRecord(ctx, UNUSED_MATCH, false);
  });

  const season = await t.run(async (ctx) => seasonRecords(ctx, PLAYER, await currentFixturesByCode(ctx)));

  expect(season.map(({ fixture, gameweek }) => [fixture.code, gameweek])).toEqual([[CURRENT_MATCH, GAMEWEEK]]);
  expect(season[0].record.fixtureCode).toBe(CURRENT_MATCH);
});

test("a record for a match that isn't held throws, never a silent skip", async () => {
  const t = freshConvex();
  await t.run(async (ctx) => {
    await holdMatch(ctx, CURRENT_MATCH);
    await holdRecord(ctx, CURRENT_MATCH);
    await holdRecord(ctx, UNHELD_MATCH);
  });

  await expect(t.run(async (ctx) => seasonRecords(ctx, PLAYER, await currentFixturesByCode(ctx)))).rejects.toThrow(
    `Player ${PLAYER} has a record for match ${UNHELD_MATCH}, which isn't held`,
  );
});
