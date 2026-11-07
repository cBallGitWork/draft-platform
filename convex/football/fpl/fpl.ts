// FPL's public API, mapped onto the football layer's seam (`Football`, in football.ts). The raw
// shapes and the mapping are copied from epl-draft's packages/core/src/football/fpl/ (raw.ts,
// map.ts and client.ts, 19 Oct 2026), not shared, and cut to the fields #21 holds, each
// player's news (#381) and flag (#1206) and each match's score (#49). One change: FPL names a club by its
// per-season id, and this hands on the club's season-stable code instead.

import { FPL_BOOTSTRAP_URL, FPL_FIXTURES_URL, getJson, getShaped, type Football } from "../football";
import { fplScoreRead, readEach } from "../scoreReads";
import type { Infer } from "convex/values";
import type { availability } from "../../schema";
import { JUNE, seasonStartYear } from "../../shared/time";

type Availability = Infer<typeof availability>;

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
  /** FPL's flag: `a` available, `d` doubtful, `i` injured, `s` suspended, `u` unavailable (left the
   *  club, on loan), `n` not available (ineligible, as against his parent club). */
  status: string;
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
  // The score's fields (#49). Typed optional, as one missing is the match's problem alone
  // (scoreReads.ts), not a changed payload refusing the sync; recordings cut before #49 lack them.
  /** Whether the match has kicked off. */
  started?: boolean | null;
  /** True from full time; `finished` waits for FPL's bonus points, which the platform never reads. */
  finished_provisional?: boolean;
  /** Minutes played: 0 before kickoff, 90 at full time. */
  minutes?: number;
  /** Null before kickoff. */
  team_h_score?: number | null;
  team_a_score?: number | null;
}

/** Bootstrap and the season's fixtures as FPL sent them. */
export async function readFplPayloads(): Promise<{ bootstrap: RawBootstrap; fixtures: RawFixture[] }> {
  const [bootstrap, fixtures] = await Promise.all([getJson(FPL_BOOTSTRAP_URL), getJson(FPL_FIXTURES_URL)]);
  return { bootstrap: bootstrap as RawBootstrap, fixtures: fixtures as RawFixture[] };
}

/** Bootstrap and the season's fixtures, mapped onto the seam. */
export async function readFpl(): Promise<Football> {
  const { bootstrap, fixtures } = await readFplPayloads();
  return mapFpl(bootstrap, fixtures, Date.now());
}

/** Bootstrap as FPL sent it, for what the seam leaves out: each player's join to the Premier
 *  League (`codesByOpta` in feedIds.ts). */
export async function readFplBootstrap(): Promise<RawBootstrap> {
  return getShaped<RawBootstrap>(FPL_BOOTSTRAP_URL, "list of players", (body) => Array.isArray(body.elements));
}

/** The year the season FPL is on starts, 2026 for 2026/27: the season its first gameweek's deadline
 *  falls in. The Premier League's reads follow it (#300). A bootstrap with no gameweeks throws:
 *  nothing then says which season to read. */
export function fplSeason(bootstrap: Pick<RawBootstrap, "events">): number {
  if (!Array.isArray(bootstrap.events) || bootstrap.events.length === 0) {
    throw new Error(`${FPL_BOOTSTRAP_URL} lists no gameweeks, so the season FPL is on is unknown`);
  }
  return seasonStartYear(Math.min(...bootstrap.events.map((event) => epochMs(event.deadline_time))));
}

/** How many players FPL lists: #7's check that Convex can read FPL (`feeds.ts`). */
export async function fplPlayerCount(): Promise<number> {
  const bootstrap = (await getJson(FPL_BOOTSTRAP_URL)) as RawBootstrap;
  return bootstrap.elements.length;
}

/** Pure raw → seam mapping: no I/O and no clock, so the same payloads always give the same records.
 *  `now` only tells an empty fixtures list between seasons from a changed payload
 *  (`fplBetweenSeasons`); without it, an empty list is refused as ever. */
export function mapFpl(bootstrap: RawBootstrap, fixtures: RawFixture[], now?: number): Football {
  const clubCode = clubCodes(bootstrap.teams);
  // Clubs first: an empty club list is refused by name before a player looks his club up.
  const clubs = wholeList(
    "club",
    bootstrap.teams.map((team) => ({ code: team.code, name: team.name, shortName: team.short_name })),
    (club) => club.code,
  );
  const players = wholeList(
    "player",
    bootstrap.elements.map((element) => ({
      code: element.code,
      name: element.web_name,
      fullName: `${element.first_name} ${element.second_name}`.trim(),
      clubCode: clubCode(element.team),
      news: element.news,
      chanceOfPlaying: element.chance_of_playing_next_round,
      availability: availabilityOf(element),
    })),
    (player) => player.code,
  );
  const gameweeks = seasonGameweeks(bootstrap.events);
  const betweenSeasons = fixtures.length === 0 && now !== undefined && fplBetweenSeasons(gameweeks, now);
  return {
    clubs,
    players,
    fixtures: betweenSeasons
      ? []
      : wholeList(
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
    gameweeks,
    betweenSeasons,
    // After `fixtures`, so a list sending a match twice is refused before its scores are read.
    scores: readEach(fixtures, (fixture) => fixture.code, fplScoreRead),
  };
}

/** FPL's gameweeks, each labelled with its season (#66): the one its first deadline falls in, as
 *  FPL sends one season's at a time. */
function seasonGameweeks(events: RawEvent[]): Football["gameweeks"] {
  const deadlines = wholeList(
    "gameweek",
    events.map((event) => ({ number: event.id, deadline: epochMs(event.deadline_time) })),
    (gameweek) => gameweek.number,
  );
  const season = seasonStartYear(Math.min(...deadlines.map(({ deadline }) => deadline)));
  return deadlines.map((gameweek) => ({ season, ...gameweek }));
}

/** Whether an empty fixtures list, at `now`, is FPL between seasons rather than a changed payload
 *  (#66): from 1 June after the season it sends the gameweeks of, or before that season's first
 *  deadline, while FPL has yet to publish the new season's matches. */
export function fplBetweenSeasons(gameweeks: Football["gameweeks"], now: number): boolean {
  const firstDeadline = Math.min(...gameweeks.map(({ deadline }) => deadline));
  const season = seasonStartYear(firstDeadline);
  return now < firstDeadline || now >= Date.UTC(season + 1, JUNE, 1);
}

/** Our availability from FPL's flag (spec/06, Availability): injured, suspended or unavailable is
 *  out, a doubt is doubtful. FPL shows its `n` with the same red flag as `u`, so it is out too. */
const AVAILABILITY_OF_FPL_STATUS: Record<string, Availability> = {
  a: "available",
  d: "doubtful",
  i: "out",
  s: "out",
  u: "out",
  n: "out",
};

/** A flag FPL has never sent is a changed payload, so it throws rather than guess. */
function availabilityOf(element: RawElement): Availability {
  const found = AVAILABILITY_OF_FPL_STATUS[element.status];
  if (found === undefined) throw new Error(`FPL sent player ${element.code} with status ${JSON.stringify(element.status)}, which it has never sent`);
  return found;
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
