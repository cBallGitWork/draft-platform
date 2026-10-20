// FPL's per-player stats for each match of a gameweek, from /event/{gw}/live/. The raw shapes are
// copied from epl-draft's packages/core/src/football/fpl/raw.ts (RawLive, 20 Oct 2026), not shared.

import { FPL_API_BASE, getJson } from "./football";

/** One scoring stat in one match. `points` and `points_modification` are FPL's scoring, not read. */
interface RawExplainStat {
  identifier: string;
  value: number;
}

/** One player's gameweek. `explain` holds one block per match he had, by FPL's per-season fixture
 *  id, with FPL's scoring stats only; `stats` holds every stat summed over the gameweek. */
export interface RawLiveElement {
  /** Per season, so never persisted. */
  id: number;
  stats: Record<string, number | string | boolean>;
  explain: { fixture: number; stats: RawExplainStat[] }[];
}

export interface RawLive {
  elements: RawLiveElement[];
}

export function fplLiveUrl(gameweek: number): string {
  return `${FPL_API_BASE}/event/${gameweek}/live/`;
}

/** A gameweek's live stats; `{elements: []}` until its first match kicks off. */
export async function readFplLive(gameweek: number): Promise<RawLive> {
  return (await getJson(fplLiveUrl(gameweek))) as RawLive;
}
