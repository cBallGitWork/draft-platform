import { expect, test } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { checkScoutingPlayersHeld, sameValue, SCOUTING_REBUILD_COMMAND, scoutingPlayerByCode } from "../../../convex/scouting/scoutingPlayers";
import { BATCH_SIZE } from "../../../convex/shared/syncRuns";
import { moveSeasonTotals } from "../../../convex/stats/seasonStats";
import { seasonStartYear } from "../../../convex/shared/time";
import { ARSENAL, CHELSEA, GONE, SAKA, insertClubs, insertPlayers } from "../../support/convex/footballRows.harness";
import { freshConvex, type TestConvex } from "../../support/convex/test.harness";

// Each player's Scouting row (#1559, scoutingPlayers.ts): his name, club, what his positions are
// worked out from and his newest season's totals, copied onto one row by every write to the rows
// they come from, so the players list reads one row a player. The list itself is
// playersList.test.ts's.

const { positions: _, ...SAKA_ROW } = SAKA;
const KICKOFF = Date.parse("2026-10-11T13:00:00Z");
const NEXT_SEASON_KICKOFF = Date.parse("2027-09-11T14:00:00Z");

async function withClubs(): Promise<TestConvex> {
  const t = freshConvex();
  await t.run(async (ctx) => {
    await insertClubs(ctx, [ARSENAL, CHELSEA]);
    await ctx.db.insert("fixtures", { code: 1, gameweek: 8, homeClubCode: ARSENAL.code, awayClubCode: CHELSEA.code, kickoff: KICKOFF });
    await ctx.db.insert("fixtures", { code: 2, gameweek: 4, homeClubCode: CHELSEA.code, awayClubCode: ARSENAL.code, kickoff: NEXT_SEASON_KICKOFF });
  });
  return t;
}

const sent = (t: TestConvex, ...rows: (typeof SAKA_ROW)[]) => t.mutation(internal.football.footballSync.upsertPlayers, { rows });
const rowOf = (t: TestConvex, code = SAKA.code) => t.run((ctx) => scoutingPlayerByCode(ctx, code));

test("a player the football sync sends gets his row: his name and club, no positions and no totals yet", async () => {
  const t = await withClubs();
  await sent(t, SAKA_ROW);
  expect(await rowOf(t)).toMatchObject({
    ...SAKA_ROW,
    positions: { starts: [], approved: [], set: [], removed: [] },
  });
  expect((await rowOf(t))?.totals).toBeUndefined();
});

test("a move to another club the sync sends moves his row with him", async () => {
  const t = await withClubs();
  await sent(t, SAKA_ROW);
  await sent(t, { ...SAKA_ROW, clubCode: CHELSEA.code });
  expect((await rowOf(t))?.clubCode).toBe(CHELSEA.code);
});

test("one the sync stops sending is marked dropped on his row too, and unmarked when sent again", async () => {
  const t = await withClubs();
  await sent(t, SAKA_ROW);
  const droppedAt = Date.UTC(2026, 10, 1);
  await t.mutation(internal.football.footballSync.markDropped, { table: "players", sentKeys: [], droppedAt, paginationOpts: { cursor: null, numItems: BATCH_SIZE } });
  expect((await rowOf(t))?.droppedAt).toBe(droppedAt);
  await sent(t, SAKA_ROW);
  expect((await rowOf(t))?.droppedAt).toBeUndefined();
});

test("his label from the positions sync is copied onto his row", async () => {
  const t = await withClubs();
  await sent(t, SAKA_ROW);
  await t.mutation(internal.positions.positionsSync.recordLabels, { labels: [{ code: SAKA.code, plLabel: "Midfielder" }] });
  expect((await rowOf(t))?.positions.plLabel).toBe("Midfielder");
});

test("his season totals as his records move them are copied: the newest season's", async () => {
  const t = await withClubs();
  await sent(t, SAKA_ROW);
  const move = (fixtureCode: number, goals: number) =>
    t.run((ctx) => moveSeasonTotals(ctx, [{ playerCode: SAKA.code, fixtureCode, before: undefined, after: { goals_scored: goals } }]));

  await move(1, 2);
  expect((await rowOf(t))?.totals).toEqual({ season: seasonStartYear(KICKOFF), stats: { goals_scored: 2 } });
  await move(2, 1);
  expect((await rowOf(t))?.totals).toEqual({ season: seasonStartYear(NEXT_SEASON_KICKOFF), stats: { goals_scored: 1 } });
});

test("the rebuild copies every held player's row, a player who has left with his mark", async () => {
  const t = await withClubs();
  await t.run(async (ctx) => {
    await insertPlayers(ctx, [SAKA]);
    await ctx.db.insert("players", { ...GONE, droppedAt: 1 });
  });
  await t.mutation(internal.scouting.scoutingPlayers.rebuild, { cursor: null });
  expect((await rowOf(t))?.positions.set).toEqual(SAKA.positions);
  expect((await rowOf(t, GONE.code))?.droppedAt).toBe(1);
});

test("players held with no row at all is refused, naming the rebuild, never an empty list", async () => {
  const t = await withClubs();
  await t.run((ctx) => insertPlayers(ctx, [SAKA]));
  await expect(t.run((ctx) => checkScoutingPlayersHeld(ctx))).rejects.toThrow(SCOUTING_REBUILD_COMMAND);
  await t.mutation(internal.scouting.scoutingPlayers.rebuild, { cursor: null });
  await expect(t.run((ctx) => checkScoutingPlayersHeld(ctx))).resolves.not.toThrow();
});

test("two rows are the same whatever their fields' order, an absent field and an undefined one alike", () => {
  expect(sameValue({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1, d: undefined })).toBe(true);
  expect(sameValue({ a: 1 }, { a: 2 })).toBe(false);
  expect(sameValue({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
});
