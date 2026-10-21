import { LEAGUE_AVERAGE, type GameweekFixtures } from "./roundRobin";
import { inTenths } from "./scoringSet";

// The league's table (#33; spec/09, spec/03). A head-to-head table is a real football table: 3
// points for a win, 1 for a draw, none for a loss, equal scores a draw; teams level on points are
// told apart by the league's tie-breaks, in the league's order. A total-points table ranks by
// points for. It takes the teams' scores as given: nothing here reads where they come from.
// Pure: no I/O.

/** The standings' tie-breaks a league lists, in its own order (spec/03): a league's rule. */
export const TIE_BREAKS = ["pointsFor", "headToHead", "pointsAgainst"] as const;
export type TieBreak = (typeof TIE_BREAKS)[number];

/** A matchup's points: a real football table's (spec/09, 21 Oct 2026), the same in every league. */
export const MATCH_POINTS = { win: 3, draw: 1, loss: 0 } as const;

/** Each team's score in each gameweek scored so far: gameweek to team to points. A gameweek
 *  missing has no scores yet, and counts for nothing. */
export type GameweekScores<Team> = ReadonlyMap<number, ReadonlyMap<Team, number>>;

export type TableRow<Team> = {
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  /** Points for less points against: the table's goal difference. */
  difference: number;
  /** The table's points: from matchups head-to-head, the team's score in total points. */
  points: number;
};

type Meeting<Team> = { team: Team; opponent: Team; teamScore: number; opponentScore: number };

const emptyRow = <Team>(team: Team): TableRow<Team> => ({
  team,
  played: 0,
  won: 0,
  drawn: 0,
  lost: 0,
  pointsFor: 0,
  pointsAgainst: 0,
  difference: 0,
  points: 0,
});

/** The points a score earns against another. */
function matchPoints(score: number, against: number): number {
  if (score > against) return MATCH_POINTS.win;
  return score === against ? MATCH_POINTS.draw : MATCH_POINTS.loss;
}

function addResult<Team>(row: TableRow<Team>, score: number, against: number): void {
  const earned = matchPoints(score, against);
  row.played += 1;
  if (earned === MATCH_POINTS.win) row.won += 1;
  else if (earned === MATCH_POINTS.draw) row.drawn += 1;
  else row.lost += 1;
  row.points += earned;
  row.pointsFor = inTenths(row.pointsFor + score);
  row.pointsAgainst = inTenths(row.pointsAgainst + against);
  row.difference = inTenths(row.pointsFor - row.pointsAgainst);
}

/** A team's score in a gameweek scored; one missing from it is the caller's bug. */
function scoreIn<Team>(scores: ReadonlyMap<Team, number>, team: Team, gameweek: number): number {
  const score = scores.get(team);
  if (score === undefined) throw new Error(`Gameweek ${gameweek} has scores, but none for ${String(team)}`);
  return inTenths(score);
}

/** The league's average score in a gameweek, every team's counted once, kept in tenths as points
 *  are. A team has one score a gameweek however many games it plays: each game counts that score. */
function averageOf<Team>(teams: readonly Team[], scores: ReadonlyMap<Team, number>, gameweek: number): number {
  const total = teams.reduce((sum, team) => sum + scoreIn(scores, team, gameweek), 0);
  return inTenths(total / teams.length);
}

/** The head-to-head table: each fixture of a gameweek scored counts once for each team in it; the
 *  team left over plays the league's average, or, on a bye, nothing. */
export function headToHeadTable<Team>(
  teams: readonly Team[],
  schedule: readonly GameweekFixtures<Team>[],
  scores: GameweekScores<Team>,
  tieBreaks: readonly TieBreak[],
): TableRow<Team>[] {
  const rows = new Map(teams.map((team) => [team, emptyRow(team)]));
  const rowOf = (team: Team) => {
    const row = rows.get(team);
    if (row === undefined) throw new Error(`${String(team)} has a fixture but isn't one of the league's teams`);
    return row;
  };
  const meetings: Meeting<Team>[] = [];
  for (const { gameweek, fixtures } of schedule) {
    const scored = scores.get(gameweek);
    if (scored === undefined) continue;
    for (const { team, opponent } of fixtures) {
      const teamScore = scoreIn(scored, team, gameweek);
      if (opponent === LEAGUE_AVERAGE) {
        addResult(rowOf(team), teamScore, averageOf(teams, scored, gameweek));
        continue;
      }
      const opponentScore = scoreIn(scored, opponent, gameweek);
      addResult(rowOf(team), teamScore, opponentScore);
      addResult(rowOf(opponent), opponentScore, teamScore);
      meetings.push({ team, opponent, teamScore, opponentScore });
    }
  }
  const byPoints = groupedBy([...rows.values()], (row) => row.points);
  return byPoints.flatMap((level) => brokenTies(level, tieBreaks, meetings));
}

/** The total-points table: each team's points for, over the gameweeks scored, highest first. */
export function totalPointsTable<Team>(teams: readonly Team[], scores: GameweekScores<Team>): TableRow<Team>[] {
  const rows = teams.map((team) => {
    const row = emptyRow(team);
    for (const [gameweek, scored] of scores) {
      row.played += 1;
      row.pointsFor = inTenths(row.pointsFor + scoreIn(scored, team, gameweek));
    }
    row.difference = row.pointsFor; // nobody scores against a team in total points
    row.points = row.pointsFor;
    return row;
  });
  return groupedBy(rows, (row) => row.points).flat();
}

/** Rows grouped by a key, highest first, each group in the rows' own order. */
function groupedBy<Row>(rows: readonly Row[], key: (row: Row) => number): Row[][] {
  const groups = new Map<number, Row[]>();
  for (const row of rows) {
    const group = groups.get(key(row));
    if (group === undefined) groups.set(key(row), [row]);
    else group.push(row);
  }
  return [...groups.entries()].toSorted(([one], [other]) => other - one).map(([, group]) => group);
}

/** Teams level on points, ordered by the first tie-break, those still level by the next, and so
 *  on; any still level after the last stay in the order they were made. */
function brokenTies<Team>(
  level: TableRow<Team>[],
  tieBreaks: readonly TieBreak[],
  meetings: readonly Meeting<Team>[],
): TableRow<Team>[] {
  const [first, ...rest] = tieBreaks;
  if (level.length < 2 || first === undefined) return level;
  const key = tieBreakKey(first, level, meetings);
  return groupedBy(level, key).flatMap((stillLevel) => brokenTies(stillLevel, rest, meetings));
}

/** What a tie-break ranks by, higher first: the most points for, the fewest points against, or
 *  the most points in the matchups between the teams level. */
function tieBreakKey<Team>(
  tieBreak: TieBreak,
  level: readonly TableRow<Team>[],
  meetings: readonly Meeting<Team>[],
): (row: TableRow<Team>) => number {
  switch (tieBreak) {
    case "pointsFor":
      return (row) => row.pointsFor;
    case "pointsAgainst":
      return (row) => -row.pointsAgainst;
    case "headToHead": {
      const levelTeams = new Set(level.map((row) => row.team));
      const among = meetings.filter(({ team, opponent }) => levelTeams.has(team) && levelTeams.has(opponent));
      return (row) =>
        among.reduce((sum, meeting) => {
          if (meeting.team === row.team) return sum + matchPoints(meeting.teamScore, meeting.opponentScore);
          if (meeting.opponent === row.team) return sum + matchPoints(meeting.opponentScore, meeting.teamScore);
          return sum;
        }, 0);
    }
  }
}
