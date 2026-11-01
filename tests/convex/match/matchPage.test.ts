import { expect, test } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import { bySheetOrder } from "../../../convex/match/sheetOrder";
import { refusals } from "../../../convex/shared/leagueAccess";
import {
  ANN,
  ANNS_TEAM,
  annsScoredGame,
  BOB,
  BOBS_TEAM,
  EVERTON_BENCH,
  EVERTON_STARTERS,
  HULL_BENCH,
  HULL_KEEPER,
  HULL_SCORER,
  HULL_STARTERS,
  LEAGUE_KICKOFF,
  PHILLIPS,
  type ScoresLeague,
} from "../../support/convex/gameweekScores.harness";
import { fullTimeRecords, scoreRead } from "../../support/convex/gameweekScoresMatch.harness";
import { adjustScorersRole, MIDFIELD_GOAL, holdTypoRule } from "../../support/convex/gameweekScoresFixes.harness";
import { ADMIN, OUTSIDER, actingAs } from "../../support/convex/leagues.harness";
import { holdLines, manOf, matchAs, matchLeague, notYetBegun, scorerFreeLeague, storedLine, STREAM_BEHIND_SINCE_KICKOFF } from "../../support/convex/matchPage.harness";
import { HULL_EVERTON, HULL_EVERTON_TEAM_STATS, mergedHullEverton } from "../../support/convex/matchStats.harness";
import { expectRefused, silenceConsoleError } from "../../support/convex/test.harness";

// The match page (#45; spec/10, The match page): Hull v Everton, Ann owning Hull's men and Bob
// Everton's, each with a saved lineup. The page shows the score, both clubs' men, each owned man's
// team and his points from his slot, as the matchup has them, and the match's commentary priced. A
// man in no lineup is unownedPoints.test.ts's.

/** Hull's scorer's goal, as the live tick stores its line. */
const SCORERS_GOAL = "64' GOAL Scorer";
const scorersGoal = (sourceId: number) => storedLine(sourceId, SCORERS_GOAL, 64, "goal", [HULL_SCORER]);
/** The match's commentary as just scorersGoal(1). */
const holdScorersGoal = (league: ScoresLeague) => holdLines(league, [scorersGoal(1)]);
/** scorersGoal(1) as the commentary shows it, worth `points`. */
const shownGoal = (points: string | null) => ({ key: `${HULL_EVERTON}:1`, text: SCORERS_GOAL, points });

test("before any record, the match shows its clubs and kickoff, no men and no lines", async () => {
  const league = await matchLeague();
  const page = await matchAs(league, ANN);
  expect(page).toMatchObject({ fixtureCode: HULL_EVERTON, kickoff: LEAGUE_KICKOFF, score: null, men: [], pointsProblem: null, teamStats: null });
  expect(page!.commentary).toEqual({ kind: "read", lines: [], delayed: false });
  expect([page!.home.shortName, page!.away.shortName]).toEqual(["HUL", "EVE"]);
});

test("at full time each club's men show, starters first, each owned man with his team and the points the matchup gives his slot", async () => {
  const league = await matchLeague();
  await fullTimeRecords(league);
  await scoreRead(league, "fullTime", 90);
  const page = (await matchAs(league, BOB))!;
  expect(page.score).toEqual({ state: "fullTime", homeGoals: 1, awayGoals: 2, minutes: 90, clockLabel: null });

  const home = page.men.filter((man) => man.side === "home");
  const hullMen = new Set([...HULL_STARTERS.map((each) => each.playerCode), ...HULL_BENCH]);
  const hullStarters = mergedHullEverton().filter((record) => record.started && hullMen.has(record.playerCode));
  // Home's starters as the sheet named them, then its substitutes; then away's.
  expect(home.filter((man) => man.started).map((man) => man.playerCode).toSorted()).toEqual(hullStarters.map((record) => record.playerCode).toSorted());
  expect(home.findIndex((man) => !man.started)).toBe(hullStarters.length);
  expect(page.men.findIndex((man) => man.side === "away")).toBe(hullMen.size);
  // Starters by position, the keeper first, in the match page's one order (the preview's too).
  expect(home[0].position).toBe("GK");
  expect(page.men).toEqual(page.men.toSorted(bySheetOrder));

  const matchup = await annsScoredGame(league);
  const slots = [...matchup.team.kind === "team" ? matchup.team.lineup!.starters : [], ...matchup.team.kind === "team" ? matchup.team.lineup!.bench : []];
  for (const slot of slots) {
    expect(manOf(page.men, slot.playerCode)).toMatchObject({ ownerTeamName: ANNS_TEAM, points: slot.points, counts: slot.counts });
  }
  expect(manOf(page.men, HULL_SCORER).points).not.toBeNull();
  // Phillips, in goal in Ann's lineup, was Hull's unused substitute, so the auto-subs took him off:
  // greyed. Hull's keeper came on for him.
  expect(manOf(page.men, PHILLIPS)).toMatchObject({ started: false, played: false, counts: false });
  expect(manOf(page.men, HULL_KEEPER)).toMatchObject({ started: true, played: true, counts: true });
  expect(manOf(page.men, EVERTON_STARTERS[0].playerCode)).toMatchObject({ side: "away", ownerTeamName: BOBS_TEAM });
});

