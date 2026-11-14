import { expect, test, vi } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ANTHROPIC_MESSAGES_URL } from "../../../convex/outbound/claude";
import { ANTHROPIC_KEY_SETTING } from "../../../convex/outbound/deploymentSettings";
import { RESEND_EMAILS_URL } from "../../../convex/outbound/email";
import { dayOf, EMAILS_PER_DAY } from "../../../convex/outbound/emailLimit";
import { DAY_MS, HOUR_MS, MINUTE_MS } from "../../../convex/shared/time";
import { insertClubs, insertPlayers } from "../../support/convex/footballRows.harness";
import { changeRules, rulesIn } from "../../support/convex/leagueRules.harness";
import { actingAs, addManagers, adminCreatesLeague, COMMISSIONER } from "../../support/convex/leagues.harness";
import { RESEND_ACCEPTED, signInDeployment } from "../../support/convex/signIn.harness";
import { clockRunsTo } from "../../support/convex/test.harness";
import {
  below,
  changedMidSeason,
  CLUBS,
  coversEveryPair,
  dealSquads,
  FIXTURES,
  lastFullTime,
  LEAGUE_SIZES,
  matchRecords,
  pairwiseRules,
  pickOne,
  PLAYERS,
  RULES_CHANGE_GAMEWEEK,
  SEASON_GAMEWEEKS,
  seededRandom,
  SETUP_MORNING,
  simulationSeed,
  TO_FULL_TIME,
  type Fixture,
  type MatchRecord,
  type Random,
} from "../../support/convex/seasonSimulation.harness";
import type { TestConvex } from "../../support/convex/test.harness";

// The season simulation (#2132): `npm run simulate`, which the nightly job calls; never part of
// `npm test`, being minutes long. Six leagues, 80 teams, a whole season of 39 gameweeks on the
// in-memory backend with a fake clock, every function held to Convex's own per-transaction limits.
// The leagues' rules cover every pair of spec/03's settings between them and change mid-season;
// commissioners override players' and teams' points among stat corrections and re-syncs.
//
// It asserts only invariants (nothing throws, no job fails, every read stays in Convex's limits,
// the day's emails stay under the limit) and outcomes with an answer ID. It prints its seed: a red
// run plays again with `SIM_SEED=<seed> npm run simulate`.
//
// Leagues playing the Scottish Premiership beside the Premier League (S04.10) aren't built yet, so
// only the Premier League is played (#2132's leftover says so).

const SEED = simulationSeed();
console.log(`Season simulation seed: ${SEED} (play it again with SIM_SEED=${SEED} npm run simulate)`);

/** A commissioner's reason, as each override needs one. */
const REASON = "Season simulation";

interface League {
  leagueId: Id<"leagues">;
  teams: Id<"teams">[];
  /** A manager of the league, whose screens read it. */
  manager: string;
  /** Each held player's team, by his code. */
  ownerOf: Map<number, Id<"teams">>;
  /** The gameweek a team and a player are overridden in while its last match is still open, and
   *  the one they are overridden in and the overrides removed once it is final. */
  openOverride: number;
  finalOverride: number;
}

/** Every Resend send's UTC day, as the limit counts them; Claude writing each recap. */
function worldFetch(sendDays: string[]) {
  vi.stubEnv(ANTHROPIC_KEY_SETTING, "test-key");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === RESEND_EMAILS_URL) {
        sendDays.push(dayOf(Date.now()));
        return Response.json(RESEND_ACCEPTED);
      }
      if (url === ANTHROPIC_MESSAGES_URL) return Response.json({ content: [{ type: "text", text: "The gameweek's recap." }] });
      throw new Error(`no fake for ${url}`);
    }),
  );
}

/** The football sync's rows, held as it holds them, and the first deadline alarm it sets. */
async function holdTheSeason(t: TestConvex) {
  await t.run(async (ctx) => {
    await insertClubs(ctx, CLUBS);
    await insertPlayers(ctx, PLAYERS);
    for (let number = 1; number <= SEASON_GAMEWEEKS; number += 1) {
      const first = Math.min(...FIXTURES.filter((fixture) => fixture.gameweek === number).map((fixture) => fixture.kickoff));
      await ctx.db.insert("gameweeks", { number, deadline: first - 90 * MINUTE_MS });
    }
    for (const fixture of FIXTURES) await ctx.db.insert("fixtures", fixture);
  });
  await t.mutation(internal.gameweeks.deadlineRecorder.recordDueDeadlines, {});
}

/** The admin makes the `index`th league, the commissioner gives it its pairwise rules and assigns
 *  each team its squad. */
