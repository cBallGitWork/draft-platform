import { defineTable } from "convex/server";
import { v } from "convex/values";
import { signInReply } from "../signIn/signInReplies";
import { joiningEvents } from "./joining";
import { managerOfTeam, replaced } from "./people";
import { squadEvents } from "./squads";

// Deleting a league (#75): how it works is in leagueDeletion.ts.

/** Why one person wasn't emailed that their league has been deleted: the day's emails had all
 *  gone, or the email service didn't send it. */
export const unemailedReason = v.union(v.literal("paused"), v.literal("notSent"));

export const leagueDeletion = v.object({
  /** Who deleted it, by email: the admin or its commissioner, who both see it and can undo it. */
  by: v.string(),
  deletesAt: v.number(),
  /** The scheduled deleteForGood, which undoing cancels. */
  scheduledId: v.id("_scheduled_functions"),
  /** Left by #75, which emailed while a league could be undone: nothing writes or reads it now
   *  (#320). Kept only so a league deleted before then still matches; drop it once none is left (#328). */
  unemailed: v.optional(v.array(v.object({ email: v.string(), reason: unemailedReason }))),
});

/** One person who wasn't emailed that a league has been deleted (#320). The league is gone by
 *  then, so the row stands alone: it names the league rather than pointing at it. */
const unemailedDeletionFields = {
  leagueName: v.string(),
  /** Who deleted it, by email. */
  by: v.string(),
  email: v.string(),
  reason: unemailedReason,
  at: v.number(),
};

// Leagues (#24, spec/13). People are known by their email, trimmed and lower-cased, so a
// commissioner or manager can be named before they have an account; the admin is ADMIN_EMAIL.

/** A letter to the whole league, as league home pins it (spec/12). */
export const pinnedLetter = v.object({ at: v.number(), from: v.string(), subject: v.string(), body: v.string() });

const leagueFields = {
  name: v.string(),
  /** The league's own maximum, 2 to 20 (spec/13), which its commissioner changes. */
  maxTeams: v.number(),
  commissionerEmail: v.string(),
  /** Absent while the league has none. */
  coCommissionerEmail: v.optional(v.string()),
  /** What asking for the commissioner's sign-in link answered, when one was sent: a commissioner
   *  with no account gets one when named. */
  commissionerLink: v.optional(v.object({ email: v.string(), reply: signInReply })),
  /** Present while the league is being deleted (#75). */
  deletion: v.optional(leagueDeletion),
  /** The gameweeks its commissioner unticked, in order (#74, convex/gameweeks/usedGameweeks.ts). Absent while
   *  it plays all 38, the default, so a league needs no write to have it. */
  unusedGameweeks: v.optional(v.array(v.number())),
  /** The latest letter its commissioner, co-commissioner or the admin wrote to the whole league
   *  (spec/16), pinned on league home until a newer one (spec/12); absent before the first. Its
   *  copies are in `letters`, one a person, so this saves finding the newest among them. */
  pinnedLetter: v.optional(pinnedLetter),
};

const teamFields = {
  leagueId: v.id("leagues"),
  /** The order teams were made in, from 1. */
  number: v.number(),
  name: v.string(),
  /** Absent while the team is vacated: a manager who leaves or is removed leaves it behind. */
  managerEmail: v.optional(v.string()),
};

/** The league switcher (#76): the league each person used last, by email, one row each. */
const lastLeagueFields = { email: v.string(), leagueId: v.id("leagues") };

/** What happened in a league, for Mail (#26) to turn into letters (spec/15, The commissioner):
 *  each says all a letter needs, as it was at the time. */
export const leagueEvent = v.union(
  v.object({ kind: v.literal("created"), name: v.string(), maxTeams: v.number() }),
  v.object({ kind: v.literal("commissionerNamed"), email: v.string(), replaced }),
  v.object({ kind: v.literal("coCommissionerNamed"), email: v.string(), replaced }),
  v.object({ kind: v.literal("coCommissionerRemoved"), email: v.string() }),
  v.object({ kind: v.literal("managerAdded"), ...managerOfTeam }),
  v.object({ kind: v.literal("managerRemoved"), ...managerOfTeam }),
  v.object({ kind: v.literal("managerLeft"), ...managerOfTeam }),
  v.object({ kind: v.literal("teamRenamed"), teamId: v.id("teams"), from: v.string(), to: v.string() }),
  v.object({ kind: v.literal("maxTeamsChanged"), from: v.number(), to: v.number() }),
  v.object({ kind: v.literal("deletionStarted"), name: v.string(), deletesAt: v.number() }),
  v.object({ kind: v.literal("deletionUndone"), name: v.string() }),
  v.object({ kind: v.literal("gameweekUsed"), gameweek: v.number(), used: v.boolean() }),
  ...joiningEvents,
  /** `changed` names the parts of LeagueRules that changed, such as "deadline". Events filed
   *  before the scoring became the site's (#354) may name "scoring" too, with `categories`, the
   *  scoring categories whose rules changed, by full name, and `wholePointsOnly`, its new value
   *  when it was switched; both absent when they didn't change, and from events before #30. */
  v.object({
    kind: v.literal("rulesChanged"),
    fromGameweek: v.number(),
    changed: v.array(v.string()),
    categories: v.optional(v.array(v.string())),
    wholePointsOnly: v.optional(v.boolean()),
  }),
  ...squadEvents,
  /** A commissioner's override of one player's points in one match (#32, spec/14): `from` is
   *  what he had there before, null when no lineup fielded him and no override held, and `teams`
   *  each team whose gameweek total it moved. */
  v.object({
    kind: v.literal("pointsOverridden"),
    playerCode: v.number(),
    playerName: v.string(),
    fixtureCode: v.number(),
    matchName: v.string(),
    gameweek: v.number(),
    from: v.union(v.number(), v.null()),
    to: v.number(),
    reason: v.string(),
    teams: v.array(v.object({ teamName: v.string(), from: v.number(), to: v.number() })),
  }),
);

const leagueEventFields = {
  leagueId: v.id("leagues"),
  at: v.number(),
  /** Who did it, by email. */
  by: v.string(),
  event: leagueEvent,
};

export const leagueTables = {
  leagues: defineTable(leagueFields)
    .index("by_commissionerEmail", ["commissionerEmail"])
    .index("by_coCommissionerEmail", ["coCommissionerEmail"]),
  teams: defineTable(teamFields)
    .index("by_leagueId_and_number", ["leagueId", "number"])
    .index("by_managerEmail", ["managerEmail"]),
  leagueEvents: defineTable(leagueEventFields)
    .index("by_leagueId_and_at", ["leagueId", "at"])
    // League home's latest squad moves of each kind (spec/12), without reading every other event.
    .index("by_leagueId_and_kind_and_at", ["leagueId", "event.kind", "at"]),
  lastLeagues: defineTable(lastLeagueFields).index("by_email", ["email"]).index("by_leagueId", ["leagueId"]),
  unemailedDeletions: defineTable(unemailedDeletionFields),
};
