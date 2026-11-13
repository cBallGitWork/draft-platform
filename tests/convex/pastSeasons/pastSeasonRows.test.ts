import { describe, expect, test } from "vitest";
import {
  FPL_POSITION_AREA,
  fplCodesByRoot,
  fplPositionsByCode,
  pastSeasonRows,
  playedIn,
  premierLeagueRows,
  seasonCounts,
  statsIn,
  withoutFplCode,
  type FplPosition,
  type LogRow,
} from "../../../convex/pastSeasons/pastSeasonRows";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { scoreMatch } from "../../../convex/scoring/scoring";
import { SAMPLE_BOOTSTRAP, SAMPLE_LOG, SAMPLE_PERSONS, SAMPLE_SEASON, sampleRows } from "../../support/convex/pastSeason.harness";

const codes = fplCodesByRoot(SAMPLE_PERSONS);
const positions = fplPositionsByCode(SAMPLE_BOOTSTRAP);
const KICKOFF_A = Date.parse("2025-08-15T19:00:00Z");

/** FPL 2025/26's defensive contribution: 2 points at 10 for a defender, 12 for a midfielder or a
 *  forward, none for a keeper. The first set no longer scores it (#1121). */
const DEFENSIVE_CONTRIBUTION_AT: Readonly<Record<FplPosition, number | null>> = { 1: null, 2: 10, 3: 12, 4: 12 };
const DEFENSIVE_CONTRIBUTION_POINTS = 2;

/** FPL's points for the row less its bonus and its defensive contribution's 2, where the row
 *  says he earned them; null where the row has no defensive contribution. */
function fplPointsWithoutBonusOrDefence(row: LogRow, position: FplPosition): number | null {
  const contribution = row.fpl_defensive_contribution as number | null;
  if (contribution === null) return null;
  const at = DEFENSIVE_CONTRIBUTION_AT[position];
  const earned = at !== null && contribution >= at ? DEFENSIVE_CONTRIBUTION_POINTS : 0;
  return (row.fpl_total_points as number) - (row.fpl_bonus as number) - earned;
}

const positionOf = (row: LogRow): FplPosition => positions.get(codes.get(row.person_root_id as string)!)!;
const firstSetPoints = (row: LogRow) =>
  scoreMatch(statsIn(row), FIRST_SCORING, { area: FPL_POSITION_AREA[positionOf(row)], lane: "centre" }).total;

describe("a past season's rows", () => {
  test("every Premier League match he played is a row, keyed by his FPL code, the season and the kickoff", () => {
    const rows = sampleRows();
    expect(rows.filter((row) => row.match !== null)).toHaveLength(8);
    expect(rows.find((row) => row.playerCode === 100002 && row.match?.kickoff === KICKOFF_A)).toEqual({
      season: SAMPLE_SEASON,
      playerCode: 100002,
      fplPosition: 2,
      match: {
        kickoff: KICKOFF_A,
        club: "Sample United",
        startingPosition: "DR",
        stats: {
          minutes: 90,
          goals_scored: 1,
          assists: 0,
          clean_sheets: 1,
          goals_conceded: 0,
          saves: 0,
          penalties_saved: 0,
          penalties_missed: 0,
          defensive_contribution: 11,
          yellow_cards: 0,
          red_cards: 0,
          own_goals: 0,
        },
      },
    });
  });

  test("a man the season names who played no match is one row with no match, so he isn't a newcomer", () => {
    expect(sampleRows().filter((row) => row.match === null)).toEqual([{ season: SAMPLE_SEASON, playerCode: 100005, fplPosition: 3, match: null }]);
  });

  test("cup rows are dropped, and a man only a cup names is not in the season", () => {
    const rows = sampleRows();
    expect(rows.some((row) => row.playerCode === 100006)).toBe(false);
    expect(rows.filter((row) => row.playerCode === 100004)).toHaveLength(2);
  });

  test("a played row with no defensive contribution keeps the stat absent, never 0", () => {
    const row = sampleRows().find((each) => each.playerCode === 100004 && each.match?.kickoff === KICKOFF_A);
    expect(row?.match?.stats).not.toHaveProperty("defensive_contribution");
    expect(row?.match?.stats.minutes).toBe(20);
  });

  test("a feed that leaves its 0s out gives 0 for a missing stat where it covered the match, and nothing where it didn't", () => {
    const row = SAMPLE_LOG.find((each) => each.person_root_id === "keeper-one")!;
    const covered = statsIn({ ...row, sofascore_minutes: 90, fotmob_minutes: 90, sofascore_won_tackle: 3 });
    expect(covered).toMatchObject({ won_tackle: 3, big_chance_missed: 0, total_tackle: 0, won_contest: 0 });
    const uncovered = statsIn({ ...row, sofascore_minutes: null, fotmob_minutes: null });
    expect(uncovered).not.toHaveProperty("won_tackle");
    expect(uncovered).not.toHaveProperty("won_contest");
  });

  test("an FPL stat stays absent when missing, even where FPL gave minutes", () => {
    const row = SAMPLE_LOG.find((each) => each.person_root_id === "keeper-one")!;
    expect(statsIn({ ...row, sofascore_minutes: 90, fpl_defensive_contribution: null })).not.toHaveProperty("defensive_contribution");
  });

  test("a start the log gives no position for is kept as null", () => {
    const row = sampleRows().find((each) => each.playerCode === 100004 && each.match?.kickoff === KICKOFF_A);
    expect(row?.match?.startingPosition).toBeNull();
  });

  test("the season's sizes count its matches, played rows, who played and who is named", () => {
    expect(seasonCounts(SAMPLE_LOG)).toEqual({ matches: 2, playedRows: 8, played: 4, named: 5 });
  });

  test("re-scored under the first set at his FPL position, every played row is FPL's points less bonus and defensive contribution", () => {
    const played = premierLeagueRows(SAMPLE_LOG).filter(playedIn);
    expect(played).toHaveLength(8);
    for (const row of played) {
      const fpl = fplPointsWithoutBonusOrDefence(row, positionOf(row));
      const points = firstSetPoints(row);
      if (fpl === null) {
        // Without it, FPL's 2 for a defensive contribution may or may not be in his points.
        const plain = (row.fpl_total_points as number) - (row.fpl_bonus as number);
        expect([plain, plain - DEFENSIVE_CONTRIBUTION_POINTS], `${String(row.person_root_id)} at ${String(row.kickoff_utc)}`).toContain(points);
      } else {
        expect(points, `${String(row.person_root_id)} at ${String(row.kickoff_utc)}`).toBe(fpl);
      }
    }
  });
});

