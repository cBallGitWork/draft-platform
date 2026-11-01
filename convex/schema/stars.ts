import { defineTable } from "convex/server";
import { v } from "convex/values";
import { roleStarsShape } from "../stars/starsShape";

export const starsTables = {
  /** Stars (#11, spec/05 Roles): one row a player with a counted match and positions, refreshed as
   *  matches lock and when the site's scoring changes (stars/starsRefresh.ts), so no read prices
   *  every player under every role. How many matches he is rated on, and for each role in each area
   *  he plays, his points per match under it and his stars. */
  playerRoleStars: defineTable({
    playerCode: v.number(),
    matches: v.number(),
    ratings: v.array(roleStarsShape.extend({ perMatch: v.number() })),
  }).index("by_playerCode", ["playerCode"]),
  /** Each bench player's stars as they stood at a league's deadline for a gameweek (Craig, 1 Nov
   *  2026; stars/deadlineStars.ts): what picks the role of an auto-sub who comes on in his own area,
   *  so scoring the gameweek again never moves it. One row a league, gameweek and team; only his
   *  ratings with stars, since "?" and "—" pick nothing. */
  deadlineStars: defineTable({
    leagueId: v.id("leagues"),
    gameweek: v.number(),
    teamId: v.id("teams"),
    bench: v.array(v.object({ playerCode: v.number(), stars: v.array(roleStarsShape) })),
  }).index("by_leagueId_and_gameweek_and_teamId", ["leagueId", "gameweek", "teamId"]),
};
