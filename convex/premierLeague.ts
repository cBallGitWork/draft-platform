// The Premier League's public API: who was named for a match, in what shape, and what each man did.
// The raw shapes and the reads are copied from epl-draft's packages/core/src/football/premierleague/
// (raw.ts, rawStats.ts and client.ts, 20 Oct 2026), not shared, and cut to what #27 and #22 read;
// the commentary and the team stats (#37) are new here.
// The reads sit behind the football seam (`football.ts`), on its URLs and its `getJson`, so every
// failed read throws with the URL and the status, and every body missing what is read with the URL.

import {
  getShaped,
  hasId,
  PL_COMMENTARY_PAGE_SIZE,
  plCommentaryUrl,
  plFixturesUrl,
  plFixtureUrl,
  plPlayerStatsUrl,
  plTeamStatsUrl,
} from "./football";

// The shapes the Premier League answers: data we do not control. Only the fields read are typed.

/** `{opta: "g2645250"}` on a fixture, `"p193278"` on a player, `"t88"` on a club. */
export interface RawPlAltIds {
  opta: string;
}

/** A man on a team sheet. `id` is the Premier League's own; `altIds.opta` is FPL's `opta_code`. */
export interface RawPlSquadPlayer {
  id: number;
  name: { display: string };
  altIds?: RawPlAltIds;
}

/** A side's shape: `label` ("4-2-3-1") drawn as `players`, lines of player ids, keeper first. */
export interface RawPlFormation {
  label: string;
  players: number[][];
}

export interface RawPlTeamList {
  teamId: number;
  lineup: RawPlSquadPlayer[];
  substitutes: RawPlSquadPlayer[];
  formation?: RawPlFormation;
}

/** A fixture from the fixture list or its own read. */
export interface RawPlFixture {
  id: number;
  /** `g` + FPL's fixture `code`. Sent only when the read asks with `altIds=true`. */
  altIds?: RawPlAltIds;
  /** `PL_FULL_TIME` once the match is over; every read recorded so far carries it. */
  status?: string;
  /** On the fixture's own read: two entries, each null until that side is named. */
  teamLists?: (RawPlTeamList | null)[];
}

/** A fixture's `status` at full time: "C", completed, on all ten of gameweek 6's recorded. Full time
 *  is the Premier League's word here, not FPL's flags (spec/07). */
export const PL_FULL_TIME = "C";

export interface RawPlFixturePage {
  content: RawPlFixture[];
}

/** One Opta stat. `description` is a "Todo" placeholder and `additionalInfo` is empty: neither is read. */
export interface RawPlMetric {
  name: string;
  value: number;
}

/** `/stats/player/{id}?fixtures={matchId}`: one man's stats in one match, with his profile as `entity`. */
export interface RawPlPlayerStats {
  entity: { id: number };
  stats: RawPlMetric[];
}

/** One commentary line. Its `playerIds` are the Premier League's ids, in an order that gives each
 *  man's part ("Goal!": the scorer, then the assister): docs/pl-commentary.md. */
export interface RawPlCommentaryLine {
  id: number;
  /** "goal", "substitution", "free kick lost": the types seen are in docs/pl-commentary.md. */
  type: string;
  text: string;
  /** Absent on the "Lineups are announced" line. `label` is the match minute: "62", "45+2". */
  time?: { secs: number; label: string };
  /** Absent on a line that names no one. */
  playerIds?: number[];
}

/** `/fixtures/{id}/textstream/EN`. Days before a match, `content` is empty; its oldest line, once
 *  there, is the lineups'. */
export interface RawPlCommentary {
  events: { pageInfo: { numPages: number }; content: RawPlCommentaryLine[] };
}

/** `/stats/match/{id}`: each side's Opta totals (`M`), keyed by the Premier League's team id.
 *  Before kickoff there is no `data`. Opta leaves noughts out, as it does per player. */
export interface RawPlTeamStats {
  entity: { id: number };
  data?: Record<string, { M: RawPlMetric[] }>;
}

/** One gameweek's fixtures, or the season's, each with its FPL join (`altIds`). */
export async function readPlFixtures(gameweek?: number): Promise<RawPlFixture[]> {
  const page = await getShaped<RawPlFixturePage>(
    plFixturesUrl(gameweek),
    "list of fixtures with ids",
    (body) => Array.isArray(body.content) && body.content.every(hasId),
  );
  return page.content;
}

/** One fixture in full: both team sheets and their formations. */
export async function readPlFixture(fixtureId: number): Promise<RawPlFixture> {
  return getShaped<RawPlFixture>(plFixtureUrl(fixtureId), "fixture id", hasId);
}

/** One man's stats in one match, by the Premier League's ids for both. */
export async function readPlPlayerStats(playerId: number, fixtureId: number): Promise<RawPlPlayerStats> {
  return getShaped<RawPlPlayerStats>(
    plPlayerStatsUrl(playerId, fixtureId),
    "player entity and stats list",
    (body) => hasId(body.entity) && Array.isArray(body.stats),
  );
}

/** A match's commentary, newest first, every line of it. A match with more lines than one read
 *  holds would lose its oldest: that throws rather than hand on part of the match. */
export async function readPlCommentary(fixtureId: number): Promise<RawPlCommentaryLine[]> {
  const url = plCommentaryUrl(fixtureId);
  const read = await getShaped<RawPlCommentary>(
    url,
    "list of commentary lines with ids",
    ({ events }) =>
      typeof events?.pageInfo?.numPages === "number" && Array.isArray(events.content) && events.content.every(hasId),
  );
  if (read.events.pageInfo.numPages > 1) {
    throw new Error(`${url} has ${read.events.pageInfo.numPages} pages: more than ${PL_COMMENTARY_PAGE_SIZE} lines`);
  }
  return read.events.content;
}

/** Both sides' totals for one match, or no `data` before it starts. */
export async function readPlTeamStats(fixtureId: number): Promise<RawPlTeamStats> {
  return getShaped<RawPlTeamStats>(
    plTeamStatsUrl(fixtureId),
    "match entity and each side's stats list",
    ({ entity, data }) =>
      hasId(entity) &&
      (data === undefined ||
        (typeof data === "object" && data !== null && Object.values(data).every((side: any) => Array.isArray(side?.M)))),
  );
}
