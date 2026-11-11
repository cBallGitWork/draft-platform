import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { positionsNow } from "../positions/playerPositions";
import { everyLeague } from "../shared/cappedRead";
import { startClock } from "./draftClock";
import { draftRulesNow } from "./draftPickTime";
import { draftOf, picksMadeIn, turnNow } from "./draftRow";
import { rulesInForceAt } from "./draftStart";

// The one-off migration for #1610: drafts started before 11 Nov 2026, on alpha and staging only,
// are backfilled once, so the draft code no longer carries a branch for each (Craig, 11 Nov 2026,
// on #1610: "drafts started before 11 Nov on alpha and staging can be wiped or backfilled once").
// Each gets what a draft started today holds, as the deleted fallbacks read it:
// - a started draft with no squad rules (before #1090) gets the league's in force when it started;
// - a started draft with no pick time (before #1439) gets the league's latest;
// - a live draft with no clock (before #1091) puts its pick on the clock from now;
// - a pick the draft made on a timeout with no `auto` (before #1100) is marked auto;
// - a pick with no positions (before #1484) gets the player's positions now.
// Running it again does nothing. Run it once on each deployment, before the pull request that
// makes `started.squad` and a pick's `positions` required:
//   npx convex run draft/oldDraftsBackfill:backfillOldDrafts
//   npx convex run --prod draft/oldDraftsBackfill:backfillOldDrafts

const filled = v.object({ squads: v.number(), pickTimes: v.number(), clocks: v.number(), autos: v.number(), positions: v.number() });

/** Fills in each draft's missing fields as above; returns how many of each it filled. */
export const backfillOldDrafts = internalMutation({
  args: {},
  returns: filled,
  handler: async (ctx) => {
    const count = { squads: 0, pickTimes: 0, clocks: 0, autos: 0, positions: 0 };
    for (const league of await everyLeague(ctx, "so some drafts would keep their old shape")) {
      const draft = await draftOf(ctx, league._id);
      if (draft?.started !== undefined) await backfillDraft(ctx, draft, count);
      await backfillPicks(ctx, league._id, count);
    }
    return count;
  },
});

type Count = Infer<typeof filled>;

/** The started `draft` gets its squad rules, pick time and clock where it lacks them. */
async function backfillDraft(ctx: MutationCtx, draft: Doc<"drafts">, count: Count): Promise<void> {
  const { leagueId } = draft;
  const started = draft.started!;
  if (started.squad === undefined) {
    await ctx.db.patch("drafts", draft._id, { started: { ...started, squad: (await rulesInForceAt(ctx, leagueId, started.at)).squad } });
    count.squads += 1;
  }
  const pickSeconds = draft.pickSeconds ?? (await draftRulesNow(ctx, leagueId)).pickSeconds;
  if (draft.pickSeconds === undefined) {
    await ctx.db.patch("drafts", draft._id, { pickSeconds });
    count.pickTimes += 1;
  }
  if (draft.clock === undefined && (await turnNow(ctx, draft)) !== null) {
    await startClock(ctx, leagueId, await picksMadeIn(ctx, leagueId), Date.now(), pickSeconds);
    count.clocks += 1;
  }
}

/** Each of the league's picks gets its `auto` mark and positions where it lacks them. */
async function backfillPicks(ctx: MutationCtx, leagueId: Id<"leagues">, count: Count): Promise<void> {
  const picks = await ctx.db
    .query("draftPicks")
    .withIndex("by_leagueId_and_pick", (q) => q.eq("leagueId", leagueId))
    .collect();
  const positionsOf = await positionsNow(ctx, leagueId);
  for (const pick of picks) {
    const auto = pick.auto === undefined && pick.timeout !== undefined;
    const positions = pick.positions === undefined ? await positionsOf(pick.playerCode) : undefined;
    if (!auto && positions === undefined) continue;
    await ctx.db.patch("draftPicks", pick._id, { ...(auto && { auto: true as const }), ...(positions && { positions }) });
    if (auto) count.autos += 1;
    if (positions) count.positions += 1;
  }
}
