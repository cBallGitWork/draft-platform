import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { seasonStartYear } from "../shared/time";

// Each season's gameweeks are their own rows, keyed on season and number, so last season's are
// kept beside this one's, never overwritten (#66). A row written before #66 has no season.

/** The season of the newest gameweeks held: the newest FPL sent. Absent while only rows from
 *  before #66 are held, which name none. shared/fixtures.ts's `heldFixturesSeason` reads the
 *  held matches' season instead, which can differ while a new season's gameweeks or matches arrive
 *  before the other. */
export async function heldGameweeksSeason(ctx: QueryCtx): Promise<number | undefined> {
  return (await newestGameweek(ctx))?.season;
}

/** The newest season's last gameweek held. */
function newestGameweek(ctx: QueryCtx) {
  return ctx.db.query("gameweeks").withIndex("by_season_and_number").order("desc").first();
}

/** How many gameweeks the season has (#1618; Craig, 11 Nov 2026: "the count is however many it
 *  has"): however many windows the feed's rounds make, numbered from 1, so the highest held: the
 *  newest season's last gameweek row, or the latest gameweek a held match is in, should the matches
 *  arrive before their gameweek's row. A gameweek the feed stopped sending stays one of them (#202).
 *  0 while neither is held, as on a fresh deployment before the first feed sync: the season then
 *  has no gameweeks, so the screens list none and a call naming one is refused with
 *  usedGameweeks.ts's `noSuchGameweek`, which says they haven't arrived. Every league plays the
 *  Premier League's until a league picks its competitions (#1429). */
export async function seasonGameweekCount(ctx: QueryCtx): Promise<number> {
  const latestMatch = await ctx.db.query("fixtures").withIndex("by_gameweek_and_droppedAt").order("desc").first();
  return Math.max((await newestGameweek(ctx))?.number ?? 0, latestMatch?.gameweek ?? 0);
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
