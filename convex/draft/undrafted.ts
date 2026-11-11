import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type QueryCtx } from "../_generated/server";
import { currentClubs, currentPlayersAt } from "../shared/players";
import { heldCodesIn } from "../squads/squadPlace";
import { putOnWaivers } from "../waivers/waiverPlayers";

// The players a league's draft leaves: what each pick chooses from (draftPicks.ts), what the draft
// room greys out against (draftPlayers.ts), and, once the draft is over, those who go on waivers
// when its setting says so (#1197).

/** Every Premier League player now. */
export async function everyPlayerNow(ctx: QueryCtx): Promise<Doc<"players">[]> {
  return (await Promise.all((await currentClubs(ctx)).map(({ code }) => currentPlayersAt(ctx, code)))).flat();
}

/** The players still undrafted in the league: in the Premier League now and held by no team. The
 *  league's squads are read once, never a read per player (#1532). */
export async function undraftedIn(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Doc<"players">[]> {
  const held = await heldCodesIn(ctx, leagueId);
  return (await everyPlayerNow(ctx)).filter(({ code }) => !held.has(code));
}

/** The players nobody drafted go on the league's waivers, a run taking them from `claimableFrom`:
 *  the draft's last pick schedules it (#1197), in a transaction of its own so the last pick stays
 *  clear of Convex's read limit (#1532). The last pick can't be undone (draftCommissioner.ts), so
 *  the draft is still over when it runs. */
export const putUndraftedOnWaivers = internalMutation({
  args: { leagueId: v.id("leagues"), claimableFrom: v.number() },
  returns: v.null(),
  handler: async (ctx, { leagueId, claimableFrom }) => {
    for (const { code } of await undraftedIn(ctx, leagueId)) await putOnWaivers(ctx, leagueId, code, claimableFrom);
    return null;
  },
});
