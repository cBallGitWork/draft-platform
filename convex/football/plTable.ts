// The Premier League table, worked out from the results (#50; spec/18, "The table": "P W D L GF GA
// GD Pts, worked out from the results"). The Premier League's rules are fixed, so they are
// constants here (CLAUDE.md), not a league's data. Pure: no I/O. Where the finished results come
// from, and the live, provisional table, are later slices of #50.
//
// The order is the Premier League Handbook's, Section C (2024/25 wording, as the Premier League
// quoted it on 4 Dec 2024, premierleague.com/news/4183163; checked 25 Oct 2026):
//   C.4  the most points first;
//   C.5  level on points: "the Club with the higher or highest Goal Difference";
//   C.6  still level: "the Club having scored the most goals in League Matches";
//   C.7  still level: "they shall be deemed to occupy the same position in the League Table".
// At the end of the season only, C.17 parts clubs still level after C.6 when the title,
// relegation or a European place turns on it:
//   C.17.1  "the total points scored by the relevant Clubs" in the league matches between them;
//   C.17.2  "the Club scoring the higher number of goals whilst the Visiting Club in Head-to-Head
//           Matches";
//   C.17.3  "a play-off on a neutral ground", set by the Board.
// What results alone can't settle: whether a tie touches a European place (that turns on who wins
// the cups), so at the end of the season C.17.1 and C.17.2 part every tie; and a C.17.3 play-off,
// which isn't a league match, so clubs level after C.17.2 share a position. Clubs sharing a
// position stay in the order the caller lists them: the Premier League lists them alphabetically,
// a practice and not a rule.

/** A league match's points (Handbook C.4): the Premier League's, fixed. */
export const PL_MATCH_POINTS = { win: 3, draw: 1, loss: 0 } as const;

/** What parts clubs level on points, in the Handbook's order, all season (C.5, C.6). */
export const PL_TIE_BREAKS = ["goalDifference", "goalsScored"] as const;

/** What parts clubs still level, after C.6, at the end of the season only (C.17.1, C.17.2). */
export const PL_END_OF_SEASON_TIE_BREAKS = ["headToHeadPoints", "headToHeadAwayGoals"] as const;

type TieBreak = (typeof PL_TIE_BREAKS)[number] | (typeof PL_END_OF_SEASON_TIE_BREAKS)[number];

/** A finished league match: the home club's goals and the away club's. */
export type PlResult<Club> = { home: Club; away: Club; homeGoals: number; awayGoals: number };

