import { describe, expect, test } from "vitest";
import { LEAGUE_AVERAGE, seededRandom, type GameweekFixtures } from "../../../convex/table/roundRobin";
import { drawn, teamsOf } from "../../support/convex/roundRobin.harness";

// The round robin's golden (#140): the exact fixtures a seed deals. The table draws every league's
// fixtures again on every read, so a change to roundsOf, roundOrder, shuffle or seededRandom that
// still deals evenly passes roundRobin.test.ts yet deals every live league's season again.
//
// CHANGING AN EXPECTED VALUE HERE DEALS EVERY LEAGUE'S SEASON AGAIN. It is never a refactor
// (docs/REFACTORING.md, "What is never a refactor"): it needs its own fix pull request, with its
// reason, and Craig's nod.

/** A gameweek as one line: "gameweek: team v opponent, ... | bye team, ...", teams by number. */
const short = (team: string) => team.replace("Team ", "");
const lineOf = ({ gameweek, fixtures, byes }: GameweekFixtures<string>) => {
  const games = fixtures.map(({ team, opponent }) => `${short(team)} v ${opponent === LEAGUE_AVERAGE ? "average" : short(opponent)}`);
  return `${gameweek}: ${games.join(", ")}${byes.length > 0 ? ` | bye ${byes.map(short).join(", ")}` : ""}`;
};

const EIGHT_GAMEWEEKS = [1, 2, 3, 4, 5, 6, 7, 8];

describe("the draw a seed deals is pinned", () => {
  test("4 teams, a game a gameweek, seed league-a", () => {
    expect(drawn(teamsOf(4), EIGHT_GAMEWEEKS, { oddTeamOut: "bye", gamesPerGameweek: 1, seed: "league-a" }).map(lineOf)).toEqual([
      "1: 1 v 3, 4 v 2",
      "2: 1 v 4, 2 v 3",
      "3: 1 v 2, 3 v 4",
      "4: 1 v 3, 4 v 2",
      "5: 1 v 4, 2 v 3",
      "6: 1 v 2, 3 v 4",
      "7: 1 v 2, 3 v 4",
      "8: 1 v 3, 4 v 2",
    ]);
  });

  test("5 teams, the odd team out on a bye, seed league-b", () => {
    expect(drawn(teamsOf(5), EIGHT_GAMEWEEKS, { oddTeamOut: "bye", gamesPerGameweek: 1, seed: "league-b" }).map(lineOf)).toEqual([
      "1: 2 v 5, 3 v 4 | bye 1",
      "2: 1 v 3, 4 v 2 | bye 5",
      "3: 1 v 5, 2 v 3 | bye 4",
      "4: 1 v 4, 5 v 3 | bye 2",
      "5: 1 v 2, 4 v 5 | bye 3",
      "6: 1 v 2, 4 v 5 | bye 3",
      "7: 2 v 5, 3 v 4 | bye 1",
      "8: 1 v 3, 4 v 2 | bye 5",
    ]);
  });

  test("5 teams, the odd team out against the league's average, seed k57abc123", () => {
    expect(drawn(teamsOf(5), EIGHT_GAMEWEEKS, { oddTeamOut: "leagueAverage", gamesPerGameweek: 1, seed: "k57abc123" }).map(lineOf)).toEqual([
      "1: 1 v average, 2 v 5, 3 v 4",
      "2: 1 v 2, 3 v average, 4 v 5",
      "3: 1 v 3, 4 v 2, 5 v average",
      "4: 1 v 4, 5 v 3, 2 v average",
      "5: 1 v 5, 4 v average, 2 v 3",
      "6: 1 v 5, 4 v average, 2 v 3",
      "7: 1 v average, 2 v 5, 3 v 4",
      "8: 1 v 4, 5 v 3, 2 v average",
    ]);
  });

  test("6 teams, two games a gameweek, seed league-a: gameweek 3 straddles two round robins", () => {
    expect(drawn(teamsOf(6), EIGHT_GAMEWEEKS.slice(0, 6), { oddTeamOut: "bye", gamesPerGameweek: 2, seed: "league-a" }).map(lineOf)).toEqual([
      "1: 1 v 2, 3 v 6, 4 v 5, 1 v 6, 2 v 5, 3 v 4",
      "2: 1 v 4, 5 v 3, 6 v 2, 1 v 5, 6 v 4, 2 v 3",
      "3: 1 v 3, 4 v 2, 5 v 6, 1 v 5, 6 v 4, 2 v 3",
      "4: 1 v 3, 4 v 2, 5 v 6, 1 v 2, 3 v 6, 4 v 5",
      "5: 1 v 4, 5 v 3, 6 v 2, 1 v 6, 2 v 5, 3 v 4",
      "6: 1 v 3, 4 v 2, 5 v 6, 1 v 5, 6 v 4, 2 v 3",
    ]);
  });

  test("the first numbers seed x gives", () => {
    const random = seededRandom("x");
    expect(Array.from({ length: 5 }, () => random())).toEqual([
      0.4801359330303967, 0.10925848642364144, 0.8231615843251348, 0.20447059837169945, 0.16694674477912486,
    ]);
  });
});
