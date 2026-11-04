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

/** A started draft: when it started, its teams in the draft order then, first pick first, and its
 *  rounds, the league's squad maximum then (spec/04, Starting it and The picks). */
const startedDraft =v.object({ at: v.number(), teamIds: v.array(v.id("teams")), rounds: v.number() });

export const draftTables = {
  /** A league's draft (spec/04, Starting it; #1089), one row at most, made the first time its
   *  commissioner sets a start or starts it: a league with none waits for him to press start.
   *  ../draft/draftStart.ts writes it. */
  drafts: defineTable({
    leagueId: v.id("leagues"),
    /** When it starts, the commissioner's date; absent while it waits for him to press start. */
    startsAt: v.optional(v.number()),
    /** The scheduled start at `startsAt`, which a new date, a cleared one or pressing start cancels. */
    startJob: v.optional(v.id("_scheduled_functions")),
    /** Present once it has started. */
    started: v.optional(startedDraft),
  }).index("by_leagueId", ["leagueId"]),
  /** A pick made in a league's draft (spec/04, The picks; #1090): its number, from 1, the team that
   *  made it and the player it took. ../draft/draftPicks.ts writes it, with his squad row. */
  draftPicks: defineTable({
    leagueId: v.id("leagues"),
    pick: v.number(),
    teamId: v.id("teams"),
    playerCode: v.number(),
    at: v.number(),
  }).index("by_leagueId_and_pick", ["leagueId", "pick"]),
};
