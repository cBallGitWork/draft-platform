import { v, type Infer } from "convex/values";
import { nextByDeadlines } from "../gameweeks/nextGameweek";
import { LINEUP_DUE_BEFORE_DEADLINE_MS } from "./lineupLimits";

// Continue's lineup step judged at the screen's minute (#526, #2005). lineupDue.ts's `isDue` sends
// the times, taking none, so it isn't asked again every minute for every open screen; the screen
// judges them here at its own minute. Pure, so the screen and the tests judge alike.

/** What `isDue` sends: the league's own deadline in each of the season's gameweeks (null where none
 *  is known), in gameweek order; the last gameweek the league plays; and the gameweek the caller's
 *  team last opened Tactics in, null before any. */
export const lineupDueTimes = v.object({
  deadlines: v.array(v.object({ gameweek: v.number(), deadline: v.union(v.number(), v.null()) })),
  lastGameweek: v.number(),
  openedIn: v.union(v.number(), v.null()),
});
export type LineupDueTimes = Infer<typeof lineupDueTimes>;

/** Whether Continue leads him to his Tactics tab at `now`: the gameweek a save now is from
 *  (saveGameweek.ts's `nextOpenGameweek`, by the same deadlines) locks within
 *  LINEUP_DUE_BEFORE_DEADLINE_MS, and he hasn't opened Tactics in it. Never once the season is over,
 *  nor with no times (`isDue`'s null: no team in the league). */
export function lineupDueAt(times: LineupDueTimes | null, now: number): boolean {
  if (times === null) return false;
  const { deadlines, lastGameweek, openedIn } = times;
  const next = nextByDeadlines(deadlines, ({ deadline }) => deadline, now);
  if (next === undefined || next.gameweek > lastGameweek || next.gameweek === openedIn) return false;
  const { deadline } = next;
  return deadline !== null && now >= deadline - LINEUP_DUE_BEFORE_DEADLINE_MS && now < deadline;
}
