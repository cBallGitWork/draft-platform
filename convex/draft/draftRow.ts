import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { pickOnTheClock } from "./snakeOrder";

// A league's draft row (../schema/draft.ts's `drafts`; spec/04, Starting it; #1089), read: by the
// draft's start (draftStart.ts), its order (draftOrder.ts) and joining (../leagues/teams.ts), which
// each stop once it has started; how many picks it has made and the pick on its clock (draftPicks.ts,
// draftPlayers.ts); and whether it is
// live, while the commissioner's assign, move and release are refused (../squads/squads.ts).

/** The league's draft row, or null while it has none: its commissioner has set no start yet. */
export function draftOf(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Doc<"drafts"> | null> {
  return ctx.db
    .query("drafts")
    .withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId))
    .unique();
}

/** The league's draft's last pick, or null while none is made. */
export function lastPickIn(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Doc<"draftPicks"> | null> {
  return ctx.db
    .query("draftPicks")
    .withIndex("by_leagueId_and_pick", (q) => q.eq("leagueId", leagueId))
    .order("desc")
    .first();
}

/** How many picks the league's draft has made (draftPicks.ts): its last pick's number, or 0. */
export async function picksMadeIn(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<number> {
  return (await lastPickIn(ctx, leagueId))?.pick ?? 0;
}

/** Whether the league's draft has started. */
export async function draftHasStarted(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<boolean> {
  return (await draftOf(ctx, leagueId))?.started !== undefined;
}

/** A started draft, as its row holds it. */
export type StartedDraft = NonNullable<Doc<"drafts">["started"]>;

/** A pick on a draft's clock (snakeOrder.ts). */
export type Turn = NonNullable<ReturnType<typeof pickOnTheClock<Id<"teams">>>>;

/** The pick on the draft's clock now, after any trade, or null before it starts and once it is over. */
export async function turnNow(ctx: QueryCtx, draft: Doc<"drafts">): Promise<Turn | null> {
  const started = draft.started;
  if (started === undefined) return null;
  return pickOnTheClock(started.teamIds, started.rounds, await picksMadeIn(ctx, draft.leagueId), draft.tradedPicks);
}

/** Whether the league's draft is live: started, with a pick still on the clock (snakeOrder.ts).
 *  Before it starts and once it is over, it isn't. */
export async function draftIsLive(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<boolean> {
  const draft = await draftOf(ctx, leagueId);
  return draft !== null && (await turnNow(ctx, draft)) !== null;
}
