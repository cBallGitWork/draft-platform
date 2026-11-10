// Sportmonks' reads' tests' shared setup (#1391, #1414): a fake Sportmonks answering each URL with
// the recorded Scottish Premiership, and a second competition, the Premier League, made from it,
// the clock at 67 minutes into the recorded live match, and the run rows read back.

import { afterEach, beforeEach, expect, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { leagueUrl, liveFixturesUrl, scheduleUrl, SEEDED_COMPETITIONS, seasonTeamsUrl, SPORTMONKS_TOKEN_ENV } from "../../../convex/football/sportmonks/sportmonks";
import type { SportmonksPayloads } from "../../../convex/football/sportmonks/sportmonksRaw";
import { MINUTE_MS } from "../../../convex/shared/time";
import { SM, sportmonksLiveRead, sportmonksSeason } from "../recorded/sportmonks.payloads";
import type { TestConvex } from "./test.harness";

export const TOKEN = "test-token";
export const SEASON_ID = 25598;
export const SCOTTISH = 501;
export const PREMIER_LEAGUE = 8;
/** The Premier League's copy of the Scottish recording: every Sportmonks id moved on by this. */
export const PL_SHIFT = 1_000_000_000;
const OLD_FIRM_KICKOFF = Date.parse("2026-11-08T12:00:00Z");
/** The live read's clock: 67 minutes in. */
export const LIVE_NOW = OLD_FIRM_KICKOFF + 70 * MINUTE_MS;
export const WRITES = (n: number) => ({ received: n, inserted: n, updated: 0, marked: 0, unmarked: 0 });
export const REFUSED = "You do not have access to this endpoint.";

/** The Scottish recording as a second competition's, the Premier League's, every id moved on by
 *  `PL_SHIFT`: no Premier League read is recorded until the paid plan covers it. */
function premierLeagueSeason(): SportmonksPayloads {
  const season = sportmonksSeason();
  const shift = (id: number) => id + PL_SHIFT;
  season.league.id = PREMIER_LEAGUE;
  if (season.league.currentseason) season.league.currentseason.id = shift(SEASON_ID);
  for (const team of season.teams) {
    team.id = shift(team.id);
    for (const man of team.players ?? []) {
      man.player_id = shift(man.player_id);
      if (man.player) man.player.id = shift(man.player.id);
    }
  }
  for (const round of season.schedule.flatMap((stage) => stage.rounds ?? [])) {
    round.id = shift(round.id);
    for (const match of round.fixtures ?? []) {
      match.id = shift(match.id);
      for (const side of match.participants ?? []) side.id = shift(side.id);
    }
  }
  return season;
}

/** The six-hourly read's bodies for one competition, by URL. */
function seasonBodies(leagueId: number, seasonId: number, season: SportmonksPayloads): Record<string, unknown> {
  return {
    [leagueUrl(leagueId)]: { data: season.league },
    [seasonTeamsUrl(seasonId, 1)]: { data: season.teams, pagination: { has_more: false } },
    [scheduleUrl(seasonId)]: { data: season.schedule },
  };
}

/** Sportmonks as these payloads, each URL its body, `refuse` answering 403; the token asked for
 *  in the header. */
export function fakeSportmonks({ refuse, season = sportmonksSeason() }: { refuse?: string; season?: SportmonksPayloads } = {}) {
  const bodies: Record<string, unknown> = {
    ...seasonBodies(SCOTTISH, SEASON_ID, season),
    ...seasonBodies(PREMIER_LEAGUE, SEASON_ID + PL_SHIFT, premierLeagueSeason()),
    [liveFixturesUrl([SM.oldFirm])]: sportmonksLiveRead(),
  };
  return vi.fn(async (url: string, init?: RequestInit) => {
    expect((init?.headers as Record<string, string>).Authorization).toBe(TOKEN);
    if (url === refuse) return Response.json({ message: REFUSED }, { status: 403 });
    if (!(url in bodies)) throw new Error(`no fake for ${url}`);
    return Response.json(bodies[url]);
  });
}

/** Each test at `LIVE_NOW`, with the token set. */
export function useSportmonks() {
  beforeEach(() => {
    vi.useFakeTimers({ now: LIVE_NOW });
    vi.stubEnv(SPORTMONKS_TOKEN_ENV, TOKEN);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
}

export const syncs = (t: TestConvex) => t.run((ctx) => ctx.db.query("sportmonksSyncs").collect());
export const ticks = (t: TestConvex) => t.run((ctx) => ctx.db.query("sportmonksLiveTicks").collect());

/** One six-hourly run, by hand, against a fake Sportmonks. */
export async function sync(t: TestConvex, payloads: Parameters<typeof fakeSportmonks>[0] = {}) {
  vi.stubGlobal("fetch", fakeSportmonks(payloads));
  await t.action(internal.football.sportmonks.sportmonksSync.run, { trigger: "manual" });
}

/** Both seeded competitions held, the Premier League turned on as well. */
export function premierLeagueOn(t: TestConvex) {
  return t.run(async (ctx) => {
    for (const competition of SEEDED_COMPETITIONS) await ctx.db.insert("sportmonksCompetitions", { ...competition, on: true });
  });
}
