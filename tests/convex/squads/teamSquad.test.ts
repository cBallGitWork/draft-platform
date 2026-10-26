import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Cell } from "../../../convex/lineup/pitch";
import { cardPoints } from "../../../convex/playerCard/cardPoints";
import type { Position } from "../../../convex/positions/positionTables";
import type { StoredScoringSet } from "../../../convex/rules/leagueRulesShape";
import { refusals } from "../../../convex/shared/leagueAccess";
import { DAY_MS, WEEK_MS } from "../../../convex/shared/time";
import { squadPoints } from "../../../convex/squads/teamSquad";
import { expectRefused } from "../../support/convex/leagueRules.harness";
import { COMMISSIONER, MANAGERS, actingAs, addManagers, adminCreatesLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { EXAMPLE_SET } from "../../support/convex/scoring.example";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// My team's Squad tab (#364): every player in the manager's squad with his positions, club, his
// club's next match, and his season's and last gameweek's points, each match priced as his card
// prices it: at his slot when he started for the team, else at his best position. The site plays
// EXAMPLE_SET throughout.

const [ANN, BOB] = MANAGERS;
const ARSENAL = { code: 3, name: "Arsenal", shortName: "ARS" };
const CHELSEA = { code: 8, name: "Chelsea", shortName: "CHE" };
const COVENTRY = { code: 9, name: "Coventry", shortName: "COV" };

const player = (code: number, name: string, clubCode: number, positions: Position[]) => ({ code, name, fullName: `${name} in full`, clubCode, positions });
const SAKA = player(1001, "Saka", ARSENAL.code, ["W"]);
const RAYA = player(1002, "Raya", ARSENAL.code, ["GK"]);
const PALMER = player(1003, "Palmer", CHELSEA.code, ["CAM"]);
const BENCHED = player(1004, "Benched", COVENTRY.code, ["ST"]);
const NOBODY = player(1005, "Nobody", COVENTRY.code, []);

const NOW = Date.parse("2026-09-01T12:00:00Z");
const fixture = (code: number, gameweek: number, home: number, away: number, kickoff: number) => ({ code, gameweek, homeClubCode: home, awayClubCode: away, kickoff });
const GW1 = fixture(1, 1, ARSENAL.code, COVENTRY.code, NOW - 2 * WEEK_MS);
const GW2 = fixture(2, 2, CHELSEA.code, ARSENAL.code, NOW - WEEK_MS);
const NEXT_ARS = fixture(3, 3, ARSENAL.code, CHELSEA.code, NOW + DAY_MS);
const LATER_ARS = fixture(4, 4, COVENTRY.code, ARSENAL.code, NOW + WEEK_MS);

/** Where Saka stood for Ann's team in gameweek 1: not his best, so the slot's points show. */
const SAKA_SLOT: Cell = { area: "attack", lane: "right" };

const record = (playerCode: number, fixtureCode: number, stats: Record<string, number>) => ({
  playerCode,
  fixtureCode,
  started: true,
  played: true,
  arrived: { fpl: true, pl: true },
  stats,
  state: "complete" as const,
});
const SAKA_GW1 = { minutes: 90, goals_scored: 1, assists: 1 };
const SAKA_GW2 = { minutes: 90, goals_scored: 2 };

let t: TestConvex;
let leagueId: Id<"leagues">;
let annTeam: Id<"teams">;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t);
  [annTeam] = await addManagers(t, leagueId, [ANN, BOB]);
  await t.run(async (ctx) => {
    for (const club of [ARSENAL, CHELSEA, COVENTRY]) await ctx.db.insert("clubs", club);
    for (const { positions, ...each } of [SAKA, RAYA, PALMER, BENCHED, NOBODY]) {
      await ctx.db.insert("players", each);
      await ctx.db.insert("playerPositions", { code: each.code, starts: [], approved: [], set: positions, removed: [] });
      if (each.code !== BENCHED.code) await ctx.db.insert("squadPlayers", { leagueId, teamId: annTeam, playerCode: each.code });
    }
    for (const each of [GW1, GW2, NEXT_ARS, LATER_ARS]) await ctx.db.insert("fixtures", each);
    await ctx.db.insert("siteScoring", { scoring: structuredClone(EXAMPLE_SET) as StoredScoringSet, kind: "fix", season: 2025, number: 1, announcedAt: 0, takesEffectAt: 0 });
    for (const gameweek of [1, 2]) await ctx.db.insert("passedDeadlines", { leagueId, gameweek, deadline: NOW - (3 - gameweek) * WEEK_MS, recordedAt: NOW });
    await ctx.db.insert("lineups", { leagueId, teamId: annTeam, fromGameweek: 1, starters: [{ playerCode: SAKA.code, ...SAKA_SLOT }], bench: [] });
    await ctx.db.insert("lineups", { leagueId, teamId: annTeam, fromGameweek: 2, starters: [], bench: [SAKA.code] });
    await ctx.db.insert("playerMatchStats", record(SAKA.code, GW1.code, SAKA_GW1));
    await ctx.db.insert("playerMatchStats", record(SAKA.code, GW2.code, SAKA_GW2));
  });
});

