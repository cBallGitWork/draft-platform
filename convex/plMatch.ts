// One match as the Premier League records it, per player: where each man was named on the team
// sheet (#22's raw material) and every stat Opta counted for him (#27's). Copied in spirit from
// epl-draft's premierleague/teamSheet.ts and playerMatch.ts (20 Oct 2026), not shared: epl-draft
// draws the sheet and sums a few stats, where this keeps the place and every stat as the feed
// names it. Players and matches come out as FPL's codes, through the bridge in `feedIds.ts`.

import { fixtureCodeIn, matchPlayers, type UnmatchedPlayer } from "./feedIds";
import type { RawPlFixture, RawPlPlayerStats, RawPlTeamList } from "./premierLeague";

/** Where one man was named for one match. */
export interface MatchSlot {
  playerCode: number;
  fixtureCode: number;
  started: boolean;
  /** The side's formation, e.g. "4-2-3-1"; null on the bench, or for a sheet that carries none. */
  formation: string | null;
  /** His line of it: 0 the keeper, counting up the pitch. Null whenever `formation` is. */
  line: number | null;
  /** His place along that line, from 0, in the feed's order: the recordings show it runs from the
   *  side's right (a back four is right back, two centre-backs, left back). Null whenever `line` is. */
  place: number | null;
}

/** One man's stats in one match, under Opta's names (`won_tackle`, `mins_played`). */
export interface PlStatLine {
  playerCode: number;
  fixtureCode: number;
  stats: Record<string, number>;
}

/** Every named man's slot, from both sides' sheets. A side not yet named has no slots. */
export function matchSlots(
  fixture: RawPlFixture,
  codeByOpta: ReadonlyMap<string, number>,
): { slots: MatchSlot[]; unmatched: UnmatchedPlayer[] } {
  const fixtureCode = codeOf(fixture);
  const { codes, unmatched } = matchPlayers(fixture, codeByOpta);
  const slots: MatchSlot[] = [];
  for (const list of fixture.teamLists ?? []) {
    if (list === null) continue;
    const grid = gridOf(fixture.id, list);
    const slot = (id: number, started: boolean): void => {
      const playerCode = codes.get(id);
      if (playerCode === undefined) return; // In `unmatched`, which the caller reports.
      const at = started ? grid?.get(id) : undefined;
      slots.push({
        playerCode,
        fixtureCode,
        started,
        formation: at === undefined ? null : (list.formation?.label ?? null),
        line: at?.line ?? null,
        place: at?.place ?? null,
      });
    };
    for (const man of list.lineup) slot(man.id, true);
    for (const man of list.substitutes) slot(man.id, false);
  }
  return { slots, unmatched };
}

/** Each starter's line and place, or null for a sheet with no formation. A formation that does not
 *  draw exactly the side's starters, or whose label does not count its lines, is a changed payload. */
function gridOf(fixtureId: number, list: RawPlTeamList): Map<number, { line: number; place: number }> | null {
  if (list.formation === undefined) return null;
  const { label, players } = list.formation;
  const where = `PL fixture ${fixtureId}, team ${list.teamId}'s ${label}`;
  const lineSizes = players.map((line) => line.length).join("-");
  if (lineSizes !== `1-${label}`) throw new Error(`${where} draws lines of ${lineSizes}`);
  const grid = new Map<number, { line: number; place: number }>();
  players.forEach((ids, line) => ids.forEach((id, place) => grid.set(id, { line, place })));
  const starters = new Set(list.lineup.map((man) => man.id));
  const drawn = [...grid.keys()];
  if (grid.size !== starters.size || drawn.some((id) => !starters.has(id))) {
    throw new Error(`${where} does not draw the ${starters.size} men it lists as starting`);
  }
  return grid;
}

/** His stats as the feed names them. Opta leaves most noughts out, so a stat absent here was not
 *  sent, which is not the same as nought. An unused substitute has only `formation_place` 0. */
export function plStats(read: RawPlPlayerStats): Record<string, number> {
  if (!Array.isArray(read.stats)) throw new Error(`the Premier League sent no stats list for player ${read.entity?.id}`);
  const stats: Record<string, number> = {};
  for (const { name, value } of read.stats) {
    if (typeof name !== "string" || typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`the Premier League sent stat ${JSON.stringify({ name, value })} for player ${read.entity.id}`);
    }
    if (name in stats) throw new Error(`the Premier League sent ${name} twice for player ${read.entity.id}`);
    stats[name] = value;
  }
  return stats;
}

/** A line for each man read, by the Premier League's player id. A read for another man than asked,
 *  or for one neither sheet names, is a caller's or the feed's mistake: it throws. */
export function plStatLines(
  fixture: RawPlFixture,
  reads: ReadonlyMap<number, RawPlPlayerStats>,
  codeByOpta: ReadonlyMap<string, number>,
): { lines: PlStatLine[]; unmatched: UnmatchedPlayer[] } {
  const fixtureCode = codeOf(fixture);
  const { codes, unmatched } = matchPlayers(fixture, codeByOpta);
  const named = new Set([...codes.keys(), ...unmatched.map((man) => man.plPlayerId)]);
  const lines: PlStatLine[] = [];
  for (const [plPlayerId, read] of reads) {
    if (read.entity?.id !== plPlayerId) {
      throw new Error(`the stats read for player ${plPlayerId} answered for player ${read.entity?.id}`);
    }
    if (!named.has(plPlayerId)) throw new Error(`PL fixture ${fixture.id}'s sheets do not name player ${plPlayerId}`);
    const playerCode = codes.get(plPlayerId);
    if (playerCode !== undefined) lines.push({ playerCode, fixtureCode, stats: plStats(read) });
  }
  return { lines, unmatched: unmatched.filter((man) => reads.has(man.plPlayerId)) };
}

function codeOf(fixture: RawPlFixture): number {
  const code = fixtureCodeIn(fixture);
  if (code === null) throw new Error(`PL fixture ${fixture.id} carries no FPL fixture code (altIds ${JSON.stringify(fixture.altIds)})`);
  return code;
}
