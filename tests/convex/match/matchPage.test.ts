import { expect, test } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import type { MatchMan } from "../../../convex/match/matchPage";
import {
  ANN,
  BOB,
  EVERTON_BENCH,
  EVERTON_STARTERS,
  fullTimeRecords,
  HULL_BENCH,
  HULL_KEEPER,
  HULL_SCORER,
  HULL_STARTERS,
  KICKOFF,
  PHILLIPS,
  scoresLeague,
  holdTypoRule,
  type ScoresLeague,
} from "../../support/convex/gameweekScores.harness";
import { actingAs } from "../../support/convex/leagues.harness";
import { EVERTON, HULL, HULL_EVERTON, HULL_EVERTON_TEAM_STATS, mergedHullEverton } from "../../support/convex/matchStats.harness";
import { silenceConsoleError } from "../../support/convex/test.harness";

// The match page (#45; spec/10, The match page): Hull v Everton, Ann owning Hull's men and Bob
// Everton's, each with a saved lineup. The page shows the score, both clubs' men, each owned man's
// team and his points from his slot, as the matchup has them, and the match's commentary priced.

/** The scores league, with both clubs held, as the football sync holds them. */
async function matchLeague(): Promise<ScoresLeague> {
  const league = await scoresLeague();
  await league.t.run(async (ctx) => {
    await ctx.db.insert("clubs", { code: HULL, name: "Hull City", shortName: "HUL" });
    await ctx.db.insert("clubs", { code: EVERTON, name: "Everton", shortName: "EVE" });
  });
  return league;
}

async function matchAs(league: ScoresLeague, email: string, fixtureCode: number = HULL_EVERTON) {
  return (await actingAs(league.t, email)).query(api.match.matchPage.ofMatch, { leagueId: league.leagueId, fixtureCode });
}

async function annsMatchup(league: ScoresLeague) {
  const read = await (await actingAs(league.t, ANN)).query(api.matchup.matchup.ofTeam, { leagueId: league.leagueId, now: Date.now() });
  if (read?.kind !== "headToHead" || read.game.kind !== "scored") throw new Error(`Ann's matchup isn't scored: ${JSON.stringify(read)}`);
  return read.game;
}

const manOf = (men: readonly MatchMan[], playerCode: number) => men.find((man) => man.playerCode === playerCode)!;

test("before any record, the match shows its clubs and kickoff, no men and no lines", async () => {
  const league = await matchLeague();
  const page = await matchAs(league, ANN);
  expect(page).toMatchObject({ fixtureCode: HULL_EVERTON, kickoff: KICKOFF, score: null, men: [], pointsProblem: null, teamStats: null });
  expect(page!.commentary).toEqual({ kind: "read", lines: [], delayed: false });
  expect([page!.home.shortName, page!.away.shortName]).toEqual(["HUL", "EVE"]);
});

test("at full time each club's men show, starters first, each owned man with his team and the points the matchup gives his slot", async () => {
  const league = await matchLeague();
  await fullTimeRecords(league);
  await league.t.mutation(internal.football.matchScores.upsertScores, {
    feed: "pl",
    readAt: Date.now(),
    reads: [{ fixtureCode: HULL_EVERTON, state: "fullTime", homeGoals: 1, awayGoals: 2, minutes: 90, clockLabel: null }],
  });
  const page = (await matchAs(league, BOB))!;
  expect(page.score).toEqual({ state: "fullTime", homeGoals: 1, awayGoals: 2, minutes: 90, clockLabel: null });

  const home = page.men.filter((man) => man.side === "home");
  const hullMen = new Set([...HULL_STARTERS.map((each) => each.playerCode), ...HULL_BENCH]);
  const hullStarters = mergedHullEverton().filter((record) => record.started && hullMen.has(record.playerCode));
  // Home's starters as the sheet named them, then its substitutes; then away's.
  expect(home.filter((man) => man.started).map((man) => man.playerCode).toSorted()).toEqual(hullStarters.map((record) => record.playerCode).toSorted());
  expect(home.findIndex((man) => !man.started)).toBe(hullStarters.length);
  expect(page.men.findIndex((man) => man.side === "away")).toBe(hullMen.size);
  // Starters by position, the keeper first.
  expect(home[0].position).toBe("GK");

  const matchup = await annsMatchup(league);
  const slots = [...matchup.team.kind === "team" ? matchup.team.lineup!.starters : [], ...matchup.team.kind === "team" ? matchup.team.lineup!.bench : []];
  for (const slot of slots) {
    expect(manOf(page.men, slot.playerCode)).toMatchObject({ ownerTeamName: "Team 1", points: slot.points, counts: slot.counts });
  }
  expect(manOf(page.men, HULL_SCORER).points).not.toBeNull();
  // Phillips, in goal in Ann's lineup, was Hull's unused substitute, so the auto-subs took him off:
  // greyed. Hull's keeper came on for him.
  expect(manOf(page.men, PHILLIPS)).toMatchObject({ started: false, played: false, counts: false });
  expect(manOf(page.men, HULL_KEEPER)).toMatchObject({ started: true, played: true, counts: true });
  expect(manOf(page.men, EVERTON_STARTERS[0].playerCode)).toMatchObject({ side: "away", ownerTeamName: "Team 2" });
});

