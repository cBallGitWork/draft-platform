// The match stats tests' shared setup: gameweek 6 as both feeds recorded it, served to the sync,
// and Hull v Everton's records as the pure merge gives them.

import type { Infer } from "convex/values";
import { vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { codesByOpta } from "../../../convex/football/feedIds";
import {
  FPL_BOOTSTRAP_URL,
  FPL_FIXTURES_URL,
  fplLiveUrl,
  plCommentaryUrl,
  plFixturesUrl,
  plFixtureUrl,
  plPlayerStatsUrl,
  plTeamStatsUrl,
} from "../../../convex/football/football";
import { fplStatLines } from "../../../convex/football/fpl/fplLive";
import { matchRecords } from "../../../convex/stats/matchRecords";
import { matchSlots, plStatLines } from "../../../convex/football/premierLeague/plMatch";
import { FULL_STATS, hullEvertonReads, MATCH, recordedGw6, type Gw6Payloads } from "../recorded/gw6.payloads";
import { recordedCommentary, recordedTeamStats } from "../recorded/commentary.payloads";
import type { syncTrigger } from "../../../convex/schema";
import { fakeFetch, freshConvex, type TestConvex } from "./test.harness";
import { HOUR_MS } from "../../../convex/shared/time";
import { insertClubs, type Club } from "./footballRows.harness";

export const GAMEWEEK = 6;
/** FPL's club codes for the two sides. */
export const HULL = 88;
export const EVERTON = 11;
/** Both clubs' rows, as the football sync holds them. */
export const HULL_CITY: Club = { code: HULL, name: "Hull City", shortName: "HUL" };
export const EVERTON_CLUB: Club = { code: EVERTON, name: "Everton", shortName: "EVE" };

export const HULL_EVERTON = MATCH.hullEverton.code;
/** Hull v Everton's kickoff, as FPL recorded it, and when the tests first read it at full time. */
export const KICKOFF = Date.parse("2026-10-11T13:00:00Z");
export const FULL_TIME_READ = KICKOFF + 2 * HOUR_MS;

/** Both sides' starters, eleven a side, as Hull v Everton's sheets name them. */
export const BOTH_ELEVENS = 22;

/** Hull v Everton's five team stats at full time, as football/premierLeague/plTeamStats.ts maps the recording. */
export const HULL_EVERTON_TEAM_STATS = {
  home: { shots: 9, shotsOnTarget: 5, possession: 34.8, corners: 7, yellowCards: 2, redCards: 0 },
  away: { shots: 15, shotsOnTarget: 7, possession: 65.2, corners: 6, yellowCards: 0, redCards: 0 },
};

/** Every feed's read for gameweek 6 as recorded, and Hull v Everton's commentary (#43) and team
 *  stats (#45) at full time, which the live tick reads; a URL containing `refuse` answers `REFUSED_STATUS`. */
export function fakeFeeds(payloads: Gw6Payloads, refuse?: string) {
  const bodies = new Map<string, unknown>([
    [FPL_BOOTSTRAP_URL, payloads.fpl.bootstrap],
    [FPL_FIXTURES_URL, payloads.fpl.fixtures],
    [fplLiveUrl(GAMEWEEK), payloads.fpl.live],
    [plFixturesUrl(GAMEWEEK), payloads.pl.round],
    ...payloads.pl.fixtures.map((fixture) => [plFixtureUrl(fixture.id), fixture] as const),
    ...payloads.pl.playerStats.map((read) => [plPlayerStatsUrl(read.player, read.fixture), read.payload] as const),
    [plCommentaryUrl(MATCH.hullEverton.pl), recordedCommentary(MATCH.hullEverton.pl)],
    [plTeamStatsUrl(MATCH.hullEverton.pl), recordedTeamStats(MATCH.hullEverton.pl)],
  ]);
  return fakeFetch(bodies, (url) => refuse !== undefined && url.includes(refuse));
}

/** A test's Convex, holding Hull v Everton and both clubs as the football sync would. */
export async function withHullEverton() {
  const t = freshConvex();
  await t.run(async (ctx) => {
    await ctx.db.insert("fixtures", {
      code: HULL_EVERTON,
      gameweek: GAMEWEEK,
      homeClubCode: HULL,
      awayClubCode: EVERTON,
      kickoff: KICKOFF,
    });
    await insertClubs(ctx, [HULL_CITY, EVERTON_CLUB]);
  });
  return t;
}

/** One sync at `time` against `payloads`, started by hand unless `trigger` says the cron, and the
 *  run row it recorded. */
export async function syncAt(
  t: TestConvex,
  time: number,
  payloads: Gw6Payloads,
  refuse?: string,
  trigger: Infer<typeof syncTrigger> = "manual",
) {
  vi.setSystemTime(time);
  vi.stubGlobal("fetch", fakeFeeds(payloads, refuse));
  await t.action(internal.stats.matchStatsSync.run, { trigger });
  const [latest] = await t.query(internal.stats.matchStats.latest, {});
  return latest;
}

/** Hull v Everton's held records, by player code, its status row and its late corrections. */
export async function heldMatch(t: TestConvex) {
  const held = await t.run(async (ctx) => ({
    records: await ctx.db.query("playerMatchStats").collect(),
    status: await ctx.db.query("matchStatsStatus").unique(),
    lateCorrections: await ctx.db.query("lateStatCorrections").collect(),
  }));
  return { ...held, records: new Map(held.records.map((row) => [row.playerCode, row] as const)) };
}

/** Hull v Everton's records as the pure merge gives them from `payloads`. */
export function mergedHullEverton(payloads: Gw6Payloads = recordedGw6()) {
  const fixture = payloads.pl.fixtures.find((each) => each.id === MATCH.hullEverton.pl)!;
  const codeByOpta = codesByOpta(payloads.fpl.bootstrap.elements);
  const { slots } = matchSlots(fixture, codeByOpta);
  const { lines } = plStatLines(fixture, hullEvertonReads(payloads), codeByOpta);
  const fplLines = fplStatLines(payloads.fpl.live, payloads.fpl.bootstrap.elements, payloads.fpl.fixtures);
  return matchRecords(HULL_EVERTON, slots, fplLines, lines);
}

/** One man's recorded Premier League read at Hull v Everton, to change for a test. */
function hullEvertonRead(payloads: Gw6Payloads, plPlayerId: number) {
  return payloads.pl.playerStats.find((read) => read.player === plPlayerId && read.fixture === MATCH.hullEverton.pl)!.payload;
}

/** `payloads` with the Premier League not yet having counted one man: his read's list is empty. */
export function withPlReadEmpty(payloads: Gw6Payloads, plPlayerId: number): Gw6Payloads {
  return withPlRead(payloads, plPlayerId, {});
}

/** The Premier League's status for a match being played: not `PL_FULL_TIME`. */
const PL_LIVE = "L";

/** `payloads` with the Premier League's list calling Hull v Everton still being played. */
export function withHullEvertonLive(payloads: Gw6Payloads): Gw6Payloads {
  payloads.pl.round.content.find((fixture) => fixture.id === MATCH.hullEverton.pl)!.status = PL_LIVE;
  return payloads;
}

/** `payloads` with one man's Premier League read holding only `stats`. */
export function withPlRead(payloads: Gw6Payloads, plPlayerId: number, stats: Record<string, number>): Gw6Payloads {
  hullEvertonRead(payloads, plPlayerId).stats = Object.entries(stats).map(([name, value]) => ({ name, value }));
  return payloads;
}

/** `payloads` with FPL's match block for these men, or for every man if none is given, not yet
 *  filled in: no stats in it, though the gameweek totals are still sent. */
export function withFplBlocksEmpty(payloads: Gw6Payloads, ...codes: number[]): Gw6Payloads {
  const ids = new Set(payloads.fpl.bootstrap.elements.filter((each) => codes.includes(each.code)).map((each) => each.id));
  for (const element of payloads.fpl.live.elements) {
    if (codes.length > 0 && !ids.has(element.id)) continue;
    for (const block of element.explain) block.stats = [];
  }
  return payloads;
}

/** `payloads` with Belloumi's goal taken away in both feeds, as a correction would. */
export function withBelloumiGoalRemoved(payloads: Gw6Payloads): Gw6Payloads {
  const element = payloads.fpl.live.elements.find((each) => each.id === FULL_STATS.belloumi.fplId)!;
  element.stats.goals_scored = 0;
  for (const block of element.explain) block.stats = block.stats.filter((stat) => stat.identifier !== "goals_scored");
  const read = hullEvertonRead(payloads, FULL_STATS.belloumi.pl);
  read.stats = read.stats.filter((metric) => !["goals", "goals_openplay"].includes(metric.name));
  return payloads;
}
