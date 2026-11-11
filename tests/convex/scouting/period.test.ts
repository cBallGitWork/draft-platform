import { beforeEach, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { MutationCtx } from "../../../convex/_generated/server";
import type { Period } from "../../../convex/scouting/periods";
import { inTenths } from "../../../convex/scoring/values";
import { WEEK_MS } from "../../../convex/shared/time";
import { COMMISSIONER, MANAGERS, actingAs, addManagers, adminCreatesLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { ARSENAL, CHELSEA, SAKA, completeRecord, insertClubs, insertPlayers } from "../../support/convex/footballRows.harness";
import { playersListed } from "../../support/convex/playersList.harness";
import { at } from "../../support/convex/seasonPoints.harness";
import { holdExampleScoring } from "../../support/convex/siteScoring.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// Scouting's period (#1028, story 3; Craig, 9 Nov 2026, on #1028, answer 5): the list, his per-90
// panel and Compare over the last 4 or 6 finished Premier League gameweeks, a match he missed
// counting 0 minutes, and before the season's first match, last season's final 4 or 6.

const [ANN] = MANAGERS;
const PALMER = { code: 1004, name: "Palmer", fullName: "Cole Palmer", clubCode: CHELSEA.code, positions: ["CAM" as const] };
const KICKOFF = Date.parse("2026-08-15T14:00:00Z");

/** One match a gameweek, a week apart, from `first`. */
const match = (gameweek: number, first = KICKOFF, droppedAt?: number) => ({
  code: first === KICKOFF ? gameweek : 100 + gameweek,
  gameweek,
  homeClubCode: ARSENAL.code,
  awayClubCode: CHELSEA.code,
  kickoff: first + (gameweek - 1) * WEEK_MS,
  ...(droppedAt === undefined ? {} : { droppedAt }),
});
/** A match read at full time. */
const fullTime = (ctx: MutationCtx, fixtureCode: number) => ctx.db.insert("matchStatsStatus", { fixtureCode, state: "locked", fullTimeAt: KICKOFF, lastReadAt: KICKOFF });
/** Saka's stats in a gameweek: a goal in each from the third. */
const sakaIn = (gameweek: number): Record<string, number> => (gameweek >= 3 ?{ minutes: 90, goals_scored: 1 } : { minutes: 90 });

let t: TestConvex;
let leagueId: Id<"leagues">;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t, 4);
  await addManagers(t, leagueId, [ANN]);
  await t.run(async (ctx) => {
    await insertClubs(ctx, [ARSENAL, CHELSEA]);
    await insertPlayers(ctx, [SAKA, PALMER]);
    await holdExampleScoring(ctx);
  });
});

/** Gameweeks 1 to 7 of 2026/27, 1 to 6 finished; Saka plays every one, Palmer only the first. */
const thisSeason = () =>
  t.run(async (ctx) => {
    for (let gameweek = 1; gameweek <= 7; gameweek++) {
      await ctx.db.insert("fixtures", match(gameweek));
      if (gameweek <= 6) await fullTime(ctx, gameweek);
      await ctx.db.insert("playerMatchStats", completeRecord(SAKA.code, gameweek, gameweek === 7 ? { minutes: 90, goals_scored: 5 } : sakaIn(gameweek)));
    }
    await ctx.db.insert("playerMatchStats", completeRecord(PALMER.code, 1, { minutes: 90, goals_scored: 1 }));
    await ctx.db.insert("playerSeasonStats", { season: 2026, playerCode: SAKA.code, stats: { minutes: 630, goals_scored: 9 } });
  });

const listOver = async (period: Period) =>
  playersListed(await actingAs(t, ANN), leagueId, { period });
const rowOf = async (period: Period, code: number) => (await listOver(period)).players.find((player) => player.code === code)!;

test("over the last 4 finished gameweeks, the list adds up those matches only, a gameweek still being played left out", async () => {
  await thisSeason();
  const list = await listOver("last4");
  expect(list.periodGameweeks).toEqual([3, 4, 5, 6]);
  expect((await rowOf("last4", SAKA.code)).figures).toMatchObject({ minutes: 360, goals: 4 });
  expect((await listOver("last6")).periodGameweeks).toEqual([1, 2, 3, 4, 5, 6]);
  expect((await rowOf("last6", SAKA.code)).figures).toMatchObject({ minutes: 540, goals: 4 });
});

