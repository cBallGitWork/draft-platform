import { defineTable } from "convex/server";
import { v } from "convex/values";

/** A player in the admin's ranking: his FPL code, and his rank, 1 the best. */
export const rankedPlayer = v.object({ code: v.number(), rank: v.number() });

export const draftRankingTables = {
  /** One row at most: the admin's ranking, one for the whole platform, which auto-pick takes from
   *  when a manager's queue is out (spec/04, The queue and the ranking; #1093). Each upload replaces
   *  it whole. Its players are best first; a player not in it is unranked. */
  draftRanking: defineTable({ players: v.array(rankedPlayer), uploadedAt: v.number() }),
};
