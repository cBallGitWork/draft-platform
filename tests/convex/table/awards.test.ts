import { describe, expect, test } from "vitest";
import { managerOfTheMonth, monthOf, monthsToAward } from "../../../convex/table/awards";
import { managerOfTheMonthLetter } from "../../../convex/table/awardWords";
import type { GameweekFixtures } from "../../../convex/table/roundRobin";
import type { GameweekScores } from "../../../convex/table/standings";

// Manager of the Month (spec/09, Awards; #2677): the most points over the gameweeks that start in
// the month on UK time, level teams split by the league's tie-breaks over that month's games, and
// no award in a month in which no gameweek starts.

const [ANN, BOB, CAT, DAN] = ["Ann", "Bob", "Cat", "Dan"];
const TEAMS = [ANN, BOB, CAT, DAN];

const week = (gameweek: number, pairs: [string, string][]): GameweekFixtures<string> => ({
  gameweek,
  fixtures: pairs.map(([team, opponent]) => ({ team, opponent })),
  byes: [],
});

const scores = (byGameweek: Record<number, Record<string, number>>): GameweekScores<string> =>
  new Map(Object.entries(byGameweek).map(([gameweek, byTeam]) => [Number(gameweek), new Map(Object.entries(byTeam))]));

const SCHEDULE = [week(1, [[ANN, BOB], [CAT, DAN]]), week(2, [[ANN, CAT], [BOB, DAN]]), week(3, [[ANN, DAN], [BOB, CAT]])];

describe("the month's winner", () => {
  test("S09.11: head-to-head, the most table points over the month's games wins; total points, the most scored", () => {
    // Bob wins both games, but Cat scores the most points: table points give it to Bob (6),
    // points scored to Cat.
    const scored = scores({ 1: { [ANN]: 40, [BOB]: 50, [CAT]: 70, [DAN]: 80 }, 2: { [ANN]: 10, [BOB]: 60, [CAT]: 75.5, [DAN]: 20 } });
    expect(managerOfTheMonth("headToHead", TEAMS, SCHEDULE, scored, [], [1, 2])).toEqual({ team: BOB, points: 6 });
    expect(managerOfTheMonth("totalPoints", TEAMS, [], scored, [], [1, 2])).toEqual({ team: CAT, points: 145.5 });
  });

  test("S09.5: only the gameweeks of the month count", () => {
    // Ann beats Bob in gameweek 1, before the month; in gameweek 2 Bob wins and Ann draws.
    const scored = scores({ 1: { [ANN]: 90, [BOB]: 10, [CAT]: 10, [DAN]: 10 }, 2: { [ANN]: 10, [BOB]: 30, [CAT]: 10, [DAN]: 10 } });
    expect(managerOfTheMonth("headToHead", TEAMS, SCHEDULE, scored, [], [2])).toEqual({ team: BOB, points: 3 });
    expect(managerOfTheMonth("totalPoints", TEAMS, [], scored, [], [2])).toEqual({ team: BOB, points: 30 });
  });

  test("S09.6, S09.9: teams level are split by the league's tie-breaks in its order, over the month's games alone", () => {
    // Ann and Bob both win both games of gameweeks 2 and 3, the month, scoring 100 each; in
    // gameweek 1, before it, Ann beat Bob.
    const scored = scores({
      1: { [ANN]: 90, [BOB]: 10, [CAT]: 0, [DAN]: 0 },
      2: { [ANN]: 40, [BOB]: 50, [CAT]: 30, [DAN]: 20 },
      3: { [ANN]: 60, [BOB]: 50, [CAT]: 45, [DAN]: 50 },
    });
    // Points against over the month: Ann 30 + 50 = 80, Bob 20 + 45 = 65; the fewest wins.
    expect(managerOfTheMonth("headToHead", TEAMS, SCHEDULE, scored, ["pointsAgainst"], [2, 3])).toEqual({ team: BOB, points: 6 });
    // They didn't meet in the month, so head-to-head leaves them level and points against splits
    // them; gameweek 1's win, outside the month, would have given it to Ann.
    expect(managerOfTheMonth("headToHead", TEAMS, SCHEDULE, scored, ["headToHead", "pointsAgainst"], [2, 3])).toEqual({ team: BOB, points: 6 });
  });

  test("S09.7: a month with no gameweek scored has no winner", () => {
    const scored = scores({ 1: { [ANN]: 40, [BOB]: 50, [CAT]: 70, [DAN]: 80 } });
    expect(managerOfTheMonth("headToHead", TEAMS, SCHEDULE, scored, [], [])).toBeNull();
  });
});

describe("the months to award", () => {
  // UK time: 31 Oct 2026 23:30 UTC is still October; 31 Mar 2026 23:30 UTC is 1 April in the UK.
  const OCT_LATE = Date.UTC(2026, 9, 31, 23, 30);
  const APR_FIRST_UK = Date.UTC(2026, 2, 31, 23, 30);
  const deadlines = new Map<number, number | null>([
    [1, Date.UTC(2026, 9, 3, 10)],
    [2, OCT_LATE],
    [3, Date.UTC(2026, 11, 5, 10)],
    [4, null],
  ]);
  const deadlineIn = (gameweek: number) => deadlines.get(gameweek) ?? null;
  const allFinal = () => true;

  test("S09.10: a gameweek's month is the one its start falls in on UK time", () => {
    expect(monthOf(OCT_LATE)).toBe("2026-10");
    expect(monthOf(APR_FIRST_UK)).toBe("2026-04");
  });

  test("S09.5: a month is awarded once its gameweeks are final and the next starts in a later month", () => {
    expect(monthsToAward([1, 2, 3, 4], deadlineIn, allFinal, [2])).toEqual([{ month: "2026-10", gameweeks: [1, 2] }]);
    // Gameweek 1 not final yet: October waits.
    expect(monthsToAward([1, 2, 3, 4], deadlineIn, (gameweek) => gameweek !== 1, [2])).toEqual([]);
  });

  test("S09.7: a month in which no gameweek starts is never awarded", () => {
    // November has no gameweek: December's gameweek 3 awards none for it, and waits on gameweek 4's start.
    expect(monthsToAward([1, 2, 3, 4], deadlineIn, allFinal, [3])).toEqual([]);
    // The league's last gameweek ends its month.
    expect(monthsToAward([1, 2, 3], deadlineIn, allFinal, [3])).toEqual([{ month: "2026-12", gameweeks: [3] }]);
  });

  test("S09.5: Mail names the team, the month and its points", () => {
    const { subject, body } = managerOfTheMonthLetter("Ann's XI", "2026-10", 145.5, false);
    expect(subject).toContain("Ann's XI");
    expect(subject).toContain("October 2026");
    expect(body).toContain("scored the most points");
    expect(body).toContain("145.5");
  });

  test("S09.11: head-to-head, Mail says the points are table points", () => {
    const { body } = managerOfTheMonthLetter("Ann's XI", "2026-10", 9, true);
    expect(body).toContain("table points");
    expect(body).toContain(": 9.");
  });
});
