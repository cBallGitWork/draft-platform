import { defineTable } from "convex/server";
import { v } from "convex/values";
import { managerOfTeam } from "./people";

// Joining a league (#73, spec/13 Joining): emailed invites, the league's invite link and join
// requests.

/** Where an email the app sends stands: being sent; sent; waiting for tomorrow, the day's emails
 *  all gone (spec/13); or not sent, for too many links to that email this hour, or by the email
 *  service. */
export const delivery = v.union(
  v.literal("sending"),
  v.literal("sent"),
  v.literal("waiting"),
  v.literal("tryLater"),
  v.literal("notSent"),
);

/** One emailed invite (spec/13, Joining). It is live until it expires, is cancelled, or the person
 *  signs in, which ends it with the team they joined or why they couldn't. */
const inviteFields = {
  leagueId: v.id("leagues"),
  email: v.string(),
  /** The vacated team it names; absent for a new team. */
  teamId: v.optional(v.id("teams")),
  invitedBy: v.string(),
  /** Seven days after it was made or last sent. */
  expiresAt: v.number(),
  delivery,
  cancelledAt: v.optional(v.number()),
  joined: v.optional(v.object({ teamId: v.id("teams"), teamName: v.string() })),
  couldNotJoin: v.optional(v.string()),
};

/** A league's one live invite link, by its token: switching it off or replacing it deletes the row. */
const inviteLinkFields = { leagueId: v.id("leagues"), token: v.string() };

/** One join request, made by opening the invite link (spec/15, Joining a league). */
const joinRequestFields = {
  leagueId: v.id("leagues"),
  email: v.string(),
  /** Absent while it waits for the commissioner. */
  decision: v.optional(v.union(v.literal("approved"), v.literal("refused"))),
  decidedBy: v.optional(v.string()),
  /** The email telling an approved person so. */
  approvedEmail: v.optional(delivery),
};

export const joiningTables = {
  invites: defineTable(inviteFields)
    .index("by_leagueId", ["leagueId"])
    .index("by_leagueId_and_cancelledAt", ["leagueId", "cancelledAt"])
    .index("by_email_and_expiresAt", ["email", "expiresAt"]),
  inviteLinks: defineTable(inviteLinkFields).index("by_leagueId", ["leagueId"]).index("by_token", ["token"]),
  joinRequests: defineTable(joinRequestFields)
    .index("by_leagueId_and_decision", ["leagueId", "decision"])
    .index("by_leagueId_and_email_and_decision", ["leagueId", "email", "decision"]),
};

/** Whom an invite is for: a vacated team, or (both null) a new team. */
export const invitedTo = { email: v.string(), teamId: v.union(v.id("teams"), v.null()), teamName: v.union(v.string(), v.null()) };

/** What joining files for Mail. A refused join request files nothing (spec/13, Joining). */
export const joiningEvents = [
  v.object({ kind: v.literal("invited"), ...invitedTo }),
  v.object({ kind: v.literal("inviteResent"), ...invitedTo }),
  v.object({ kind: v.literal("inviteCancelled"), ...invitedTo }),
  v.object({ kind: v.literal("joinedByInvite"), ...managerOfTeam, invitedBy: v.string() }),
  v.object({ kind: v.literal("joinRequestApproved"), ...managerOfTeam }),
  v.object({ kind: v.literal("inviteLinkMade"), replacedOne: v.boolean() }),
  v.object({ kind: v.literal("inviteLinkSwitchedOff") }),
] as const;
