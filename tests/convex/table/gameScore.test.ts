import { describe, expect, test } from "vitest";
import { LEAGUE_AVERAGE } from "../../../convex/table/roundRobin";
import { gameScore } from "../../../convex/table/teamGames";

// A fixture's score from a gameweek's team scores (#436), as the table's fixtures and My team's
// Fixtures tab both show it: pure.

const TEAMS = ["Ann", "Bob", "Cat"];
const scored = (provisional: readonly string[] = []) =>
  new Map([
    ["Ann", { points: 40.5, provisional: provisional.includes("Ann") }],
    ["Bob", { points: 30, provisional: provisional.includes("Bob") }],
    ["Cat", { points: 20, provisional: provisional.includes("Cat") }],
  ]);

describe("against a team", () => {
  test("is each side's points, the team's own first, final while neither may move", () => {
    expect(gameScore(TEAMS, scored(), 3, "Ann", "Bob")).toEqual({ team: 40.5, opponent: 30, provisional: false });
    expect(gameScore(TEAMS, scored(), 3, "Bob", "Ann")).toEqual({ team: 30, opponent: 40.5, provisional: false });
  });

  test.each([["Ann"], ["Bob"]])("is provisional while %s's points may move", (live) => {
    expect(gameScore(TEAMS, scored([live]), 3, "Ann", "Bob").provisional).toBe(true);
  });

  test("is provisional only for the two sides, not a third team's live points", () => {
    expect(gameScore(TEAMS, scored(["Cat"]), 3, "Ann", "Bob").provisional).toBe(false);
  });
});

describe("against the league's average", () => {
  test("is every team's average, in tenths", () => {
    expect(gameScore(TEAMS, scored(), 3, "Cat", LEAGUE_AVERAGE)).toEqual({ team: 20, opponent: 30.2, provisional: false });
  });

  test("is provisional while any team's points may move", () => {
    expect(gameScore(TEAMS, scored(["Bob"]), 3, "Cat", LEAGUE_AVERAGE).provisional).toBe(true);
  });
});

test("throws for a gameweek scored short of a team in it, rather than show a wrong score", () => {
  const short = scored();
  short.delete("Bob");
  expect(() => gameScore(TEAMS, short, 3, "Ann", "Bob")).toThrow("Gameweek 3 is scored, but not for team Bob");
  expect(() => gameScore(TEAMS, short, 3, "Cat", LEAGUE_AVERAGE)).toThrow("Gameweek 3 is scored, but not for team Bob");
});
