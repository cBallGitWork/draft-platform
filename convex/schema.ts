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

// Match stats (#27, spec/07 "Match stats"): one record per player per match, both feeds merged,
// keyed on FPL's player and fixture codes. Stats keep the feeds' own names (spec/14 names them
// later); a stat a whole record leaves out is 0.

/** Provisional until full time and every man who played has both feeds' records; complete then;
 *  locked when the correction window closes, after which a correction changes nothing. */
export const matchStatsState = v.union(v.literal("provisional"), v.literal("complete"), v.literal("locked"));

export const playerMatchRecord = v.object({
  playerCode: v.number(),
  fixtureCode: v.number(),
  started: v.boolean(),
  /** False for an unused substitute; null while no feed has sent a substitute's minutes. */
  played: v.union(v.boolean(), v.null()),
  /** Whether each feed has sent his record for this match. */
  arrived: v.object({ fpl: v.boolean(), pl: v.boolean() }),
  stats: v.record(v.string(), v.number()),
});

/** One match's place in the window. `fullTimeAt` is when a read first found it at full time;
 *  `completeAt` when every record it needs had arrived (absent while provisional). */
const matchStatsStatusFields = {
  fixtureCode: v.number(),
  state: matchStatsState,
  fullTimeAt: v.number(),
  completeAt: v.optional(v.number()),
  lockedAt: v.optional(v.number()),
  lastReadAt: v.number(),
};

/** A stat a feed changed after the lock, for the feeds page (spec/15): the locked value and the sent one. */
export const lateStatChange = v.object({ stat: v.string(), locked: v.number(), sent: v.number() });

/** The platform's own settings, the admin's to change (spec/15). A league's rules are never here. */
const platformSettingName = v.literal("statCorrectionWindowMinutes");

export const matchStatsSyncTrigger = v.union(v.literal("manual"), v.literal("cron"));

/** What one sync did with one match. */
export const matchSyncOutcome = v.union(
  v.object({
    fixtureCode: v.number(),
    ok: v.literal(true),
    state: matchStatsState,
    players: v.number(),
    inserted: v.number(),
    updated: v.number(),
    lateCorrections: v.number(),
    /** The men inserted or updated, whose points to recompute (#28). Absent on runs before it. */
    changed: v.optional(v.array(v.number())),
    /** Men a team sheet names whom FPL does not list: no record, since there is no code to key it on. */
    unmatched: v.array(v.object({ plPlayerId: v.number(), name: v.string(), opta: v.union(v.string(), v.null()) })),
  }),
  v.object({ fixtureCode: v.number(), ok: v.literal(false), error: v.string() }),
);

// One row per run of matchStatsSync.run, so a failed read is on record, never silent.
export const matchStatsSyncFields = {
  trigger: matchStatsSyncTrigger,
  ranAt: v.number(),
  outcome: v.union(
    v.object({
      ok: v.literal(true),
      matches: v.array(matchSyncOutcome),
      /** Matches due whose Premier League status is not yet full time. */
      waiting: v.array(v.number()),
    }),
    v.object({ ok: v.literal(false), error: v.string() }),
  ),
};

const matchStatsTables = {
  playerMatchStats: defineTable(playerMatchRecord.extend({ state: matchStatsState })).index("by_fixtureCode_and_playerCode", [
    "fixtureCode",
    "playerCode",
  ]),
  matchStatsStatus: defineTable(matchStatsStatusFields).index("by_fixtureCode", ["fixtureCode"]),
  lateStatCorrections: defineTable({
    fixtureCode: v.number(),
    playerCode: v.number(),
    seenAt: v.number(),
    changes: v.array(lateStatChange),
  }).index("by_fixtureCode_and_playerCode", ["fixtureCode", "playerCode"]),
  platformSettings: defineTable({ name: platformSettingName, value: v.number() }).index("by_name", ["name"]),
  matchStatsSyncs: defineTable(matchStatsSyncFields),
  /** When a run last tried each match, read or not: one that never reads steps behind the rest. */
  matchStatsTries: defineTable({ fixtureCode: v.number(), triedAt: v.number() }).index("by_fixtureCode", ["fixtureCode"]),
};

// The live poller (#28): one row per tick that found a match live, so a failed one is on record.
export const liveStatsTickFields = {
  ranAt: v.number(),
  outcome: v.union(
    v.object({ ok: v.literal(true), matches: v.array(matchSyncOutcome) }),
    v.object({ ok: v.literal(false), error: v.string() }),
  ),
};

const liveStatsTables = {
  liveStatsTicks: defineTable(liveStatsTickFields),
};

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

// Joining a league (#73, spec/13 Joining): emailed invites, the league's invite link and join
// requests. Every field added to a live table is optional.

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

/** Whom an invite is for: a vacated team, or (both null) a new team. */
const invitedTo = { email: v.string(), teamId: v.union(v.id("teams"), v.null()), teamName: v.union(v.string(), v.null()) };

/** What joining files for Mail. A refused join request files nothing (spec/13, Joining). */
const joiningEvents = [
  v.object({ kind: v.literal("invited"), ...invitedTo }),
  v.object({ kind: v.literal("inviteResent"), ...invitedTo }),
  v.object({ kind: v.literal("inviteCancelled"), ...invitedTo }),
  v.object({ kind: v.literal("joinedByInvite"), ...managerOfTeam, invitedBy: v.string() }),
  v.object({ kind: v.literal("joinRequestApproved"), ...managerOfTeam }),
  v.object({ kind: v.literal("inviteLinkMade"), replacedOne: v.boolean() }),
  v.object({ kind: v.literal("inviteLinkSwitchedOff") }),
] as const;

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
  ...joiningEvents,
);

const leagueEventFields = {
  leagueId: v.id("leagues"),
  at: v.number(),
  /** Who did it, by email. */
  by: v.string(),
  event: leagueEvent,
};

export default defineSchema({
  ...matchStatsTables,
  ...liveStatsTables,
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
  invites: defineTable(inviteFields)
    .index("by_leagueId", ["leagueId"])
    .index("by_email_and_expiresAt", ["email", "expiresAt"]),
  inviteLinks: defineTable(inviteLinkFields).index("by_leagueId", ["leagueId"]).index("by_token", ["token"]),
  joinRequests: defineTable(joinRequestFields)
    .index("by_leagueId_and_decision", ["leagueId", "decision"])
    .index("by_leagueId_and_email_and_decision", ["leagueId", "email", "decision"]),
  feedChecks: defineTable(feedCheckFields),
  clubs: defineTable(clubRecord.extend({ droppedAt })).index("by_code", ["code"]),
  players: defineTable(playerRecord.extend({ droppedAt })).index("by_code", ["code"]),
  fixtures: defineTable(fixtureRecord.extend({ droppedAt })).index("by_code", ["code"]).index("by_kickoff", ["kickoff"]),
  gameweeks: defineTable(gameweekRecord.extend({ droppedAt })).index("by_number", ["number"]),
  footballSyncs: defineTable(footballSyncFields),
});
