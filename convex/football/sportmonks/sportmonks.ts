// Sportmonks' football API (#1391), read from Convex's own servers: the second feed to fill the
// `Football` seam (football.ts), beside FPL's (fpl/fpl.ts), so nothing past the seam knows which
// feed filled it. Slice 1 reads the Scottish Premiership, the league Sportmonks' free plan covers.
// Every club, player and match is keyed on Sportmonks' own id for it (Craig, 9 Nov 2026, on #1196).
// A body of another shape throws, naming what was missing, so a changed payload is a failed run on
// the feeds page, never a guess. Calls a run and a live minute make: ARCHITECTURE.md.

import type { Infer } from "convex/values";
import { TIMEOUT_MS, type Football } from "../football";
import { readEach } from "../scoreReads";
import type { gameweekRecord } from "../../schema";
import { SECOND_MS } from "../../shared/time";
import { smScoreRead } from "./sportmonksMatch";
import { SPORTMONKS, type RawFixture, type RawLeague, type RawRound, type RawSeason, type RawStage, type RawTeam, type SportmonksPayloads } from "./sportmonksRaw";

/** The deployment's setting holding Sportmonks' API token. Unset, nothing reads Sportmonks. */
export const SPORTMONKS_TOKEN_ENV = "SPORTMONKS_API_TOKEN";

const SPORTMONKS_API_BASE = "https://api.sportmonks.com/v3/football";
/** Sportmonks' id for the Scottish Premiership: its free plan's (checked 9 Nov 2026, on #1391). */
export const SCOTTISH_PREMIERSHIP = 501;
/** The most rows Sportmonks gives a page. */
const PER_PAGE = 50;
/** The most matches one `fixtures/multi` read asks for. */
export const MULTI_FIXTURES_MAX = 50;
/** What a live read asks for with each match: its score, clock, lineups, each man's stats and the
 *  events timeline, all in one call. */
const LIVE_INCLUDES = "participants;scores;periods;lineups.details;events";

/** The league, with its current season's id and name. */
export function leagueUrl(): string {
  return `${SPORTMONKS_API_BASE}/leagues/${SCOTTISH_PREMIERSHIP}?include=currentSeason`;
}

/** A season's clubs, each with its squad and each man in it, a page at a time. */
export function seasonTeamsUrl(seasonId: number, page: number): string {
  return `${SPORTMONKS_API_BASE}/teams/seasons/${seasonId}?include=players.player&per_page=${PER_PAGE}&page=${page}`;
}

/** A season's stages, each with its rounds, each round with its matches. */
export function scheduleUrl(seasonId: number): string {
  return `${SPORTMONKS_API_BASE}/schedules/seasons/${seasonId}`;
}

/** Up to `MULTI_FIXTURES_MAX` matches, read whole for the live tick. */
export function liveFixturesUrl(fixtureIds: number[]): string {
  return `${SPORTMONKS_API_BASE}/fixtures/multi/${fixtureIds.join(",")}?include=${LIVE_INCLUDES}`;
}

/** The token, or null where none is set: then nothing reads Sportmonks (the live deployment). */
export function sportmonksToken(): string | null {
  return process.env[SPORTMONKS_TOKEN_ENV] || null;
}

/** One read's `data`, and whether more pages follow. The token goes in a header, so no error or
 *  log line ever holds it. A status that is not OK, or a body with no `data`, throws, naming the
 *  URL and Sportmonks' own message. */
