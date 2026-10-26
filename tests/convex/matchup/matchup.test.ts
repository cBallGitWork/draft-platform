import { expect, test, vi } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { MatchupSide, MatchupSlot } from "../../../convex/matchup/matchupShape";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { inTenths } from "../../../convex/scoring/scoringSet";
import { DAY_MS, HOUR_MS } from "../../../convex/shared/time";
import {
  ANN,
  BOB,
  CAT,
  EVERTON_POINTS,
  EVERTON_STARTERS,
  fullTimeRecords,
  GAMEWEEK,
  HULL_AFTER_SUB,
  HULL_POINTS,
  HULL_KEEPER,
  HULL_SCORER,
  HULL_STARTERS,
  KICKOFF,
  liveRecords,
  lockMatch,
  PHILLIPS,
  scoresLeague,
  sideTotal,
  type ScoresLeague,
} from "../../support/convex/gameweekScores.harness";
import { actingAs, ADMIN, adminCreatesLeague } from "../../support/convex/leagues.harness";
import { HULL, HULL_EVERTON, mergedHullEverton } from "../../support/convex/matchStats.harness";
import { silenceConsoleError } from "../../support/convex/test.harness";

// The matchup (#34; spec/10, The matchup, as a live match): Hull v Everton replayed through one
// head-to-head, Ann fielding Hull and Bob Everton. Each player's status follows his match, points
// move as the records land, the auto-sub comes once the match is over, and the result is final
// once it locks: the table's own numbers (gameweekScores.test.ts pins them).

const RECORDS = mergedHullEverton();
/** An hour into the match, as the clock reads then. */
const LIVE_MINUTE = 60;
/** A club Hull meet again in a double gameweek: FPL's code for Arsenal. */
const ARSENAL = 3;

/** The match's score as a feed reads it: `state`, and the minute on its clock. */
async function scoreRead({ t }: ScoresLeague, state: "live" | "fullTime", minutes: number) {
  await t.mutation(internal.football.matchScores.upsertScores, {
    feed: "pl",
    readAt: Date.now(),
    reads: [{ fixtureCode: HULL_EVERTON, state, homeGoals: 1, awayGoals: 2, minutes, clockLabel: null }],
  });
}

async function matchupAs(league: ScoresLeague, email: string, args: { teamId?: Id<"teams">; gameweek?: number } = {}) {
  return (await actingAs(league.t, email)).query(api.matchup.matchup.ofTeam, { leagueId: league.leagueId, now: Date.now(), ...args });
}

/** The scored game Ann's matchup shows in gameweek 6. */
async function annsGame(league: ScoresLeague) {
  const read = await matchupAs(league, ANN, { gameweek: GAMEWEEK });
  if (read?.kind !== "headToHead" || read.game.kind !== "scored") throw new Error(`Ann's matchup isn't scored: ${JSON.stringify(read)}`);
  return read.game;
}

const lineupOf = (side: MatchupSide) => {
  if (side.kind !== "team" || side.lineup === null) throw new Error("the side has no lineup");
  return side.lineup;
};
const slotOf = (side: MatchupSide, playerCode: number): MatchupSlot =>
  [...lineupOf(side).starters, ...lineupOf(side).bench].find((slot) => slot.playerCode === playerCode)!;
const nameOf = (league: ScoresLeague, code: number) =>
  league.t.run(async (ctx) => (await ctx.db.query("players").withIndex("by_code", (q) => q.eq("code", code)).unique())!.name);

