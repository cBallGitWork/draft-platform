import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { DEFAULT_DEADLINE_RULE } from "../gameweeks/deadline";
import { recordPassedDeadlines } from "../gameweeks/deadlineRecorder";
import { LEAGUES_READ_MOST, takeAllOrThrow } from "../shared/cappedRead";
import { RULES_CHANGES_MOST } from "./rulesHistory";

// The one-off migration for #1412: leagues made with the old default deadline, FPL's 90 minutes
// before the first kickoff, move to the platform's 15 (spec/03 S03.3, spec/05 S05.20), and so does
// the admin's default rules row, which every new league copies. A deadline already passed stays
// where it fell (S05.25): every league's passed deadlines are recorded first, as the football sync
// records them, and a recorded deadline is the deadline whatever the rule now says (deadline.ts).
// Every rules row holding 90 moves, past ones included, as a passed gameweek reads its recorded
// deadline, never its rule; a row holding any other time is a commissioner's and stays. Running
// it again does nothing. Run it once on each deployment:
//   npx convex run rules/deadlineDefaultBackfill:moveDeadlinesToDefault
//   npx convex run --prod rules/deadlineDefaultBackfill:moveDeadlinesToDefault

/** The old default: FPL's own timing, which leagues were made with before #1412. */
const OLD_DEFAULT_MINUTES = 90;

const holdsOldDefault = (rules: { deadline: { minutesBeforeFirstKickoff: number } }) =>
  rules.deadline.minutesBeforeFirstKickoff === OLD_DEFAULT_MINUTES;

/** Records every league's passed deadlines, then moves each rules row, and the admin's default
 *  rules, holding 90 minutes to the default; returns how many rules rows it moved and whether the
 *  defaults moved. */
export const moveDeadlinesToDefault = internalMutation({
  args: {},
  returns: v.object({ rowsMoved: v.number(), defaultsMoved: v.boolean() }),
  handler: async (ctx) => {
    await recordPassedDeadlines(ctx);
    const deadline = { ...DEFAULT_DEADLINE_RULE };
    const leagues = await takeAllOrThrow(
      ctx.db.query("leagues"),
      LEAGUES_READ_MOST,
      `More than ${LEAGUES_READ_MOST} leagues are held, so some would keep FPL's deadline`,
    );
    let rowsMoved = 0;
    for (const league of leagues) {
      const rows = await takeAllOrThrow(
        ctx.db.query("leagueRules").withIndex("by_leagueId_and_fromGameweek", (q) => q.eq("leagueId", league._id)),
        RULES_CHANGES_MOST,
        `League ${league._id} holds more than ${RULES_CHANGES_MOST} rules rows, so some would keep FPL's deadline`,
      );
      for (const row of rows) {
        if (!holdsOldDefault(row.rules)) continue;
        await ctx.db.patch("leagueRules", row._id, { rules: { ...row.rules, deadline } });
        rowsMoved += 1;
      }
    }
    const defaults = await ctx.db.query("defaultLeagueRules").unique();
    const defaultsMoved = defaults !== null && holdsOldDefault(defaults.rules);
    if (defaultsMoved) await ctx.db.patch("defaultLeagueRules", defaults._id, { rules: { ...defaults.rules, deadline } });
    return { rowsMoved, defaultsMoved };
  },
});
