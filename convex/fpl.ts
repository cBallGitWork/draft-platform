// FPL's public API, mapped onto the football layer's seam (`Football`, in football.ts). The raw
// shapes and the mapping are copied from epl-draft's packages/core/src/football/fpl/ (raw.ts,
// map.ts and client.ts, 19 Oct 2026), not shared, and cut to the fields #21 holds. One change:
// FPL names a club by its per-season id, and this hands on the club's season-stable code instead.

import { FPL_BOOTSTRAP_URL, FPL_FIXTURES_URL, getJson, type Football } from "./football";

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

/** Bootstrap and the season's fixtures, mapped onto the seam. */
export async function readFpl(): Promise<Football> {
  const [bootstrap, fixtures] = await Promise.all([
    getJson(FPL_BOOTSTRAP_URL),
    getJson(FPL_FIXTURES_URL),
  ]);
  return mapFpl(bootstrap as RawBootstrap, fixtures as RawFixture[]);
}

/** Pure raw → seam mapping: no I/O and no clock, so the same payloads always give the same records. */
export function mapFpl(bootstrap: RawBootstrap, fixtures: RawFixture[]): Football {
  const clubCode = clubCodes(bootstrap.teams);
  return {
    clubs: bootstrap.teams.map((t) => ({ code: t.code, name: t.name, shortName: t.short_name })),
    players: bootstrap.elements.map((e) => ({
      code: e.code,
      name: e.web_name,
      fullName: `${e.first_name} ${e.second_name}`.trim(),
      clubCode: clubCode(e.team),
    })),
    fixtures: fixtures.map((f) => ({
      code: f.code,
      gameweek: f.event ?? null,
      homeClubCode: clubCode(f.team_h),
      awayClubCode: clubCode(f.team_a),
      kickoff: f.kickoff_time ? epochMs(f.kickoff_time) : null,
    })),
    gameweeks: bootstrap.events.map((e) => ({ number: e.id, deadline: epochMs(e.deadline_time) })),
  };
}

/** A club's season-stable code from its per-season id. A club FPL names but does not list is a
 *  changed payload, so it throws rather than file a player or a match under no club. */
function clubCodes(teams: RawTeam[]): (id: number) => number {
  const codes = new Map(teams.map((t) => [t.id, t.code]));
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
