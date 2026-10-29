import { expect, test, vi } from "vitest";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { scoreMatch } from "../../../convex/scoring/scoring";
import { inTenths } from "../../../convex/scoring/scoringSet";
import { MATCHUP_POINTS } from "../../../convex/table/standings";
import { HOUR_MS, MINUTE_MS } from "../../../convex/shared/time";
import { recordedGw6 } from "../../support/recorded/gw6.payloads";
import { EVERTON_POINTS, HULL_POINTS } from "../../support/convex/gameweekScores.harness";
import { FULL_TIME_READ, GAMEWEEK, heldMatch, HULL_EVERTON } from "../../support/convex/matchStats.harness";
import { elapse } from "../../support/convex/test.harness";
import { REPLAY_MINUTES, stagedGw6, stageTime } from "../../support/convex/liveStats.harness";
import {
  ANN,
  BOB,
  DEADLINE,
  ELEVENS,
  footballSyncAt,
  leagueWorld,
  liveTickAt,
  miniBetaLeague,
  tableOf,
  type MiniBeta,
} from "../../support/convex/miniBeta.harness";

// The mini beta closes "when the four-team league plays a real gameweek end to end" (#36): "a quick
// league of about four, with players assigned to teams rather than drafted" (SPEC.md). Here it does,
// through the entry points the app and the crons call: the league made, four squads assigned, four
// lineups saved, the deadline passed by the football sync, gameweek 6 replayed through the live
// tick minute by minute to full time, the match locked an hour after (S07.2), and the scores
// stored. "Points move live during matches, provisional until final" (spec/07).

/** A minute well into the first half, before Hull's goal at 64 minutes. */
const FIRST_HALF = 30;
/** Just short of the correction window: S07.2's hour after full time. */
const WINDOW_LESS_A_MINUTE = HOUR_MS - MINUTE_MS;

/** Gameweek 6's points by team, as the table gives them. */
async function gameweekPoints(league: MiniBeta) {
  const table = await tableOf(league);
  return table!.results.find((result) => result.gameweek === GAMEWEEK)?.teams ?? [];
}

/** Each manager's points worked out here, man by man, from the match's held records: each starter
 *  priced at his cell. A lent man has no record, his club having no match held, so adds nothing. */
async function expectedPoints(league: MiniBeta): Promise<Map<string, number>> {
  const { records } = await heldMatch(league.t);
  const points = (eleven: (typeof ELEVENS)[string]) =>
    eleven.reduce((sum, { playerCode, area, lane }) => {
      const record = records.get(playerCode);
      return record === undefined ? sum : sum + scoreMatch(record.stats, FIRST_SCORING, { area, lane }).total!;
    }, 0);
  return new Map(Object.entries(ELEVENS).map(([email, eleven]) => [email, inTenths(points(eleven))]));
}

