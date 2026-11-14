import { expect, test, vi } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { recordPassedDeadlines } from "../../../convex/gameweeks/deadlineRecorder";
import { keepGameweekKickoffs } from "../../../convex/gameweeks/gameweekKickoffs";
import { FIRST_GAMEWEEK } from "../../../convex/gameweeks/usedGameweeks";
import { positionOfSlot } from "../../../convex/lineup/pitch";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { scoreMatch } from "../../../convex/scoring/scoring";
import { inTenths } from "../../../convex/scoring/values";
import { HOUR_MS, MINUTE_MS, WEEK_MS } from "../../../convex/shared/time";
import { MATCHUP_POINTS } from "../../../convex/table/standings";
import { recordedGw6 } from "../../support/recorded/gw6.payloads";
import { draftSteps } from "../../support/convex/draft.harness";
import { annsScoredGame, EVERTON_POINTS, HULL_POINTS, sideTotal, slotOf } from "../../support/convex/gameweekScores.harness";
import { actingAs, addManagers, adminCreatesLeague, ADMIN, lettersTo } from "../../support/convex/leagues.harness";
import { EVERTON, FULL_TIME_READ, GAMEWEEK, HULL, KICKOFF, mergedHullEverton } from "../../support/convex/matchStats.harness";
import { ANN, BOB, CAT, DAN, DEADLINE, ELEVENS, footballSyncAt, leagueWorld, liveTickAt, WEEK_BEFORE_GW6, tableOf } from "../../support/convex/miniBeta.harness";
import { signInDeployment } from "../../support/convex/signIn.harness";
import { BELLOUMI } from "../../support/convex/teamPoints.harness";
import { clockRunsTo, MADE_UP_CODES, SLOW_TEST, type TestConvex } from "../../support/convex/test.harness";
import { dropPlayer } from "../../support/convex/waivers.harness";

// One season chain through the entry points the app and the crons call (#2131): the four mini beta
// managers draft their elevens from the recorded gameweek 6 world, the draft's end leaving each team
// its first lineup; three save theirs and Dan, gone quiet, is on the auto team at the deadline;
// gameweek 6, Hull v Everton as recorded, is scored and locked into the table; a waiver run hands a
// dropped man out in reverse table order; and in gameweek 7 he scores for his new team. Gameweek 7
// is Hull v Everton again a week on, held as the football sync holds a fixture and read at full
// time from the same recorded lines, so his points there are known man by man. Two gameweeks, so it
// runs on every pull request; the in-memory backend only.

/** Gameweek 7, Hull v Everton's return a week on, and its code, one no feed sends. */
const NEXT_GAMEWEEK = GAMEWEEK + 1;
const RETURN_MATCH = MADE_UP_CODES + 1;
const RETURN_KICKOFF = KICKOFF + WEEK_MS;
const RETURN_DEADLINE = RETURN_KICKOFF - FIRST_RULES.deadline.minutesBeforeFirstKickoff * MINUTE_MS;
const RETURN_FULL_TIME = RETURN_KICKOFF + 2 * HOUR_MS;
/** The Wednesday after gameweek 6, 18:00 UK time: the first waiver run by the league's default. */
const WEDNESDAY_RUN = Date.parse("2026-10-14T17:00:00Z");
/** Each manager's squad, in the order he drafts it: his eleven as the mini beta assigns it. */
const PICKS = new Map([ANN, BOB, CAT, DAN].map((email) => [email, ELEVENS[email].map(({ playerCode }) => playerCode)]));

const heldSquad = (t: TestConvex, teamId: Id<"teams">) =>
  t.run(async (ctx) => (await ctx.db.query("squadPlayers").withIndex("by_teamId", (q) => q.eq("teamId", teamId)).collect()).map(({ playerCode }) => playerCode));
const teamLineups = (t: TestConvex, teamId: Id<"teams">) => t.run(async (ctx) => (await ctx.db.query("lineups").collect()).filter((row) => row.teamId === teamId));
const storedIn = async (t: TestConvex, gameweek: number, emailOf: Map<Id<"teams">, string>) =>
  new Map((await t.run((ctx) => ctx.db.query("finalScores").collect())).filter((row) => row.gameweek === gameweek).map((row) => [emailOf.get(row.teamId)!, row.points]));

