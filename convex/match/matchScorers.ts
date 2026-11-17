import { v, type Infer } from "convex/values";
import { FEED_TYPE, minuteOf } from "../football/commentary";
import type { StoredCommentary } from "../football/matchCommentary";
import type { PlayerCode } from "../shared/players";

// The scorers' line under the match page's scoreboard (#1032; spec/10 S10.7: "Under the
// scoreboard, each side's scorers"): each goal the match's commentary holds, under the side it
// counted for, oldest first. An own goal counts for the other side and says so. A goal VAR took
// away goes, as the score does.

/** One goal: who scored it and when ("23'", "45+2'"). */
export const matchGoal = v.object({ name: v.string(), minute: v.string(), ownGoal: v.boolean() });
export type MatchGoal = Infer<typeof matchGoal>;
export const matchScorers = v.object({ home: v.array(matchGoal), away: v.array(matchGoal) });
export type MatchScorers = Infer<typeof matchScorers>;

/** A man the page names: his name and the side he plays for, null for neither. */
export type ScorerMan = { name: string; side: "home" | "away" | null };

const SCORING = new Set<string>([FEED_TYPE.goal, FEED_TYPE.penaltyGoal, FEED_TYPE.ownGoal]);

/** Each side's goals from the stored lines (newest first, as the feed's). A goal line naming no
 *  scorer, with no minute, or whose man the page can't place on a side is left off the line rather
 *  than guessed, and logged under `match` ("Match 7"). */
export function scorersOf(lines: StoredCommentary["lines"], menByCode: ReadonlyMap<PlayerCode, ScorerMan>, match: string): MatchScorers {
  const leftOff = (goal: string, why: string) => console.warn(`${match}'s goal${goal} is left off the scorers: ${why}`);
  const goals: { scorer: PlayerCode; minute: string; ownGoal: boolean }[] = [];
  for (const line of lines.toReversed()) {
    const scorer = line.playerCodes?.[0] ?? null;
    const minute = line.minute === undefined || line.minute === null ? null : minuteOf(line.minute, line.addedMinute ?? null);
    if (line.type === FEED_TYPE.varCancelledGoal) {
      const cancelled = goals.findLastIndex((goal) => goal.scorer === scorer);
      if (cancelled >= 0) goals.splice(cancelled, 1);
      continue;
    }
    if (line.type === undefined || !SCORING.has(line.type)) continue;
    if (scorer === null) leftOff(minute === null ? "" : ` at ${minute}`, "its line names no scorer");
    else if (minute === null) leftOff(` by player ${scorer}`, "its line has no minute");
    else goals.push({ scorer, minute, ownGoal: line.type === FEED_TYPE.ownGoal });
  }
  const scorers: MatchScorers = { home: [], away: [] };
  for (const { scorer, minute, ownGoal } of goals) {
    const man = menByCode.get(scorer);
    if (man === undefined || man.side === null) {
      leftOff(` at ${minute} by player ${scorer}`, "he is on neither side");
      continue;
    }
    const countsFor = ownGoal ? (man.side === "home" ? "away" : "home") : man.side;
    scorers[countsFor].push({ name: man.name, minute, ownGoal });
  }
  return scorers;
}
