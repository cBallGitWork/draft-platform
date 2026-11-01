// The Premier League table, worked out from the results (#50; spec/18, "The table": "P W D L GF GA
// GD Pts, worked out from the results"). The Premier League's rules are fixed, so they are
// constants here (CLAUDE.md), not a league's data. Pure: no I/O.
//
// Clubs level on points are split by the competition's own tie-break order, which the caller
// passes from its data (tieBreaks.ts), so the table holds no competition's order (#899). The
// head-to-head steps apply when the competition's timing says (the Premier League's: once the
// season is over), and only while every match between the clubs level at that step is played.
// Clubs level after the last step share a position, in the order the caller lists them: the Premier League lists them alphabetically, a practice and not a rule.

import { HEAD_TO_HEAD_TIE_BREAKS, type CompetitionTieBreak, type CompetitionTieBreaking } from "./tieBreaks";

/** A league match's points (Handbook C.4): the Premier League's, fixed. */
const PL_MATCH_POINTS = { win: 3, draw: 1, loss: 0 } as const;

/** A league match: its home club and its away club. */
export type PlMatch<Club> = { home: Club; away: Club };

/** A finished league match, or one being played as it stands: the home club's goals and the away
 *  club's. */
export type PlResult<Club> = PlMatch<Club> & { homeGoals: number; awayGoals: number };

/** What splits a tie: the competition's tie-breaking (tieBreaks.ts), whether the season is over,
 *  and the matches with no result, still to come or never played, which hold back the
 *  head-to-head steps. */
export type PlTieBreaking<Club> = {
  competition: CompetitionTieBreaking;
  seasonOver: boolean;
  unplayed: readonly PlMatch<Club>[];
};

export type PlTableRow<Club> = {
  club: Club;
  /** 1 at the top; clubs the order can't split share one, and the next club's skips past them
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

/** The table: every club in `clubs`, a club with no results on nothing. A club listed twice, a
 *  match naming a club not in `clubs`, a club playing itself, or goals that aren't a whole number
 *  from 0 throws: each is the caller's bug. */
export function plTable<Club>(
  clubs: readonly Club[],
  results: readonly PlResult<Club>[],
  { competition, seasonOver, unplayed }: PlTieBreaking<Club>,
): PlTableRow<Club>[] {
  const rows = new Map(clubs.map((club) => [club, emptyRow(club)]));
  if (rows.size !== clubs.length) throw new Error(`A club is listed twice in ${clubs.map(String).join(", ")}`);
  const rowOf = (club: Club) => {
    const row = rows.get(club);
    if (row === undefined) throw new Error(`A match names ${String(club)}, which isn't one of the clubs`);
    return row;
  };
  for (const result of results) {
    throwIfUncountable(result);
    addResult(rowOf(result.home), result.homeGoals, result.awayGoals);
    addResult(rowOf(result.away), result.awayGoals, result.homeGoals);
  }
  for (const match of unplayed) {
    throwIfPlayingItself(match);
    rowOf(match.home);
    rowOf(match.away);
  }
  const levelGroups = groupedBy([...rows.values()], (row) => row.points).flatMap((level) =>
    brokenTies(level, competition.order, {
      results,
      unplayed,
      headToHeadDue: competition.headToHead === "allSeason" || seasonOver,
    }),
  );
  let position = 1;
  return levelGroups.flatMap((group) => {
    const placed = group.map((row) => ({ ...row, position }));
    position += group.length;
    return placed;
  });
}

function throwIfPlayingItself<Club>({ home, away }: PlMatch<Club>): void {
  if (home === away) throw new Error(`A match has ${String(home)} playing itself`);
}

function throwIfUncountable<Club>(result: PlResult<Club>): void {
  throwIfPlayingItself(result);
  const { home, away, homeGoals, awayGoals } = result;
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

type Matches<Club> = { results: readonly PlResult<Club>[]; unplayed: readonly PlMatch<Club>[]; headToHeadDue: boolean };

/** Clubs level on points, split by the first tie-break, those still level by the next, and so on:
 *  each group returned is level on everything applied. A head-to-head step not yet due, or with a
 *  match between the clubs level unplayed, is skipped, and the next step applies. */
function brokenTies<Club>(level: Row<Club>[], tieBreaks: readonly CompetitionTieBreak[], matches: Matches<Club>): Row<Club>[][] {
  const [first, ...rest] = tieBreaks;
  if (level.length < 2 || first === undefined) return [level];
  if (HEAD_TO_HEAD_TIE_BREAKS.has(first) && (!matches.headToHeadDue || between(level, matches.unplayed).length > 0)) {
    return brokenTies(level, rest, matches);
  }
  return groupedBy(level, tieBreakKey(first, level, matches.results)).flatMap((stillLevel) =>
    brokenTies(stillLevel, rest, matches),
  );
}

/** What a tie-break ranks by, higher first. The head-to-head steps count only the matches between
 *  the clubs level at that step, however many there are (C.17.1 counts "the relevant Clubs"). */
function tieBreakKey<Club>(
  tieBreak: CompetitionTieBreak,
  level: readonly Row<Club>[],
  results: readonly PlResult<Club>[],
): (row: Row<Club>) => number {
  switch (tieBreak) {
    case "goalDifference":
      return (row) => row.goalDifference;
    case "goalsScored":
      return (row) => row.goalsFor;
    case "headToHeadPoints": {
      const among = between(level, results);
      return (row) =>
        among.reduce((sum, { home, away, homeGoals, awayGoals }) => {
          if (home === row.club) return sum + matchPoints(homeGoals, awayGoals);
          if (away === row.club) return sum + matchPoints(awayGoals, homeGoals);
          return sum;
        }, 0);
    }
    case "headToHeadAwayGoals": {
      const among = between(level, results);
      return (row) => among.reduce((sum, { away, awayGoals }) => (away === row.club ? sum + awayGoals : sum), 0);
    }
  }
}

/** The matches between the clubs level. */
function between<Club, M extends PlMatch<Club>>(level: readonly Row<Club>[], matches: readonly M[]): M[] {
  const levelClubs = new Set(level.map((row) => row.club));
  return matches.filter(({ home, away }) => levelClubs.has(home) && levelClubs.has(away));
}
