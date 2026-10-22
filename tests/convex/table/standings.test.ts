import { describe, expect, test } from "vitest";
import { LEAGUE_AVERAGE, type GameweekFixtures } from "../../../convex/table/roundRobin";
import { headToHeadTable, totalPointsTable, type GameweekScores, type TableRow, type TieBreak } from "../../../convex/table/standings";

// The table (#33; spec/09, spec/03): 3 for a win, 1 for a draw, none for a loss, equal scores a
// draw; for, against and the difference; the team left over against the league's average or on a
// bye; and the league's tie-breaks, in its order. Total points ranks by points for.

const [ANN, BOB, CAT, DAN] = ["Ann", "Bob", "Cat", "Dan"];

/** Gameweek `gameweek`'s fixtures, as [team, opponent] pairs, and who has a bye. */
const week = (gameweek: number, pairs: [string, string][], byes: string[] = []): GameweekFixtures<string> => ({
  gameweek,
  fixtures: pairs.map(([team, opponent]) => ({ team, opponent })),
  byes,
});

/** Each gameweek's scores, by team. */
const scores = (byGameweek: Record<number, Record<string, number>>): GameweekScores<string> =>
  new Map(Object.entries(byGameweek).map(([gameweek, byTeam]) => [Number(gameweek), new Map(Object.entries(byTeam))]));

const order = (rows: TableRow<string>[]) => rows.map((row) => row.team);
const rowOf = (rows: TableRow<string>[], team: string) => rows.find((row) => row.team === team);

describe("a head-to-head table", () => {
  test("a win is 3, a draw 1 and a loss none, equal scores a draw, with for, against and the difference", () => {
    const schedule = [week(1, [[ANN, BOB], [CAT, DAN]]), week(2, [[ANN, CAT], [BOB, DAN]])];
    const table = headToHeadTable([ANN, BOB, CAT, DAN], schedule, scores({ 1: { Ann: 50, Bob: 40.5, Cat: 30, Dan: 30 }, 2: { Ann: 20, Cat: 25, Bob: 10, Dan: 60 } }), []);

    expect(rowOf(table, ANN)).toEqual({ team: ANN, played: 2, won: 1, drawn: 0, lost: 1, pointsFor: 70, pointsAgainst: 65.5, difference: 4.5, points: 3 });
    expect(rowOf(table, CAT)).toEqual({ team: CAT, played: 2, won: 1, drawn: 1, lost: 0, pointsFor: 55, pointsAgainst: 50, difference: 5, points: 4 });
    expect(rowOf(table, DAN)).toMatchObject({ won: 1, drawn: 1, lost: 0, points: 4 });
    expect(rowOf(table, BOB)).toMatchObject({ won: 0, drawn: 0, lost: 2, points: 0, difference: -59.5 });
  });

  test("ranks by the table's points", () => {
    const table = headToHeadTable([ANN, BOB], [week(1, [[ANN, BOB]])], scores({ 1: { Ann: 1, Bob: 2 } }), []);
    expect(order(table)).toEqual([BOB, ANN]);
  });

  test("before any gameweek is scored every team is on nothing, in the order they were made", () => {
    const table = headToHeadTable([ANN, BOB, CAT, DAN], [week(1, [[ANN, BOB], [CAT, DAN]])], new Map(), ["pointsFor", "headToHead"]);
    expect(order(table)).toEqual([ANN, BOB, CAT, DAN]);
    for (const row of table) expect(row).toEqual({ team: row.team, played: 0, won: 0, drawn: 0, lost: 0, pointsFor: 0, pointsAgainst: 0, difference: 0, points: 0 });
  });

  test("a gameweek not yet scored counts for nothing", () => {
    const table = headToHeadTable([ANN, BOB], [week(1, [[ANN, BOB]]), week(2, [[ANN, BOB]])], scores({ 1: { Ann: 3, Bob: 1 } }), []);
    expect(rowOf(table, ANN)).toMatchObject({ played: 1, won: 1, pointsFor: 3 });
  });

  test("the team left over plays the league's average, every team's score counted, kept in tenths", () => {
    const schedule = [{ gameweek: 1, fixtures: [{ team: ANN, opponent: BOB }, { team: CAT, opponent: LEAGUE_AVERAGE }], byes: [] }];
    const table = headToHeadTable([ANN, BOB, CAT], schedule, scores({ 1: { Ann: 10, Bob: 10, Cat: 11 } }), []);

    // (10 + 10 + 11) / 3 is 10.333…, kept as 10.3, which Cat beats.
    expect(rowOf(table, CAT)).toMatchObject({ played: 1, won: 1, points: 3, pointsFor: 11, pointsAgainst: 10.3, difference: 0.7 });
    expect(rowOf(table, ANN)).toMatchObject({ drawn: 1, pointsAgainst: 10 });
  });

  test("a score equal to the league's average is a draw", () => {
    const schedule = [{ gameweek: 1, fixtures: [{ team: ANN, opponent: BOB }, { team: CAT, opponent: LEAGUE_AVERAGE }], byes: [] }];
    const table = headToHeadTable([ANN, BOB, CAT], schedule, scores({ 1: { Ann: 0.1, Bob: 0.3, Cat: 0.2 } }), []);
    expect(rowOf(table, CAT)).toMatchObject({ drawn: 1, points: 1, pointsAgainst: 0.2 });
  });

  test("the team on a bye plays nobody: it gets nothing for that gameweek, for or against", () => {
    const table = headToHeadTable([ANN, BOB, CAT], [week(1, [[ANN, BOB]], [CAT])], scores({ 1: { Ann: 1, Bob: 2, Cat: 99 } }), []);
    expect(rowOf(table, CAT)).toMatchObject({ played: 0, points: 0, pointsFor: 0 });
  });

  test("with two games a gameweek, a team's one score counts in both, and the average counts each team's score once", () => {
    // Cat plays Ann and the average: the average is (10 + 20 + 30) / 3, not weighted by games.
    const schedule = [{ gameweek: 1, fixtures: [{ team: ANN, opponent: BOB }, { team: CAT, opponent: ANN }, { team: CAT, opponent: LEAGUE_AVERAGE }], byes: [BOB] }];
    const table = headToHeadTable([ANN, BOB, CAT], schedule, scores({ 1: { Ann: 10, Bob: 20, Cat: 30 } }), []);
    expect(rowOf(table, CAT)).toMatchObject({ played: 2, won: 2, pointsFor: 60, pointsAgainst: 30 });
    expect(rowOf(table, ANN)).toMatchObject({ played: 2, lost: 2, pointsFor: 20 });
  });

  test("a gameweek scored without a team's score is a bug, and says whose is missing", () => {
    expect(() => headToHeadTable([ANN, BOB], [week(1, [[ANN, BOB]])], scores({ 1: { Ann: 1 } }), [])).toThrow("Gameweek 1 has scores, but none for Bob");
  });
});

