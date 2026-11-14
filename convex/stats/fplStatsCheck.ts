// The first live-data check's stats test (#2115, spec/20 `S20.13`): a man's stored record for a
// match beside the stats FPL itself gives for it, stat by stat, and his stored stats with FPL's
// counts put in, to price his points as they would be were the two the same. Pure: the report
// (fplStatsCheckReport.ts) reads the records and FPL's lines.

import type { MatchStats } from "../scoring/values";
import { MINUTES_STAT, storedStatName } from "./matchRecords";

/** One of FPL's stats for a man in a match, under FPL's name, as FPL gives it and as his record
 *  holds it: null where there is no FPL line, or no record. */
type StatDifference = { stat: string; fpl: number | null; stored: number | null };

/** Every stat FPL gives for the match whose stored count isn't FPL's, by name, FPL's own points left out
 *  (never stored, spec/07). A stat a record leaves out is 0, as the scoring reads it (spec/14). With
 *  no FPL line, only his minutes are set beside the record's. */
export function statDifferences(fpl: MatchStats | null, stored: MatchStats | null): StatDifference[] {
  const differences: StatDifference[] = [];
  for (const stat of fpl === null ? [MINUTES_STAT] : Object.keys(fpl)) {
    const name = storedStatName(stat);
    if (name === null) continue;
    const each = { stat, fpl: fpl?.[stat] ?? null, stored: stored === null ? null : (stored[name] ?? 0) };
    if (each.fpl !== each.stored) differences.push(each);
  }
  return differences.toSorted((one, other) => one.stat.localeCompare(other.stat));
}

/** His stored stats with every count FPL gives for the match put in their place, FPL's own points
 *  left out: what the league's scoring prices were his record FPL's. */
export function withFplStats(stored: MatchStats, fpl: MatchStats): MatchStats {
  const stats: Record<string, number> = { ...stored };
  for (const [stat, value] of Object.entries(fpl)) {
    const name = storedStatName(stat);
    if (name !== null) stats[name] = value;
  }
  return stats;
}
