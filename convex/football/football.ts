// scripts/record-match.mjs loads this under plain node: import only types, or other files by explicit `.ts` path.
// The two public football feeds, read from Convex's own servers. The URLs and the browser
// User-Agent are copied from epl-draft's packages/core (17 Oct 2026), not shared.

import type { Infer } from "convex/values";
import type { clubRow, fixtureRecord, gameweekRecord, playerRecord } from "../schema";
import type { ScoreReads } from "./scoreReads";

/** The football layer's one seam: the real Premier League as any feed hands it to the platform.
 *  FPL's feed fills it today (`fpl.ts`); a paid feed replaces it by returning the same. */
export interface Football {
  clubs: Infer<typeof clubRow>[];
  players: Infer<typeof playerRecord>[];
  fixtures: Infer<typeof fixtureRecord>[];
  gameweeks: Infer<typeof gameweekRecord>[];
  /** The feed sent no fixtures between seasons, so `fixtures` is empty and no held match may be
   *  marked as dropped for it (#66). */
  betweenSeasons: boolean;
  /** Each match's score and clock, or why the feed's read gives none. */
  scores: ScoreReads;
}

const FPL_API_BASE = "https://fantasy.premierleague.com/api";
/** Players, clubs and gameweeks. */
export const FPL_BOOTSTRAP_URL = `${FPL_API_BASE}/bootstrap-static/`;
/** Every match of the season. */
export const FPL_FIXTURES_URL = `${FPL_API_BASE}/fixtures/`;
const PL_API_BASE = "https://footballapi.pulselive.com/football";
/** The Premier League's id for its own competition. */
const PL_COMPETITION = 1;
/** More than every season the Premier League has held (35 in 2026), in one page. */
const PL_COMP_SEASONS_PAGE_SIZE = 100;

/** Every season the Premier League has held, each with its own id for it, newest first. An entry is
 *  a label and an id, no dates, and the labels' formats differ ("English Premier League Season
 *  2026/2027", "2025/26"): checked 31 Oct 2026, 35 seasons. */
export function plCompSeasonsUrl(): string {
  return `${PL_API_BASE}/competitions/${PL_COMPETITION}/compseasons?pageSize=${PL_COMP_SEASONS_PAGE_SIZE}`;
}

/** The Premier League's ids for the season FPL is on and the one before, worked out once per run
 *  from its list of seasons (#300). */
export interface PlSeasons {
  current: number;
  last: number;
}

/** A club's registered squad in `compSeason`, each man with his squad number, his label and, asked
 *  with `altIds=true`, the join to FPL. */
export function plSquadUrl(teamId: number, compSeason: number): string {
  return `${PL_API_BASE}/teams/${teamId}/compseasons/${compSeason}/staff?type=all&altIds=true`;
}

/** A gameweek's live stats, per player. */
export function fplLiveUrl(gameweek: number): string {
  return `${FPL_API_BASE}/event/${gameweek}/live/`;
}

/** The most fixtures one read of the list asks for: a season's 380 in one page. */
const PL_FIXTURES_PAGE_SIZE = 400;

/** `compSeason`'s fixtures in one gameweek, or all of them when it is omitted. It always asks for
 *  `altIds`: without it the fixtures arrive with no join to FPL, and nothing says so. */
export function plFixturesUrl(compSeason: number, gameweek?: number): string {
  const round = gameweek === undefined ? "" : `&gameweekNumbers=${gameweek}`;
  return (
    `${PL_API_BASE}/fixtures?comps=${PL_COMPETITION}&compSeasons=${compSeason}` +
    `${round}&pageSize=${PL_FIXTURES_PAGE_SIZE}&page=0&sort=asc&altIds=true`
  );
}

export function plFixtureUrl(fixtureId: number): string {
  return `${PL_API_BASE}/fixtures/${fixtureId}`;
}

export function plPlayerStatsUrl(playerId: number, fixtureId: number): string {
  return `${PL_API_BASE}/stats/player/${playerId}?fixtures=${fixtureId}`;
}

/** The most commentary lines one read of the stream asks for. The most seen in a match is 133. */
export const PL_COMMENTARY_PAGE_SIZE = 200;

/** A match's commentary, newest first. It needs no `Origin` header (docs/pl-commentary.md). */
export function plCommentaryUrl(fixtureId: number): string {
  return `${PL_API_BASE}/fixtures/${fixtureId}/textstream/EN?pageSize=${PL_COMMENTARY_PAGE_SIZE}&sort=desc`;
}

/** Both sides' Opta totals for one match: shots, possession, corners, cards and the rest. */
export function plTeamStatsUrl(fixtureId: number): string {
  return `${PL_API_BASE}/stats/match/${fixtureId}`;
}

/** Who the feeds are told is asking. Exported for scripts/record-match.mjs, which reads with it. */
export const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";
// A feed that never answers would otherwise hold the action until Convex kills it.
export const TIMEOUT_MS = 15_000;

/** The body as JSON; a status that is not OK throws, naming the URL and the status. */
export async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.json();
}

/** The body as JSON once `fits` passes it. A body of another shape is a changed payload: it throws
 *  here, naming the URL and what was missing, rather than fail later somewhere unrelated. */
export async function getShaped<T>(
  url: string,
  missing: string,
  fits: (body: Record<string, any>) => boolean,
): Promise<T> {
  const body = await getJson(url);
  if (typeof body !== "object" || body === null || !fits(body)) {
    throw new Error(`${url} answered with no ${missing}`);
  }
  return body as T;
}

const isNumber = (value: unknown): value is number => typeof value === "number";
/** An id the feeds send as a number (the Premier League's arrive as `128978.0`, still a number). */
export const hasId = (value: unknown): boolean => isNumber((value as { id?: unknown } | null)?.id);
