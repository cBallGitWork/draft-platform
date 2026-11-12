// Sportmonks' football API (#1391), read from Convex's own servers: the second feed to fill the
// `Football` seam (football.ts), beside FPL's (fpl/fpl.ts), so nothing past the seam knows which
// feed filled it. It reads each competition on the list that is on (#1414): for now the Scottish
// Premiership, the league Sportmonks' free plan covers.
// Every club, player and match is keyed on Sportmonks' own id for it (Craig, 9 Nov 2026, on #1196).
// A body of another shape throws, naming what was missing, so a changed payload is a failed run on
// the feeds page, never a guess. Calls a run and a live minute make: ARCHITECTURE.md.

import type { Infer } from "convex/values";
import { TIMEOUT_MS, type Football } from "../football";
import { firstKickoffs } from "../../gameweeks/gameweekStarts";
import { readEach } from "../scoreReads";
import type { gameweekRecord, sportmonksCompetition } from "../../schema";
import { SECOND_MS } from "../../shared/time";
import { smScoreRead } from "./sportmonksMatch";
import { AWAY, HOME, SPORTMONKS, type RawFixture, type RawLeague, type RawRound, type RawSeason, type RawSideline, type RawStage, type RawTeam, type SportmonksPayloads } from "./sportmonksRaw";

/** The deployment's setting holding Sportmonks' API token. Unset, nothing reads Sportmonks. */
export const SPORTMONKS_TOKEN_ENV = "SPORTMONKS_API_TOKEN";

const SPORTMONKS_API_BASE = "https://api.sportmonks.com/v3/football";
export type SportmonksCompetition = Infer<typeof sportmonksCompetition>;
/** The competitions the beta plays on (SPEC, *What it is*; Craig, #1196), the list's first rows:
 *  the Scottish Premiership, on the free plan (checked 9 Nov 2026, on #1391), and the Premier
 *  League, off until the paid plan covers it. A deployment holding none starts from these. */
export const SEEDED_COMPETITIONS: readonly SportmonksCompetition[] = [
  { name: "Scottish Premiership", competition: 501, on: true },
  { name: "Premier League", competition: 8, on: false },
];
/** The most rows Sportmonks gives a page. */
const PER_PAGE = 50;
/** The most matches one `fixtures/multi` read asks for. */
export const MULTI_FIXTURES_MAX = 50;
/** What a live read asks for with each match: its score, clock, lineups, each man's stats and the
 *  events timeline, all in one call. */
const LIVE_INCLUDES = "participants;scores;periods;lineups.details;events";
/** What a squad read asks for: each man himself, and the club's men out injured or suspended,
 *  each named by its type (#1420). */
const SQUAD_INCLUDES = "players.player;sidelined.type";
/** What the positions read asks for with each squad man: himself, with Sportmonks' positions for him. */
export const POSITIONS_SQUAD_INCLUDES = "players.player.position;players.player.detailedPosition";
/** What the positions read asks for with each played match: each side's formation and where each
 *  man lined up in it. */
const LINEUPS_INCLUDES = "formations;lineups.detailedPosition";

/** A league, with its current season's id and name. */
export function leagueUrl(leagueId: number): string {
  return `${SPORTMONKS_API_BASE}/leagues/${leagueId}?include=currentSeason`;
}

/** A league, with its current season and every season it has had: the positions read's. */
export function leagueSeasonsUrl(leagueId: number): string {
  return `${leagueUrl(leagueId)};seasons`;
}

/** A season's clubs, each with its squad and each man in it, a page at a time. */
export function seasonTeamsUrl(seasonId: number, page: number, include = SQUAD_INCLUDES): string {
  return `${SPORTMONKS_API_BASE}/teams/seasons/${seasonId}?include=${include}&per_page=${PER_PAGE}&page=${page}`;
}

/** A season's stages, each with its rounds, each round with its matches. */
export function scheduleUrl(seasonId: number): string {
  return `${SPORTMONKS_API_BASE}/schedules/seasons/${seasonId}`;
}