describe("the league's tie-breaks", () => {
  // Ann and Bob are level on 3 points: Ann has more points for, but more against, and lost to Bob.
  const schedule = [week(1, [[ANN, BOB], [CAT, DAN]]), week(2, [[ANN, CAT], [BOB, DAN]])];
  const level = scores({ 1: { Ann: 40, Bob: 50, Cat: 0, Dan: 0 }, 2: { Ann: 60, Cat: 59, Bob: 20, Dan: 21 } });
  const ranked = (tieBreaks: TieBreak[]) => order(headToHeadTable([ANN, BOB, CAT, DAN], schedule, level, tieBreaks)).slice(1, 3);

  test("Ann and Bob are level on points", () => {
    const table = headToHeadTable([ANN, BOB, CAT, DAN], schedule, level, []);
    expect([rowOf(table, ANN)?.points, rowOf(table, BOB)?.points]).toEqual([3, 3]);
  });

  test.each<[string, TieBreak[], string[]]>([
    ["points for: the most first", ["pointsFor"], [ANN, BOB]],
    ["points against: the fewest first", ["pointsAgainst"], [BOB, ANN]],
    ["head-to-head: the winner of their matchup first", ["headToHead"], [BOB, ANN]],
    ["the first listed decides", ["pointsFor", "headToHead"], [ANN, BOB]],
    ["the first listed decides, in either order", ["headToHead", "pointsFor"], [BOB, ANN]],
    ["none: the order they were made", [], [ANN, BOB]],
  ])("%s", (_, tieBreaks, expected) => {
    expect(ranked(tieBreaks)).toEqual(expected);
  });

  test("a tie-break that leaves them level passes to the next", () => {
    // Equal for; Ann concedes less. Ann and Bob never met, so head-to-head leaves them level.
    const table = headToHeadTable([ANN, BOB, CAT, DAN], [week(1, [[ANN, CAT], [BOB, DAN]])], scores({ 1: { Ann: 5, Bob: 5, Cat: 1, Dan: 2 } }), ["pointsFor", "headToHead", "pointsAgainst"]);
    expect(order(table)).toEqual([ANN, BOB, DAN, CAT]);
  });

  test("head-to-head counts only the matchups between the teams level", () => {
    // Ann, Bob and Cat are level on 3; among the three, Cat beat Ann, and nobody else met.
    // Dan's matchups don't count, though Bob beat him.
    const schedule3 = [week(1, [[CAT, ANN], [BOB, DAN]]), week(2, [[ANN, DAN], [BOB, CAT]])];
    const table = headToHeadTable([ANN, BOB, CAT, DAN], schedule3, scores({ 1: { Cat: 2, Ann: 1, Bob: 2, Dan: 1 }, 2: { Ann: 2, Dan: 1, Bob: 1, Cat: 2 } }), ["headToHead"]);
    expect(table.slice(0, 3).map((row) => [row.team, row.points])).toEqual([[CAT, 6], [ANN, 3], [BOB, 3]]);
  });
});

describe("a total-points table", () => {
  test("ranks by points for over the gameweeks scored; teams level stay in the order they were made", () => {
    const table = totalPointsTable([ANN, BOB, CAT], scores({ 1: { Ann: 10, Bob: 20.5, Cat: 15 }, 2: { Ann: 15, Bob: 1, Cat: 20.5 } }));
    expect(table.map((row) => [row.team, row.played, row.points])).toEqual([[CAT, 2, 35.5], [ANN, 2, 25], [BOB, 2, 21.5]]);
    expect(order(totalPointsTable([ANN, BOB], scores({ 1: { Ann: 5, Bob: 5 } })))).toEqual([ANN, BOB]);
  });
});