const read = async (email = ANN) => (await actingAs(t, email)).query(api.squads.teamSquad.ofMyTeam, { leagueId, now: NOW });
const rowOf = async (code: number) => (await read()).players.find((each) => each.code === code)!;
const priced = (stats: Record<string, number>, positions: Position[], slot: Cell | null) => cardPoints(stats, EXAMPLE_SET, positions, slot).total!;

test("someone running no team in the league is refused", async () => {
  await expectRefused(read(COMMISSIONER), refusals.runsNoTeam);
});

test("another manager reads his own team's squad, not Ann's", async () => {
  expect(await read(BOB)).toMatchObject({ teamName: "Team 2", players: [] });
});

describe("the rows", () => {
  test("hold every player in the squad, back to front by position, with his club and positions", async () => {
    const { teamName, players } = await read();
    expect(teamName).toBe("Team 1");
    expect(players.map(({ name, positions, club }) => [name, positions, club.shortName])).toEqual([
      ["Raya", ["GK"], "ARS"],
      ["Palmer", ["CAM"], "CHE"],
      ["Saka", ["W"], "ARS"],
      ["Nobody", [], "COV"],
    ]);
  });

  test("give his club's next match after now, home or away, or none", async () => {
    expect((await rowOf(SAKA.code)).nextFixture).toEqual({ gameweek: 3, kickoff: NEXT_ARS.kickoff, opponent: CHELSEA, home: true });
    expect((await rowOf(PALMER.code)).nextFixture).toEqual({ gameweek: 3, kickoff: NEXT_ARS.kickoff, opponent: ARSENAL, home: false });
    expect((await rowOf(NOBODY.code)).nextFixture).toEqual({ gameweek: 4, kickoff: LATER_ARS.kickoff, opponent: ARSENAL, home: true });
  });
});

describe("the points", () => {
  test("price a match at his slot when he started for the team, else at his best position", async () => {
    const slot = priced(SAKA_GW1, ["W"], SAKA_SLOT);
    const best = priced(SAKA_GW2, ["W"], null);
    expect(slot).not.toBe(priced(SAKA_GW1, ["W"], null));
    expect(await rowOf(SAKA.code)).toMatchObject({ seasonPoints: slot + best, lastGameweekPoints: best });
    expect((await read()).lastGameweek).toBe(2);
  });

  test("leave out a match whose whole record hasn't arrived", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("playerMatchStats", { ...record(PALMER.code, GW2.code, { minutes: 90, goals_scored: 1 }), arrived: { fpl: true, pl: false } });
    });
    expect(await rowOf(PALMER.code)).toMatchObject({ seasonPoints: null, lastGameweekPoints: null });
  });

  test("mark a player who has left the Premier League", async () => {
    await t.run(async (ctx) => {
      const row = (await ctx.db.query("players").withIndex("by_code", (q) => q.eq("code", NOBODY.code)).unique())!;
      await ctx.db.patch("players", row._id, { droppedAt: NOW });
    });
    expect(await rowOf(NOBODY.code)).toMatchObject({ gone: true });
    expect(await rowOf(SAKA.code)).toMatchObject({ gone: false });
  });

  test("are '—' for a player with no match priced", async () => {
    expect(await rowOf(RAYA.code)).toMatchObject({ seasonPoints: null, lastGameweekPoints: null });
  });

  test("add up only the matches priced, and a gameweek he didn't play is '—'", () => {
    const matches = [
      { gameweek: 1, points: 4 },
      { gameweek: 2, points: null },
      { gameweek: 2, points: 3 },
    ];
    expect(squadPoints(matches, 2)).toEqual({ seasonPoints: 7, lastGameweekPoints: 3 });
    expect(squadPoints(matches, 3)).toEqual({ seasonPoints: 7, lastGameweekPoints: null });
    expect(squadPoints([], null)).toEqual({ seasonPoints: null, lastGameweekPoints: null });
  });
});