test("a player who missed the period's matches has 0 minutes there, and no points", async () => {
  await thisSeason();
  const palmer = await rowOf("last4", PALMER.code);
  expect(palmer.figures.minutes).toBe(0);
  expect(palmer.points).toBeNull();
  expect((await rowOf("last6", PALMER.code)).figures).toMatchObject({ minutes: 90, goals: 1 });
});

test("the season keeps the season's totals, and the points column is the season points", async () => {
  await thisSeason();
  const saka = await rowOf("season", SAKA.code);
  expect(saka.figures).toMatchObject({ minutes: 630, goals: 9 });
  expect(saka.points).toBe(saka.seasonPoints);
  expect((await listOver("season")).periodGameweeks).toEqual([]);
});

test("his points over the period are his matches there at his main position, a league's override counting in a match's place", async () => {
  await thisSeason();
  const lastFour = [3, 4, 5, 6].map((gameweek) => at(sakaIn(gameweek), "W"));
  expect((await rowOf("last4", SAKA.code)).points).toBe(inTenths(lastFour.reduce((sum, points) => sum + points, 0)));
  await t.run((ctx) =>
    ctx.db.insert("pointsOverrides", { leagueId, gameweek: 6, fixtureCode: 6, playerCode: SAKA.code, points: 20, reason: "The feed was wrong", by: COMMISSIONER, at: KICKOFF }),
  );
  expect((await rowOf("last4", SAKA.code)).points).toBe(inTenths(lastFour.slice(0, 3).reduce((sum, points) => sum + points, 0) + 20));
});

test("the list sorts by the period's figures", async () => {
  await thisSeason();
  const names = async (period: Period) =>
    (
      await playersListed(await actingAs(t, ANN), leagueId, { sort: { by: "minutes", descending: true }, stat: "goals_scored", period })
    ).players.map((player) => [player.name, player.stat]);
  expect(await names("last4")).toEqual([["Saka", 4], ["Palmer", 0]]);
});

test("his per-90 panel and Compare are over the period too", async () => {
  await thisSeason();
  const ann = await actingAs(t, ANN);
  const goals = (await ann.query(api.scouting.per90.figures, { leagueId, playerCode: SAKA.code, stat: null, period: "last4" })).figures.find(({ stat }) => stat === "goals_scored");
  expect(goals).toMatchObject({ total: 4, perNinety: 1, percentile: 100 });
  const [saka, palmer] = await ann.query(api.scouting.compare.players, { leagueId, codes: [SAKA.code, PALMER.code], stat: null, period: "last4" });
  expect([saka.minutes, palmer.minutes]).toEqual([360, 0]);
});

test("before the season's first match, they are last season's final gameweeks, under the site's set as it stands, with no override", async () => {
  const LAST_KICKOFF = Date.parse("2025-08-16T14:00:00Z");
  await t.run(async (ctx) => {
    // 2026/27's first match is still to come; last season's 34 to 38 are held, the feed sending none.
    await ctx.db.insert("fixtures", match(1));
    for (let gameweek = 34; gameweek <= 38; gameweek++) {
      const last = match(gameweek, LAST_KICKOFF, KICKOFF);
      await ctx.db.insert("fixtures", last);
      await fullTime(ctx, last.code);
      await ctx.db.insert("playerMatchStats", completeRecord(SAKA.code, last.code, { minutes: 90, goals_scored: 1 }));
    }
    await ctx.db.insert("playerSeasonStats", { season: 2025, playerCode: SAKA.code, stats: { minutes: 450, goals_scored: 5 } });
    await ctx.db.insert("pointsOverrides", { leagueId, gameweek: 38, fixtureCode: 138, playerCode: SAKA.code, points: 20, reason: "The feed was wrong", by: COMMISSIONER, at: KICKOFF });
  });
  expect((await listOver("last4")).periodGameweeks).toEqual([35, 36, 37, 38]);
  const saka = await rowOf("last4", SAKA.code);
  expect(saka.figures).toMatchObject({ minutes: 360, goals: 4 });
  expect(saka.points).toBe(inTenths(4 * at({ minutes: 90, goals_scored: 1 }, "W")));
});

test("with no gameweek finished, the period counts none", async () => {
  await t.run(async (ctx) => {
    await ctx.db.insert("fixtures", match(1));
    await ctx.db.insert("playerSeasonStats", { season: 2026, playerCode: SAKA.code, stats: { minutes: 90 } });
  });
  const list = await listOver("last6");
  expect(list.periodGameweeks).toEqual([]);
  expect(list.players.every((player) => player.figures.minutes === 0 && player.points === null)).toBe(true);
});
