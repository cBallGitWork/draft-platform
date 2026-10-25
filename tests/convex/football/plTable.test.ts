import { describe, expect, test } from "vitest";
import { plTable, type PlResult, type PlTableRow } from "../../../convex/football/plTable";

// The Premier League table (#50; spec/18): P W D L GF GA GD Pts from the results, every club in it,
// and the Handbook's order: points (C.4), goal difference (C.5), goals scored (C.6), a shared
// position (C.7), and, at the end of the season only, head-to-head points (C.17.1) then away goals
// in the head-to-head matches (C.17.2).

const [ARS, BOU, CHE, DER] = ["Arsenal", "Bournemouth", "Chelsea", "Derby"];
const IN_SEASON = { seasonOver: false };
const SEASON_OVER = { seasonOver: true };

/** A result as "home homeGoals-awayGoals away". */
const result = (home: string, homeGoals: number, awayGoals: number, away: string): PlResult<string> => ({
  home,
  away,
  homeGoals,
  awayGoals,
});

const placed = (rows: PlTableRow<string>[]) => rows.map(({ club, position }) => [position, club]);
const rowOf = (rows: PlTableRow<string>[], club: string) => rows.find((row) => row.club === club);

describe("the Premier League table", () => {
  test("a win is 3, a draw 1 and a loss none, with played, goals for, against and the difference", () => {
    const table = plTable([ARS, BOU, CHE], [result(ARS, 3, 1, BOU), result(CHE, 2, 2, ARS)], IN_SEASON);

    expect(rowOf(table, ARS)).toEqual({ club: ARS, position: 1, played: 2, won: 1, drawn: 1, lost: 0, goalsFor: 5, goalsAgainst: 3, goalDifference: 2, points: 4 });
    expect(rowOf(table, CHE)).toEqual({ club: CHE, position: 2, played: 1, won: 0, drawn: 1, lost: 0, goalsFor: 2, goalsAgainst: 2, goalDifference: 0, points: 1 });
    expect(rowOf(table, BOU)).toEqual({ club: BOU, position: 3, played: 1, won: 0, drawn: 0, lost: 1, goalsFor: 1, goalsAgainst: 3, goalDifference: -2, points: 0 });
  });

  test("every club is in it, a club with no results on nothing, all sharing first in the order given", () => {
    const table = plTable([CHE, ARS, BOU], [], IN_SEASON);

    expect(placed(table)).toEqual([[1, CHE], [1, ARS], [1, BOU]]);
    expect(rowOf(table, ARS)).toEqual({ club: ARS, position: 1, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 });
  });

  test("C.4: the most points first", () => {
    expect(placed(plTable([ARS, BOU], [result(ARS, 0, 1, BOU)], IN_SEASON))).toEqual([[1, BOU], [2, ARS]]);
  });

  test("C.5: level on points, the higher goal difference first", () => {
    const table = plTable([BOU, ARS, CHE], [result(ARS, 2, 0, CHE), result(BOU, 1, 0, CHE)], IN_SEASON);
    expect(placed(table)).toEqual([[1, ARS], [2, BOU], [3, CHE]]);
  });

  test("C.6: level on points and goal difference, the most goals first", () => {
    const table = plTable([BOU, ARS, CHE], [result(ARS, 3, 1, CHE), result(BOU, 2, 0, CHE)], IN_SEASON);
    expect(placed(table)).toEqual([[1, ARS], [2, BOU], [3, CHE]]);
  });

  // Arsenal beat Bournemouth; both end on 3 points, 3 scored and 3 conceded. Derby top, Chelsea last.
  const levelAfterGoals = [
    result(ARS, 2, 1, BOU),
    result(BOU, 2, 1, CHE),
    result(DER, 2, 1, ARS),
    result(DER, 0, 0, CHE),
  ];

  test("C.7: in the season, clubs level after goals scored share a position, and head-to-head doesn't count", () => {
    const table = plTable([BOU, ARS, CHE, DER], levelAfterGoals, IN_SEASON);
    expect(placed(table)).toEqual([[1, DER], [2, BOU], [2, ARS], [4, CHE]]);
  });

  test("C.17.1: at the end of the season, the most points in the matches between the clubs level first", () => {
    const table = plTable([BOU, ARS, CHE, DER], levelAfterGoals, SEASON_OVER);
    expect(placed(table)).toEqual([[1, DER], [2, ARS], [3, BOU], [4, CHE]]);
  });

  test("C.17.2: level on head-to-head points, the most goals scored away in those matches first", () => {
    const drawnTwice = [result(ARS, 1, 1, BOU), result(BOU, 0, 0, ARS)];

    expect(placed(plTable([ARS, BOU], drawnTwice, IN_SEASON))).toEqual([[1, ARS], [1, BOU]]);
    expect(placed(plTable([ARS, BOU], drawnTwice, SEASON_OVER))).toEqual([[1, BOU], [2, ARS]]);
  });

  test("C.17.3: still level after away goals, the clubs share a position: a play-off isn't in the results", () => {
    const table = plTable([ARS, BOU], [result(ARS, 1, 1, BOU), result(BOU, 1, 1, ARS)], SEASON_OVER);
    expect(placed(table)).toEqual([[1, ARS], [1, BOU]]);
  });

  test("C.17.1 with three clubs level counts only the matches among the three", () => {
    // Between themselves Arsenal take 4 points, Bournemouth 3, Chelsea 1; their games with Derby
    // bring each to 7 points, 3 scored and 1 conceded.
    const results = [
      result(ARS, 1, 0, BOU),
      result(BOU, 1, 0, CHE),
      result(CHE, 0, 0, ARS),
      result(DER, 1, 2, ARS),
      result(DER, 0, 2, BOU),
      result(DER, 0, 0, BOU),
      result(DER, 0, 2, CHE),
      result(DER, 0, 1, CHE),
    ];
    const clubs = [CHE, BOU, ARS, DER];

    expect(placed(plTable(clubs, results, IN_SEASON))).toEqual([[1, CHE], [1, BOU], [1, ARS], [4, DER]]);
    expect(placed(plTable(clubs, results, SEASON_OVER))).toEqual([[1, ARS], [2, BOU], [3, CHE], [4, DER]]);
  });

  test("a result it can't count throws, naming the clubs", () => {
    expect(() => plTable([ARS], [result(ARS, 1, 0, BOU)], IN_SEASON)).toThrow(/Bournemouth/);
    expect(() => plTable([ARS], [result(ARS, 1, 0, ARS)], IN_SEASON)).toThrow(/Arsenal playing itself/);
    expect(() => plTable([ARS, BOU], [result(ARS, -1, 0, BOU)], IN_SEASON)).toThrow(/Arsenal v Bournemouth has -1 goals/);
    expect(() => plTable([ARS, BOU], [result(ARS, 1, 0.5, BOU)], IN_SEASON)).toThrow(/0.5 goals/);
  });
});
