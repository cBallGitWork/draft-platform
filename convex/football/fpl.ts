// FPL's public API, mapped onto the football layer's seam (`Football`, in football.ts). The raw
// shapes and the mapping are copied from epl-draft's packages/core/src/football/fpl/ (raw.ts,
// map.ts and client.ts, 19 Oct 2026), not shared, and cut to the fields #21 holds and each
// player's news (#381). One change: FPL names a club by its per-season id, and this hands on the
// club's season-stable code instead.

import { FPL_BOOTSTRAP_URL, FPL_FIXTURES_URL, getJson, getShaped, type Football } from "./football";

// The shapes FPL's public API returns: data we do not control. Only the fields read below are typed.

interface RawTeam {
  /** Per season, so never persisted: only used to find the club's `code`. */
  id: number;
  code: number;
  name: string;
  short_name: string;
}

interface RawElement {
  /** Per season, so never persisted. */
  id: number;
  code: number;
  web_name: string;
  first_name: string;
  second_name: string;
  /** The club's per-season id. */
  team: number;
  /** Why he may miss the next match, e.g. "Back injury - Unknown return date"; "" with nothing to say. */
  news: string;
  /** The chance he plays in the next round, in percent; null while FPL has no doubt about him. */
  chance_of_playing_next_round: number | null;
  /** `"p"` + `code`: the Premier League's `altIds.opta` for him, the join between the two feeds. */
  opta_code: string | null;
}

interface RawEvent {
  /** The gameweek's number. */
  id: number;
  /** ISO, e.g. "2026-08-21T17:30:00Z". */
  deadline_time: string;
}

export interface RawBootstrap {
  teams: RawTeam[];
  elements: RawElement[];
  events: RawEvent[];
}

export interface RawFixture {
  /** Per season, so never persisted. */
  id: number;
  /** The season-stable id, the one that may be persisted. */
  code: number;
  event: number | null;
  kickoff_time: string | null;
  team_h: number;
  team_a: number;
}

/** Bootstrap and the season's fixtures as FPL sent them. */
export async function readFplPayloads(): Promise<{ bootstrap: RawBootstrap; fixtures: RawFixture[] }> {
  const [bootstrap, fixtures] = await Promise.all([getJson(FPL_BOOTSTRAP_URL), getJson(FPL_FIXTURES_URL)]);
  return { bootstrap: bootstrap as RawBootstrap, fixtures: fixtures as RawFixture[] };
}

/** Bootstrap and the season's fixtures, mapped onto the seam. */
export async function readFpl(): Promise<Football> {
  const { bootstrap, fixtures } = await readFplPayloads();
  return mapFpl(bootstrap, fixtures);
}

/** Bootstrap as FPL sent it, for what the seam leaves out: each player's join to the Premier
 *  League (`codesByOpta` in feedIds.ts). */
export async function readFplBootstrap(): Promise<RawBootstrap> {
  return getShaped<RawBootstrap>(FPL_BOOTSTRAP_URL, "list of players", (body) => Array.isArray(body.elements));
}

/** Pure raw → seam mapping: no I/O and no clock, so the same payloads always give the same records. */
export function mapFpl(bootstrap: RawBootstrap, fixtures: RawFixture[]): Football {
  const clubCode = clubCodes(bootstrap.teams);
  // Clubs first: an empty club list is refused by name before a player looks his club up.
  return {
    clubs: wholeList(
      "club",
      bootstrap.teams.map((team) => ({ code: team.code, name: team.name, shortName: team.short_name })),
      (club) => club.code,
    ),
    players: wholeList(
      "player",
      bootstrap.elements.map((element) => ({
        code: element.code,
        name: element.web_name,
        fullName: `${element.first_name} ${element.second_name}`.trim(),
        clubCode: clubCode(element.team),
        news: element.news,
        chanceOfPlaying: element.chance_of_playing_next_round,
      })),
      (player) => player.code,
    ),
    fixtures: wholeList(
      "match",
      fixtures.map((fixture) => ({
        code: fixture.code,
        gameweek: fixture.event ?? null,
        homeClubCode: clubCode(fixture.team_h),
        awayClubCode: clubCode(fixture.team_a),
        kickoff: fixture.kickoff_time ? epochMs(fixture.kickoff_time) : null,
      })),
      (fixture) => fixture.code,
    ),
    gameweeks: wholeList(
      "gameweek",
      bootstrap.events.map((event) => ({ number: event.id, deadline: epochMs(event.deadline_time) })),
      (gameweek) => gameweek.number,
    ),
  };
}

/** `rows`, unless the list is empty or sends a key twice: a changed payload, so it throws. The
 *  sync marks every held row a list leaves out (#64), so an empty list would mark them all; and it
 *  looks a batch's rows up together, so two rows with one key would both be inserted, and every
 *  later sync would fail on the pair. */
function wholeList<Row>(what: string, rows: Row[], keyOf: (row: Row) => number): Row[] {
  if (rows.length === 0) throw new Error(`FPL sent an empty ${what} list`);
  const seen = new Set<number>();
  for (const key of rows.map(keyOf)) {
    if (seen.has(key)) throw new Error(`FPL sent ${what} ${key} twice`);
    seen.add(key);
  }
  return rows;
}

/** A club's season-stable code from its per-season id. A club FPL names but does not list is a
 *  changed payload, so it throws rather than file a player or a match under no club. */
function clubCodes(teams: RawTeam[]): (id: number) => number {
  const codes = new Map(teams.map((team) => [team.id, team.code]));
  return (id) => {
    const code = codes.get(id);
    if (code === undefined) throw new Error(`FPL names club id ${id}, which bootstrap-static does not list`);
    return code;
  };
}

function epochMs(iso: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`FPL sent a time that does not parse: ${JSON.stringify(iso)}`);
  return ms;
}
