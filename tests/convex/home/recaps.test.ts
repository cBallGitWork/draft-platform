import { expect, test } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import { benchPointsOf, performersOf, RECAP_TRIES_MOST } from "../../../convex/home/recaps";
import { RECAP_SYSTEM, recapPrompt, recapUpLetter } from "../../../convex/home/recapWords";
import { CLAUDE_RETRY_MS, WRITING_MODEL } from "../../../convex/outbound/claude";
import { HOUR_MS, MINUTE_MS, WEEK_MS } from "../../../convex/shared/time";
import { ANN, BOB, EVERTON_POINTS, GAMEWEEK, HULL_POINTS, LEAGUE_FULL_TIME_READ, scoresLeague, type ScoresLeague } from "../../support/convex/gameweekScores.harness";
import { fullTimeRecords, lockMatch, storeLeague, WRITTEN_OVER, writeOverAnns } from "../../support/convex/gameweekScoresMatch.harness";
import { actingAs, lettersTo } from "../../support/convex/leagues.harness";
import { leagueHomeOf } from "../../support/convex/screenReads.harness";
import { fakeClaude, fakeReport } from "../../support/convex/scouts.harness";
import { elapse, pendingJobs, silenceConsoleError } from "../../support/convex/test.harness";
import { teamNumbered } from "../../../convex/leagues/teams";

// League home's weekly recap (#387; spec/12, League home): once every match of the gameweek is
// final, Claude writes one recap for the league from facts only, Mail says it is up, and League
// home shows it until the next gameweek's first matchday mode begins. Written once, never again: a
// score changed since puts a line under it (Craig, 6 Nov 2026). Ann's Team 1 plays Bob's Team 2 in
// gameweek 6's one match.

/** The scores league, gameweek 6 locked and stored final, with Claude faked. */
async function finalLeague() {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  await lockMatch(league);
  const claude = fakeClaude();
  await storeLeague(league);
  await elapse(league.t, 0);
  return { league, claude };
}

const homeAt = async ({ t, leagueId }: ScoresLeague, now: number) => leagueHomeOf(await actingAs(t, ANN), leagueId, now);
const recapOf = async ({ t, leagueId }: ScoresLeague, gameweek = GAMEWEEK) => (await actingAs(t, BOB)).query(api.home.recaps.ofGameweek, { leagueId, gameweek });
const AFTER = LEAGUE_FULL_TIME_READ + 3 * HOUR_MS;

test("once the gameweek is final, Claude writes the recap from its facts, and Mail tells the whole league it is up", async () => {
  const { league, claude } = await finalLeague();

  expect(claude.asked).toHaveLength(1);
  const [{ model, system, messages }] = claude.asked;
  expect({ model, system }).toEqual({ model: WRITING_MODEL, system: RECAP_SYSTEM });
  const prompt = messages[0].content;
  expect(prompt).toContain(`Results:\nTeam 1 ${HULL_POINTS}, Team 2 ${EVERTON_POINTS}`);
  // Each team, most points first, with what it left on the bench.
  expect(prompt).toMatch(new RegExp(`Team 2: ${EVERTON_POINTS}, bench \\d+\nTeam 1: ${HULL_POINTS}, bench \\d+`));
  const section = (heading: string) => prompt.split(`${heading}, points for their team:\n`)[1].split("\n").slice(0, 3);
  expect(section("Top performers")).toHaveLength(3);
  expect(section("Letdowns")).toHaveLength(3);

  const recap = { gameweek: GAMEWEEK, text: fakeReport(prompt), changedTeamId: null };
  expect(await recapOf(league)).toMatchObject(recap);
  expect((await homeAt(league, AFTER))!.recap).toMatchObject(recap);
  for (const email of [ANN, BOB]) expect(await lettersTo(league.t, email)).toContainEqual(recapUpLetter(GAMEWEEK));
});

test("it is written once: the gameweek stored again writes no second recap", async () => {
  const { league, claude } = await finalLeague();
  await league.t.mutation(internal.table.finalScores.rescore, { leagueId: league.leagueId, gameweek: GAMEWEEK });
  await elapse(league.t, 0);

  expect(claude.asked).toHaveLength(1);
  const recaps = await league.t.run((ctx) => ctx.db.query("recaps").collect());
  expect(recaps).toHaveLength(1);
});

test("a gameweek stored final after a newer one gets no recap: only the newest is written and Mailed", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  await lockMatch(league);
  const claude = fakeClaude();
  // A later gameweek already stored final, as when a pass catches up on several.
  await league.t.run((ctx) =>
    ctx.db.insert("finalScores", { leagueId: league.leagueId, gameweek: GAMEWEEK + 1, teamId: league.annsTeam, points: 0, fixtureCodes: [], storedAt: 0 }),
  );
  await storeLeague(league);
  await elapse(league.t, 0);

  expect(claude.asked).toEqual([]);
  expect(await league.t.run((ctx) => ctx.db.query("recaps").collect())).toEqual([]);
});

