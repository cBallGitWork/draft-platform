// One record per player per match, both feeds merged (#27, spec/07 "Match stats"): which feed's
// count is kept where both send a stat, when a record is whole, when a match is complete and when
// it locks. Pure: no I/O and no clock, so the same reads always give the same records.

import type { Infer } from "convex/values";
import type { FplStatLine } from "./fplLive";
import type { MatchSlot, PlStatLine } from "./plMatch";
import type { playerMatchRecord } from "./schema";

export type PlayerMatchRecord = Infer<typeof playerMatchRecord>;
type Stats = Record<string, number>;

/** A stat both feeds send, under each one's name, and whose count is kept (spec/07: FPL's for
 *  goals, assists, minutes, cards, saves, clean sheets, goals conceded and penalties; the Premier
 *  League's for the rest). Three of Opta's names have not been seen in a recording yet, since no
 *  recorded match had the event: a wrong guess there only leaves both feeds' counts stored. */
const STATS_IN_BOTH_FEEDS: { fpl: string; pl: string; kept: "fpl" | "pl" }[] = [
  { fpl: "goals_scored", pl: "goals", kept: "fpl" },
  { fpl: "assists", pl: "goal_assist", kept: "fpl" },
  { fpl: "minutes", pl: "mins_played", kept: "fpl" },
  { fpl: "yellow_cards", pl: "yellow_card", kept: "fpl" },
  { fpl: "red_cards", pl: "red_card", kept: "fpl" }, // Opta's name, not yet seen
  { fpl: "saves", pl: "saves", kept: "fpl" },
  { fpl: "clean_sheets", pl: "clean_sheet", kept: "fpl" },
  { fpl: "goals_conceded", pl: "goals_conceded", kept: "fpl" },
  { fpl: "penalties_saved", pl: "penalty_save", kept: "fpl" }, // Opta's name, not yet seen
  { fpl: "penalties_missed", pl: "att_pen_miss", kept: "fpl" }, // Opta's name, not yet seen
  { fpl: "own_goals", pl: "own_goals", kept: "pl" },
  { fpl: "starts", pl: "game_started", kept: "pl" },
];

/** FPL's own points, never stored (spec/07, spec/14): its bonus and BPS, and the two built on them. */
const FPL_POINTS = new Set(["bonus", "bps", "total_points", "in_dreamteam"]);

const droppedFromFpl = new Set([...FPL_POINTS, ...STATS_IN_BOTH_FEEDS.filter((s) => s.kept === "pl").map((s) => s.fpl)]);
const droppedFromPl = new Set(STATS_IN_BOTH_FEEDS.filter((s) => s.kept === "fpl").map((s) => s.pl));

/** What a match's minutes are read from in each feed. */
const FPL_MINUTES = "minutes";
const PL_MINUTES = "mins_played";

/** Both feeds' stats in one map: each feed's name for what only it sends, and the kept feed's for
 *  what both send. A feed whose record has not arrived adds nothing. */
export function mergeStats(fpl: Stats | undefined, pl: Stats | undefined): Stats {
  const merged: Stats = {};
  for (const [stat, value] of Object.entries(pl ?? {})) if (!droppedFromPl.has(stat)) merged[stat] = value;
  for (const [stat, value] of Object.entries(fpl ?? {})) if (!droppedFromFpl.has(stat)) merged[stat] = value;
  return merged;
}

/** A record for every man either team sheet names. A man is whole once both feeds have sent him,
 *  or once one says an unused substitute played no minutes. FPL lists whole squads, so its line for
 *  a man neither sheet names is dropped when he played no minutes; one who played is a sheet that
 *  cannot be trusted, and throws. An empty Premier League list is read as not counted yet: even an
 *  unused substitute's carries `formation_place` (an assumption until a live match is recorded). */
export function matchRecords(
  fixtureCode: number,
  slots: readonly MatchSlot[],
  fplLines: readonly FplStatLine[],
  plLines: readonly PlStatLine[],
): PlayerMatchRecord[] {
  const fplByPlayer = linesByPlayer(fixtureCode, fplLines);
  const plByPlayer = linesByPlayer(fixtureCode, plLines);
  const named = new Set(slots.map((slot) => slot.playerCode));
  for (const [playerCode, stats] of fplByPlayer) {
    if (!named.has(playerCode) && (stats[FPL_MINUTES] ?? 0) > 0) {
      throw new Error(`FPL has player ${playerCode} playing in match ${fixtureCode}, whom neither team sheet names`);
    }
  }
  return slots.map((slot) => {
    const fpl = fplByPlayer.get(slot.playerCode);
    const plSent = plByPlayer.get(slot.playerCode);
    const pl = plSent !== undefined && Object.keys(plSent).length > 0 ? plSent : undefined;
    const minutes = fpl !== undefined ? (fpl[FPL_MINUTES] ?? 0) : pl !== undefined ? (pl[PL_MINUTES] ?? 0) : null;
    return {
      playerCode: slot.playerCode,
      fixtureCode,
      started: slot.started,
      played: slot.started || (minutes === null ? null : minutes > 0),
      arrived: { fpl: fpl !== undefined, pl: pl !== undefined },
      stats: mergeStats(fpl, pl),
    };
  });
}

/** Each player's stats in this match, from lines that may hold other matches too. */
function linesByPlayer(fixtureCode: number, lines: readonly (FplStatLine | PlStatLine)[]): Map<number, Stats> {
  return new Map(lines.filter((line) => line.fixtureCode === fixtureCode).map((line) => [line.playerCode, line.stats]));
}

/** His whole record has arrived: both feeds' parts, or enough to know he never came on. */
export function isWhole(record: Pick<PlayerMatchRecord, "played" | "arrived">): boolean {
  return record.played === false || (record.arrived.fpl && record.arrived.pl);
}

/** A stat's value, or null (shown "—", spec/14) while his whole record has not arrived. Once it
 *  has, a stat it leaves out is 0, and so is one a correction took away. */
export function statValue(record: Pick<PlayerMatchRecord, "played" | "arrived" | "stats">, stat: string): number | null {
  return isWhole(record) ? (record.stats[stat] ?? 0) : null;
}

/** Every man who played has his whole record: a match read at full time stops being provisional. */
export function isMatchComplete(records: readonly PlayerMatchRecord[]): boolean {
  return records.length > 0 && records.every(isWhole);
}

/** When a complete match locks: the window after full time, or, for a match whose last record
 *  arrived after that, the window after it arrived (spec/07). */
export function lockTime(fullTimeAt: number, completeAt: number, windowMs: number): number {
  return completeAt <= fullTimeAt + windowMs ? fullTimeAt + windowMs : completeAt + windowMs;
}

/** Each stat whose sent value differs from the locked one, by name; a stat left out counts as 0. */
export function statChanges(locked: Stats, sent: Stats): { stat: string; locked: number; sent: number }[] {
  return [...new Set([...Object.keys(locked), ...Object.keys(sent)])]
    .sort()
    .map((stat) => ({ stat, locked: locked[stat] ?? 0, sent: sent[stat] ?? 0 }))
    .filter((change) => change.locked !== change.sent);
}