test("a replayed gameweek plays out on the matchup: yet to play, live with the minute, the auto-sub at full time, final once locked", async () => {
  const league = await scoresLeague();

  // Past the deadline, before kickoff: both lineups show, every man yet to play, nobody on points.
  const before = await annsGame(league);
  expect(lineupOf(before.team).starters.map((slot) => slot.playerCode)).toEqual(HULL_STARTERS.map((starter) => starter.playerCode));
  expect(lineupOf(before.opponent).starters.map((slot) => slot.playerCode)).toEqual(EVERTON_STARTERS.map((starter) => starter.playerCode));
  expect(slotOf(before.team, HULL_SCORER)).toMatchObject({ status: { kind: "yetToPlay", kickoff: KICKOFF }, points: null, counts: true });
  expect(before.team).toMatchObject({ points: 0, provisional: true });

  // An hour in, Hull's goal not yet scored: every man on with the clock's minute, the bench greyed,
  // and no auto-sub while the match is on.
  const beforeTheGoal = RECORDS.map((record) => (record.playerCode === HULL_SCORER ? { ...record, stats: { ...record.stats, goals_scored: 0 } } : record));
  await liveRecords(league, beforeTheGoal);
  await scoreRead(league, "live", LIVE_MINUTE);
  const live = await annsGame(league);
  expect(slotOf(live.team, HULL_SCORER).status).toEqual({ kind: "playing", minute: LIVE_MINUTE });
  expect(live.team).toMatchObject({ points: sideTotal(beforeTheGoal, HULL_STARTERS), provisional: true });
  expect(lineupOf(live.team).bench.every((slot) => !slot.counts)).toBe(true);
  expect(slotOf(live.team, PHILLIPS)).toMatchObject({ counts: true, autoSub: null });

  // Full time: finished, Hull's keeper on for Phillips, who didn't play, and the goal counted.
  await fullTimeRecords(league);
  await scoreRead(league, "fullTime", 90);
  const fullTime = await annsGame(league);
  expect(slotOf(fullTime.team, HULL_SCORER).status).toEqual({ kind: "finished" });
  expect(slotOf(fullTime.team, PHILLIPS)).toMatchObject({ counts: false, autoSub: { kind: "off", playerName: await nameOf(league, HULL_KEEPER) } });
  expect(slotOf(fullTime.team, HULL_KEEPER)).toMatchObject({ counts: true, area: "goalkeeper", autoSub: { kind: "on", playerName: await nameOf(league, PHILLIPS) } });
  expect(fullTime.team).toMatchObject({ points: HULL_POINTS, provisional: true });

  // Locked: the result is final, Everton's side the winner.
  await lockMatch(league);
  const final = await annsGame(league);
  expect(sideTotal(RECORDS, HULL_AFTER_SUB)).toBe(HULL_POINTS);
  expect(final.team).toMatchObject({ kind: "team", teamId: league.annsTeam, teamName: "Team 1", points: HULL_POINTS, provisional: false });
  expect(final.opponent).toMatchObject({ kind: "team", teamId: league.bobsTeam, teamName: "Team 2", points: EVERTON_POINTS, provisional: false });
});

test("a final gameweek's stored scores are its totals, as the table reads them, while its slots are still shown", async () => {
  const league = await scoresLeague({ catToo: true });
  await fullTimeRecords(league);
  await lockMatch(league);
  await league.t.mutation(internal.table.finalScores.storeLeague, { leagueId: league.leagueId });
  // Written over, so only a read of the stored rows can give it.
  const WRITTEN_OVER = 99;
  await league.t.run(async (ctx) => {
    const row = (await ctx.db.query("finalScores").collect()).find((each) => each.teamId === league.annsTeam)!;
    await ctx.db.patch("finalScores", row._id, { points: WRITTEN_OVER });
  });

  const game = await annsGame(league);
  const table = await (await actingAs(league.t, ANN)).query(api.table.leagueTable.ofLeague, { leagueId: league.leagueId });
  const fixtures = table!.gameweeks.find((each) => each.gameweek === GAMEWEEK)!.fixtures;
  expect(game.team).toMatchObject({ points: WRITTEN_OVER, provisional: false });
  expect(fixtures.find((each) => each.teamId === league.annsTeam)!.points).toEqual({ team: game.team.points, opponent: game.opponent.points });
  expect(lineupOf(game.team).starters).toHaveLength(HULL_STARTERS.length);
  // The league's average counts the stored total too.
  const cats = await matchupAs(league, CAT, { gameweek: GAMEWEEK });
  expect(cats).toMatchObject({ game: { opponent: { kind: "leagueAverage", points: inTenths((WRITTEN_OVER + EVERTON_POINTS) / 3) } } });
});

test("a final gameweek whose matches have changed since it was stored is worked out again, as the table does", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  await lockMatch(league);
  await league.t.mutation(internal.table.finalScores.storeLeague, { leagueId: league.leagueId });
  await league.t.run(async (ctx) => {
    for (const row of await ctx.db.query("finalScores").collect()) await ctx.db.patch("finalScores", row._id, { points: 99 });
    await ctx.db.insert("fixtures", { code: HULL_EVERTON + 1, gameweek: GAMEWEEK, homeClubCode: ARSENAL, awayClubCode: ARSENAL + 1, kickoff: KICKOFF });
  });
  const game = await annsGame(league);
  expect([game.team.points, game.opponent.points]).toEqual([HULL_POINTS, EVERTON_POINTS]);
});