test("a score changed after it is written leaves the recap as written, with a line naming that team's matchup", async () => {
  const { league } = await finalLeague();
  const before = await recapOf(league);
  await writeOverAnns(league);

  expect(WRITTEN_OVER).not.toBe(HULL_POINTS);
  expect(await recapOf(league)).toEqual({ ...before, changedTeamId: league.annsTeam });
  expect((await homeAt(league, AFTER))!.recap).toEqual({ ...before, changedTeamId: league.annsTeam });
});

test("League home shows it until the next gameweek's first matchday mode begins, 3 hours before its first kickoff", async () => {
  const { league } = await finalLeague();
  const nextKickoff = LEAGUE_FULL_TIME_READ + WEEK_MS;
  await league.t.run((ctx) => ctx.db.insert("fixtures", { code: 900_001, gameweek: GAMEWEEK + 1, homeClubCode: 1, awayClubCode: 2, kickoff: nextKickoff }));

  expect((await homeAt(league, nextKickoff - 3 * HOUR_MS - MINUTE_MS))!.recap).not.toBeNull();
  expect((await homeAt(league, nextKickoff - 3 * HOUR_MS))!.recap).toBeNull();
  // Read the recap still opens it.
  expect(await recapOf(league)).not.toBeNull();
});

test("before it is written there is none to show", async () => {
  const league = await scoresLeague();
  expect((await homeAt(league, AFTER))!.recap).toBeNull();
  expect(await recapOf(league)).toBeNull();
});

test("a failed write is logged and tried again later, up to a day's worth of tries; none lands, so nobody is told", async () => {
  const errors = silenceConsoleError();
  const league = await scoresLeague();
  await fullTimeRecords(league);
  await lockMatch(league);
  const claude = fakeClaude();
  claude.failing = true;
  await storeLeague(league);
  await elapse(league.t, 0);

  expect(errors).toHaveBeenCalledTimes(1);
  const [recap] = await league.t.run((ctx) => ctx.db.query("recaps").collect());
  expect(recap).toMatchObject({ state: "writing", failedTries: 1 });
  expect(await pendingJobs(league.t, internal.home.recaps.write)).toHaveLength(1);

  claude.failing = false;
  await elapse(league.t, CLAUDE_RETRY_MS);
  expect((await recapOf(league))?.text).toBe(fakeReport(claude.asked[1].messages[0].content));
});

test("past the most tries it stops trying", async () => {
  silenceConsoleError();
  const league = await scoresLeague();
  await fullTimeRecords(league);
  await lockMatch(league);
  fakeClaude().failing = true;
  await storeLeague(league);
  await elapse(league.t, 0);
  for (let tries = 1; tries < RECAP_TRIES_MOST; tries++) await elapse(league.t, CLAUDE_RETRY_MS);

  const [recap] = await league.t.run((ctx) => ctx.db.query("recaps").collect());
  expect(recap.failedTries).toBe(RECAP_TRIES_MOST);
  expect(await pendingJobs(league.t, internal.home.recaps.write)).toEqual([]);
});

test("the top performers are the three starters who scored most for their team; the letdowns the three who scored least of the rest", () => {
  const man = (player: string, points: number) => ({ player, team: teamNumbered(1), points });
  const starters = [man("A", 2), man("B", 12), man("C", 9), man("D", -1), man("E", 9), man("F", 6), man("G", 1)];
  expect(performersOf(starters)).toEqual({
    topPerformers: [man("B", 12), man("C", 9), man("E", 9)],
    letdowns: [man("D", -1), man("G", 1), man("A", 2)],
  });
  // With fewer than six, no man is both.
  expect(performersOf(starters.slice(0, 4))).toEqual({ topPerformers: [man("B", 12), man("C", 9), man("A", 2)], letdowns: [man("D", -1)] });
});

test("the bench is added up in tenths: 4.2 and 0.1 left on it give a brief line ending bench 4.3", () => {
  // A bench man who came on counts for the team, so isn't left on the bench; one with no points yet adds none.
  const bench = [{ counts: false, points: 4.2 }, { counts: true, points: 6 }, { counts: false, points: 0.1 }, { counts: false, points: null }];
  expect(benchPointsOf(bench)).toBe(4.3);
  expect(benchPointsOf([{ counts: false, points: 0.1 }, { counts: false, points: 0.2 }])).toBe(0.3);
  const prompt = recapPrompt({ gameweek: GAMEWEEK, results: [], teams: [{ team: "Team 1", points: 30, benchPoints: benchPointsOf(bench) }], topPerformers: [], letdowns: [] });
  expect(prompt.split("\n")).toContain("Team 1: 30, bench 4.3");
});
