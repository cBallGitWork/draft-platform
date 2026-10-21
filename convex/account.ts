import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { adminEmail } from "./allowedEmails";

/** Who this browser is signed in as, or null when signed out. No league exists until #24 builds
 *  them, so everyone is in none, and sees the page saying so (spec/02). */
export const signedInAs = query({
  args: {},
  returns: v.union(v.null(), v.object({ email: v.string(), isAdmin: v.boolean(), inLeague: v.boolean() })),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get("users", userId);
    // A session outlives its user only if the user row was deleted by hand.
    if (user === null) return null;
    if (user.email === undefined) throw new Error(`User ${userId} signed in without an email`);
    return { email: user.email, isAdmin: user.email === adminEmail(), inLeague: false };
  },
});
