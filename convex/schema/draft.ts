import { defineTable } from "convex/server";
import { v } from "convex/values";
import { leagueRulesShape } from "../rules/leagueRulesShape";

/** A player in the admin's ranking: his FPL code, and his rank, 1 the best. */
export const rankedPlayer = v.object({ code: v.number(), rank: v.number() });

export const draftRankingTables = {
  /** One row at most: the admin's ranking, one for the whole platform, which auto-pick takes from
   *  when a manager's queue is out (spec/04, The queue and the ranking; #1093). Each upload replaces
   *  it whole. Its players are best first; a player not in it is unranked. */
  draftRanking: defineTable({ players: v.array(rankedPlayer), uploadedAt: v.number() }),
};

/** A started draft: when it started, its teams in the draft order then, first pick first, its
 *  rounds, the league's squad maximum then, and the squad rules every pick is checked against, the
 *  league's then (spec/04, Starting it and The picks; Craig, 4 Nov 2026, on #1090). `squad` is
 *  absent only from drafts started before #1090, whose picks read the rules in force at `at`
 *  (../draft/draftPicks.ts): optional, so those rows need no migration. */
const startedDraft = v.object({
  at: v.number(),
  teamIds: v.array(v.id("teams")),
  rounds: v.number(),
  squad: v.optional(leagueRulesShape.fields.squad),
});

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
    /** The pick on the clock (spec/04, The picks; #1091): its number, when its clock starts, 10
     *  seconds after the pick before it, and when it runs out, and the scheduled job that makes the
     *  pick for its team then, or as its clock starts for a team with no manager. Absent before the
     *  draft starts and once it is over, and from a draft started before #1091 until its next pick.
     *  ../draft/draftClock.ts writes it. */
    clock: v.optional(v.object({ pick: v.number(), startsAt: v.number(), endsAt: v.number(), job: v.id("_scheduled_functions") })),
  }).index("by_leagueId", ["leagueId"]),
  /** A team's draft queue and do-not-draft list (spec/04, The queue and the ranking; #1092), one row
   *  at most, made the first time its manager adds to either: a team with none has both empty. They
   *  are the team's, not one draft's (Craig, 4 Nov 2026). ../draft/draftLists.ts writes it. */
  draftLists: defineTable({
    leagueId: v.id("leagues"),
    teamId: v.id("teams"),
    /** The queue, by FPL code, first choice first. */
    queue: v.array(v.number()),
    /** The do-not-draft list, by FPL code, in the order they were added. */
    doNotDraft: v.array(v.number()),
  })
    .index("by_teamId", ["teamId"])
    .index("by_leagueId", ["leagueId"]),
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
