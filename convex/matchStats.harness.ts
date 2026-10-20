// The match stats tests' shared setup: gameweek 6 as both feeds recorded it, served to the sync,
// and Hull v Everton's records as the pure merge gives them. For the tests only: the second dot
// in this file's name keeps it out of Convex's deploy.

import { vi } from "vitest";
import { internal } from "./_generated/api";
import { codesByOpta } from "./feedIds";
import {
  FPL_BOOTSTRAP_URL,
  FPL_FIXTURES_URL,
  fplLiveUrl,
  plFixturesUrl,
  plFixtureUrl,
  plPlayerStatsUrl,
} from "./football";
import { fplStatLines } from "./fplLive";
import { matchRecords } from "./matchRecords";
import { matchSlots, plStatLines } from "./plMatch";
import { FULL_STATS, MATCH, recordedGw6, type Gw6Payloads } from "./recorded/gw6.payloads";
import { fakeFetch, freshConvex, type TestConvex } from "./test.harness";
import { HOUR_MS } from "./time";

export const GAMEWEEK = 6;
/** FPL's club codes for the two sides. */
const HULL = 88;
const EVERTON = 11;
/** Belloumi's per-season FPL id in the recording, which only the live read carries. */
const BELLOUMI_FPL_ID = 286;

export const HULL_EVERTON = MATCH.hullEverton.code;
/** Hull v Everton's kickoff, as FPL recorded it, and when the tests first read it at full time. */
export const KICKOFF = Date.parse("2026-10-11T13:00:00Z");
export const FULL_TIME_READ = KICKOFF + 2 * HOUR_MS;

/** Every feed's read for gameweek 6 as recorded; a URL containing `refuse` answers `REFUSED_STATUS`. */
function fakeFeeds(payloads: Gw6Payloads, refuse?: string) {
  const bodies = new Map<string, unknown>([
    [FPL_BOOTSTRAP_URL, payloads.fpl.bootstrap],
    [FPL_FIXTURES_URL, payloads.fpl.fixtures],
    [fplLiveUrl(GAMEWEEK), payloads.fpl.live],
    [plFixturesUrl(GAMEWEEK), payloads.pl.round],
    ...payloads.pl.fixtures.map((fixture) => [plFixtureUrl(fixture.id), fixture] as const),
    ...payloads.pl.playerStats.map((read) => [plPlayerStatsUrl(read.player, read.fixture), read.payload] as const),
  ]);
  return fakeFetch(bodies, (url) => refuse !== undefined && url.includes(refuse));
}

/** A test's Convex, holding Hull v Everton as the football sync would. */
export async function withHullEverton() {
  const t = freshConvex();
  await t.run((ctx) =>
    ctx.db.insert("fixtures", {
      code: HULL_EVERTON,
      gameweek: GAMEWEEK,
      homeClubCode: HULL,
      awayClubCode: EVERTON,
      kickoff: KICKOFF,
    }),
  );
  return t;
}

/** Lets `ms` pass, and runs every scheduled function that falls due in it. */
export async function elapse(t: TestConvex, ms: number) {
  vi.advanceTimersByTime(ms);
  await t.finishInProgressScheduledFunctions();
}

/** One sync at `time` against `payloads`, and the run row it recorded. */
export async function syncAt(t: TestConvex, time: number, payloads: Gw6Payloads, refuse?: string) {
  vi.setSystemTime(time);
  vi.stubGlobal("fetch", fakeFeeds(payloads, refuse));
  await t.action(internal.matchStatsSync.run, { trigger: "manual" });
  const [latest] = await t.query(internal.matchStats.latest, {});
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
  const reads = payloads.pl.playerStats.filter((read) => read.fixture === MATCH.hullEverton.pl);
  const { lines } = plStatLines(fixture, new Map(reads.map((read) => [read.player, read.payload])), codeByOpta);
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
  const element = payloads.fpl.live.elements.find((each) => each.id === BELLOUMI_FPL_ID)!;
  element.stats.goals_scored = 0;
  for (const block of element.explain) block.stats = block.stats.filter((stat) => stat.identifier !== "goals_scored");
  const read = hullEvertonRead(payloads, FULL_STATS.belloumi.pl);
  read.stats = read.stats.filter((metric) => !["goals", "goals_openplay"].includes(metric.name));
  return payloads;
}