describe("a player with no FPL code is skipped, the rest of the season kept (Craig, 6 Nov 2026, on #842)", () => {
  const keeper = SAMPLE_LOG.filter((row) => row.person_root_id === "keeper-one");
  const unmatched = keeper.map((row) => ({ ...row, person_root_id: "no-fpl-seven" }));

  test("his rows are left out and he is named, with the matches he played", () => {
    const { kept, skipped } = withoutFplCode([...SAMPLE_LOG, ...unmatched], codes);
    expect(kept).toEqual(premierLeagueRows(SAMPLE_LOG));
    expect(skipped).toEqual([{ root: "no-fpl-seven", rows: unmatched.length, played: unmatched.filter(playedIn).length }]);
  });

  test("everyone else is still found by his FPL code", () => {
    const { kept } = withoutFplCode([...SAMPLE_LOG, ...unmatched], codes);
    expect(pastSeasonRows(SAMPLE_SEASON, kept, codes, positions)).toEqual(sampleRows());
  });

  test("a season where everyone has a code skips no one", () => {
    expect(withoutFplCode(SAMPLE_LOG, codes).skipped).toEqual([]);
  });
});

describe("the copy stops, naming him, rather than guess", () => {
  const playedRow = SAMPLE_LOG.find((row) => row.person_root_id === "keeper-one")!;

  test("a Premier League row whose person has no FPL code", () => {
    const log = [{ ...playedRow, person_root_id: "no-fpl-seven" }];
    expect(() => pastSeasonRows(SAMPLE_SEASON, log, codes, positions)).toThrow("Person no-fpl-seven has no FPL code");
  });

  test("a player the season's FPL list lacks", () => {
    const withoutKeeper = new Map([...positions].filter(([code]) => code !== 100001));
    expect(() => pastSeasonRows(SAMPLE_SEASON, [playedRow], codes, withoutKeeper)).toThrow("Person keeper-one (FPL code 100001) is not in the season's FPL player list");
  });

  test("a player twice at one kickoff", () => {
    expect(() => pastSeasonRows(SAMPLE_SEASON, [playedRow, playedRow], codes, positions)).toThrow("plays twice at kickoff 2025-08-15T19:00:00.000Z");
  });

  test("a played row with no club (S14.20)", () => {
    expect(() => pastSeasonRows(SAMPLE_SEASON, [{ ...playedRow, team: null }], codes, positions)).toThrow(
      "Person keeper-one (FPL code 100001) has no team at kickoff 2025-08-15T19:00:00.000Z",
    );
  });

  test("a kickoff that isn't a time", () => {
    expect(() => pastSeasonRows(SAMPLE_SEASON, [{ ...playedRow, kickoff_utc: "soon" }], codes, positions)).toThrow("keeper-one's kickoff_utc is soon");
  });

  test("a stat that isn't a number", () => {
    expect(() => statsIn({ ...playedRow, goals: "two" })).toThrow("keeper-one's goals is two, not a number");
  });

  test("one person with two FPL codes", () => {
    const twice = [...SAMPLE_PERSONS, { name: "keeper-one-again.json", json: { root_id: "keeper-one", source_mappings: { fpl_code: 999 } } }];
    expect(() => fplCodesByRoot(twice)).toThrow("Person keeper-one has two FPL codes, 100001 and 999");
  });

  test("an FPL player in none of FPL's four positions", () => {
    expect(() => fplPositionsByCode({ elements: [{ code: 1, element_type: 6 }] })).toThrow("FPL player 1 has position 6");
  });
});

test("an older season's FPL list, its players alone with no bootstrap around them, gives the same positions", () => {
  expect(fplPositionsByCode((SAMPLE_BOOTSTRAP as { elements: unknown[] }).elements)).toEqual(positions);
});

test("2024/25's managers in FPL's list are no players, so they get no position", () => {
  expect(fplPositionsByCode([{ code: 1, element_type: 5 }, { code: 2, element_type: 2 }])).toEqual(new Map([[2, 2]]));
});

test("a man only on the bench who isn't in the season's FPL list is left out, and the rest is kept", () => {
  const benchOnly = SAMPLE_LOG.filter((row) => row.competition === "premier_league" && !playedIn(row)).map((row) => ({ ...row, person_root_id: "keeper-one" }));
  expect(benchOnly.length).toBeGreaterThan(0);
  const withoutKeeper = new Map([...positions].filter(([code]) => code !== 100001));
  expect(pastSeasonRows(SAMPLE_SEASON, benchOnly, codes, withoutKeeper)).toEqual([]);
});

test("a kickoff the log gives with no zone is read as UTC", () => {
  const row = { ...SAMPLE_LOG.find((each) => each.person_root_id === "keeper-one")!, kickoff_utc: "2025-08-15T19:00:00" };
  expect(pastSeasonRows(SAMPLE_SEASON, [row], codes, positions)[0].match?.kickoff).toBe(KICKOFF_A);
});
