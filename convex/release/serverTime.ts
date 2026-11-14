import { v } from "convex/values";
import { mutation } from "../_generated/server";

/** The server's time now, for anyone, signed in or not: an open tab asks once, so its countdowns go
 *  by the server's time, not its own clock's (src/shared/serverClock.ts; S04.22, S05.50). A
 *  mutation, as a query's answer is cached and would hand back a time gone by. */
export const now = mutation({
  args: {},
  returns: v.number(),
  handler: () => Date.now(),
});
