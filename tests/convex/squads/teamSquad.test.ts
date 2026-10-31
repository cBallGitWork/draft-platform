import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Cell } from "../../../convex/lineup/pitch";
import { roleIn } from "../../../convex/lineup/roles";
import { cardPoints } from "../../../convex/playerCard/cardPoints";
import type { Position } from "../../../convex/positions/positionTables";
import type { StoredScoringSet } from "../../../convex/scoring/scoringSetShape";
import { scoreMatch } from "../../../convex/scoring/scoring";
import { refusals } from "../../../convex/shared/leagueAccess";
import { DAY_MS, WEEK_MS } from "../../../convex/shared/time";
import { squadPoints } from "../../../convex/squads/teamSquad";
import { expectRefused } from "../../support/convex/test.harness";
import { COMMISSIONER, MANAGERS, actingAs, addManagers, adminCreatesLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { EXAMPLE_SET, GOAL_AND_ASSIST } from "../../support/convex/scoring.example";
import { holdSiteScoring } from "../../support/convex/siteScoring.harness";
import { ARSENAL, CHELSEA, COVENTRY, UNHELD, completeRecord, insertClubs, insertPlayers } from "../../support/convex/footballRows.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// My team's Squad tab (#364): every player in the manager's squad with his positions, club, his
// club's next match, and his season's and last gameweek's points: what his team got from him, the
// matches his card shows at his slot, never one labelled not counted or at his best position
// (spec/12; #595). The site plays EXAMPLE_SET throughout.

const [ANN, BOB] = MANAGERS;

const player = (code: number, name: string, clubCode: number, positions: Position[]) => ({ code, name, fullName: `${name} in full`, clubCode, positions });
const SAKA = player(1001, "Saka", ARSENAL.code, ["W"]);
const RAYA = player(1002, "Raya", ARSENAL.code, ["GK"]);
const PALMER = player(1003, "Palmer", CHELSEA.code, ["CAM"]);
const BENCHED = player(1004, "Benched", COVENTRY.code, ["ST"]);
const NOBODY = player(1005, "Nobody", COVENTRY.code, []);

const NOW = Date.parse("2026-09-01T12:00:00Z");
/** When the league is made: before gameweek 1's deadline, so it plays both gameweeks begun. */
const MADE = NOW - 3 * WEEK_MS;
const fixture = (code: number, gameweek: number, home: number, away: number, kickoff: number) => ({ code, gameweek, homeClubCode: home, awayClubCode: away, kickoff });
const GW1 = fixture(1, 1, ARSENAL.code, COVENTRY.code, NOW - 2 * WEEK_MS);
const GW2 = fixture(2, 2, CHELSEA.code, ARSENAL.code, NOW - WEEK_MS);
const NEXT_ARS = fixture(3, 3, ARSENAL.code, CHELSEA.code, NOW + DAY_MS);
const LATER_ARS = fixture(4, 4, COVENTRY.code, ARSENAL.code, NOW + WEEK_MS);

/** Where Saka stood for Ann's team in gameweek 1: not his best, so the slot's points show. */
const SAKA_SLOT: Cell = { area: "attack", lane: "right" };

const SAKA_GW1 = GOAL_AND_ASSIST;
const SAKA_GW2 = { minutes: 90, goals_scored: 2 };

let t: TestConvex;
let leagueId: Id<"leagues">;
let annTeam: Id<"teams">;
let bobTeam: Id<"teams">;
beforeEach(async () => {
  t = await signInDeployment(MADE);
  fakeResend();
  leagueId = await adminCreatesLeague(t);
  [annTeam, bobTeam] = await addManagers(t, leagueId, [ANN, BOB]);
  await t.run(async (ctx) => {
    await insertClubs(ctx, [ARSENAL, CHELSEA, COVENTRY]);
    const players = [SAKA, RAYA, PALMER, BENCHED, NOBODY];
    await insertPlayers(ctx, players);
    for (const each of players) if (each.code !== BENCHED.code) await ctx.db.insert("squadPlayers", { leagueId, teamId: annTeam, playerCode: each.code });
    for (const each of [GW1, GW2, NEXT_ARS, LATER_ARS]) await ctx.db.insert("fixtures", each);
    await holdSiteScoring(ctx, { scoring: structuredClone(EXAMPLE_SET) as StoredScoringSet, kind: "fix", season: 2025, number: 1, at: 0 });
    for (const gameweek of [1, 2]) await ctx.db.insert("passedDeadlines", { leagueId, gameweek, deadline: NOW - (3 - gameweek) * WEEK_MS, recordedAt: NOW });
    await ctx.db.insert("lineups", { leagueId, teamId: annTeam, fromGameweek: 1, starters: [{ playerCode: SAKA.code, ...SAKA_SLOT }], bench: [] });
    await ctx.db.insert("lineups", { leagueId, teamId: annTeam, fromGameweek: 2, starters: [], bench: [SAKA.code] });
    await ctx.db.insert("playerMatchStats", completeRecord(SAKA.code, GW1.code, SAKA_GW1));
    await ctx.db.insert("playerMatchStats", completeRecord(SAKA.code, GW2.code, SAKA_GW2));
  });
});

const read = async (email = ANN) => (await actingAs(t, email)).query(api.squads.teamSquad.ofMyTeam, { leagueId, now: NOW });
const rowOf = async (code: number) => (await read()).players.find((each) => each.code === code)!;
const priced = (stats: Record<string, number>, positions: Position[], slot: Cell | null) =>
  (slot === null ? cardPoints(stats, EXAMPLE_SET, positions) : scoreMatch(stats, EXAMPLE_SET, slot, roleIn(slot, undefined).key)).total!;
/** Saka's points as his card prices them: gameweek 1 at his slot, gameweek 2, on the bench with
 *  nobody to come on for, at his best, labelled not counted. */
const sakaGw1 = () => priced(SAKA_GW1, ["W"], SAKA_SLOT);
const sakaGw2 = () => priced(SAKA_GW2, ["W"], null);

/** A commissioner's override of the player's points in the match (#32), in `league`. */
const overrides = (playerCode: number, { code: fixtureCode, gameweek }: { code: number; gameweek: number }, points: number, league = leagueId) =>
  t.run(async (ctx) => {
    await ctx.db.insert("pointsOverrides", { leagueId: league, gameweek, fixtureCode, playerCode, points, reason: "The feed was wrong", by: COMMISSIONER, at: NOW });
  });

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

  // Bob's team has no lineup in a begun gameweek: one naming him there still throws, in scoring
  // (gameweekScorer/teamGameweek.ts lineupPlayer), whose call that is.
  test("keep one whose player the football sync doesn't hold as his code, for a team no begun gameweek's lineup names him in (#323)", async () => {
    await t.run((ctx) => ctx.db.insert("squadPlayers", { leagueId, teamId: bobTeam, playerCode: UNHELD }));
    const { players, unheld } = await read(BOB);
    expect(players).toEqual([]);
    expect(unheld).toEqual([UNHELD]);
  });

  test("give his club's next match after now, home or away, or none", async () => {
    expect((await rowOf(SAKA.code)).nextFixture).toEqual({ gameweek: 3, kickoff: NEXT_ARS.kickoff, opponent: CHELSEA, home: true });
    expect((await rowOf(PALMER.code)).nextFixture).toEqual({ gameweek: 3, kickoff: NEXT_ARS.kickoff, opponent: ARSENAL, home: false });
    expect((await rowOf(NOBODY.code)).nextFixture).toEqual({ gameweek: 4, kickoff: LATER_ARS.kickoff, opponent: ARSENAL, home: true });
  });
});