test("in a double gameweek a man is yet to play while his second match is to come, and no auto-sub comes before it", async () => {
  const league = await scoresLeague();
  const secondKickoff = KICKOFF + 3 * DAY_MS;
  await league.t.run((ctx) =>
    ctx.db.insert("fixtures", { code: HULL_EVERTON + 1, gameweek: GAMEWEEK, homeClubCode: HULL, awayClubCode: ARSENAL, kickoff: secondKickoff }),
  );
  await fullTimeRecords(league);
  await scoreRead(league, "fullTime", 90);
  const game = await annsGame(league);
  expect(slotOf(game.team, HULL_SCORER).status).toEqual({ kind: "yetToPlay", kickoff: secondKickoff });
  expect(slotOf(game.team, PHILLIPS)).toMatchObject({ counts: true, autoSub: null });
  // Everton play once, and are done.
  expect(slotOf(game.opponent, EVERTON_STARTERS[0].playerCode).status).toEqual({ kind: "finished" });
});

test("each side's total is the same as the table's for the gameweek", async () => {
  const league = await scoresLeague();
  await fullTimeRecords(league);
  await lockMatch(league);
  const table = await (await actingAs(league.t, ANN)).query(api.table.leagueTable.ofLeague, { leagueId: league.leagueId });
  const game = await annsGame(league);
  expect(table!.gameweeks.find((each) => each.gameweek === GAMEWEEK)!.fixtures[0].points).toEqual({ team: game.team.points, opponent: game.opponent.points });
});

test("with no team or gameweek named, it opens on the caller's own team in the latest gameweek begun", async () => {
  const league = await scoresLeague();
  vi.setSystemTime(KICKOFF + HOUR_MS);
  const read = await matchupAs(league, BOB);
  expect(read).toMatchObject({ kind: "headToHead", teamId: league.bobsTeam, gameweek: GAMEWEEK, game: { kind: "scored" } });
  // Bob's own team is on the left.
  expect(read?.kind === "headToHead" && read.game.kind === "scored" && read.game.team).toMatchObject({ teamName: "Team 2" });
});

test("before a gameweek's deadline neither lineup shows, only who meets whom", async () => {
  const league = await scoresLeague();
  const read = await matchupAs(league, ANN, { gameweek: GAMEWEEK + 1 });
  expect(read).toMatchObject({ kind: "headToHead", gameweek: GAMEWEEK + 1, game: { kind: "notBegun", opponent: { kind: "team", teamName: "Team 2" } } });
});

test("anyone in the league sees another team's matchup once the gameweek has begun", async () => {
  const league = await scoresLeague({ catToo: true });
  const read = await matchupAs(league, CAT, { teamId: league.annsTeam, gameweek: GAMEWEEK });
  expect(read?.kind === "headToHead" && read.game.kind === "scored" && lineupOf(read.game.opponent).starters).toHaveLength(EVERTON_STARTERS.length);
});

test("a side that never saved a lineup shows none and scores 0", async () => {
  const league = await scoresLeague({ bobSaves: false });
  await fullTimeRecords(league);
  await lockMatch(league);
  expect((await annsGame(league)).opponent).toEqual({ kind: "team", teamId: league.bobsTeam, teamName: "Team 2", points: 0, provisional: false, lineup: null });
});

test("the team left over meets the league's average, every team counted once in it", async () => {
  const league = await scoresLeague({ catToo: true });
  await fullTimeRecords(league);
  await lockMatch(league);
  const read = await matchupAs(league, CAT, { gameweek: GAMEWEEK });
  expect(read).toMatchObject({
    game: { kind: "scored", team: { teamName: "Team 3", lineup: null, points: 0 }, opponent: { kind: "leagueAverage", points: inTenths((HULL_POINTS + EVERTON_POINTS) / 3), provisional: false } },
  });
});

test("someone who runs the league but no team, naming none, is told so; a team from another league is refused", async () => {
  const league = await scoresLeague();
  expect(await matchupAs(league, ADMIN)).toEqual({ kind: "noTeam" });
  const otherLeague = await adminCreatesLeague(league.t, undefined, "Another league");
  const otherTeam = await league.t.run((ctx) => ctx.db.insert("teams", { leagueId: otherLeague, number: 1, name: "Elsewhere", managerEmail: "x@example.com" }));
  await expect(matchupAs(league, ANN, { teamId: otherTeam })).rejects.toThrow("That team isn't in this league.");
});

