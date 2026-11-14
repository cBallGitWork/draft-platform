import { v } from "convex/values";
import { query } from "../_generated/server";
import { SITE_VERSION } from "../shared/siteVersion";

/** The version of its public functions the server holds now, for anyone, signed in or not: an
 *  open tab compares it with its own (src/shared/newVersion.ts; spec/12, S12.13). */
export const current = query({
  args: {},
  returns: v.number(),
  handler: () => SITE_VERSION,
});
