import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { Position } from "../positions/positionTables";
import { pickOnTheClock, picksLeftFor } from "./snakeOrder";

// A league's draft row (../schema/draft.ts's `drafts`; spec/04, Starting it; #1089), read: by the
// draft's start (draftStart.ts), its order (draftOrder.ts) and joining (../leagues/teams.ts), which
// each stop once it has started; how many picks it has made and the pick on its clock (draftPicks.ts,
// draftPlayers.ts); whether it is live, while the commissioner's assign, move and release are refused
// (../squads/squads.ts); and whether it is over, before which free agency and waivers are shut
// (../waivers/).

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

/** Whether the draft's last pick, `last`, is one its manager made himself whose 10 seconds to undo
 *  still run at `now` (pickWindow.ts; #1458): they end as the next clock starts, or the draft ends,
 *  and a pause freezes them (Craig, 4 Nov 2026, on #1091). */
export function undoWindowOpen(draft: Doc<"drafts">, last: Doc<"draftPicks"> | null, now: number): boolean {
  const clock = draft.clock;
  return last?.own !== undefined && clock !== undefined && (clock.paused?.at ?? now) < clock.startsAt;
}

/** How many picks the league's draft has made (draftPicks.ts): its last pick's number, or 0. */
export async function picksMadeIn(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<number> {
  return (await lastPickIn(ctx, leagueId))?.pick ?? 0;
}

/** The positions each player the league's draft has taken had when he was drafted, by his code: the
 *  rest of the draft counts him at them, so a position he loses since can't leave his team with no
 *  legal pick (Craig, 11 Nov 2026, on #1484). A pick made before #1484 kept none, and is left out. */
export async function draftedPositionsIn(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Map<number, Position[]>> {
  const picks = await ctx.db
    .query("draftPicks")
    .withIndex("by_leagueId_and_pick", (q) => q.eq("leagueId", leagueId))
    .collect();
  return new Map(picks.flatMap(({ playerCode, positions }) => (positions === undefined ? [] : [[playerCode, positions] as const])));
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

/** How many picks `teamId` has left in the started draft, counting one on the clock (snakeOrder.ts's
 *  `picksLeftFor`): the pick and the draft room's greyed-out list both count them here. */
export async function picksLeftOf(ctx: QueryCtx, draft: Doc<"drafts">, started: StartedDraft, teamId: Id<"teams">): Promise<number> {
  return picksLeftFor(started.teamIds, started.rounds, await picksMadeIn(ctx, draft.leagueId), draft.tradedPicks ?? [], teamId);
}

/** Whether the league's draft is live: started, with a pick still on the clock (snakeOrder.ts) or
 *  its last pick's 10 seconds still running (draftClock.ts; #1458). Before it starts and once it is
 *  over, it isn't. */
export async function draftIsLive(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<boolean> {
  const draft = await draftOf(ctx, leagueId);
  return draft !== null && (draft.clock?.closing === true || (await turnNow(ctx, draft)) !== null);
}

/** Whether the league's draft is over: started, with no pick left on the clock. Free agency and
 *  waivers wait for it (spec/08, Craig, 8 Nov 2026: "refused until drafted"; #1326). */
export async function draftIsOver(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<boolean> {
  return (await draftHasStarted(ctx, leagueId)) && !(await draftIsLive(ctx, leagueId));
}