describe("the points", () => {
  test("add up his slot's points when he started for the team, and nothing for a match he stayed on the bench", async () => {
    const slot = sakaGw1();
    expect(slot).not.toBe(priced(SAKA_GW1, ["W"], null));
    expect(sakaGw2()).toBeGreaterThan(0);
    expect(await rowOf(SAKA.code)).toMatchObject({ seasonPoints: slot, lastGameweekPoints: 0 });
    expect((await read()).lastGameweek).toBe(2);
  });

  test("leave out a match whose whole record hasn't arrived", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("playerMatchStats", completeRecord(PALMER.code, GW2.code, { minutes: 90, goals_scored: 1 }, { pl: false }));
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
      { gameweek: 1, points: 4, counted: true },
      { gameweek: 2, points: null, counted: true },
      { gameweek: 2, points: 3, counted: true },
    ];
    expect(squadPoints(matches, 2)).toEqual({ seasonPoints: 7, lastGameweekPoints: 3 });
    expect(squadPoints(matches, 3)).toEqual({ seasonPoints: 7, lastGameweekPoints: null });
    expect(squadPoints([], null)).toEqual({ seasonPoints: null, lastGameweekPoints: null });
  });

  test("leave out a match his team didn't count, so a gameweek of only those is 0, not '—' (#595)", () => {
    const matches = [
      { gameweek: 1, points: 4, counted: true },
      { gameweek: 2, points: 6, counted: false },
    ];
    expect(squadPoints(matches, 2)).toEqual({ seasonPoints: 4, lastGameweekPoints: 0 });
  });

  test("keep to tenths, as the table does: 0.1 and 0.2 make 0.3", () => {
    const matches = [
      { gameweek: 2, points: 0.1, counted: true },
      { gameweek: 2, points: 0.2, counted: true },
    ];
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(squadPoints(matches, 2)).toEqual({ seasonPoints: 0.3, lastGameweekPoints: 0.3 });
  });

  test("take the league's override of his points in a match in place of what his record scores", async () => {
    const overridden = 12.5;
    expect(sakaGw1()).not.toBe(overridden);
    await overrides(SAKA.code, GW1, overridden);
    expect(await rowOf(SAKA.code)).toMatchObject({ seasonPoints: overridden, lastGameweekPoints: 0 });
  });

  test("take an override of a match whose whole record hasn't arrived", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("playerMatchStats", completeRecord(PALMER.code, GW2.code, { minutes: 90, goals_scored: 1 }, { pl: false }));
    });
    await overrides(PALMER.code, GW2, 4);
    // Priced now, so no longer '—'; but he wasn't in the lineup, so his team got nothing from it.
    expect(await rowOf(PALMER.code)).toMatchObject({ seasonPoints: 0, lastGameweekPoints: 0 });
  });

  test("leave another league's override out", async () => {
    await overrides(SAKA.code, GW1, 12.5, await adminCreatesLeague(t));
    expect(await rowOf(SAKA.code)).toMatchObject({ seasonPoints: sakaGw1(), lastGameweekPoints: 0 });
  });
});

describe("the last gameweek", () => {
  test("is the latest the league plays: with gameweek 2 unticked, gameweek 1", async () => {
    await t.run(async (ctx) => {
      await ctx.db.patch("leagues", leagueId, { unusedGameweeks: [2] });
    });
    const squad = await read();
    expect(squad.lastGameweek).toBe(1);
    expect(squad.players.find((each) => each.code === SAKA.code)).toMatchObject({ seasonPoints: sakaGw1(), lastGameweekPoints: sakaGw1() });
  });

  test("is none for a league made after the deadlines passed, until its first gameweek begins, and his matches add nothing", async () => {
    await t.run(async (ctx) => {
      for (const row of await ctx.db.query("passedDeadlines").collect()) await ctx.db.patch("passedDeadlines", row._id, { deadline: MADE - DAY_MS });
    });
    const squad = await read();
    expect(squad.lastGameweek).toBeNull();
    // The table scores none of the league's gameweeks, so his team got nothing from him (#577):
    // his card prices them at his best position, and the Squad tab adds none of it (#595).
    expect(squad.players.find((each) => each.code === SAKA.code)).toMatchObject({ seasonPoints: 0, lastGameweekPoints: null });
  });
});
