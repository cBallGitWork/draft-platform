import { defineTable } from "convex/server";
import { v, type Infer } from "convex/values";

// Squads (#31, spec/15 Assigning players): which team in a league owns each player, by FPL's
// season-stable code. A player is on one team in a league at most; any other is a free agent.

/** A player as a squad letter names him, and the team concerned. */
const playerOnTeam = { playerCode: v.number(), playerName: v.string(), teamId: v.id("teams"), teamName: v.string() };

/** Who went for a player joining a team, if anyone: onto waivers, or back to the free agents. */
const droppedFor = v.union(v.object({ playerCode: v.number(), playerName: v.string(), toWaivers: v.boolean() }), v.null());

/** A player by code and name, as a letter, a claim or a screen names him. */
export const namedPlayer = v.object({ playerCode: v.number(), playerName: v.string() });

/** One side of a trade that went through: its players, and its draft pick, each named by the team
 *  whose pick in the round it is, even once another team holds it (#1096). */
export const tradedSide = v.object({
  players: v.array(namedPlayer),
  picks: v.array(v.object({ round: v.number(), teamId: v.id("teams"), teamName: v.string() })),
});
export type TradedSide = Infer<typeof tradedSide>;

/** What assigning players files for Mail. */
export const squadEvents = [
  v.object({ kind: v.literal("playerAssigned"), ...playerOnTeam }),
  v.object({ kind: v.literal("playerMoved"), ...playerOnTeam, fromTeamId: v.id("teams"), fromTeamName: v.string() }),
  v.object({ kind: v.literal("playerReleased"), ...playerOnTeam }),
  /** His manager dropped him (spec/08, #1197): onto waivers, or straight back to the free agents
   *  under the churn rule. */
  v.object({ kind: v.literal("playerDropped"), ...playerOnTeam, toWaivers: v.boolean() }),
  /** A waiver run gave him to the team for its claim (spec/08, #1198), and who went for him, if
   *  anyone: that drop is filed as its own `playerDropped` too, with no letter of its own. */
  v.object({ kind: v.literal("playerClaimed"), ...playerOnTeam, dropped: droppedFor }),
  /** His manager picked him up as a free agent (spec/08, #1199), and who went for him, if anyone:
   *  that drop is filed as its own `playerDropped` too, with no letter of its own. */
  v.object({ kind: v.literal("playerPickedUp"), ...playerOnTeam, dropped: droppedFor }),
  /** A trade that went through moved him (spec/08 Trades): one for each player, which the squads'
   *  history reads, with no letter or listed row of its own. The trade's own `tradeMade` is the row
   *  (#1491). Trades made before it filed `playerMoved` instead. */
  v.object({ kind: v.literal("playerTraded"), ...playerOnTeam, fromTeamId: v.id("teams"), fromTeamName: v.string() }),
  /** A trade that went through (spec/08 Trades; #1491), one event for the whole trade, filed with
   *  no letter of its own (the trade letter says it): the offering team, the team it went to, and
   *  what each side gave, players or draft picks, as named then. */
  v.object({
    kind: v.literal("tradeMade"),
    fromTeamId: v.id("teams"),
    fromTeamName: v.string(),
    toTeamId: v.id("teams"),
    toTeamName: v.string(),
    /** What went from the offering team to the other. */
    gives: tradedSide,
    /** What came back from the other team to the offering one. */
    gets: tradedSide,
  }),
] as const;

export const squadTables = {
  squadPlayers: defineTable({
    leagueId: v.id("leagues"),
    teamId: v.id("teams"),
    playerCode: v.number(),
    /** The number his manager gave him (#13, spec/05 Squad numbers): absent until given, and gone
     *  when he moves, so he starts afresh on another team. */
    number: v.optional(v.number()),
    /** When his manager picked him up as a free agent (#1199): until a deadline has passed since,
     *  a drop sends him straight back to the free agents (spec/08, the churn rule). Absent for any
     *  other way of joining, and cleared when a trade or move takes him to another team (#1479). */
    pickedUpAt: v.optional(v.number()),
  })
    .index("by_leagueId_and_playerCode", ["leagueId", "playerCode"])
    .index("by_teamId", ["teamId"]),
};

// The shortlist (#374, spec/19 The shortlist): each team's own list of players for the season, by
// FPL's season-stable code. Private to the team: only its manager reads or changes it.
export const shortlistTables = {
  shortlistPlayers: defineTable({ leagueId: v.id("leagues"), teamId: v.id("teams"), playerCode: v.number() })
    .index("by_teamId_and_playerCode", ["teamId", "playerCode"])
    .index("by_leagueId_and_playerCode", ["leagueId", "playerCode"]),
};
