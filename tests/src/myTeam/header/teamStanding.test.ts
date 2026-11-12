// Where a team stands, read from the league's table and fixtures (src/myTeam/header/teamStanding.ts):
// My team's header band and the Tactics tab's GW opponent widget read it.

import { describe, expect, it } from "vitest";
import { FORM_RESULTS } from "../../../../convex/table/standings";
import { gamesIn, gamesOfTeam, standingOf } from "../../../../src/myTeam/header/teamStanding";
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
    expect(gamesIn(leagueTableOf(TEAMS, { gameweeks: GAMEWEEKS }), "Ana", 3).map(({ gameweek }) => gameweek)).toEqual([3]);
    expect(gamesIn(leagueTableOf(TEAMS, { gameweeks: GAMEWEEKS, format: "totalPoints" }), "Ana", 3)).toEqual([]);
  });

  it("in a gameweek of two games, is both, against two different teams; and none in a gameweek not drawn", () => {
    const table = leagueTableOf(TEAMS, { gameweeks: GAMEWEEKS, gamesPerGameweek: 2 });
    const games = gamesIn(table, "Ana", 3);
    expect(games.map(({ gameweek }) => gameweek)).toEqual([3, 3]);
    const opponents = games.map(({ against }) => (against.kind === "team" ? against.team : null));
    expect(new Set(opponents).size).toBe(2);
    expect(opponents).not.toContain(null);
    expect(gamesIn(table, "Ana", 8)).toEqual([]);
  });

  it("against the league's average, in a league with an odd team out", () => {
    const table = leagueTableOf(TEAMS.slice(0, 3), { gameweeks: GAMEWEEKS, scores, oddTeamOut: "leagueAverage" });
    const average = gamesOfTeam(table, "Cal").find(({ against }) => against.kind === "leagueAverage");
    // The average of 60, 50 and 40.
    expect(average?.score).toEqual({ team: 40, opponent: 50, provisional: false });
  });

  it("is live or final as its fixture was sent, whatever the gameweek's other results say (#1745)", () => {
    const table = leagueTableOf(TEAMS.slice(0, 3), { gameweeks: GAMEWEEKS, scores, oddTeamOut: "leagueAverage" });
    const averageGame = (each: (typeof table.gameweeks)[number]["fixtures"][number]) => each.team === "Cal" && each.opponent === null;
    const gameweek = table.gameweeks.find((each) => each.fixtures.some(averageGame))!;
    const fixture = gameweek.fixtures.find(averageGame)!;
    // A team that joined after the gameweek began, live in its results but no part of its draw.
    table.results.find((each) => each.gameweek === gameweek.gameweek)!.teams.push({ teamId: idOf("Dee"), teamName: "Dee", points: 0, provisional: true });
    const score = () => gamesIn(table, "Cal", gameweek.gameweek)[0].score;
    expect(score()?.provisional).toBe(false);
    fixture.points = { ...fixture.points!, provisional: true };
    expect(score()?.provisional).toBe(true);
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
    expect(ana.form).toEqual(Array(FORM_RESULTS).fill("won"));
    expect(standingOf(table, "Dee")!.place).toBe(4);
    expect(standingOf(table, "Dee")!.form).toEqual(Array(FORM_RESULTS).fill("lost"));
  });

  it("counts a live game in its form, as League home does, and marks its last game live", () => {
    const table = leagueTableOf(TEAMS, { gameweeks: GAMEWEEKS, scores, provisional: ["Ana"] });
    const ana = standingOf(table, "Ana")!;
    expect(ana.form).toEqual(Array(FORM_RESULTS).fill("won"));
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
});
