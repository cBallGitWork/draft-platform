// Scouting's per-90 figures and percentiles (#1028; Craig, 9 Nov 2026, on #1028): what the selected
// player's panel lists for his area, and how he ranks against the players of it. Pure, apart from
// per90.ts, so the preview and the tests share it without the server's imports.

import { AREAS, areasOf, cellsOf, LANES, positionOfSlot, SLOT_POSITIONS, type Area } from "../lineup/pitch";
import { cardOpensAt } from "../playerCard/cardPoints";
import { mostFirst } from "./raceOrder";
import type { Position } from "../positions/positionTables";
import {
  ASSISTS,
  BIG_CHANCES_CREATED,
  CLEAN_SHEETS,
  CLEARANCES,
  GOALS,
  GOALS_CONCEDED,
  INTERCEPTIONS,
  KEY_PASSES,
  MINUTES_STAT,
  PASSES,
  SAVES,
  SHOTS_ON_TARGET,
  TACKLES_WON,
} from "../scoring/statKeys";
import type { Stats } from "../stats/statTotals";

/** The fewest minutes a player has over the period to be ranked (the approved picture: "270+
 *  minutes to be ranked"), his own percentile and his place among the others' alike. */
export const RANKED_MINUTES = 270;

/** A match's minutes, the per-90 figures' unit. */
const MATCH_MINUTES = 90;

/** The stats each area's panel lists per 90 (Craig, 9 Nov 2026, on #1028, answer 3), by the names
 *  the merged record keeps them under (sportmonksStats.ts): the goalkeeper's, the defence's, and
 *  the picture's six for every other area, midfield and attack. */
const GOALKEEPER_STATS = [SAVES, GOALS_CONCEDED, CLEAN_SHEETS, PASSES] as const;
const DEFENCE_STATS = [TACKLES_WON, INTERCEPTIONS, CLEARANCES, CLEAN_SHEETS, ASSISTS] as const;
const MIDFIELD_AND_ATTACK_STATS = [GOALS, ASSISTS, KEY_PASSES, SHOTS_ON_TARGET, BIG_CHANCES_CREATED, TACKLES_WON] as const;

/** The stats a player of `area` is shown per 90, then `picked` (the list's stat) as a seventh when
 *  it isn't among them already. */
export function per90Stats(area: Area, picked: string | null): string[] {
  const set: readonly string[] = area === "goalkeeper" ? GOALKEEPER_STATS : area === "defence" ? DEFENCE_STATS : MIDFIELD_AND_ATTACK_STATS;
  return picked === null || set.includes(picked) ? [...set] : [...set, picked];
}

/** The area of a player's main position (his card's, cardOpensAt), as spec/14's table places each
 *  slot's position: a winger and an attacking midfielder are both attacking midfield. A position
 *  with no slot of its own (SS) is the first area it plays. Null with no position. */
export function mainArea(positions: readonly Position[]): Area | null {
  const main = cardOpensAt(positions);
  if (main === null) return null;
  const slot = SLOT_POSITIONS.find((each) => each === main);
  if (slot === undefined) return areasOf([main])[0] ?? null;
  return AREA_OF_SLOT.get(slot)!;
}

/** Each slot's position's area: the area of a cell it is the slot of. */
const AREA_OF_SLOT = new Map(
  AREAS.flatMap((area) =>
    cellsOf(area, LANES).map((cell) => [positionOfSlot(cell), area] as const),
  ),
);

/** His total of `stat`, 0 when his totals leave it out. Deliberate, not a missing feed hidden:
 *  statTotals.ts's addStats drops every total of 0, so a stat he never recorded (a minute, a save)
 *  is absent rather than 0, and no minutes gives a null per-90 figure, never a made-up one. */
export const totalOf = (totals: Stats, stat: string) => totals[stat] ?? 0;

/** His figure per 90 minutes from his totals, or null with no minutes played. */
export function perNinety(totals: Stats, stat: string): number | null {
  const minutes = totalOf(totals, MINUTES_STAT);
  return minutes > 0 ? (totalOf(totals, stat) / minutes) * MATCH_MINUTES : null;
}

/** Whether a player with these totals has played enough to be ranked. */
export const isRanked = (totals: Stats) => totalOf(totals, MINUTES_STAT) >= RANKED_MINUTES;

/** A player as his per-90 panel weighs him: his main position's area and his totals over the
 *  period. */
export type Weighed = { area: Area | null; totals: Stats };

/** The selected player's panel: his area's stats and `stat` per 90 (per90Stats), each with his
 *  percentile among `everyone`'s ranked players of his area, null while he isn't ranked himself. */
export function per90PanelOf(his: Weighed, everyone: Iterable<Weighed>, stat: string | null) {
  const { area, totals } = his;
  if (area === null) return { area, ranked: false, figures: [] };
  return { area, ranked: isRanked(totals), figures: per90FiguresIn(area, totals, everyone, stat) };
}

/** `totals`' figures for `area`'s stats and `stat` (per90Stats): each one's total over the period,
 *  per 90, and the percentile among `everyone`'s ranked players of `area`, null while these totals
 *  aren't ranked. Compare weighs both its players by the first's area, so their rows line up. */
export function per90FiguresIn(area: Area, totals: Stats, everyone: Iterable<Weighed>, stat: string | null) {
  const peers = [...everyone].filter((each) => each.area === area && isRanked(each.totals)).map((each) => each.totals);
  const ranked = isRanked(totals);
  return per90Stats(area, stat).map((each) => {
    const value = perNinety(totals, each);
    const others = peers.map((peer) => perNinety(peer, each)!);
    return { stat: each, total: totalOf(totals, each), perNinety: value, percentile: ranked && value !== null ? percentileOf(value, others, mostFirst(each)) : null };
  });
}

/** A percentile's top: the best of a player's peers stands at it. */
const PERCENTILE_TOP = 100;

/** Where `value` stands among `peers`' figures, as a percentile from 0 to 100: the share of them at
 *  or below it, rounded, so the best of them is 100. With `mostIsBest` false (a stat where fewer is
 *  better, raceOrder.ts's FEWEST_FIRST: Craig, 11 Nov 2026, on #1787), the share at or above it, so
 *  the fewest stands at 100. Null with no peers. */
export function percentileOf(value: number, peers: readonly number[], mostIsBest = true): number | null {
  if (peers.length === 0) return null;
  const atOrWorse = peers.filter((peer) => (mostIsBest ? peer <= value : peer >= value));
  return Math.round((PERCENTILE_TOP * atOrWorse.length) / peers.length);
}
