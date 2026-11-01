import { describe, expect, test } from "vitest";
import { plTable, type PlMatch, type PlResult, type PlTableRow } from "../../../convex/football/plTable";
import { COMPETITION_TIE_BREAKS, type CompetitionTieBreak } from "../../../convex/football/tieBreaks";

// The Premier League table (#50; spec/18): P W D L GF GA GD Pts from the results, every club in it,
// and clubs level on points split by the competition's own order, held as data (#899). The
// Premier League's: goal difference (C.5), goals scored (C.6), then, all season, head-to-head
// points (C.17.1) and away goals in the head-to-head matches (C.17.2) while every match between
// the clubs level is played, and a shared position after (C.7, C.17.3).

const [ARS, BOU, CHE, DER] = ["Arsenal", "Bournemouth", "Chelsea", "Derby"];
const PL = COMPETITION_TIE_BREAKS.premierLeague;
/** The Premier League's order, every match listed played. */
const ALL_PLAYED = { tieBreaks: PL, unplayed: [] };
/** The Premier League's order with these matches still to come, or never played. */
const withUnplayed = (...unplayed: PlMatch<string>[]) => ({ tieBreaks: PL, unplayed });

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
    const table = plTable([ARS, BOU, CHE], [result(ARS, 3, 1, BOU), result(CHE, 2, 2, ARS)], ALL_PLAYED);

    expect(rowOf(table, ARS)).toEqual({ club: ARS, position: 1, played: 2, won: 1, drawn: 1, lost: 0, goalsFor: 5, goalsAgainst: 3, goalDifference: 2, points: 4 });
    expect(rowOf(table, CHE)).toEqual({ club: CHE, position: 2, played: 1, won: 0, drawn: 1, lost: 0, goalsFor: 2, goalsAgainst: 2, goalDifference: 0, points: 1 });
    expect(rowOf(table, BOU)).toEqual({ club: BOU, position: 3, played: 1, won: 0, drawn: 0, lost: 1, goalsFor: 1, goalsAgainst: 3, goalDifference: -2, points: 0 });
  });

  test("every club is in it, a club with no results on nothing, all sharing first in the order given", () => {
    const table = plTable([CHE, ARS, BOU], [], withUnplayed({ home: ARS, away: BOU }));

    expect(placed(table)).toEqual([[1, CHE], [1, ARS], [1, BOU]]);
    expect(rowOf(table, ARS)).toEqual({ club: ARS, position: 1, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 });
  });

  test("C.4: the most points first", () => {
    expect(placed(plTable([ARS, BOU], [result(ARS, 0, 1, BOU)], ALL_PLAYED))).toEqual([[1, BOU], [2, ARS]]);
  });

  test("C.5: level on points, the higher goal difference first", () => {
    const table = plTable([BOU, ARS, CHE], [result(ARS, 2, 0, CHE), result(BOU, 1, 0, CHE)], ALL_PLAYED);
    expect(placed(table)).toEqual([[1, ARS], [2, BOU], [3, CHE]]);
  });

  test("C.6: level on points and goal difference, the most goals first", () => {
    const table = plTable([BOU, ARS, CHE], [result(ARS, 3, 1, CHE), result(BOU, 2, 0, CHE)], ALL_PLAYED);
    expect(placed(table)).toEqual([[1, ARS], [2, BOU], [3, CHE]]);
  });

  // Arsenal beat Bournemouth; both on 3 points, 3 scored and 3 conceded. Derby top, Chelsea last.
  const levelAfterGoals = [
    result(ARS, 2, 1, BOU),
    result(BOU, 2, 1, CHE),
    result(DER, 2, 1, ARS),
    result(DER, 0, 0, CHE),
  ];

  test("C.17.1 mid-season: both their meetings played, the most points in them first, with other matches still to come", () => {
    // The return match a draw: Arsenal and Bournemouth on 4 points, 4 scored, 4 conceded, as Derby
    // is on points; Arsenal took 4 of the 6 between them.
    const results = [...levelAfterGoals, result(BOU, 1, 1, ARS)];
    const table = plTable([BOU, ARS, CHE, DER], results, withUnplayed({ home: CHE, away: DER }, { home: ARS, away: CHE }));

    expect(placed(table)).toEqual([[1, DER], [2, ARS], [3, BOU], [4, CHE]]);
  });

  test("one of their meetings unplayed, head-to-head is skipped and clubs level after goals share a position", () => {
    const table = plTable([BOU, ARS, CHE, DER], levelAfterGoals, withUnplayed({ home: BOU, away: ARS }));
    expect(placed(table)).toEqual([[1, DER], [2, BOU], [2, ARS], [4, CHE]]);
  });

  test("C.17.2: level on head-to-head points, the most goals scored away in those matches first", () => {
    const drawnTwice = [result(ARS, 1, 1, BOU), result(BOU, 0, 0, ARS)];
    expect(placed(plTable([ARS, BOU], drawnTwice, ALL_PLAYED))).toEqual([[1, BOU], [2, ARS]]);
  });

  test("C.17.3: still level after away goals, the clubs share a position: a play-off isn't in the results", () => {
    const table = plTable([ARS, BOU], [result(ARS, 1, 1, BOU), result(BOU, 1, 1, ARS)], ALL_PLAYED);
    expect(placed(table)).toEqual([[1, ARS], [1, BOU]]);
  });

  describe("three clubs level", () => {
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

    test("C.17.1 counts only the matches among the three", () => {
      expect(placed(plTable(clubs, results, ALL_PLAYED))).toEqual([[1, ARS], [2, BOU], [3, CHE], [4, DER]]);
    });

    test("one match among the three unplayed, all three stay level", () => {
      expect(placed(plTable(clubs, results, withUnplayed({ home: BOU, away: ARS })))).toEqual([[1, CHE], [1, BOU], [1, ARS], [4, DER]]);
    });

    test("a match unplayed between two of them and a third club doesn't hold the three back", () => {
      expect(placed(plTable(clubs, results, withUnplayed({ home: ARS, away: DER })))).toEqual([[1, ARS], [2, BOU], [3, CHE], [4, DER]]);
    });
  });

  test("the order is the competition's data: another competition's order sorts the same results differently", () => {
    // Arsenal, Bournemouth and Derby on 3 points. By goal difference Arsenal (+3), Derby (+1),
    // Bournemouth (0); by head-to-head points first, Bournemouth and Derby (3 each, from beating
    // Arsenal and Bournemouth) ahead of Arsenal (0), then goal difference between those two.
    const otherCompetition: readonly CompetitionTieBreak[] = ["headToHeadPoints", "goalDifference"];
    const results = [result(ARS, 0, 1, BOU), result(ARS, 4, 0, CHE), result(DER, 1, 0, BOU)];
    const clubs = [ARS, BOU, CHE, DER];

    expect(placed(plTable(clubs, results, ALL_PLAYED))).toEqual([[1, ARS], [2, DER], [3, BOU], [4, CHE]]);
    expect(placed(plTable(clubs, results, { tieBreaks: otherCompetition, unplayed: [] }))).toEqual([[1, DER], [2, BOU], [3, ARS], [4, CHE]]);
  });

  test("a head-to-head step skipped for a match unplayed, the competition's next step still applies", () => {
    const headToHeadFirst: readonly CompetitionTieBreak[] = ["headToHeadPoints", "goalDifference"];
    const table = plTable([BOU, ARS, CHE], [result(ARS, 2, 0, CHE), result(BOU, 1, 0, CHE)], {
      tieBreaks: headToHeadFirst,
      unplayed: [{ home: ARS, away: BOU }],
    });
    expect(placed(table)).toEqual([[1, ARS], [2, BOU], [3, CHE]]);
  });

  test("a club listed twice throws", () => {
    expect(() => plTable([ARS, BOU, ARS], [], ALL_PLAYED)).toThrow(/listed twice in Arsenal, Bournemouth, Arsenal/);
  });

  test("a result it can't count throws, naming the clubs", () => {
    expect(() => plTable([ARS], [result(ARS, 1, 0, BOU)], ALL_PLAYED)).toThrow(/Bournemouth/);
    expect(() => plTable([ARS], [result(ARS, 1, 0, ARS)], ALL_PLAYED)).toThrow(/Arsenal playing itself/);
    expect(() => plTable([ARS, BOU], [result(ARS, -1, 0, BOU)], ALL_PLAYED)).toThrow(/Arsenal v Bournemouth has -1 goals/);
    expect(() => plTable([ARS, BOU], [result(ARS, 1, 0.5, BOU)], ALL_PLAYED)).toThrow(/0.5 goals/);
  });

  test("an unplayed match naming a club not in the table, or one playing itself, throws", () => {
    expect(() => plTable([ARS], [], withUnplayed({ home: ARS, away: BOU }))).toThrow(/Bournemouth, which isn't one of the clubs/);
    expect(() => plTable([ARS], [], withUnplayed({ home: ARS, away: ARS }))).toThrow(/Arsenal playing itself/);
  });
});
