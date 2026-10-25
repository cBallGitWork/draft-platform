// scripts/record-match.mjs loads this under plain node: import only types, or other files by explicit `.ts` path.
// The two public football feeds, read from Convex's own servers. The URLs and the browser
// User-Agent are copied from epl-draft's packages/core (17 Oct 2026), not shared.

import type { Infer } from "convex/values";
import type { clubRecord, fixtureRecord, gameweekRecord, playerRecord } from "../schema";
import type { ScoreReads } from "./scoreReads";

/** The football layer's one seam: the real Premier League as any feed hands it to the platform.
 *  FPL's feed fills it today (`fpl.ts`); a paid feed replaces it by returning the same. */
export interface Football {
  clubs: Infer<typeof clubRecord>[];
  players: Infer<typeof playerRecord>[];
  fixtures: Infer<typeof fixtureRecord>[];
  gameweeks: Infer<typeof gameweekRecord>[];
  /** Each match's score and clock, or why the feed's read gives none. */
  scores: ScoreReads;
}

export const FPL_API_BASE = "https://fantasy.premierleague.com/api";
/** Players, clubs and gameweeks. */
export const FPL_BOOTSTRAP_URL = `${FPL_API_BASE}/bootstrap-static/`;
/** Every match of the season. */
export const FPL_FIXTURES_URL = `${FPL_API_BASE}/fixtures/`;
export const PL_API_BASE = "https://footballapi.pulselive.com/football";
/** The Premier League's id for its own competition. */
export const PL_COMPETITION = 1;
/** The year the season the two ids below name starts: 2026 for 2026/27. Each summer, the three
 *  change together (#201). */
export const PL_SEASON_START_YEAR = 2026;
/** The Premier League's id for this season, PL_SEASON_START_YEAR's (from `/competitions/1/compseasons`). */
export const PL_COMP_SEASON = 841;
/** The Premier League's id for the season before. */
export const PL_LAST_COMP_SEASON = 777;
/** `Date.UTC`'s month for July: a season's last match is in May and the next one's first in August,
 *  so from 1 July after it ends, its ids are out of date. */
const JULY = 6;
/** The year the season `at` falls in starts, 2026 for 2026/27: a season runs from 1 July (JULY)
 *  to 30 June. The one way the platform knows a season (#355). */
export function seasonStartYear(at: number): number {
  const date = new Date(at);
  return date.getUTCFullYear() - (date.getUTCMonth() < JULY ? 1 : 0);
}
/** When PL_COMP_SEASON and PL_LAST_COMP_SEASON stop naming this season and the last. */
export const PL_SEASON_IDS_STALE_FROM = Date.UTC(PL_SEASON_START_YEAR + 1, JULY, 1);
/** Why every Premier League read naming a season fails from PL_SEASON_IDS_STALE_FROM. */
export const PL_SEASON_IDS_STALE =
  `The Premier League season ids (PL_COMP_SEASON ${PL_COMP_SEASON}, PL_LAST_COMP_SEASON ${PL_LAST_COMP_SEASON}) are for ` +
  `${PL_SEASON_START_YEAR}/${String(PL_SEASON_START_YEAR + 1).slice(-2)}, which has ended: update them and ` +
  `PL_SEASON_START_YEAR in convex/football/football.ts from ${PL_API_BASE}/competitions/${PL_COMPETITION}/compseasons.`;

/** Throws once the season ids are out of date, so the rollover fails loudly instead of quietly
 *  reading old seasons' squads and fixtures (#201). */
function requireCurrentSeasonIds(): void {
  if (Date.now() >= PL_SEASON_IDS_STALE_FROM) throw new Error(PL_SEASON_IDS_STALE);
}
/** The Premier League's id for Arsenal, whose squad list proves squad numbers can be read. */
export const PL_ARSENAL = 1;

/** A club's registered squad this season, each man with his squad number, his label and, asked
 *  with `altIds=true`, the join to FPL. */
export function plSquadUrl(teamId: number): string {
  requireCurrentSeasonIds();
  return `${PL_API_BASE}/teams/${teamId}/compseasons/${PL_COMP_SEASON}/staff?type=all&altIds=true`;
}

/** A gameweek's live stats, per player. */
export function fplLiveUrl(gameweek: number): string {
  return `${FPL_API_BASE}/event/${gameweek}/live/`;
}

/** The most fixtures one read of the list asks for: a season's 380 in one page. */
export const PL_FIXTURES_PAGE_SIZE = 400;

/** One gameweek's fixtures, or the season's when omitted; this season's unless another is named.
 *  It always asks for `altIds`: without it the fixtures arrive with no join to FPL, and nothing
 *  says so. */
export function plFixturesUrl(gameweek?: number, compSeason = PL_COMP_SEASON): string {
  requireCurrentSeasonIds();
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
  const page = (await getJson(plFixturesUrl())) as RawPlFixturePage;
  return page.content.length;
}

export async function arsenalSquadNumbers(): Promise<number> {
  const staff = (await getJson(plSquadUrl(PL_ARSENAL))) as RawPlStaff;
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