async function makeLeague(t: TestConvex, random: Random, index: number): Promise<League> {
  const size = LEAGUE_SIZES[index];
  const leagueId = await adminCreatesLeague(t, size, `Sim League ${index + 1}`);
  const emails = Array.from({ length: size }, (_, team) => `sim${index + 1}.manager${team + 1}@example.com`);
  const teams = await addManagers(t, leagueId, emails);
  await changeRules(t, leagueId, pairwiseRules(await rulesIn(t, leagueId, 1), index));
  const commissioner = await actingAs(t, COMMISSIONER);
  const ownerOf = new Map<number, Id<"teams">>();
  for (const [team, squad] of dealSquads(random, size).entries()) {
    for (const playerCode of squad) {
      await commissioner.mutation(api.squads.squads.assign, { leagueId, playerCode, teamId: teams[team] });
      ownerOf.set(playerCode, teams[team]);
    }
  }
  const openOverride = 2 + below(random, SEASON_GAMEWEEKS - 2);
  const finalOverride = 1 + ((openOverride + below(random, SEASON_GAMEWEEKS - 2)) % SEASON_GAMEWEEKS);
  return { leagueId, teams, manager: emails[0], ownerOf, openOverride, finalOverride: finalOverride === openOverride ? openOverride - 1 : finalOverride };
}

/** The full-time read of a match, as the match-stats sync writes it. */
const fullTimeRead = (t: TestConvex, fixture: Fixture, readAt: number, records: MatchRecord[]) =>
  t.mutation(internal.stats.matchStats.upsertMatch, { fixtureCode: fixture.code, readAt, records });

/** Each team's stored points in the gameweek, by team. */
const storedIn = (t: TestConvex, leagueId: Id<"leagues">, gameweek: number) =>
  t.run(async (ctx) => {
    const rows = await ctx.db.query("finalScores").collect();
    return new Map(rows.filter((row) => row.leagueId === leagueId && row.gameweek === gameweek).map((row) => [row.teamId, row.points]));
  });

/** The override the player's card shows for the match, in the league, or null. */
async function cardOverride(t: TestConvex, league: League, playerCode: number, fixtureCode: number) {
  const card = await (await actingAs(t, league.manager)).query(api.playerCard.playerCard.card, { leagueId: league.leagueId, playerCode, now: Date.now() });
  return card!.matches.find((match) => match.fixtureCode === fixtureCode)?.override?.points ?? null;
}

/** A held player who played in the match of `records`, and his team, for an override; null when
 *  the league holds none. */
function heldIn(random: Random, league: League, records: MatchRecord[]) {
  const held = records.filter((record) => record.played && league.ownerOf.has(record.playerCode));
  if (held.length === 0) return null;
  const { playerCode } = pickOne(random, held);
  return { playerCode, teamId: league.ownerOf.get(playerCode)! };
}

/** Points an override sets: whole, so every scoring set takes them. */
const overridePoints = (random: Random) => below(random, 40) - 5;

