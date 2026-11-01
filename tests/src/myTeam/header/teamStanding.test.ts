// Where a team stands, read from the league's table and fixtures (src/myTeam/header/teamStanding.ts):
// My team's header band and the Tactics tab's GW opponent widget read it.

import { describe, expect, it } from "vitest";
import { FORM_LENGTH, gameIn, gamesOfTeam, resultOf, standingOf } from "../../../../src/myTeam/header/teamStanding";
import { idOf, leagueTableOf } from "../../../../src/table/drawnTable";

const TEAMS = ["Ana", "Ben", "Cal", "Dee"];
const GAMEWEEKS = [1, 2, 3, 4, 5, 6, 7];
/** Each team's points in each of six gameweeks scored: Ana always top, Dee always bottom. */
const POINTS: Record<string, number> = { Ana: 60, Ben: 50, Cal: 40, Dee: 30 };
const scores = new Map(GAMEWEEKS.slice(0, 6).map((gameweek) => [gameweek, new Map(TEAMS.map((team) => [team, POINTS[team]]))]));

describe("a team's games", () => {
  it("are its head-to-head games in gameweek order, each scored from its own side once played", () => {
    const table = leagueTableOf(TEAMS, { gameweeks: GAMEWEEKS, scores });
    const games = gamesOfTeam(table, "Dee");
    expect(games.map(({ gameweek }) => gameweek)).toEqual(GAMEWEEKS);
    for (const { against, score } of games.slice(0, 6)) {
      expect(against.kind).toBe("team");
      expect(score).toEqual({ team: 30, opponent: against.kind === "team" ? POINTS[against.team] : null, provisional: false });
    }
    expect(games.at(-1)!.score).toBeNull();
  });

  it("in a gameweek, is the one it plays, or none in total points", () => {
    expect(gameIn(leagueTableOf(TEAMS, { gameweeks: GAMEWEEKS }), "Ana", 3)?.gameweek).toBe(3);
    expect(gameIn(leagueTableOf(TEAMS, { gameweeks: GAMEWEEKS, format: "totalPoints" }), "Ana", 3)).toBeNull();
  });

  it("against the league's average, in a league with an odd team out", () => {
    const table = leagueTableOf(TEAMS.slice(0, 3), { gameweeks: GAMEWEEKS, scores, oddTeamOut: "leagueAverage" });
    const average = gamesOfTeam(table, "Cal").find(({ against }) => against.kind === "leagueAverage");
    // The average of 60, 50 and 40.
    expect(average?.score).toEqual({ team: 40, opponent: 50, provisional: false });
  });
});

describe("where a team stands", () => {
  it("is its place and points in the table, its last game, and its last five results, oldest first", () => {
    const table = leagueTableOf(TEAMS, { gameweeks: GAMEWEEKS, scores });
    const ana = standingOf(table, "Ana")!;
    expect(ana.teamId).toBe(idOf("Ana"));
    expect(ana.place).toBe(1);
    expect(ana.points).toBe(table.table[0].points);
    expect(ana.last?.gameweek).toBe(6);
    expect(ana.form).toEqual(Array(FORM_LENGTH).fill("W"));
    expect(standingOf(table, "Dee")!.place).toBe(4);
    expect(standingOf(table, "Dee")!.form).toEqual(Array(FORM_LENGTH).fill("L"));
  });

  it("leaves a live game out of its form, but not out of its last game", () => {
    const table = leagueTableOf(TEAMS, { gameweeks: GAMEWEEKS, scores, provisional: ["Ana"] });
    const ana = standingOf(table, "Ana")!;
    expect(ana.form).toEqual([]);
    expect(ana.last?.score?.provisional).toBe(true);
  });

  it("in total points, has its latest gameweek's points and no games", () => {
    const table = leagueTableOf(TEAMS, { gameweeks: GAMEWEEKS, scores, format: "totalPoints" });
    const ben = standingOf(table, "Ben")!;
    expect(ben.last).toBeNull();
    expect(ben.lastPoints).toEqual({ gameweek: 6, points: 50, provisional: false });
    expect(ben.place).toBe(2);
  });

  it("is none for a team the table doesn't hold", () => {
    expect(standingOf(leagueTableOf(TEAMS), "Eve")).toBeNull();
  });

  it("calls a game won, lost or drawn by its points", () => {
    expect([resultOf({ team: 2, opponent: 1 }), resultOf({ team: 1, opponent: 2 }), resultOf({ team: 1, opponent: 1 })]).toEqual(["W", "L", "D"]);
  });
});
