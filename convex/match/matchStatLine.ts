import { v, type Infer } from "convex/values";
import type { CategoryPoints } from "../scoring/scoring";
import {
  ASSISTS,
  CLEAN_SHEETS,
  GOALS,
  GOALS_CONCEDED,
  KEY_PASSES,
  MINUTES_STAT,
  RED_CARDS,
  SAVES,
  SHOTS,
  SHOTS_ON_TARGET,
  TACKLES,
  YELLOW_CARDS,
} from "../scoring/statKeys";

// Each man's stats for the match on the match page's Player stats tab (#1032; spec/10 S10.8: "A
// match needs a tab for detailed stats"), in the approved picture's columns, counted from his record
// as the scoring reads it.

/** The record's stat behind each column, under the name it is kept by. */
export const MATCH_STAT_KEYS = {
  minutes: MINUTES_STAT,
  goals: GOALS,
  assists: ASSISTS,
  shots: SHOTS,
  shotsOnTarget: SHOTS_ON_TARGET,
  keyPasses: KEY_PASSES,
  tackles: TACKLES,
  cleanSheets: CLEAN_SHEETS,
  goalsConceded: GOALS_CONCEDED,
  saves: SAVES,
  yellowCards: YELLOW_CARDS,
  redCards: RED_CARDS,
} as const;
export type MatchStat = keyof typeof MATCH_STAT_KEYS;

export const matchStatLine = v.object({
  minutes: v.number(),
  goals: v.number(),
  assists: v.number(),
  shots: v.number(),
  shotsOnTarget: v.number(),
  keyPasses: v.number(),
  tackles: v.number(),
  cleanSheets: v.number(),
  goalsConceded: v.number(),
  saves: v.number(),
  yellowCards: v.number(),
  redCards: v.number(),
});
export type MatchStatLine = Infer<typeof matchStatLine>;

/** A man's stats from his record: 0 for a stat it leaves out, as the scoring counts it, and null
 *  before his record has arrived, so the page shows placeholders, never made-up figures. */
export function statLineOf(stats: Readonly<Record<string, number>> | undefined): MatchStatLine | null {
  if (stats === undefined) return null;
  const line = Object.fromEntries(Object.entries(MATCH_STAT_KEYS).map(([column, stat]) => [column, stats[stat] ?? 0]));
  return line as MatchStatLine;
}

/** What each of his stats earned him, for the Points switch (S10.8: "Points showing what each stat
 *  earned him"), from the categories his points were scored by, never scored again: 0 for a stat
 *  the league's set doesn't score, and null while no category is priced (his record not arrived, or
 *  the match unpriced). His role's and instructions' points stay in his Pts alone. */
export function statPointsOf(categories: readonly CategoryPoints[]): MatchStatLine | null {
  if (categories.length === 0 || categories.some(({ points }) => points === null)) return null;
  const pointsOf = (stat: string) => categories.reduce((sum, each) => sum + (each.stat === stat ? (each.points ?? 0) : 0), 0);
  const line = Object.fromEntries(Object.entries(MATCH_STAT_KEYS).map(([column, stat]) => [column, pointsOf(stat)]));
  return line as MatchStatLine;
}
