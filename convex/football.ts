// The two public football feeds, read from Convex's own servers. The URLs and the browser
// User-Agent are copied from epl-draft's packages/core (17 Oct 2026), not shared.

import type { Infer } from "convex/values";
import type { clubRecord, fixtureRecord, gameweekRecord, playerRecord } from "./schema";

/** The football layer's one seam: the real Premier League as any feed hands it to the platform.
 *  FPL's feed fills it today (`fpl.ts`); a paid feed replaces it by returning the same. */
export interface Football {
  clubs: Infer<typeof clubRecord>[];
  players: Infer<typeof playerRecord>[];
  fixtures: Infer<typeof fixtureRecord>[];
  gameweeks: Infer<typeof gameweekRecord>[];
}

export const FPL_API_BASE = "https://fantasy.premierleague.com/api";
/** Players, clubs and gameweeks. */
export const FPL_BOOTSTRAP_URL = `${FPL_API_BASE}/bootstrap-static/`;
/** Every match of the season. */
export const FPL_FIXTURES_URL = `${FPL_API_BASE}/fixtures/`;
export const PL_API_BASE = "https://footballapi.pulselive.com/football";
/** The Premier League's id for its own competition. */
export const PL_COMPETITION = 1;
/** The Premier League's id for the 2026/27 season. */
export const PL_COMP_SEASON = 841;
/** The Premier League's id for Arsenal, whose squad list proves squad numbers can be read. */
export const PL_ARSENAL = 1;

/** A gameweek's live stats, per player. */
export function fplLiveUrl(gameweek: number): string {
  return `${FPL_API_BASE}/event/${gameweek}/live/`;
}

/** One gameweek's fixtures, or the season's when omitted. It always asks for `altIds`: without it
 *  the fixtures arrive with no join to FPL, and nothing says so. */
export function plFixturesUrl(gameweek?: number): string {
  const round = gameweek === undefined ? "" : `&gameweekNumbers=${gameweek}`;
  return (
    `${PL_API_BASE}/fixtures?comps=${PL_COMPETITION}&compSeasons=${PL_COMP_SEASON}` +
    `${round}&pageSize=400&page=0&sort=asc&altIds=true`
  );
}

export function plFixtureUrl(fixtureId: number): string {
  return `${PL_API_BASE}/fixtures/${fixtureId}`;
}

export function plPlayerStatsUrl(playerId: number, fixtureId: number): string {
  return `${PL_API_BASE}/stats/player/${playerId}?fixtures=${fixtureId}`;
}

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";
// A feed that never answers would otherwise hold the action until Convex kills it.
const TIMEOUT_MS = 15_000;

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

interface RawBootstrap {
  elements: unknown[];
}

interface RawPlFixturePage {
  content: unknown[];
}

/** `/teams/{id}/compseasons/{season}/staff`: a club's registered squad, each with his squad number. */
export interface RawPlStaff {
  players: { id: number; info?: { shirtNum?: number } }[];
}

export async function fplPlayerCount(): Promise<number> {
  const bootstrap = (await getJson(FPL_BOOTSTRAP_URL)) as RawBootstrap;
  return bootstrap.elements.length;
}

export async function plFixtureCount(): Promise<number> {
  const page = (await getJson(
    `${PL_API_BASE}/fixtures?comps=1&compSeasons=${PL_COMP_SEASON}&pageSize=400&page=0&altIds=true`,
  )) as RawPlFixturePage;
  return page.content.length;
}

export async function arsenalSquadNumbers(): Promise<number> {
  const staff = (await getJson(
    `${PL_API_BASE}/teams/${PL_ARSENAL}/compseasons/${PL_COMP_SEASON}/staff?type=all`,
  )) as RawPlStaff;
  return squadNumbers(staff).size;
}

/** Premier League player id → squad number, for every registered player who has one. */
export function squadNumbers(staff: RawPlStaff): Map<number, number> {
  const numbers = new Map<number, number>();
  for (const player of staff.players) {
    const shirt = player.info?.shirtNum;
    if (shirt !== undefined) numbers.set(player.id, shirt);
  }
  return numbers;
}