test("a gameweek that can't be scored says why, and logs it", async () => {
  const league = await scoresLeague();
  await league.t.run((ctx) =>
    ctx.db.insert("siteScoring", {
      scoring: { ...FIRST_SCORING, rules: [...FIRST_SCORING.rules, { ...FIRST_SCORING.rules[0], stat: "goals_scroed" }] },
      kind: "fix",
      season: 2026,
      number: 1,
      announcedAt: 0,
      takesEffectAt: 0,
    }),
  );
  const logged = silenceConsoleError();
  expect(await matchupAs(league, ANN, { gameweek: GAMEWEEK })).toMatchObject({ game: { kind: "unscored", reason: expect.stringContaining('"goals_scroed"') } });
  expect(logged).toHaveBeenCalledWith(expect.stringContaining(`can't score Team 1's matchup in gameweek ${GAMEWEEK}`));
});

test("a lineup player the football sync no longer holds leaves the matchup unscored, saying who", async () => {
  const league = await scoresLeague();
  await league.t.run(async (ctx) => {
    const player = await ctx.db.query("players").withIndex("by_code", (q) => q.eq("code", HULL_SCORER)).unique();
    await ctx.db.delete("players", player!._id);
  });
  const logged = silenceConsoleError();
  expect(await matchupAs(league, ANN, { gameweek: GAMEWEEK })).toMatchObject({
    game: { kind: "unscored", reason: expect.stringContaining(`player ${HULL_SCORER} is in a lineup but the football sync doesn't hold him`) },
  });
  expect(logged).toHaveBeenCalled();
});

test("a stored fixture naming a team gone from the league throws, naming it", async () => {
  const league = await scoresLeague();
  await league.t.run((ctx) => ctx.db.delete("teams", league.bobsTeam));
  await expect(matchupAs(league, ANN, { gameweek: GAMEWEEK })).rejects.toThrow(`name team ${league.bobsTeam}, which isn't in the league`);
});

test("a total-points league has no head-to-heads", async () => {
  const league = await scoresLeague();
  await league.t.run(async (ctx) => {
    for (const row of await ctx.db.query("leagueRules").withIndex("by_leagueId_and_fromGameweek", (q) => q.eq("leagueId", league.leagueId)).collect()) {
      await ctx.db.patch("leagueRules", row._id, { rules: { ...row.rules, format: "totalPoints" } });
    }
  });
  expect(await matchupAs(league, ANN)).toEqual({ kind: "totalPoints" });
});

test("the commentary is the match's stored lines, the goal priced for its scorer, the full-time line listing both lineups' men's points, and says when delayed", async () => {
  const league = await scoresLeague();
  expect((await annsGame(league)).commentary).toEqual({ kind: "read", lines: [], delayed: false });

  await fullTimeRecords(league);
  const scorer = await nameOf(league, HULL_SCORER);
  const line = (sourceId: number, text: string, minute: number | null, type: string, playerCodes: number[] = []) => ({ sourceId, text, minute, addedMinute: 0, type, playerCodes });
  await league.t.run((ctx) =>
    ctx.db.insert("matchCommentary", {
      fixtureCode: HULL_EVERTON,
      lines: [line(3, "FT HUL 1–2 EVE", 1, "end 14"), line(2, `64' GOAL ${scorer}`, 64, "goal", [HULL_SCORER]), line(1, "KO HUL v EVE", 0, "start")],
      delayed: { reason: "the stream is over 10 minutes behind the clock", since: KICKOFF },
    }),
  );

  const { commentary, team, opponent } = await annsGame(league);
  if (commentary.kind !== "read") throw new Error(`the commentary wasn't read: ${commentary.reason}`);
  const scorerSlot = slotOf(team, HULL_SCORER);
  expect(commentary.delayed).toBe(true);
  expect(commentary.lines.map((each) => each.text).slice(1)).toEqual([`64' GOAL ${scorer}`, "KO HUL v EVE"]);
  // The first set's goal for a man in midfield, where he stands.
  const MIDFIELD_GOAL = 5;
  expect(commentary.lines[1].points).toBe(`+${MIDFIELD_GOAL}`);
  expect(commentary.lines[0].text).toMatch(/^FT HUL 1–2 EVE: /);
  expect(commentary.lines[0].text).toContain(`${scorer} ${scorerSlot.points}`);
  const evertonKeeper = EVERTON_STARTERS[0].playerCode;
  expect(commentary.lines[0].text).toContain(`${await nameOf(league, evertonKeeper)} ${slotOf(opponent, evertonKeeper).points}`);
  // Phillips, Hull's unused keeper, didn't play, so isn't listed.
  expect(commentary.lines[0].text).not.toContain(await nameOf(league, PHILLIPS));
});