test("a whole season: six leagues, 80 teams, 39 gameweeks, within Convex's limits", async () => {
  expect(coversEveryPair()).toBe(true);
  const random = seededRandom(SEED);
  const sendDays: string[] = [];
  const t = await signInDeployment(SETUP_MORNING, true);
  worldFetch(sendDays);
  await holdTheSeason(t);
  const leagues: League[] = [];
  for (let index = 0; index < LEAGUE_SIZES.length; index += 1) leagues.push(await makeLeague(t, random, index));
  expect(leagues.reduce((teams, league) => teams + league.teams.length, 0)).toBe(80);

  for (let gameweek = 1; gameweek <= SEASON_GAMEWEEKS; gameweek += 1) {
    if (gameweek === RULES_CHANGE_GAMEWEEK) {
      for (const { leagueId } of leagues) await changeRules(t, leagueId, changedMidSeason(await rulesIn(t, leagueId, gameweek - 1)));
    }
    const fixtures = FIXTURES.filter((fixture) => fixture.gameweek === gameweek).sort((one, other) => one.kickoff - other.kickoff);
    const played = new Map<number, MatchRecord[]>();
    for (const fixture of fixtures) {
      await clockRunsTo(t, fixture.kickoff + TO_FULL_TIME);
      const records = matchRecords(random, fixture);
      played.set(fixture.code, records);
      await fullTimeRead(t, fixture, Date.now(), records);
    }

    // The last match is still in its correction window: a team's total and a player's points are
    // overridden, then his stats are corrected and the match read again unchanged.
    const last = fixtures.at(-1)!;
    const lastRecords = played.get(last.code)!;
    const open = new Map<League, { teamId: Id<"teams">; teamPoints: number; playerCode: number; playerPoints: number }>();
    for (const league of leagues.filter((each) => each.openOverride === gameweek)) {
      const held = heldIn(random, league, lastRecords);
      if (held === null) continue;
      const commissioner = await actingAs(t, COMMISSIONER);
      const teamPoints = overridePoints(random);
      const playerPoints = overridePoints(random);
      await commissioner.mutation(api.table.teamOverrides.overrideTeam, { leagueId: league.leagueId, gameweek, teamId: held.teamId, points: teamPoints, reason: REASON });
      await commissioner.mutation(api.table.pointsOverrides.override, {
        leagueId: league.leagueId,
        fixtureCode: last.code,
        playerCode: held.playerCode,
        points: playerPoints,
        reason: REASON,
      });
      open.set(league, { ...held, teamPoints, playerPoints });
    }
    if (open.size > 0) {
      const corrected = lastRecords.map((record) =>
        [...open.values()].some((each) => each.playerCode === record.playerCode) ? { ...record, stats: { ...record.stats, goals_scored: 3 } } : record,
      );
      vi.setSystemTime(Date.now() + MINUTE_MS);
      await fullTimeRead(t, last, Date.now(), corrected);
      vi.setSystemTime(Date.now() + MINUTE_MS);
      await fullTimeRead(t, last, Date.now(), corrected);
    }

    // The window closes: every match locks and each league stores its gameweek (S07.2).
    await clockRunsTo(t, lastFullTime(gameweek) + HOUR_MS + MINUTE_MS);
    for (const league of leagues) {
      const stored = await storedIn(t, league.leagueId, gameweek);
      expect(stored.size, `league ${league.leagueId}, gameweek ${gameweek}: every team stored (S07.2)`).toBe(league.teams.length);
      const overridden = open.get(league);
      if (overridden !== undefined) {
        // The team's total stands over the correction and its player's override (S14.3, S14.4).
        expect(stored.get(overridden.teamId), "S14.3, S14.4").toBe(overridden.teamPoints);
        // So does the player's points over his correction (S14.4).
        expect(await cardOverride(t, league, overridden.playerCode, last.code), "S14.4").toBe(overridden.playerPoints);
      }
      if (league.finalOverride === gameweek) await overrideAndRemove(t, random, league, gameweek, fixtures, played);
      // The screens' reads of the league, within Convex's limits.
      await (await actingAs(t, league.manager)).query(api.table.leagueTable.ofLeague, { leagueId: league.leagueId });
    }

    // The week between: the waiver and trade checks run as their crons do, each day.
    for (let day = 1; day <= 5; day += 1) {
      await clockRunsTo(t, lastFullTime(gameweek) + day * DAY_MS);
      await t.mutation(internal.waivers.waiverRun.runDue, {});
      await t.mutation(internal.trades.tradeClose.closeDue, {});
    }
  }

  const failed = await t.run(async (ctx) => (await ctx.db.system.query("_scheduled_functions").collect()).filter((job) => job.state.kind === "failed"));
  expect(failed.map((job) => job.name)).toEqual([]);
  const perDay = new Map<string, number>();
  for (const day of sendDays) perDay.set(day, (perDay.get(day) ?? 0) + 1);
  for (const [day, sends] of perDay) expect(sends, `emails on ${day}`).toBeLessThanOrEqual(EMAILS_PER_DAY);
});

/** Once the gameweek is final, a team's total and a player's points are overridden and the
 *  overrides removed: the stored score puts back what was scored (S14.3, S14.5). */
async function overrideAndRemove(
  t: TestConvex,
  random: Random,
  league: League,
  gameweek: number,
  fixtures: Fixture[],
  played: Map<number, MatchRecord[]>,
) {
  const fixture = pickOne(random, fixtures);
  const held = heldIn(random, league, played.get(fixture.code)!);
  if (held === null) return;
  const { leagueId } = league;
  const commissioner = await actingAs(t, COMMISSIONER);
  const scored = (await storedIn(t, leagueId, gameweek)).get(held.teamId);
  const teamPoints = overridePoints(random);
  await commissioner.mutation(api.table.teamOverrides.overrideTeam, { leagueId, gameweek, teamId: held.teamId, points: teamPoints, reason: REASON });
  expect((await storedIn(t, leagueId, gameweek)).get(held.teamId), "S14.3").toBe(teamPoints);
  await commissioner.mutation(api.table.teamOverrides.removeTeamOverride, { leagueId, gameweek, teamId: held.teamId });
  expect((await storedIn(t, leagueId, gameweek)).get(held.teamId), "S14.5").toBe(scored);

  const playerPoints = overridePoints(random);
  const { playerCode } = held;
  await commissioner.mutation(api.table.pointsOverrides.override, { leagueId, fixtureCode: fixture.code, playerCode, points: playerPoints, reason: REASON });
  expect(await cardOverride(t, league, playerCode, fixture.code), "S14.2").toBe(playerPoints);
  await commissioner.mutation(api.table.pointsOverrides.removeOverride, { leagueId, fixtureCode: fixture.code, playerCode });
  expect(await cardOverride(t, league, playerCode, fixture.code), "S14.5").toBeNull();
  expect((await storedIn(t, leagueId, gameweek)).get(held.teamId), "S14.5").toBe(scored);
}
