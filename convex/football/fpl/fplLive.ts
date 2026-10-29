// FPL's per-player stats for each match of a gameweek, from /event/{gw}/live/. The raw shapes and
// the split by match are copied from epl-draft's packages/core/src/football/fpl/ (raw.ts' RawLive
// and map.ts' mapLiveStats, 20 Oct 2026), not shared. Two changes: the stats keep FPL's own names
// rather than becoming epl-draft's fields, and players and matches come out as FPL's season-stable
// codes, never its per-season ids.

import { fplLiveUrl, getShaped, hasId } from "../football";
import type { RawBootstrap, RawFixture } from "./fpl";

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

/** One player's stats in one match, under FPL's names (`goals_scored`, `bps`, `expected_goals`). */
export interface FplStatLine {
  playerCode: number;
  fixtureCode: number;
  stats: Record<string, number>;
}

/** A gameweek's live stats; `{elements: []}` until its first match kicks off. */
export async function readFplLive(gameweek: number): Promise<RawLive> {
  return getShaped<RawLive>(
    fplLiveUrl(gameweek),
    "list of players with ids",
    (body) => Array.isArray(body.elements) && body.elements.every(hasId),
  );
}

/** A line for each player for each match he had in the gameweek. A match's own block gives its
 *  scoring stats. The gameweek totals give the rest only when he had one match, where the two are
 *  the same; with two, FPL does not split them, so those stats are left out of both lines rather
 *  than guessed. A block with no `minutes` is one FPL has not filled in yet, so it gives no line:
 *  every recorded block carries them, 0 for an unused substitute. A player or a match FPL's other
 *  reads do not list is a changed payload: it throws. */
export function fplStatLines(live: RawLive, elements: RawBootstrap["elements"], fixtures: RawFixture[]): FplStatLine[] {
  const playerCode = codeById("player", new Map(elements.map((element) => [element.id, element.code])));
  const fixtureCode = codeById("match", new Map(fixtures.map((fixture) => [fixture.id, fixture.code])));
  return live.elements.flatMap((element) => {
    const totals = element.explain.length === 1 ? gameweekTotals(element) : {};
    return element.explain.flatMap((block) => {
      const line = { playerCode: playerCode(element.id), fixtureCode: fixtureCode(block.fixture) };
      const values = matchValues(element.id, block.stats);
      return "minutes" in values ? [{ ...line, stats: { ...totals, ...values } }] : [];
    });
  });
}

/** A block's values by identifier. */
function matchValues(elementId: number, stats: RawExplainStat[]): Record<string, number> {
  const values: Record<string, number> = {};
  for (const stat of stats) {
    if (stat.identifier in values) {
      throw new Error(`FPL sent ${stat.identifier} twice in one match for player id ${elementId}`);
    }
    values[stat.identifier] = numberOf(elementId, stat.identifier, stat.value);
  }
  return values;
}

/** The gameweek totals as numbers: the expected stats and FPL's indices arrive as decimal strings
 *  ("0.62"), and `in_dreamteam` and `played` as true or false, held as 1 or 0. */
function gameweekTotals(element: RawLiveElement): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const [key, value] of Object.entries(element.stats)) {
    totals[key] = typeof value === "boolean" ? Number(value) : numberOf(element.id, key, value);
  }
  return totals;
}

function numberOf(elementId: number, key: string, value: unknown): number {
  const number = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof number !== "number" || !Number.isFinite(number)) {
    throw new Error(`FPL sent ${key} ${JSON.stringify(value)} for player id ${elementId}, which is not a number`);
  }
  return number;
}

function codeById(what: string, codes: Map<number, number>): (id: number) => number {
  return (id) => {
    const code = codes.get(id);
    if (code === undefined) {
      throw new Error(`FPL's live stats name ${what} id ${id}, which its other reads do not list`);
    }
    return code;
  };
}