export type PlTableRow<Club> = {
  club: Club;
  /** 1 at the top; clubs the Handbook can't part share one, and the next club's skips past them
   *  (1, 2, 2, 4). */
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

type Row<Club> = Omit<PlTableRow<Club>, "position">;

/** The table: every club in `clubs`, a club with no results on nothing. `seasonOver` brings in
 *  the head-to-head steps (C.17), which apply only once every match is played. A result naming a
 *  club not in `clubs`, a club playing itself, or goals that aren't a whole number from 0 throws:
 *  each is the caller's bug. */
export function plTable<Club>(
  clubs: readonly Club[],
  results: readonly PlResult<Club>[],
  { seasonOver }: { seasonOver: boolean },
): PlTableRow<Club>[] {
  const rows = new Map(clubs.map((club) => [club, emptyRow(club)]));
  const rowOf = (club: Club) => {
    const row = rows.get(club);
    if (row === undefined) throw new Error(`A result names ${String(club)}, which isn't one of the clubs`);
    return row;
  };
  for (const result of results) {
    throwIfUncountable(result);
    addResult(rowOf(result.home), result.homeGoals, result.awayGoals);
    addResult(rowOf(result.away), result.awayGoals, result.homeGoals);
  }
  const tieBreaks = seasonOver ? [...PL_TIE_BREAKS, ...PL_END_OF_SEASON_TIE_BREAKS] : PL_TIE_BREAKS;
  const levelGroups = groupedBy([...rows.values()], (row) => row.points).flatMap((level) =>
    brokenTies(level, tieBreaks, results),
  );
  let position = 1;
  return levelGroups.flatMap((group) => {
    const placed = group.map((row) => ({ ...row, position }));
    position += group.length;
    return placed;
  });
}

function throwIfUncountable<Club>({ home, away, homeGoals, awayGoals }: PlResult<Club>): void {
  if (home === away) throw new Error(`A result has ${String(home)} playing itself`);
  for (const goals of [homeGoals, awayGoals]) {
    if (!Number.isInteger(goals) || goals < 0) {
      throw new Error(`${String(home)} v ${String(away)} has ${goals} goals, not a whole number from 0`);
    }
  }
}

const emptyRow = <Club>(club: Club): Row<Club> => ({
  club,
  played: 0,
  won: 0,
  drawn: 0,
  lost: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  goalDifference: 0,
  points: 0,
});

/** The points a club's goals earn against the other side's. */
function matchPoints(goals: number, against: number): number {
  if (goals > against) return PL_MATCH_POINTS.win;
  return goals === against ? PL_MATCH_POINTS.draw : PL_MATCH_POINTS.loss;
}

function addResult<Club>(row: Row<Club>, goals: number, against: number): void {
  row.played += 1;
  if (goals > against) row.won += 1;
  else if (goals === against) row.drawn += 1;
  else row.lost += 1;
  row.points += matchPoints(goals, against);
  row.goalsFor += goals;
  row.goalsAgainst += against;
  row.goalDifference = row.goalsFor - row.goalsAgainst;
}

/** Rows grouped by a key, highest first, each group in the rows' own order. */
function groupedBy<R>(rows: readonly R[], key: (row: R) => number): R[][] {
  const groups = new Map<number, R[]>();
  for (const row of rows) {
    const group = groups.get(key(row));
    if (group === undefined) groups.set(key(row), [row]);
    else group.push(row);
  }
  return [...groups.entries()].toSorted(([one], [other]) => other - one).map(([, group]) => group);
}

/** Clubs level on points, split by the first tie-break, those still level by the next, and so on:
 *  each group returned is level on everything applied. */
function brokenTies<Club>(
  level: Row<Club>[],
  tieBreaks: readonly TieBreak[],
  results: readonly PlResult<Club>[],
): Row<Club>[][] {
  const [first, ...rest] = tieBreaks;
  if (level.length < 2 || first === undefined) return [level];
  return groupedBy(level, tieBreakKey(first, level, results)).flatMap((stillLevel) =>
    brokenTies(stillLevel, rest, results),
  );
}

/** What a tie-break ranks by, higher first. The head-to-head steps count only the matches between
 *  the clubs level at that step, however many there are (C.17.1 counts "the relevant Clubs"). */
function tieBreakKey<Club>(
  tieBreak: TieBreak,
  level: readonly Row<Club>[],
  results: readonly PlResult<Club>[],
): (row: Row<Club>) => number {
  switch (tieBreak) {
    case "goalDifference":
      return (row) => row.goalDifference;
    case "goalsScored":
      return (row) => row.goalsFor;
    case "headToHeadPoints": {
      const between = resultsBetween(level, results);
      return (row) =>
        between.reduce((sum, { home, away, homeGoals, awayGoals }) => {
          if (home === row.club) return sum + matchPoints(homeGoals, awayGoals);
          if (away === row.club) return sum + matchPoints(awayGoals, homeGoals);
          return sum;
        }, 0);
    }
    case "headToHeadAwayGoals": {
      const between = resultsBetween(level, results);
      return (row) => between.reduce((sum, { away, awayGoals }) => (away === row.club ? sum + awayGoals : sum), 0);
    }
  }
}

function resultsBetween<Club>(level: readonly Row<Club>[], results: readonly PlResult<Club>[]): PlResult<Club>[] {
  const levelClubs = new Set(level.map((row) => row.club));
  return results.filter(({ home, away }) => levelClubs.has(home) && levelClubs.has(away));
}
