import { v, type Infer } from "convex/values";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { adminOf } from "../shared/leagueAccess";
import { clubByCode, heldPlayerByCode } from "../shared/players";
import { positionsNow, type PositionsNow } from "../positions/playerPositions";
import { EVERY_LEAGUE } from "../positions/positionSettings";
import { availability, position } from "../schema";

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

/** A player as the admin dashboard's Availability tab shows him (the approved auto-team picture):
 *  his name, club and positions, what the feed says and what the admin set, null for none. */
const adminRow = v.object({
  code: v.number(),
  name: v.string(),
  clubShortName: v.string(),
  positions: v.array(position),
  feed: availability,
  set: v.union(availability, v.null()),
});
export type AvailabilityRow = Infer<typeof adminRow>;

async function adminRowOf(ctx: QueryCtx, code: number, positionsOf: PositionsNow): Promise<AvailabilityRow> {
  const player = await heldPlayerByCode(ctx, code, `No player with code ${code} is held, so his availability can't be shown`);
  const { feed, set } = await availabilityOf(ctx, code);
  return { code, name: player.name, clubShortName: (await clubByCode(ctx, player.clubCode)).shortName, positions: await positionsOf(code), feed, set };
}

/** Every player the admin has set by hand over the feed, by name, for the Availability tab. */
export const setByHand = query({
  args: {},
  returns: v.array(adminRow),
  handler: async (ctx) => {
    await adminOf(ctx);
    const positionsOf = await positionsNow(ctx, EVERY_LEAGUE);
    const rows = await Promise.all((await ctx.db.query("availabilitySettings").collect()).map(({ code }) => adminRowOf(ctx, code, positionsOf)));
    return rows.sort((one, other) => one.name.localeCompare(other.name));
  },
});

/** One player for the Availability tab's panel, set by hand or not. */
export const forAdmin = query({
  args: { code: v.number() },
  returns: adminRow,
  handler: async (ctx, { code }) => {
    await adminOf(ctx);
    return adminRowOf(ctx, code, await positionsNow(ctx, EVERY_LEAGUE));
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
