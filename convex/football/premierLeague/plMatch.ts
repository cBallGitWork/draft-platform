// One match as the Premier League records it, per player: where each man was named on the team
// sheet (#22's raw material) and every stat Opta counted for him (#27's). Adapted from epl-draft's
// premierleague/teamSheet.ts and playerMatch.ts (20 Oct 2026), not shared: epl-draft draws the
// sheet and sums a few stats, where this keeps the place and every stat as the feed names it.
// Players and matches come out as FPL's codes, through the bridge in `feedIds.ts`.

import { fixtureCodeIn, matchPlayers, namedMen, type UnmatchedPlayer } from "../feedIds";
import {
  PL_FULL_TIME,
  PL_FULL_TIME_PHASE,
  PL_HALF_TIME_PHASE,
  PL_SECOND_HALF_PHASE,
  type RawPlFixture,
  type RawPlPlayerStats,
  type RawPlTeamList,
} from "./premierLeague";

/** Where one man was named for one match. */
export interface MatchSlot {
  playerCode: number;
  fixtureCode: number;
  started: boolean;
  /** The side's formation as its sheet labels it, e.g. "4-2-3-1"; null on the bench, or for a sheet
   *  that carries none. The label need not count the lines drawn: 2025/26's "4-5-1"s draw 4-3-2-1. */
  formation: string | null;
  /** His line of it: 0 the keeper, counting up the pitch. Null whenever `formation` is. */
  line: number | null;
  /** His place along that line, from 0, in the feed's order: the recordings show it runs from the
   *  side's right (a back four is right back, two centre-backs, left back). Null whenever `line` is. */
  place: number | null;
}

/** A starter's line of his side's formation and his place along it (`MatchSlot`). */
type Place = { line: number; place: number };

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
  const fixtureCode = requireFixtureCode(fixture);
  const { codes, unmatched } = matchPlayers(fixture, codeByOpta);
  const slots: MatchSlot[] = [];
  for (const list of fixture.teamLists ?? []) {
    if (list === null) continue;
    const places = startingPlaces(fixture.id, list);
    const addSlot = (id: number, started: boolean): void => {
      const playerCode = codes.get(id);
      if (playerCode === undefined) return; // In `unmatched`, which the caller reports.
      const drawn = started ? places?.get(id) : undefined;
      slots.push({
        playerCode,
        fixtureCode,
        started,
        formation: drawn === undefined ? null : (list.formation?.label ?? null),
        line: drawn?.line ?? null,
        place: drawn?.place ?? null,
      });
    };
    for (const man of list.lineup) addSlot(man.id, true);
    for (const man of list.substitutes) addSlot(man.id, false);
  }
  return { slots, unmatched };
}

/** Each starter's line and place, or null for a sheet with no formation. A formation that does not
 *  draw exactly the side's starters, the keeper alone on its first line, is a changed payload. */
function startingPlaces(fixtureId: number, list: RawPlTeamList): Map<number, Place> | null {
  if (list.formation === undefined) return null;
  const { label, players } = list.formation;
  const where = `PL fixture ${fixtureId}, team ${list.teamId}'s ${label}`;
  if (players[0]?.length !== 1) throw new Error(`${where} draws ${players[0]?.length ?? 0} men in goal`);
  const places = new Map<number, Place>();
  players.forEach((ids, line) => ids.forEach((id, place) => places.set(id, { line, place })));
  const starters = new Set(list.lineup.map((man) => man.id));
  if (places.size !== starters.size || [...places.keys()].some((id) => !starters.has(id))) {
    throw new Error(`${where} does not draw the ${starters.size} men it lists as starting`);
  }
  return places;
}

/** His stats as the feed sent them, names and values. Opta leaves most noughts out, and a stat it
 *  did not send stays absent: what that means for scoring is #27's to settle. */