// "Yes show the old team as for the current games he's on that team" (Craig, 31 Oct 2026; #561).
test("a man moved to another team after the deadline names his old team beside the points its locked lineup scores him, which don't move", async () => {
  const league = await matchLeague();
  await fullTimeRecords(league);
  await holdScorersGoal(league);
  const before = (await matchAs(league, ANN))!;
  await (await actingAs(league.t, ADMIN)).mutation(api.squads.squads.move, { leagueId: league.leagueId, playerCode: HULL_SCORER, teamId: league.bobsTeam });
  const page = (await matchAs(league, ANN))!;
  const matchup = await annsScoredGame(league);
  const slot = matchup.team.kind === "team" ? matchup.team.lineup!.starters.find((starter) => starter.playerCode === HULL_SCORER) : undefined;
  expect(slot?.points).toEqual(expect.any(Number));
  // He scores for Ann's lineup, locked at the deadline, so Ann's team is named, though Bob owns him now.
  expect(manOf(page.men, HULL_SCORER)).toMatchObject({ ownerTeamName: ANNS_TEAM, points: slot!.points, counts: slot!.counts });
  // Only the name was in question: every man's points, and his goal's, are as before the move.
  expect(before.commentary).toEqual({ kind: "read", lines: [shownGoal(expect.stringMatching(/^\+/))], delayed: false });
  expect(page.men).toEqual(before.men);
  expect(page.commentary).toEqual(before.commentary);
});

test("a man released after the deadline names the team that had him at the deadline beside the points its locked lineup scores him, which don't move", async () => {
  const league = await matchLeague();
  await fullTimeRecords(league);
  await holdScorersGoal(league);
  const before = (await matchAs(league, ANN))!;
  await (await actingAs(league.t, ADMIN)).mutation(api.squads.squads.release, { leagueId: league.leagueId, playerCode: HULL_SCORER });
  expect(manOf(before.men, HULL_SCORER).points).toEqual(expect.any(Number));
  expect(before.commentary).toEqual({ kind: "read", lines: [shownGoal(expect.stringMatching(/^\+/))], delayed: false });
  const page = (await matchAs(league, ANN))!;
  expect(manOf(page.men, HULL_SCORER)).toMatchObject({ ownerTeamName: ANNS_TEAM });
  expect(page.men).toEqual(before.men);
  expect(page.commentary).toEqual(before.commentary);
});

test("before the league's gameweek begins, a man moved shows the team that owns him now, as his lineup isn't locked", async () => {
  const league = await matchLeague();
  await fullTimeRecords(league);
  await notYetBegun(league);
  await (await actingAs(league.t, ADMIN)).mutation(api.squads.squads.move, { leagueId: league.leagueId, playerCode: HULL_SCORER, teamId: league.bobsTeam });
  expect(manOf((await matchAs(league, ANN))!.men, HULL_SCORER)).toMatchObject({ ownerTeamName: BOBS_TEAM, points: null });
});

test("before kickoff, the men the team sheets name show as the sheets have them, each owned man with his team, none yet played", async () => {
  const league = await matchLeague();
  const sheets = mergedHullEverton().map(({ playerCode, started }) => ({ playerCode, started }));
  await league.t.mutation(internal.football.matchTeamSheets.store, { fixtureCode: HULL_EVERTON, men: sheets });
  const page = (await matchAs(league, ANN))!;

  const byCode = (one: { playerCode: number }, other: { playerCode: number }) => one.playerCode - other.playerCode;
  expect(page.men.map(({ playerCode, started }) => ({ playerCode, started })).toSorted(byCode)).toEqual(sheets.toSorted(byCode));
  expect(page.men.every((man) => man.played === null)).toBe(true);
  expect(page.men[0]).toMatchObject({ side: "home", started: true, position: "GK" });
  expect(manOf(page.men, PHILLIPS)).toMatchObject({ side: "home", started: false, ownerTeamName: ANNS_TEAM });
  expect(manOf(page.men, EVERTON_STARTERS[0].playerCode)).toMatchObject({ side: "away", started: true, ownerTeamName: BOBS_TEAM });
});

