import { describe, expect, test } from "vitest";
import { checkCatalogueStat } from "../../../convex/scoring/statCatalogue";
import { FORM_GAMEWEEKS } from "../../../convex/squads/squadLimits";
import { SQUAD_STATS, squadEleven, squadForm, squadPoints } from "../../../convex/squads/teamSquad";

// My team's Squad tab's sums (#364), apart from the query's reads (teamSquad.test.ts): his points
// added up from his priced matches, his form, and the stats a row holds.

describe("the points", () => {
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
});

describe("Started and Role points (#1005)", () => {
  test("a start is every match he stood in the scoring eleven for, a double gameweek's uncounted one too", () => {
    const matches = [
      { inEleven: true, counted: true, points: 6, rolePoints: 1 },
      { inEleven: true, counted: false, points: 2, rolePoints: 2 },
      { inEleven: false, counted: false, points: 4, rolePoints: null },
    ];
    expect(squadEleven(matches).started).toBe(2);
  });

  test("Role points add only the role lines of matches his team got, kept to tenths", () => {
    const matches = [
      { inEleven: true, counted: true, points: 6, rolePoints: 0.1 },
      { inEleven: true, counted: true, points: 3, rolePoints: 0.2 },
      { inEleven: true, counted: true, points: 2, rolePoints: null },
      { inEleven: true, counted: false, points: 2, rolePoints: 5 },
    ];
    expect(squadEleven(matches).rolePoints).toBe(0.3);
  });

  test("with no match his team got priced, Role points are '—'", () => {
    expect(squadEleven([{ inEleven: true, counted: true, points: null, rolePoints: null }])).toEqual({ started: 1, rolePoints: null });
    expect(squadEleven([{ inEleven: false, counted: false, points: 4, rolePoints: null }])).toEqual({ started: 0, rolePoints: null });
    expect(squadEleven([])).toEqual({ started: 0, rolePoints: null });
  });
});

describe("the season's stats", () => {
  test("each is read under its catalogue key", () => {
    for (const stat of Object.values(SQUAD_STATS)) expect(() => checkCatalogueStat(stat)).not.toThrow();
  });
});

describe("the form", () => {
  test("keeps only the last five gameweeks", () => {
    const matches = [1, 2, 3, 4, 5, 6].map((gameweek) => ({ gameweek, points: gameweek, counted: true }));
    expect(squadForm(matches, [1, 2, 3, 4, 5, 6, 7])).toEqual([3, 4, 5, 6, null]);
    expect(FORM_GAMEWEEKS).toBe(5);
  });
});