/** Up to `MULTI_FIXTURES_MAX` matches, read whole for the live tick. */
export function liveFixturesUrl(fixtureIds: number[]): string {
  return `${SPORTMONKS_API_BASE}/fixtures/multi/${fixtureIds.join(",")}?include=${LIVE_INCLUDES}`;
}

/** Up to `MULTI_FIXTURES_MAX` played matches, each with its formations and lineups. */
export function lineupsUrl(fixtureIds: number[]): string {
  return `${SPORTMONKS_API_BASE}/fixtures/multi/${fixtureIds.join(",")}?include=${LINEUPS_INCLUDES}`;
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

/** A league's current season, its clubs and squads, and its schedule: three reads, more only if a
 *  season had over `PER_PAGE` clubs. Throws on a failed read. */
export async function readSportmonksPayloads(token: string, leagueId: number): Promise<SportmonksPayloads> {
  const { data: league } = await getData<RawLeague>(leagueUrl(leagueId), token);
  const season = league.currentseason;
  if (!season) throw new Error(`${SPORTMONKS} sent no current season for league ${leagueId}`);
  const teams = await readSeasonTeams(season.id, token);
  const { data: schedule } = await getData<RawStage[]>(scheduleUrl(season.id), token);
  return { league, teams, schedule };
}

/** A season's clubs with their squads, every page, each man with `include`'s. */
export async function readSeasonTeams(seasonId: number, token: string, include = SQUAD_INCLUDES): Promise<RawTeam[]> {
  const teams: RawTeam[] = [];
  for (let page = 1, more = true; more; page += 1) {
    const read = await getData<RawTeam[]>(seasonTeamsUrl(seasonId, page, include), token);
    teams.push(...read.data);
    more = read.hasMore;
  }
  return teams;
}

/** A league as the seam takes it. */
export async function readSportmonks(token: string, leagueId: number): Promise<Football> {
  return mapSportmonks(await readSportmonksPayloads(token, leagueId));
}

/** The year a season named "2025/2026" starts. */
export function seasonStart(season: RawSeason): number {
  const year = Number.parseInt(season.name, 10);
  if (!Number.isInteger(year)) throw new Error(`${SPORTMONKS} sent season name ${JSON.stringify(season.name)}`);
  return year;
}

/** A club's short name: Sportmonks' `short_code`, or, where it sends none, the name's first three
 *  letters, logged so a club standing on the made-up one shows in the run's logs. */
function shortNameOf(team: RawTeam): string {
  if (team.short_code) return team.short_code;
  const made = team.name.slice(0, 3).toUpperCase();
  console.warn(`${SPORTMONKS} sent club ${team.id} (${team.name}) with no short_code; using ${made}`);
  return made;
}

/** The payloads as the seam's records: each club, each squad's men (a man in two squads once,
 *  under the club listed last), each round as a gameweek (rounds sharing a number as one) and each match under its round's number. */
export function mapSportmonks({ league, teams, schedule }: SportmonksPayloads): Football {
  if (!league.currentseason) throw new Error(`${SPORTMONKS} sent no current season`);
  const season = seasonStart(league.currentseason);
  if (teams.length === 0) throw new Error(`${SPORTMONKS} sent no clubs`);
  const clubs = teams.map((team) => ({ code: team.id, name: team.name, shortName: shortNameOf(team) }));
  const players = new Map<number, Football["players"][number]>();
  const out = openSidelines(teams);
  for (const team of teams) {
    for (const man of team.players ?? []) {
      if (!man.player) throw new Error(`${SPORTMONKS} sent squad man ${man.player_id} of club ${team.id} with no player`);
      const { id, name, display_name, common_name } = man.player;
      players.set(id, { code: id, name: display_name ?? common_name ?? name, fullName: name, clubCode: team.id, ...availabilityOf(out.get(id)) });
    }
  }
  const fixtures: Football["fixtures"] = [];
  const matches: RawFixture[] = [];
  for (const round of schedule.flatMap((stage) => stage.rounds ?? [])) {
    const number = roundNumber(round);
    for (const match of round.fixtures ?? []) {
      const { home, away } = sides(match);
      fixtures.push({ code: match.id, gameweek: number, homeClubCode: home, awayClubCode: away, kickoff: kickoffOf(match) });
      matches.push(match);
    }
  }
  // Sportmonks has no deadline: a round's is its first kickoff, as a league works its own out. By
  // round number: after the Scottish split two stages each hold a round 34, one gameweek here.
  const gameweeks: Infer<typeof gameweekRecord>[] = [...firstKickoffs(fixtures)].map(([number, deadline]) => ({ season, number, deadline }));
  return {
    clubs,
    players: [...players.values()],
    fixtures,
    gameweeks,
    betweenSeasons: fixtures.length === 0,
    scores: readEach(matches, (match) => match.id, smScoreRead),
  };
}

/** Each man's open injury or suspension, by his Sportmonks id: of two, the one ending last, one
 *  with no return date counting as last. A finished one (`completed`) keeps no one out, and one
 *  with `completed` unsent counts as open. One for a man in no club's squad is kept here but never
 *  read, since only squad men become players: he has no row for it to mark. */
function openSidelines(teams: RawTeam[]): Map<number, RawSideline> {
  const open = new Map<number, RawSideline>();
  for (const sideline of teams.flatMap((team) => team.sidelined ?? [])) {
    if (sideline.completed === true) continue;
    const held = open.get(sideline.player_id);
    if (held === undefined || endsLater(sideline, held)) open.set(sideline.player_id, sideline);
  }
  return open;
}

function endsLater(one: RawSideline, other: RawSideline): boolean {
  if (!other.end_date) return false;
  return !one.end_date || one.end_date > other.end_date;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A man's availability from his open injury or suspension: out, its name and his expected return
 *  where Sportmonks sends one in `news`, "Hamstring Injury - Expected back 22 Nov" as FPL words
 *  it; with none, available. Nothing is doubtful: Sportmonks sends no doubts (Craig, 10 Nov 2026,
 *  on #1420: "Injured or banned = out"). The admin's setting over it is read apart (spec/06). */
function availabilityOf(sideline: RawSideline | undefined): Pick<Football["players"][number], "availability" | "news"> {
  if (sideline === undefined) return { availability: "available", news: "" };
  const reason = sideline.type?.name ?? sideline.category;
  if (!reason) throw new Error(`${SPORTMONKS} sent sideline ${sideline.id} of player ${sideline.player_id} with no type or category`);
  return { availability: "out", news: sideline.end_date ? `${reason} - Expected back ${dayMonth(sideline.end_date)}` : reason };
}

/** "2026-11-22" as "22 Nov". */
function dayMonth(date: string): string {
  const [, monthText, dayText] = /^\d{4}-(\d{2})-(\d{2})/.exec(date) ?? [];
  const month = MONTHS[Number(monthText) - 1];
  if (month === undefined || dayText === undefined) throw new Error(`${SPORTMONKS} sent sideline end date ${JSON.stringify(date)}`);
  return `${Number(dayText)} ${month}`;
}

function roundNumber(round: RawRound): number {
  const number = Number.parseInt(round.name, 10);
  if (!Number.isInteger(number)) throw new Error(`${SPORTMONKS} sent round ${round.id} named ${JSON.stringify(round.name)}`);
  return number;
}

/** A match's kickoff in epoch milliseconds, null while it has none. Sportmonks' times are UTC. */
export function kickoffOf(match: RawFixture): number | null {
  if (typeof match.starting_at_timestamp === "number") return match.starting_at_timestamp * SECOND_MS;
  if (match.starting_at === null) return null;
  const at = Date.parse(`${match.starting_at.replace(" ", "T")}Z`);
  if (Number.isNaN(at)) throw new Error(`${SPORTMONKS} sent kickoff ${JSON.stringify(match.starting_at)} for match ${match.id}`);
  return at;
}

/** A match's home and away clubs, by their `meta.location`. */
export function sides(match: RawFixture): { home: number; away: number } {
  const at = (location: string) => match.participants?.find((side) => side.meta?.location === location)?.id;
  const home = at(HOME);
  const away = at(AWAY);
  if (home === undefined || away === undefined) throw new Error(`${SPORTMONKS} sent match ${match.id} with no home or away club`);
  return { home, away };
}
