import { v, type Infer } from "convex/values";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { adminOf } from "../shared/leagueAccess";
import { heldPlayerByCode } from "../shared/players";
import { availability } from "../schema";

// A player's availability (spec/06, Availability): out, doubtful or available, our own, so it
// scales past the Premier League. The feed fills it through the football layer (for the Premier
// League, FPL's flags: `mapFpl` in football/fpl/fpl.ts), and the admin can set it by hand over the
// feed, then clear it back (spec/15: the admin always has the option). The auto team reads only
// `availabilityOf` (spec/09).

export type Availability = Infer<typeof availability>;

/** What a feed sends with no flag on him, and what a row from before availability holds until the
 *  next football sync fills it. */
const UNFLAGGED: Availability = "available";

const playerAvailability = v.object({
  /** What counts: the admin's, if he has set one, else the feed's. */
  availability,
  feed: availability,
  /** The admin's, or null while he has set none. */
  set: v.union(availability, v.null()),
});
export type PlayerAvailability = Infer<typeof playerAvailability>;

/** His availability now. A player the football sync doesn't hold is data gone wrong, so it throws. */
export async function availabilityOf(ctx: QueryCtx, code: number): Promise<PlayerAvailability> {
  const player = await heldPlayerByCode(ctx, code, `No player with code ${code} is held, so he has no availability`);
  const feed = player.availability ?? UNFLAGGED;
  const set = (await settingOf(ctx, code))?.availability ?? null;
  return { availability: set ?? feed, feed, set };
}

/** His availability, the feed's and the admin's, for the admin. */
export const ofPlayer = query({
  args: { code: v.number() },
  returns: playerAvailability,
  handler: async (ctx, { code }) => {
    await adminOf(ctx);
    return availabilityOf(ctx, code);
  },
});

/** Sets his availability by hand over the feed's, until cleared with null, which brings the
 *  feed's back. */
export const set = mutation({
  args: { code: v.number(), availability: v.union(availability, v.null()) },
  returns: v.null(),
  handler: async (ctx, { code, availability: given }) => {
    await adminOf(ctx);
    await heldPlayerByCode(ctx, code, `No player with code ${code} is held, so his availability can't be set`);
    const row = await settingOf(ctx, code);
    if (given === null) {
      if (row !== null) await ctx.db.delete("availabilitySettings", row._id);
    } else if (row === null) {
      await ctx.db.insert("availabilitySettings", { code, availability: given });
    } else {
      await ctx.db.patch("availabilitySettings", row._id, { availability: given });
    }
    return null;
  },
});

function settingOf(ctx: QueryCtx, code: number) {
  return ctx.db
    .query("availabilitySettings")
    .withIndex("by_code", (q) => q.eq("code", code))
    .unique();
}
