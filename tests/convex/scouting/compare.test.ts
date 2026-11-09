import { beforeEach, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Position } from "../../../convex/positions/positionTables";
import { per90Stats } from "../../../convex/scouting/per90Figures";
import { refusals } from "../../../convex/shared/leagueAccess";
import { FPL_SEASON } from "../../support/recorded/plSeasons.payloads";
import { MANAGERS, actingAs, addManagers, adminCreatesLeague, teamName, type TestConvex } from "../../support/convex/leagues.harness";
import { ARSENAL, CHELSEA, SAKA, insertClubs, insertPlayers } from "../../support/convex/footballRows.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { expectRefused } from "../../support/convex/test.harness";

// Two players side by side (#373, spec/19 The players list; the approved picture's compare, #1028):
// who each is and who owns him in the league, his minutes over the season and the first's area's
// stats, each with his total and per 90 (how they are ranked is per90.test.ts's). Season points
// are "—" (null) here, with none priced; that they match the list's is
// tests/convex/stats/seasonPoints.test.ts's.

const [ANN, BOB] = MANAGERS;
const PALMER = { code: 1004, name: "Palmer", fullName: "Cole Palmer", clubCode: CHELSEA.code, positions: ["CAM", "W"] as Position[] };
/** Held by the football sync, with no match yet. */
const NEW_BOY = { code: 1005, name: "New", fullName: "New Boy", clubCode: CHELSEA.code, positions: [] as Position[] };

let t: TestConvex;
let leagueId: Id<"leagues">;
let teams: Id<"teams">[];
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t);
  teams = await addManagers(t, leagueId, [ANN, BOB]);
  await t.run(async (ctx) => {
    await insertClubs(ctx, [ARSENAL, CHELSEA]);
    await insertPlayers(ctx, [SAKA, PALMER, NEW_BOY]);
    await ctx.db.insert("squadPlayers", { leagueId, teamId: teams[0], playerCode: SAKA.code });
    await ctx.db.insert("playerSeasonStats", { season: FPL_SEASON, playerCode: SAKA.code, stats: { minutes: 180, goals_scored: 3, assists: 1 } });
    await ctx.db.insert("playerSeasonStats", { season: FPL_SEASON, playerCode: PALMER.code, stats: { minutes: 90, assists: 3 } });
  });
});

const compareAs = async (email: string, codes: number[]) => (await actingAs(t, email)).query(api.scouting.compare.players, { leagueId, codes, stat: null });

test("two players side by side, in the order asked: who each is, his minutes and the first's area's stats, each total and per 90", async () => {
  const [saka, palmer] = await compareAs(ANN, [SAKA.code, PALMER.code]);
  expect(saka).toMatchObject({ code: SAKA.code, name: "Saka", fullName: "Bukayo Saka", club: ARSENAL, positions: ["W"], ownerTeamName: await teamName(t, teams[0]), seasonPoints: null, minutes: 180 });
  expect(palmer).toMatchObject({ code: PALMER.code, name: "Palmer", club: CHELSEA, positions: ["CAM", "W"], ownerTeamName: null, seasonPoints: null, minutes: 90 });
  expect(saka.figures.map(({ stat }) => stat)).toEqual(per90Stats("attackingMidfield", null));
  expect(saka.figures[0]).toMatchObject({ stat: "goals_scored", total: 3, perNinety: 1.5 });
  expect(palmer.figures[1]).toMatchObject({ stat: "assists", total: 3, perNinety: 3 });
});

test("a player with no minutes has no figure per 90; with the first's position unknown, no rows at all", async () => {
  const [, newBoy] = await compareAs(ANN, [SAKA.code, NEW_BOY.code]);
  expect(newBoy.minutes).toBe(0);
  expect(newBoy.figures[0]).toEqual({ stat: "goals_scored", total: 0, perNinety: null, percentile: null });
  expect((await compareAs(ANN, [NEW_BOY.code, SAKA.code]))[1].figures).toEqual([]);
});

test.each([
  ["one player", [SAKA.code]],
  ["three players", [SAKA.code, PALMER.code, NEW_BOY.code]],
  ["the same player twice", [SAKA.code, SAKA.code]],
])("asking for %s is refused", async (_, codes) => {
  await expect(compareAs(ANN, codes)).rejects.toThrow("Compare 2 different players");
});

test("a player the football sync doesn't hold is refused", async () => {
  await expect(compareAs(ANN, [SAKA.code, 404])).rejects.toThrow("No player 404 is held to compare");
});

test("anyone in the league may compare; someone not in it is refused", async () => {
  expect(await compareAs(BOB, [SAKA.code, PALMER.code])).toHaveLength(2);
  await expectRefused(compareAs(MANAGERS[3], [SAKA.code, PALMER.code]), refusals.notInLeague);
});
