import { defineTable } from "convex/server";
import { v } from "convex/values";
import { roleStarsShape } from "../stars/starsShape";

export const starsTables = {
  /** Stars (#11, spec/05 Roles): one row a player with a counted match and positions, refreshed as
   *  matches lock and when the site's scoring changes (stars/starsRefresh.ts), so no read prices
   *  every player under every role. How many matches he is rated on, and for each role in each area
   *  he plays, his points per match under it and his stars. `refreshedAt` is when his row was last
   *  worked out, so a refresh of every player drops the rows of those it no longer holds. */
  playerRoleStars: defineTable({
    playerCode: v.number(),
    matches: v.number(),
    ratings: v.array(roleStarsShape.extend({ perMatch: v.number() })),
    refreshedAt: v.number(),
  }).index("by_playerCode", ["playerCode"]),
};