test("a season chain: the draft's end, first lineups, the auto team, gameweek 6 scored, the table, a waiver run and the claimed man's points", SLOW_TEST, async () => {
  const beforeKickoff = () => leagueWorld(recordedGw6(), { beforeKickoff: true });
  const t = await signInDeployment(WEEK_BEFORE_GW6);
  expect((await footballSyncAt(t, WEEK_BEFORE_GW6, beforeKickoff())).outcome.ok).toBe(true);
  const leagueId = await adminCreatesLeague(t);
  const managers = [...PICKS.keys()];
  const teamIds = await addManagers(t, leagueId, managers);
  const [annsTeam, bobsTeam, catsTeam, dansTeam] = teamIds;
  const emailOf = new Map(teamIds.map((teamId, index) => [teamId, managers[index]]));
  const admin = await actingAs(t, ADMIN);
  for (const starter of Object.values(ELEVENS).flat()) {
    await admin.mutation(api.positions.playerPositions.setPosition, { code: starter.playerCode, position: positionOfSlot(starter) });
  }

  // The draft, run to its end: each manager picks his eleven when the room puts him on the clock.
  const draft = draftSteps(() => ({ t, leagueId }));
  await draft.setSquadSize(ELEVENS[ANN].length);
  await draft.start();
  const left = new Map([...PICKS].map(([email, codes]) => [email, [...codes]]));
  for (let room = await draft.read(); room?.status === "live"; room = await draft.read()) {
    const email = emailOf.get(room.onTheClock.teamId)!;
    await draft.pickAndWait(email, left.get(email)!.shift()!);
  }
  expect(await draft.read()).toMatchObject({ status: "over", picksMade: PICKS.size * ELEVENS[ANN].length });
  for (const teamId of teamIds) expect(new Set(await heldSquad(t, teamId))).toEqual(new Set(PICKS.get(emailOf.get(teamId)!)));

  // Each team holds the first lineup its picks filled, from gameweek 1, saved as the draft ended
  // (S05.49, #1040): every man in his squad on it, nobody twice.
  for (const teamId of teamIds) {
    const [first] = await teamLineups(t, teamId);
    expect(first).toMatchObject({ fromGameweek: FIRST_GAMEWEEK });
    expect(first.firstLineup).toBeUndefined();
    expect([...first.starters.map(({ playerCode }) => playerCode), ...first.bench].sort()).toEqual([...PICKS.get(emailOf.get(teamId)!)!].sort());
  }

  // Ann, Bob and Cat save their elevens. Dan switches the auto team on and plays no more; one of
  // his midfielders is then ruled out.
  for (const email of [ANN, BOB, CAT]) await (await actingAs(t, email)).mutation(api.lineup.lineups.save, { leagueId, lineup: { starters: ELEVENS[email], bench: [] } });
  await (await actingAs(t, DAN)).mutation(api.lineup.autoTeam.set, { leagueId, teamId: dansTeam, on: true });
  const [dansFirst] = await teamLineups(t, dansTeam);
  const ruledOut = dansFirst.starters.find(({ area }) => area === "midfield")!;
  await admin.mutation(api.availability.availability.set, { code: ruledOut.playerCode, availability: "out" });

  // The deadline (S03.3) passes and the football sync records it. The auto team keeps Dan's lineup
  // and swaps the man who is out for the first bench player who fits, from gameweek 6 (S09.3).
  expect((await footballSyncAt(t, DEADLINE + MINUTE_MS, beforeKickoff())).outcome.ok).toBe(true);
  await clockRunsTo(t, Date.now());
  const dansSix = (await teamLineups(t, dansTeam)).find((row) => row.fromGameweek === GAMEWEEK)!;
  const startersOf = (row: typeof dansFirst) => row.starters.map(({ playerCode }) => playerCode).sort();
  const swapped = startersOf(dansFirst).map((code) => (code === ruledOut.playerCode ? dansFirst.bench[0] : code)).sort();
  expect(startersOf(dansSix)).toEqual(swapped);
  expect(dansSix.bench).toContain(ruledOut.playerCode);

  // Gameweek 6 is played and read at full time; an hour on it locks (S07.2) and each team's score
  // is stored. Ann fields Hull and Bob Everton, as the whole-gameweek golden prices them.
  expect((await liveTickAt(t, FULL_TIME_READ, leagueWorld(recordedGw6()))).outcome.ok).toBe(true);
  await clockRunsTo(t, FULL_TIME_READ + HOUR_MS + MINUTE_MS);
  const six = await storedIn(t, GAMEWEEK, emailOf);
  expect([...six.keys()].sort()).toEqual([...managers].sort());
  expect(six.get(ANN)).toBe(HULL_POINTS);
  expect(six.get(BOB)).toBe(EVERTON_POINTS);

  // The table: one game each on the stored scores. Ann and Bob both won, level on points, Bob
  // above on the tie-breaks (S03.2); Dan marked as on the auto team (spec/09).
  const table = (await tableOf({ t, leagueId }))!.table;
  for (const row of table) {
    expect(row.pointsFor).toBe(six.get(emailOf.get(row.teamId)!));
    expect(row.played).toBe(1);
    expect(row.points).toBe(row.won === 1 ? MATCHUP_POINTS.win : row.drawn === 1 ? MATCHUP_POINTS.draw : MATCHUP_POINTS.loss);
  }
  expect(table.map(({ teamId }) => emailOf.get(teamId))).toEqual([BOB, ANN, CAT, DAN]);
  expect(table[0].points).toBe(table[1].points);
  expect(table.find((row) => row.teamId === dansTeam)?.onAutoTeam).toBe(true);
  expect(table.filter((row) => row.onAutoTeam)).toHaveLength(1);

  // Gameweek 7's match is held before the waivers open, as the football sync holds the season's.
  await t.run(async (ctx) => {
    await ctx.db.insert("fixtures", { code: RETURN_MATCH, gameweek: NEXT_GAMEWEEK, homeClubCode: HULL, awayClubCode: EVERTON, kickoff: RETURN_KICKOFF });
    await keepGameweekKickoffs(ctx, [NEXT_GAMEWEEK]);
  });

  // After the lock Cat drops Belloumi, Hull's scorer off the bench, and both Ann and Bob claim him,
  // each naming a midfielder to go. Bob's claim is in first, and the draft order's reverse puts Bob
  // above Ann; but the run goes in reverse table order (S08.18), and Ann is below Bob, so Belloumi
  // is hers and her named man goes; Bob keeps his (S08.19).
  const annsDrop = ELEVENS[ANN].find(({ area, lane }) => area === "midfield" && lane === "left")!;
  const bobsDrop = ELEVENS[BOB].find(({ area }) => area === "midfield")!;
  await dropPlayer(t, leagueId, CAT, BELLOUMI);
  vi.setSystemTime(Date.now() + MINUTE_MS);
  await (await actingAs(t, BOB)).mutation(api.waivers.waiverClaims.putIn, { leagueId, playerCode: BELLOUMI, dropCode: bobsDrop.playerCode });
  vi.setSystemTime(Date.now() + MINUTE_MS);
  await (await actingAs(t, ANN)).mutation(api.waivers.waiverClaims.putIn, { leagueId, playerCode: BELLOUMI, dropCode: annsDrop.playerCode });
  vi.setSystemTime(WEDNESDAY_RUN);
  await t.mutation(internal.waivers.waiverRun.run, { leagueId, at: WEDNESDAY_RUN });
  expect(await heldSquad(t, annsTeam)).toContain(BELLOUMI);
  expect(await heldSquad(t, annsTeam)).not.toContain(annsDrop.playerCode);
  expect(await heldSquad(t, bobsTeam)).toContain(bobsDrop.playerCode);
  expect(await heldSquad(t, bobsTeam)).not.toContain(BELLOUMI);
  expect(await heldSquad(t, catsTeam)).not.toContain(BELLOUMI);
  expect((await lettersTo(t, BOB)).map(({ subject }) => subject)).toContain("Your claim for Belloumi failed");

  // Ann puts Belloumi in her dropped man's place from gameweek 7, the next not yet begun.
  const annsSeven = ELEVENS[ANN].map((starter) => (starter.playerCode === annsDrop.playerCode ? { ...starter, playerCode: BELLOUMI } : starter));
  expect(await (await actingAs(t, ANN)).mutation(api.lineup.lineups.save, { leagueId, lineup: { starters: annsSeven, bench: [] } })).toBe(NEXT_GAMEWEEK);

  // Gameweek 7: its deadline passes, the match is read at full time, and an hour on it locks. A
  // match counts in the gameweek it kicks off in (S07.9), so Belloumi's points are Ann's now: his
  // recorded line priced at the cell she put him in, and her score her eleven's with him in it.
  vi.setSystemTime(RETURN_DEADLINE + MINUTE_MS);
  await t.run((ctx) => recordPassedDeadlines(ctx));
  await clockRunsTo(t, RETURN_FULL_TIME);
  const records = mergedHullEverton().map((record) => ({ ...record, fixtureCode: RETURN_MATCH }));
  await t.mutation(internal.stats.matchStats.upsertMatch, { fixtureCode: RETURN_MATCH, readAt: RETURN_FULL_TIME, records });
  await clockRunsTo(t, RETURN_FULL_TIME + HOUR_MS + MINUTE_MS);

  const belloumi = records.find(({ playerCode }) => playerCode === BELLOUMI)!;
  const hisPoints = inTenths(scoreMatch(belloumi.stats, FIRST_SCORING, annsDrop).total!);
  expect(hisPoints).toBeGreaterThan(0);
  const game = await annsScoredGame({ t, leagueId, annsTeam, bobsTeam }, NEXT_GAMEWEEK);
  expect(slotOf(game.team, BELLOUMI)).toMatchObject({ points: hisPoints, counts: true });
  const seven = await storedIn(t, NEXT_GAMEWEEK, emailOf);
  expect(seven.get(ANN)).toBe(sideTotal(records, annsSeven));
  expect(seven.get(ANN)).not.toBe(six.get(ANN));
});
