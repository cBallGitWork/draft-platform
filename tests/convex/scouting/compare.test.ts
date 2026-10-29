import { beforeEach, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Position } from "../../../convex/positions/positionTables";
import { refusals } from "../../../convex/shared/leagueAccess";
import { MANAGERS, actingAs, addManagers, adminCreatesLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { ARSENAL, CHELSEA, SAKA, completeRecord, insertClubs, insertPlayers } from "../../support/convex/footballRows.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// Two players side by side (#373, spec/19 The players list): who each is and who owns him in the
// league, and his stats this season added up from the matches his card lists: not last season's,
// not a match he sat out unused, not one postponed with no new date, and a match's stats only once
// both feeds' parts are in. Season points are "—" (null)
// until matches are scored (#29).

const [ANN, BOB] = MANAGERS;
const PALMER = { code: 1004, name: "Palmer", fullName: "Cole Palmer", clubCode: CHELSEA.code, positions: ["CAM", "W"] as Position[] };
/** Held by the football sync, with no match yet. */
const NEW_BOY = { code: 1005, name: "New", fullName: "New Boy", clubCode: CHELSEA.code, positions: [] as Position[] };

const KICKOFF = Date.parse("2026-08-22T14:00:00Z");
const fixture = (code: number, gameweek: number | null, dropped = false) => ({
  code,
  gameweek,
  homeClubCode: ARSENAL.code,
  awayClubCode: CHELSEA.code,
  kickoff: KICKOFF + code,
  ...(dropped ? { droppedAt: KICKOFF } : {}),
});
const GW1 = fixture(1, 1);
const GW2 = fixture(2, 2);
const GW3 = fixture(3, 3);
/** Last season's, which the feed no longer sends. */
const LAST_SEASON = fixture(4, 30, true);
/** Postponed with no new date. */
const POSTPONED = fixture(5, null);

const record = (playerCode: number, fixtureCode: number, stats: Record<string, number>, played: boolean | null = true, pl = true) =>
  completeRecord(playerCode, fixtureCode, stats, { started: played === true, played, pl });

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
    for (const each of [GW1, GW2, GW3, LAST_SEASON, POSTPONED]) await ctx.db.insert("fixtures", each);
    await ctx.db.insert("squadPlayers", { leagueId, teamId: teams[0], playerCode: SAKA.code });
    for (const each of [
      record(SAKA.code, GW1.code, { minutes: 90, goals_scored: 1, expected_goals: 0.71 }),
      record(SAKA.code, GW2.code, { minutes: 64, goals_scored: 2, expected_goals: 0.43, assists: 1 }),
      record(SAKA.code, LAST_SEASON.code, { minutes: 90, goals_scored: 3 }),
      record(SAKA.code, POSTPONED.code, { minutes: 90, goals_scored: 5 }),
      record(PALMER.code, GW1.code, { minutes: 90, assists: 2 }),
      // An unused substitute.
      record(PALMER.code, GW2.code, { minutes: 0 }, false),
      record(PALMER.code, GW3.code, { minutes: 80, assists: 1, goals_scored: 1 }),
      // Only FPL's part has arrived: a match he was in, whose stats don't count until whole.
      record(SAKA.code, GW3.code, { minutes: 90, goals_scored: 4 }, true, false),
    ]) {
      await ctx.db.insert("playerMatchStats", each);
    }
  });
});

const compareAs = async (email: string, codes: number[]) => (await actingAs(t, email)).query(api.scouting.compare.players, { leagueId, codes });
const teamName = (teamId: Id<"teams">) => t.run(async (ctx) => (await ctx.db.get("teams", teamId))!.name);

test("two players side by side, in the order asked: who each is, his matches this season and his stats added up", async () => {
  expect(await compareAs(ANN, [SAKA.code, PALMER.code])).toEqual([
    {
      code: SAKA.code,
      name: "Saka",
      fullName: "Bukayo Saka",
      club: ARSENAL,
      positions: ["W"],
      ownerTeamName: await teamName(teams[0]),
      seasonPoints: null,
      matches: 3,
      stats: { minutes: 154, goals_scored: 3, expected_goals: 1.14, assists: 1 },
    },
    {
      code: PALMER.code,
      name: "Palmer",
      fullName: "Cole Palmer",
      club: CHELSEA,
      positions: ["CAM", "W"],
      ownerTeamName: null,
      seasonPoints: null,
      matches: 2,
      stats: { minutes: 170, assists: 3, goals_scored: 1 },
    },
  ]);
});

test("a player with no match this season has none, and no stats", async () => {
  const [, newBoy] = await compareAs(ANN, [SAKA.code, NEW_BOY.code]);
  expect(newBoy).toMatchObject({ code: NEW_BOY.code, matches: 0, stats: {} });
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
  await expect(compareAs(MANAGERS[3], [SAKA.code, PALMER.code])).rejects.toThrow(refusals.notInLeague);
});
