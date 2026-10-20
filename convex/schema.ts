import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { signInReply } from "./signInLinks";

/** What one read of a feed found: a count of what came back, or why it failed. */
export const feedOutcome = v.union(
  v.object({ ok: v.literal(true), count: v.number() }),
  v.object({ ok: v.literal(false), error: v.string() }),
);

export const feedCheckTrigger = v.union(v.literal("manual"), v.literal("timer"));

// One row per run of feeds.check (issue #7): proof that Convex reaches both feeds,
// and, for a "timer" run, that a scheduled function fired with nobody watching.
export const feedCheckFields = {
  trigger: feedCheckTrigger,
  scheduledFor: v.optional(v.number()),
  ranAt: v.number(),
  fplPlayers: feedOutcome,
  plFixtures: feedOutcome,
  arsenalSquadNumbers: feedOutcome,
};

// The real Premier League, as the football layer hands it over (#21). Each row is keyed on a
// season-stable code, never FPL's per-season id, and names its clubs by their codes too, so a
// new season's ids change nothing. A gameweek is keyed on its number, as FPL numbers them.
// Times are epoch milliseconds.

export const clubRecord = v.object({
  code: v.number(),
  name: v.string(),
  /** Three letters, e.g. "ARS". */
  shortName: v.string(),
});

export const playerRecord = v.object({
  code: v.number(),
  /** FPL's short display name, e.g. "Saka". */
  name: v.string(),
  fullName: v.string(),
  clubCode: v.number(),
});

export const fixtureRecord = v.object({
  code: v.number(),
  /** Null while a postponed match waits for a new date. */
  gameweek: v.union(v.number(), v.null()),
  homeClubCode: v.number(),
  awayClubCode: v.number(),
  /** Null while a match has no kickoff time. */
  kickoff: v.union(v.number(), v.null()),
});

export const gameweekRecord = v.object({
  number: v.number(),
  /** FPL's own deadline. A league's deadline is its own rule (spec/03), worked out from the kickoffs. */
  deadline: v.number(),
});

// The schema is live: clubs, players, fixtures, gameweeks and footballSyncs hold rows written
// before #64, so every field added since is optional, or the next push would refuse those rows.
// Renaming a field is a migration, never an edit here.

/** When the feed stopped sending a held row: the `ranAt` of the first sync without it. Absent
 *  while the row is sent. The row is kept, never deleted, and unmarked when sent again, found by
 *  its key as ever: a player by his `code` (#64). */
const droppedAt = v.optional(v.number());

/** One table's share of a sync: the rows the feed sent, how many were new or had changed, and
 *  how many held rows it marked as no longer sent or unmarked as sent again (absent on runs before #64). */
export const tableWrites = v.object({
  received: v.number(),
  inserted: v.number(),
  updated: v.number(),
  marked: v.optional(v.number()),
  unmarked: v.optional(v.number()),
});

export const footballSyncTrigger = v.union(v.literal("manual"), v.literal("cron"));

// One row per run of footballSync.run, so a failed fetch is on record, never silent.
export const footballSyncFields = {
  trigger: footballSyncTrigger,
  ranAt: v.number(),
  outcome: v.union(
    v.object({
      ok: v.literal(true),
      clubs: tableWrites,
      players: tableWrites,
      fixtures: tableWrites,
      gameweeks: tableWrites,
    }),
    v.object({ ok: v.literal(false), error: v.string() }),
  ),
};

// Sign-in (#20, spec/02). Emails are stored trimmed and lower-cased (`normaliseEmail`).

/** An email the admin let sign in (spec/13, Joining). The admin's own email needs no row. */
const allowedEmailFields = { email: v.string() };

/** One ask for a link that was answered "check your email", on the list or not, so the hourly
 *  limit counts every email alike. A refused ask (too many, or paused) is told so and not stored. */
const signInAskFields = {
  email: v.string(),
  askedAt: v.number(),
  /** Whether the email was on the list, so a link was to be sent. */
  listed: v.boolean(),
  /** When Convex Auth's send took this ask; a send with no ask to take is refused. */
  claimedAt: v.optional(v.number()),
  /** Why the email wasn't sent, when it wasn't. */
  sendError: v.optional(v.string()),
};

/** The emails the app sent on one UTC day, against Resend's daily limit (ARCHITECTURE.md). */
const emailSendFields = { day: v.string(), count: v.number() };

// Deleting a league (#75, spec/13, Deleting): for DELETION_UNDO_HOURS the league is frozen and
// hidden from everyone with a part in it but whoever deleted it, then a scheduled function
// deletes it and every row keyed to it.

/** Why one person wasn't emailed that their league is being deleted: the day's emails had all
 *  gone, or the email service didn't send it. */
export const unemailedReason = v.union(v.literal("paused"), v.literal("notSent"));

export const leagueDeletion = v.object({
  /** Who deleted it, by email: they, and the admin, see it and can undo it. */
  by: v.string(),
  deletesAt: v.number(),
  /** The scheduled deleteForGood, which undoing cancels. */
  scheduledId: v.id("_scheduled_functions"),
  /** Each person who wasn't emailed, so whoever deleted it is told. */
  unemailed: v.array(v.object({ email: v.string(), reason: unemailedReason })),
});

// Leagues (#24, spec/13). People are known by their email, trimmed and lower-cased, so a
// commissioner or manager can be named before they have an account; the admin is ADMIN_EMAIL.

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
};

const teamFields = {
  leagueId: v.id("leagues"),
  /** The order teams were made in, from 1. */
  number: v.number(),
  name: v.string(),
  /** Absent while the team is vacated: a manager who leaves or is removed leaves it behind. */
  managerEmail: v.optional(v.string()),
};

/** Who held a role before, or null when nobody did. */
const replaced = v.union(v.string(), v.null());
/** A manager and their team, its name as it was then. */
const managerOfTeam = { email: v.string(), teamId: v.id("teams"), teamName: v.string() };

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
);

const leagueEventFields = {
  leagueId: v.id("leagues"),
  at: v.number(),
  /** Who did it, by email. */
  by: v.string(),
  event: leagueEvent,
};

export default defineSchema({
  ...authTables,
  allowedEmails: defineTable(allowedEmailFields).index("by_email", ["email"]),
  signInAsks: defineTable(signInAskFields).index("by_email_and_askedAt", ["email", "askedAt"]),
  emailSends: defineTable(emailSendFields).index("by_day", ["day"]),
  leagues: defineTable(leagueFields)
    .index("by_commissionerEmail", ["commissionerEmail"])
    .index("by_coCommissionerEmail", ["coCommissionerEmail"]),
  teams: defineTable(teamFields)
    .index("by_leagueId_and_number", ["leagueId", "number"])
    .index("by_managerEmail", ["managerEmail"]),
  leagueEvents: defineTable(leagueEventFields).index("by_leagueId_and_at", ["leagueId", "at"]),
  feedChecks: defineTable(feedCheckFields),
  clubs: defineTable(clubRecord.extend({ droppedAt })).index("by_code", ["code"]),
  players: defineTable(playerRecord.extend({ droppedAt })).index("by_code", ["code"]),
  fixtures: defineTable(fixtureRecord.extend({ droppedAt })).index("by_code", ["code"]),
  gameweeks: defineTable(gameweekRecord.extend({ droppedAt })).index("by_number", ["number"]),
  footballSyncs: defineTable(footballSyncFields),
});