test("once the match has records, they are its men, not the sheets", async () => {
  const league = await matchLeague();
  await league.t.mutation(internal.football.matchTeamSheets.store, { fixtureCode: HULL_EVERTON, men: [{ playerCode: PHILLIPS, started: true }] });
  await fullTimeRecords(league);
  const page = (await matchAs(league, ANN))!;
  expect(page.men).toHaveLength(mergedHullEverton().length);
  expect(manOf(page.men, PHILLIPS).started).toBe(false);
});

test("a man who has left both clubs has no side", async () => {
  const league = await matchLeague();
  await fullTimeRecords(league);
  const moved = HULL_BENCH[2];
  await league.t.run(async (ctx) => {
    const player = (await ctx.db.query("players").withIndex("by_code", (q) => q.eq("code", moved)).unique())!;
    await ctx.db.patch("players", player._id, { clubCode: 999 });
  });
  const page = (await matchAs(league, ANN))!;
  expect(manOf(page.men, moved).side).toBeNull();
  expect(page.men.at(-1)!.playerCode).toBe(moved);
});

test("the commentary is the match's lines newest first, the goal priced for its owner's slot, and says when delayed", async () => {
  const league = await matchLeague();
  await fullTimeRecords(league);
  await holdLines(league, [scorersGoal(2), storedLine(1, "KO HUL v EVE", 0, "start")], STREAM_BEHIND_SINCE_KICKOFF);
  const page = (await matchAs(league, ANN))!;
  const matchup = await annsScoredGame(league);
  if (matchup.commentary.kind !== "read") throw new Error("the matchup's commentary wasn't read");
  // The same lines, priced alike, as the matchup's.
  expect(page.commentary).toEqual({ kind: "read", lines: matchup.commentary.lines, delayed: true });
  expect(page.commentary.kind === "read" && page.commentary.lines[0].points).toMatch(/^\+/);
});

test("a goal's points include his role's adjustment, on the match page and the matchup alike, as his slot's do", async () => {
  const league = await matchLeague();
  await fullTimeRecords(league);
  const ROLE_GOAL = 2;
  await adjustScorersRole(league, ROLE_GOAL);
  await holdScorersGoal(league);
  // His goal in midfield, and his role's on top.
  const lines = [shownGoal(`+${MIDFIELD_GOAL + ROLE_GOAL}`)];
  expect((await matchAs(league, ANN))!.commentary).toEqual({ kind: "read", lines, delayed: false });
  expect((await annsScoredGame(league)).commentary).toEqual({ kind: "read", lines, delayed: false });
});

test("the five team stats show each side's, home and away, as the live poller last stored them", async () => {
  const league = await matchLeague();
  await league.t.mutation(internal.football.matchTeamStats.store, { fixtureCode: HULL_EVERTON, ...HULL_EVERTON_TEAM_STATS });
  expect((await matchAs(league, BOB))!.teamStats).toEqual(HULL_EVERTON_TEAM_STATS);
});

test("before the league's gameweek begins, the men show their owners but no points, and the lines are unpriced", async () => {
  const league = await matchLeague();
  await fullTimeRecords(league);
  await notYetBegun(league);
  await holdScorersGoal(league);
  const page = (await matchAs(league, ANN))!;
  expect(manOf(page.men, HULL_SCORER)).toMatchObject({ ownerTeamName: ANNS_TEAM, points: null });
  expect(page.commentary).toEqual({ kind: "read", lines: [shownGoal(null)], delayed: false });
});

test("a set that can't be priced says why, while the men and lines still show, every man's points, a free agent's too, unknown", async () => {
  const league = await scorerFreeLeague();
  await holdTypoRule(league);
  silenceConsoleError();
  const page = (await matchAs(league, ANN))!;
  expect(page.pointsProblem).toEqual(expect.any(String));
  expect(manOf(page.men, HULL_SCORER)).toMatchObject({ ownerTeamName: null, counts: false });
  expect(page.men.every((man) => man.points === null)).toBe(true);
  expect(page.men).toHaveLength(HULL_STARTERS.length + HULL_BENCH.length + EVERTON_STARTERS.length + EVERTON_BENCH.length);
});

test("a match nobody holds is null, and someone outside the league is refused", async () => {
  const league = await matchLeague();
  expect(await matchAs(league, ANN, 1)).toBeNull();
  await expectRefused(matchAs(league, OUTSIDER), refusals.notInLeague);
});
