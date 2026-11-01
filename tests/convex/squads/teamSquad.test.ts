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
import { squadStats } from "../../../convex/squads/teamSquad";
import { latestRules } from "../../../convex/rules/rulesHistory";
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

  // His row has no squad move, so he was in Ann's squad at both begun gameweeks' deadlines and
  // joins their lineups' benches (lineups.ts). Scoring counts him as not playing (#810), so the
  // rest of her squad keeps its points; before #812 this read threw.
  test("keep one whose player the football sync doesn't hold as his code, after the rest, the rest's points kept (#323)", async () => {
    const before = await read();
    await t.run((ctx) => ctx.db.insert("squadPlayers", { leagueId, teamId: annTeam, playerCode: UNHELD }));
    const { players, unheld } = await read();
    expect(players).toEqual(before.players);
    expect(unheld).toEqual([UNHELD]);
  });

  test("keep one for a team with no lineup yet (#323)", async () => {
    await t.run((ctx) => ctx.db.insert("squadPlayers", { leagueId, teamId: bobTeam, playerCode: UNHELD }));
    expect(await read(BOB)).toMatchObject({ players: [], unheld: [UNHELD] });
  });

  test("give his club's next match after now, home or away, or none", async () => {
    expect((await rowOf(SAKA.code)).nextFixtures[0]).toEqual({ gameweek: 3, kickoff: NEXT_ARS.kickoff, opponent: CHELSEA, home: true });
    expect((await rowOf(PALMER.code)).nextFixtures[0]).toEqual({ gameweek: 3, kickoff: NEXT_ARS.kickoff, opponent: ARSENAL, home: false });
    expect((await rowOf(NOBODY.code)).nextFixtures[0]).toEqual({ gameweek: 4, kickoff: LATER_ARS.kickoff, opponent: ARSENAL, home: true });
    await t.run(async (ctx) => {
      for (const row of await ctx.db.query("fixtures").collect()) await ctx.db.patch("fixtures", row._id, { kickoff: NOW - DAY_MS });
    });
    expect((await rowOf(SAKA.code)).nextFixtures).toEqual([]);
  });

  test("give up to his club's next three matches, soonest first, reading on past those of clubs already full", async () => {
    await t.run(async (ctx) => {
      for (const [index, gameweek] of [5, 6].entries()) await ctx.db.insert("fixtures", fixture(10 + index, gameweek, ARSENAL.code, COVENTRY.code, NOW + (2 + index) * WEEK_MS));
    });
    expect((await rowOf(SAKA.code)).nextFixtures.map(({ gameweek, opponent }) => [gameweek, opponent.shortName])).toEqual([
      [3, "CHE"],
      [4, "COV"],
      [5, "COV"],
    ]);
    // Coventry's third comes after Arsenal have their three.
    expect((await rowOf(NOBODY.code)).nextFixtures.map(({ gameweek }) => gameweek)).toEqual([4, 5, 6]);
    expect((await rowOf(PALMER.code)).nextFixtures.map(({ gameweek }) => gameweek)).toEqual([3]);
  });

  test("give FPL's news on him and its chance he plays, or none", async () => {
    await t.run(async (ctx) => {
      const row = (await ctx.db.query("players").withIndex("by_code", (q) => q.eq("code", SAKA.code)).unique())!;
      await ctx.db.patch("players", row._id, { news: "Knock - 75% chance of playing", chanceOfPlaying: 75 });
    });
    expect(await rowOf(SAKA.code)).toMatchObject({ news: "Knock - 75% chance of playing", chanceOfPlaying: 75 });
    expect(await rowOf(RAYA.code)).toMatchObject({ news: null, chanceOfPlaying: null });
  });

  test("give the most players the league's rules let a squad hold", async () => {
    const rules = await t.run((ctx) => latestRules(ctx, leagueId));
    expect(rules?.squad.size?.maximum).toEqual(expect.any(Number));
    expect((await read()).squadMaximum).toBe(rules?.squad.size?.maximum);
  });
});

describe("the season's stats", () => {
  test("are his totals in the newest season held, the rest 0, as Scouting reads them", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("playerSeasonStats", { season: 2026, playerCode: SAKA.code, stats: { appearances: 2, minutes: 180, goals_scored: 3, assists: 1, yellow_cards: 1, tackles: 4 } });
    });
    expect((await rowOf(SAKA.code)).stats).toEqual({ appearances: 2, minutes: 180, goals: 3, assists: 1, cleanSheets: 0, saves: 0, yellowCards: 1, redCards: 0 });
    expect((await rowOf(RAYA.code)).stats).toEqual(squadStats({}));
  });

  test("come from his own totals row alone, so one with none counted shows no goals beside no minutes", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("playerSeasonStats", { season: 2026, playerCode: SAKA.code, stats: { appearances: 2, minutes: 180, goals_scored: 3, clean_sheets: 1 } });
    });
    const { players } = await read();
    for (const { stats } of players.filter(({ code }) => code !== SAKA.code)) expect(stats).toEqual(squadStats({}));
    for (const { stats } of players) if (stats!.minutes === 0) expect(Object.values(stats!).every((value) => value === 0)).toBe(true);
  });

  test("are none while no season's totals are held", async () => {
    expect((await rowOf(SAKA.code)).stats).toBeNull();
  });
});

describe("the form", () => {
  test("is his points in each of the league's begun gameweeks, oldest first, '—' where none is priced", async () => {
    expect((await rowOf(SAKA.code)).form).toEqual([sakaGw1(), 0]);
    expect((await rowOf(RAYA.code)).form).toEqual([null, null]);
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