export function plStats(read: RawPlPlayerStats): Record<string, number> {
  const player = read.entity?.id;
  if (!Array.isArray(read.stats)) throw new Error(`the Premier League sent no stats list for player ${player}`);
  const stats: Record<string, number> = {};
  for (const { name, value } of read.stats) {
    if (typeof name !== "string" || typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`the Premier League sent stat ${JSON.stringify({ name, value })} for player ${player}`);
    }
    if (name in stats) throw new Error(`the Premier League sent ${name} twice for player ${player}`);
    stats[name] = value;
  }
  return stats;
}

/** The site's two half-time stats, worked out from the fixture's half-time score, as Opta sends
 *  neither per player: whether his club had let none in at half-time (1 or 0), and how many it had.
 *  Only a starter gets them (Craig, 9 Nov 2026, on #990: Keep it tight early "goes by his club's
 *  half-time score for anyone who started; a bench player who comes on scores nothing from it"). */
export const HALF_TIME_STATS = { cleanSheet: "clean_sheet_half_time", goalsConceded: "goals_conceded_half_time" } as const;

/** The phases from which half-time's score is settled. */
const HALF_TIME_REACHED: ReadonlySet<string | undefined> = new Set([PL_HALF_TIME_PHASE, PL_SECOND_HALF_PHASE, PL_FULL_TIME_PHASE]);

/** Each starter's half-time stats, by the Premier League's player id: none before half-time, as the
 *  score isn't settled yet. A half-time score that isn't two whole goal counts throws. */
export function halfTimeStats(fixture: RawPlFixture): Map<number, Record<string, number>> {
  const stats = new Map<number, Record<string, number>>();
  if (fixture.status !== PL_FULL_TIME && !HALF_TIME_REACHED.has(fixture.phase)) return stats;
  const { homeScore, awayScore } = fixture.halfTimeScore ?? {};
  for (const goals of [homeScore, awayScore]) {
    if (typeof goals !== "number" || !Number.isInteger(goals) || goals < 0) {
      throw new Error(`PL fixture ${fixture.id} sent half-time score ${JSON.stringify(fixture.halfTimeScore)}`);
    }
  }
  const homeId = fixture.teams?.[0]?.team.id;
  if (homeId === undefined) throw new Error(`PL fixture ${fixture.id} names no home side`);
  for (const list of fixture.teamLists ?? []) {
    if (list === null) continue;
    const conceded = list.teamId === homeId ? awayScore! : homeScore!;
    const line = { [HALF_TIME_STATS.cleanSheet]: conceded === 0 ? 1 : 0, [HALF_TIME_STATS.goalsConceded]: conceded };
    for (const man of list.lineup) stats.set(man.id, line);
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
  const fixtureCode = requireFixtureCode(fixture);
  const { codes, unmatched } = matchPlayers(fixture, codeByOpta);
  const named = new Set(namedMen(fixture).map((man) => man.id));
  const halfTime = halfTimeStats(fixture);
  const lines: PlStatLine[] = [];
  for (const [plPlayerId, read] of reads) {
    if (read.entity?.id !== plPlayerId) {
      throw new Error(`the stats read for player ${plPlayerId} answered for player ${read.entity?.id}`);
    }
    if (!named.has(plPlayerId)) throw new Error(`PL fixture ${fixture.id}'s sheets do not name player ${plPlayerId}`);
    const playerCode = codes.get(plPlayerId);
    // Half-time's stats join only a line Opta has counted: an empty one is read as not counted yet.
    const stats = plStats(read);
    if (Object.keys(stats).length > 0) Object.assign(stats, halfTime.get(plPlayerId));
    if (playerCode !== undefined) lines.push({ playerCode, fixtureCode, stats });
  }
  return { lines, unmatched: unmatched.filter((man) => reads.has(man.plPlayerId)) };
}

/** FPL's code for a Premier League fixture; one that carries none throws rather than file
 *  anything under no match. */
export function requireFixtureCode(fixture: RawPlFixture): number {
  const code = fixtureCodeIn(fixture);
  if (code === null) {
    throw new Error(`PL fixture ${fixture.id} carries no FPL fixture code (altIds ${JSON.stringify(fixture.altIds)})`);
  }
  return code;
}
