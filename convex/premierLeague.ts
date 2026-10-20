// The Premier League's public API: who was named for a match, in what shape, and what each man did.
// The raw shapes and the reads are copied from epl-draft's packages/core/src/football/premierleague/
// (raw.ts, rawStats.ts and client.ts, 20 Oct 2026), not shared, and cut to what #27 and #22 read.
// The reads sit behind the football seam (`football.ts`), on its URLs and its `getJson`, so every
// failed read throws with the URL and the status.

import { getJson, plFixturesUrl, plFixtureUrl, plPlayerStatsUrl } from "./football";

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
  /** The line he was named in for THIS match: `G`, `D`, `M` or `F`. */
  matchPosition?: string;
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

/** A fixture from the fixture list or its own read. `status`: `U` upcoming, `L` live, `C` complete. */
export interface RawPlFixture {
  id: number;
  status: string;
  teams: { team: { id: number; altIds?: RawPlAltIds } }[];
  /** `g` + FPL's fixture `code`. Sent only when the read asks with `altIds=true`. */
  altIds?: RawPlAltIds;
  /** On the fixture's own read: two entries, each null until that side is named. */
  teamLists?: (RawPlTeamList | null)[];
}

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

/** One gameweek's fixtures, or the season's, each with its FPL join (`altIds`). */
export async function readPlFixtures(gameweek?: number): Promise<RawPlFixture[]> {
  const page = (await getJson(plFixturesUrl(gameweek))) as RawPlFixturePage;
  return page.content;
}

/** One fixture in full: both team sheets and their formations. */
export async function readPlFixture(fixtureId: number): Promise<RawPlFixture> {
  return (await getJson(plFixtureUrl(fixtureId))) as RawPlFixture;
}

/** One man's stats in one match, by the Premier League's ids for both. */
export async function readPlPlayerStats(playerId: number, fixtureId: number): Promise<RawPlPlayerStats> {
  return (await getJson(plPlayerStatsUrl(playerId, fixtureId))) as RawPlPlayerStats;
}
