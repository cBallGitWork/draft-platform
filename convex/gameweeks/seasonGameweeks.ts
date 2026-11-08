import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { seasonStartYear } from "../shared/time";

// Each season's gameweeks are their own rows, keyed on season and number, so last season's are
// kept beside this one's, never overwritten (#66). A row written before #66 has no season.

/** The season of the newest gameweeks held: the newest FPL sent. Absent while only rows from
 *  before #66 are held, which name none. */
export async function heldSeason(ctx: QueryCtx): Promise<number | undefined> {
  const newest = await ctx.db.query("gameweeks").withIndex("by_season_and_number").order("desc").first();
  return newest?.season;
}

/** The held row of a gameweek FPL sent: its season's, else a row from before #66 with its number
 *  whose deadline falls in that season, for the sync to label. Never another season's. */
export async function heldGameweek(ctx: QueryCtx, sent: Pick<Doc<"gameweeks">, "season" | "number">): Promise<Doc<"gameweeks"> | null> {
  const find = (season: number | undefined) =>
    ctx.db
      .query("gameweeks")
      .withIndex("by_season_and_number", (q) => q.eq("season", season).eq("number", sent.number))
      .unique();
  const labelled = await find(sent.season);
  if (labelled !== null) return labelled;
  const unlabelled = await find(undefined);
  return unlabelled !== null && seasonStartYear(unlabelled.deadline) === sent.season ? unlabelled : null;
}
