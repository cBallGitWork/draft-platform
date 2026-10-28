import { v } from "convex/values";
import { internalQuery, mutation, type QueryCtx } from "../_generated/server";
import { callerEmail, refuse } from "../shared/leagueAccess";
import { isTimeZone } from "../shared/moments";

// Each person's own time zone (Craig, 26 Oct 2026, #442): taken from their browser every time the
// app opens, so it follows them when they travel, and nothing to set. What the server writes for
// them (Mail's letters, a refusal, the admin's email) tells time in it.

const rowOf = (ctx: QueryCtx, email: string) =>
  ctx.db
    .query("timeZones")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();

/** The person's own zone, or undefined until their browser has named one (`momentIn` then tells London's). */
export async function zoneOf(ctx: QueryCtx, email: string): Promise<string | undefined> {
  return (await rowOf(ctx, email))?.zone;
}

/** `zoneOf`, for an action, which can't read the table itself. */
export const zoneFor = internalQuery({
  args: { email: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { email }) => (await zoneOf(ctx, email)) ?? null,
});

export const notAZone = (zone: string) => `"${zone}" isn't a time zone, so it wasn't kept.`;

/** The signed-in person's browser names the zone it is in. */
export const recordZone = mutation({
  args: { zone: v.string() },
  returns: v.null(),
  handler: async (ctx, { zone }) => {
    const email = await callerEmail(ctx);
    if (!isTimeZone(zone)) refuse(notAZone(zone));
    const row = await rowOf(ctx, email);
    if (!row) await ctx.db.insert("timeZones", { email, zone });
    else if (row.zone !== zone) await ctx.db.patch("timeZones", row._id, { zone });
    return null;
  },
});
