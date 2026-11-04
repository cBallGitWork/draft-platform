import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

// A league's draft row (../schema/draft.ts's `drafts`; spec/04, Starting it; #1089), read: by the
// draft's start (draftStart.ts), its order (draftOrder.ts) and joining (../leagues/teams.ts), which
// each stop once it has started; and how many picks it has made (draftPicks.ts).

/** The league's draft row, or null while it has none: its commissioner has set no start yet. */
export function draftOf(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Doc<"drafts"> | null> {
  return ctx.db
    .query("drafts")
    .withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId))
    .unique();
}

/** How many picks the league's draft has made (draftPicks.ts): its last pick's number, or 0. */
export async function picksMadeIn(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<number> {
  const last = await ctx.db
    .query("draftPicks")
    .withIndex("by_leagueId_and_pick", (q) => q.eq("leagueId", leagueId))
    .order("desc")
    .first();
  return last?.pick ?? 0;
}

/** Whether the league's draft has started. */
export async function draftHasStarted(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<boolean> {
  return (await draftOf(ctx, leagueId))?.started !== undefined;
}