test("a man owned by no team shows no owner and no points; a man who has left both clubs has no side", async () => {
  const league = await matchLeague();
  await fullTimeRecords(league);
  const freeAgent = HULL_BENCH[1];
  const moved = HULL_BENCH[2];
  await league.t.run(async (ctx) => {
    const owned = (await ctx.db.query("squadPlayers").collect()).find((row) => row.playerCode === freeAgent)!;
    await ctx.db.delete("squadPlayers", owned._id);
    const player = (await ctx.db.query("players").withIndex("by_code", (q) => q.eq("code", moved)).unique())!;
    await ctx.db.patch("players", player._id, { clubCode: 999 });
  });
  const page = (await matchAs(league, ANN))!;
  expect(manOf(page.men, freeAgent)).toMatchObject({ ownerTeamName: null, points: null, counts: true });
  expect(manOf(page.men, moved).side).toBeNull();
  expect(page.men.at(-1)!.playerCode).toBe(moved);
});

test("the commentary is the match's lines newest first, the goal priced for its owner's slot, and says when delayed", async () => {
  const league = await matchLeague();
  await fullTimeRecords(league);
  const line = (sourceId: number, text: string, minute: number | null, type: string, playerCodes: number[] = []) => ({ sourceId, text, minute, addedMinute: 0, type, playerCodes });
  await league.t.run((ctx) =>
    ctx.db.insert("matchCommentary", {
      fixtureCode: HULL_EVERTON,
      lines: [line(2, "64' GOAL Scorer", 64, "goal", [HULL_SCORER]), line(1, "KO HUL v EVE", 0, "start")],
      delayed: { reason: "the stream is over 10 minutes behind the clock", since: KICKOFF },
    }),
  );
  const page = (await matchAs(league, ANN))!;
  const matchup = await annsMatchup(league);
  if (matchup.commentary.kind !== "read") throw new Error("the matchup's commentary wasn't read");
  // The same lines, priced alike, as the matchup's.
  expect(page.commentary).toEqual({ kind: "read", lines: matchup.commentary.lines, delayed: true });
  expect(page.commentary.kind === "read" && page.commentary.lines[0].points).toMatch(/^\+/);
});

test("the five team stats show each side's, home and away, as the live poller last stored them", async () => {
  const league = await matchLeague();
  await league.t.mutation(internal.football.matchTeamStats.store, { fixtureCode: HULL_EVERTON, ...HULL_EVERTON_TEAM_STATS });
  expect((await matchAs(league, BOB))!.teamStats).toEqual(HULL_EVERTON_TEAM_STATS);
});

test("before the league's gameweek begins, the men show their owners but no points, and the lines are unpriced", async () => {
  const league = await matchLeague();
  await fullTimeRecords(league);
  await league.t.run(async (ctx) => {
    for (const row of await ctx.db.query("passedDeadlines").collect()) await ctx.db.delete("passedDeadlines", row._id);
    await ctx.db.insert("matchCommentary", { fixtureCode: HULL_EVERTON, lines: [{ sourceId: 1, text: "64' GOAL Scorer", minute: 64, addedMinute: 0, type: "goal", playerCodes: [HULL_SCORER] }], delayed: null });
  });
  const page = (await matchAs(league, ANN))!;
  expect(manOf(page.men, HULL_SCORER)).toMatchObject({ ownerTeamName: "Team 1", points: null });
  expect(page.commentary).toEqual({ kind: "read", lines: [{ key: `${HULL_EVERTON}:1`, text: "64' GOAL Scorer", points: null }], delayed: false });
});

test("a set that can't be priced says why, while the men and lines still show", async () => {
  const league = await matchLeague();
  await fullTimeRecords(league);
  await holdTypoRule(league);
  silenceConsoleError();
  const page = (await matchAs(league, ANN))!;
  expect(page.pointsProblem).toEqual(expect.any(String));
  expect(page.men.every((man) => man.points === null)).toBe(true);
  expect(page.men).toHaveLength(HULL_STARTERS.length + HULL_BENCH.length + EVERTON_STARTERS.length + EVERTON_BENCH.length);
});

test("a match nobody holds is null, and someone outside the league is refused", async () => {
  const league = await matchLeague();
  expect(await matchAs(league, ANN, 1)).toBeNull();
  await expect(matchAs(league, "stranger@example.com")).rejects.toThrow();
});