export async function getData<T>(url: string, token: string): Promise<{ data: T; hasMore: boolean }> {
  const res = await fetch(url, { headers: { Authorization: token, Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const body = (await res.json().catch(() => null)) as { data?: T | null; message?: string; pagination?: { has_more?: boolean } } | null;
  const message = body?.message ? `: ${body.message}` : "";
  if (!res.ok) throw new Error(`${url} answered ${res.status}${message}`);
  if (body?.data === undefined || body.data === null) throw new Error(`${url} answered with no data${message}`);
  return { data: body.data, hasMore: body.pagination?.has_more === true };
}

/** The Scottish Premiership's current season, its clubs and squads, and its schedule: three
 *  reads, more only if a season had over `PER_PAGE` clubs. Throws on a failed read. */
export async function readSportmonksPayloads(token: string): Promise<SportmonksPayloads> {
  const { data: league } = await getData<RawLeague>(leagueUrl(), token);
  const season = league.currentseason;
  if (!season) throw new Error(`${SPORTMONKS} sent no current season for league ${SCOTTISH_PREMIERSHIP}`);
  const teams: RawTeam[] = [];
  for (let page = 1, more = true; more; page += 1) {
    const read = await getData<RawTeam[]>(seasonTeamsUrl(season.id, page), token);
    teams.push(...read.data);
    more = read.hasMore;
  }
  const { data: schedule } = await getData<RawStage[]>(scheduleUrl(season.id), token);
  return { league, teams, schedule };
}

/** The Scottish Premiership as the seam takes it. */
export async function readSportmonks(token: string): Promise<Football> {
  return mapSportmonks(await readSportmonksPayloads(token));
}

/** The year a season named "2025/2026" starts. */
function seasonStart(season: RawSeason): number {
  const year = Number.parseInt(season.name, 10);
  if (!Number.isInteger(year)) throw new Error(`${SPORTMONKS} sent season name ${JSON.stringify(season.name)}`);
  return year;
}

/** The payloads as the seam's records: each club, each squad's men (a man in two squads once,
 *  under the club listed last), each round as a gameweek and each match under its round's number. */
export function mapSportmonks({ league, teams, schedule }: SportmonksPayloads): Football {
  if (!league.currentseason) throw new Error(`${SPORTMONKS} sent no current season`);
  const season = seasonStart(league.currentseason);
  if (teams.length === 0) throw new Error(`${SPORTMONKS} sent no clubs`);
  const clubs = teams.map((team) => ({ code: team.id, name: team.name, shortName: team.short_code ?? team.name.slice(0, 3).toUpperCase() }));
  const players = new Map<number, Football["players"][number]>();
  for (const team of teams) {
    for (const man of team.players ?? []) {
      if (!man.player) throw new Error(`${SPORTMONKS} sent squad man ${man.player_id} of club ${team.id} with no player`);
      const { id, name, display_name, common_name } = man.player;
      players.set(id, { code: id, name: display_name ?? common_name ?? name, fullName: name, clubCode: team.id });
    }
  }
  const gameweeks: Infer<typeof gameweekRecord>[] = [];
  const fixtures: Football["fixtures"] = [];
  const matches: RawFixture[] = [];
  for (const round of schedule.flatMap((stage) => stage.rounds ?? [])) {
    const number = roundNumber(round);
    const kickoffs: number[] = [];
    for (const match of round.fixtures ?? []) {
      const kickoff = kickoffOf(match);
      if (kickoff !== null) kickoffs.push(kickoff);
      const { home, away } = sides(match);
      fixtures.push({ code: match.id, gameweek: number, homeClubCode: home, awayClubCode: away, kickoff });
      matches.push(match);
    }
    // Sportmonks has no deadline: a round's is its first kickoff, as a league works its own out.
    if (kickoffs.length > 0) gameweeks.push({ season, number, deadline: Math.min(...kickoffs) });
  }
  return {
    clubs,
    players: [...players.values()],
    fixtures,
    gameweeks,
    betweenSeasons: fixtures.length === 0,
    scores: readEach(matches, (match) => match.id, smScoreRead),
  };
}

function roundNumber(round: RawRound): number {
  const number = Number.parseInt(round.name, 10);
  if (!Number.isInteger(number)) throw new Error(`${SPORTMONKS} sent round ${round.id} named ${JSON.stringify(round.name)}`);
  return number;
}

/** A match's kickoff in epoch milliseconds, null while it has none. Sportmonks' times are UTC. */
function kickoffOf(match: RawFixture): number | null {
  if (typeof match.starting_at_timestamp === "number") return match.starting_at_timestamp * SECOND_MS;
  if (match.starting_at === null) return null;
  const at = Date.parse(`${match.starting_at.replace(" ", "T")}Z`);
  if (Number.isNaN(at)) throw new Error(`${SPORTMONKS} sent kickoff ${JSON.stringify(match.starting_at)} for match ${match.id}`);
  return at;
}

/** A match's home and away clubs, by their `meta.location`. */
function sides(match: RawFixture): { home: number; away: number } {
  const at = (location: string) => match.participants?.find((side) => side.meta?.location === location)?.id;
  const home = at("home");
  const away = at("away");
  if (home === undefined || away === undefined) throw new Error(`${SPORTMONKS} sent match ${match.id} with no home or away club`);
  return { home, away };
}