test("the four-team league plays gameweek 6 end to end: live, provisional, then locked and stored (S07.2)", async () => {
  const world = (payloads = recordedGw6()) => leagueWorld(payloads);
  const beforeKickoff = () => leagueWorld(recordedGw6(), { beforeKickoff: true });
  const league = await miniBetaLeague(beforeKickoff());
  const { t, teams } = league;
  const emailOf = new Map([...teams].map(([email, teamId]) => [teamId, email]));
  expect(league.savedFrom).toEqual([GAMEWEEK, GAMEWEEK, GAMEWEEK, GAMEWEEK]);

  // The deadline passes, and the football sync's next run records it and fixes the fixtures.
  const passed = await footballSyncAt(t, DEADLINE + MINUTE_MS, beforeKickoff());
  expect(passed.outcome.ok).toBe(true);
  const recorded = await t.run((ctx) => ctx.db.query("passedDeadlines").collect());
  expect(recorded.map(({ gameweek, deadline }) => ({ gameweek, deadline }))).toEqual([{ gameweek: GAMEWEEK, deadline: DEADLINE }]);
  const begun = (await tableOf(league))!;
  const idOf = new Map(begun.table.map((row) => [row.teamName, row.teamId]));
  // Four teams, one game each: two head-to-heads, each team in one.
  const games = begun.gameweeks.find((each) => each.gameweek === GAMEWEEK)!.fixtures.map((each) => [each.teamId, idOf.get(each.opponent!)!]);
  expect(games).toHaveLength(2);
  expect(new Set(games.flat())).toEqual(new Set(teams.values()));
  const opponentOf = new Map(games.flatMap(([team, opponent]) => [[team, opponent], [opponent, team]]));
  const begunPoints = await gameweekPoints(league);
  expect(begunPoints).toHaveLength(teams.size);
  expect(begunPoints.every((team) => team.provisional)).toBe(true);

  // The match is played: each tick moves the points, and they stay provisional.
  const pointsAt = new Map<number, Map<string, number>>();
  for (const minute of [FIRST_HALF, REPLAY_MINUTES]) {
    const tick = await liveTickAt(t, stageTime(minute), world(stagedGw6(minute)));
    expect(tick.outcome).toMatchObject({ ok: true, matches: [{ fixtureCode: HULL_EVERTON, ok: true, state: "provisional" }] });
    const live = await gameweekPoints(league);
    expect(live.every((team) => team.provisional)).toBe(true);
    pointsAt.set(minute, new Map(live.map((team) => [emailOf.get(team.teamId)!, team.points])));
  }
  // Hull's goal at 64 minutes counts for Ann before full time.
  expect(pointsAt.get(REPLAY_MINUTES)!.get(ANN)).toBeGreaterThan(pointsAt.get(FIRST_HALF)!.get(ANN)!);

  // Full time: every man's record whole, the match complete, its points still open an hour.
  const fullTime = await liveTickAt(t, FULL_TIME_READ, world());
  expect(fullTime.outcome).toMatchObject({ ok: true, matches: [{ fixtureCode: HULL_EVERTON, ok: true, state: "complete" }] });
  const expected = await expectedPoints(league);
  expect(expected.get(ANN)).toBe(HULL_POINTS);
  expect(expected.get(BOB)).toBe(EVERTON_POINTS);
  const atFullTime = await gameweekPoints(league);
  expect(new Map(atFullTime.map((team) => [emailOf.get(team.teamId)!, team.points]))).toEqual(expected);
  expect(atFullTime.every((team) => team.provisional)).toBe(true);

  await elapse(t, WINDOW_LESS_A_MINUTE);
  expect((await heldMatch(t)).status?.state).toBe("complete");
  expect(await t.run((ctx) => ctx.db.query("finalScores").collect())).toEqual([]);

  // The hour is up: the match locks, and the lock stores each team's final score.
  await elapse(t, MINUTE_MS);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect((await heldMatch(t)).status?.state).toBe("locked");
  const stored = await t.run((ctx) => ctx.db.query("finalScores").collect());
  expect(new Map(stored.map((row) => [emailOf.get(row.teamId)!, row.points]))).toEqual(expected);
  expect(stored.every((row) => row.gameweek === GAMEWEEK && !row.noLineup)).toBe(true);

  const table = (await tableOf(league))!;
  const final = table.results.find((result) => result.gameweek === GAMEWEEK)!.teams;
  expect(new Map(final.map((team) => [emailOf.get(team.teamId)!, team.points]))).toEqual(expected);
  expect(final.every((team) => !team.provisional)).toBe(true);

  // The table: one game each, won, drawn or lost on the points worked out above.
  const rowFor = (teamId: (typeof games)[number][number]) => {
    const pointsFor = expected.get(emailOf.get(teamId)!)!;
    const pointsAgainst = expected.get(emailOf.get(opponentOf.get(teamId)!)!)!;
    const result = pointsFor > pointsAgainst ? "won" : pointsFor === pointsAgainst ? "drawn" : "lost";
    return {
      teamId,
      played: 1,
      won: result === "won" ? 1 : 0,
      drawn: result === "drawn" ? 1 : 0,
      lost: result === "lost" ? 1 : 0,
      pointsFor,
      pointsAgainst,
      difference: inTenths(pointsFor - pointsAgainst),
      points: { won: MATCHUP_POINTS.win, drawn: MATCHUP_POINTS.draw, lost: MATCHUP_POINTS.loss }[result],
    };
  };
  const byTeam = (one: { teamId: string }, other: { teamId: string }) => one.teamId.localeCompare(other.teamId);
  expect(table.table.map(({ teamName: _name, ...row }) => row).sort(byTeam)).toEqual([...teams.values()].map(rowFor).sort(byTeam));
});
