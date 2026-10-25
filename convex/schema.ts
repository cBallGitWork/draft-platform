import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v, type VLiteral } from "convex/values";
import { cellShape, scoringSetShape, storedLeagueRulesShape } from "./rules/leagueRulesShape";
import { squadMaximumBandShape } from "./rules/squadMaximums";
import { POSITIONS, type Position } from "./positions/positionTables";
import { feedValidator } from "./shared/feedSchedule";
import { signInReply } from "./signIn/signInLinks";
import { LEAGUE_AVERAGE } from "./table/roundRobin";

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

const feedCheckTables = {
  feedChecks: defineTable(feedCheckFields),
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
  /** FPL's news on why he may miss the next match, "" with none (#381); absent on rows from before it. */
  news: v.optional(v.string()),
  /** FPL's chance he plays in the next round, in percent, null while it has no doubt about him
   *  (#381); absent on rows from before it. */
  chanceOfPlaying: v.optional(v.union(v.number(), v.null())),
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

// Each match's score and clock (#49, #50), written by both feeds, so kept apart from `fixtures`,
// FPL's record rewritten whole: football/matchScores.ts.

/** Where a match stands. The Premier League's half-time is its own; FPL's feed has none. */
export const matchState = v.union(v.literal("upcoming"), v.literal("live"), v.literal("halfTime"), v.literal("fullTime"));

/** The feed a score was read from. */
export const scoreFeed = v.union(v.literal("fpl"), v.literal("pl"));

/** One match's score as one read gives it. */
export const scoreRead = v.object({
  fixtureCode: v.number(),
  state: matchState,
  /** Null before kickoff, when there is no score yet (the Premier League sends 0–0 then). */
  homeGoals: v.union(v.number(), v.null()),
  awayGoals: v.union(v.number(), v.null()),
  /** The minute on the match clock, null before kickoff: FPL's `minutes`, or the whole minutes of
   *  the Premier League's clock, which restarts at 45 for the second half and runs on in stoppage. */
  minutes: v.union(v.number(), v.null()),
  /** The Premier League's own clock label, e.g. "45+3'00"; null from FPL, which sends none. */
  clockLabel: v.union(v.string(), v.null()),
});

/** A match whose score a read could not give, and why: kept on the run row, never written. */
export const scoreProblem = v.object({ fixtureCode: v.number(), problem: v.string() });

/** One run's share of the scores: the matches read, how many rows changed, and the problems. */
export const scoreWrites = v.object({ received: v.number(), written: v.number(), problems: v.array(scoreProblem) });

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

/** Who started a sync: someone by hand, or its cron. */
export const syncTrigger = v.union(v.literal("manual"), v.literal("cron"));

// One row per run of footballSync.run, so a failed fetch is on record, never silent.
export const footballSyncFields = {
  trigger: syncTrigger,
  ranAt: v.number(),
  outcome: v.union(
    v.object({
      ok: v.literal(true),
      clubs: tableWrites,
      players: tableWrites,
      fixtures: tableWrites,
      gameweeks: tableWrites,
      /** Absent on runs before #49's scores. */
      scores: v.optional(scoreWrites),
    }),
    v.object({ ok: v.literal(false), error: v.string() }),
  ),
};

const footballTables = {
  clubs: defineTable(clubRecord.extend({ droppedAt })).index("by_code", ["code"]).index("by_droppedAt", ["droppedAt"]),
  players: defineTable(playerRecord.extend({ droppedAt }))
    .index("by_code", ["code"])
    .index("by_clubCode_and_droppedAt", ["clubCode", "droppedAt"])
    .searchIndex("search_fullName", { searchField: "fullName", filterFields: ["droppedAt"] }),
  fixtures: defineTable(fixtureRecord.extend({ droppedAt }))
    .index("by_code", ["code"])
    .index("by_kickoff", ["kickoff"])
    .index("by_droppedAt_and_kickoff", ["droppedAt", "kickoff"])
    // A gameweek's matches, for the Premier League's fixtures and results (#49).
    .index("by_gameweek_and_droppedAt", ["gameweek", "droppedAt"]),
  gameweeks: defineTable(gameweekRecord.extend({ droppedAt })).index("by_number", ["number"]),
  footballSyncs: defineTable(footballSyncFields),
  /** Each match's newest score, which feed gave it and when that read was made. */
  matchScores: defineTable(scoreRead.extend({ feed: scoreFeed, readAt: v.number() })).index("by_fixtureCode", ["fixtureCode"]),
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

const signInTables = {
  allowedEmails: defineTable(allowedEmailFields).index("by_email", ["email"]),
  signInAsks: defineTable(signInAskFields).index("by_email_and_askedAt", ["email", "askedAt"]),
  emailSends: defineTable(emailSendFields).index("by_day", ["day"]),
};

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
  trigger: syncTrigger,
  ranAt: v.number(),
  outcome: v.union(
    v.object({
      ok: v.literal(true),
      matches: v.array(matchSyncOutcome),
      /** Matches due whose Premier League status is not yet full time. */
      waiting: v.array(v.number()),
      /** The due matches' scores; absent on runs before #49's scores, and on a run with none due. */
      scores: v.optional(scoreWrites),
    }),
    v.object({ ok: v.literal(false), error: v.string() }),
  ),
};

const matchStatsTables = {
  playerMatchStats: defineTable(playerMatchRecord.extend({ state: matchStatsState }))
    .index("by_fixtureCode_and_playerCode", ["fixtureCode", "playerCode"])
    // A player's matches, for his card (#381), whichever clubs he played them for.
    .index("by_playerCode", ["playerCode"]),
  matchStatsStatus: defineTable(matchStatsStatusFields)
    .index("by_fixtureCode", ["fixtureCode"])
    // The feeds page's matches still provisional past their window (spec/15).
    .index("by_state_and_fullTimeAt", ["state", "fullTimeAt"]),
  lateStatCorrections: defineTable({
    fixtureCode: v.number(),
    playerCode: v.number(),
    seenAt: v.number(),
    changes: v.array(lateStatChange),
  }).index("by_fixtureCode_and_playerCode", ["fixtureCode", "playerCode"]),
  platformSettings: defineTable({ name: platformSettingName, value: v.number() }).index("by_name", ["name"]),
  matchStatsSyncs: defineTable(matchStatsSyncFields),
  /** Each player's records added up for a season (#373, seasonStats.ts), so Scouting sorts every
   *  player by any stat without reading a season of records: one row a player and season, kept
   *  in step as each record is written. `season` is the year it starts (football.ts's
   *  `seasonStartYear` of the match's kickoff). */
  playerSeasonStats: defineTable({ season: v.number(), playerCode: v.number(), stats: v.record(v.string(), v.number()) }).index(
    "by_season_and_playerCode",
    ["season", "playerCode"],
  ),
  /** When a run last tried each match, read or not: one that never reads steps behind the rest. */
  matchStatsTries: defineTable({ fixtureCode: v.number(), triedAt: v.number() }).index("by_fixtureCode", ["fixtureCode"]),
};

// Positions (#22). Kept apart from `players`, which the football sync rewrites every six hours, so
// no feed read touches the admin's say. Each row is keyed on FPL's season-stable `code`.

// `v.union` takes two or more members, which a mapped array cannot promise its type.
const positionLiterals = POSITIONS.map((position) => v.literal(position));
export const position = v.union(...(positionLiterals as [VLiteral<Position>, VLiteral<Position>, ...VLiteral<Position>[]]));

/** One match a player started, where he lined up: `Start` in positions.ts. */
export const startRecord = v.object({
  fixtureCode: v.number(),
  kickoff: v.number(),
  formation: v.union(v.string(), v.null()),
  line: v.union(v.number(), v.null()),
  place: v.union(v.number(), v.null()),
});

export const playerPositionFields = {
  code: v.number(),
  /** The Premier League's `positionInfo` for him, his squad's or else his newest sheet's; absent
   *  until one names him. */
  plLabel: v.optional(v.string()),
  /** His newest starts, at most `START_WINDOW`, newest first. */
  starts: v.array(startRecord),
  // The admin's say (`AdminPositions` in positions.ts): only his actions write these.
  approved: v.array(position),
  confirmedLabel: v.optional(v.string()),
  set: v.array(position),
  removed: v.array(position),
};

export const approveMode = v.union(v.literal("proposals"), v.literal("countAtOnce"));

/** How many starts in a row elsewhere flag a position from starts, then remove it (spec/06):
 *  `ChangeThresholds` in positionChanges.ts. */
export const changeThresholds = v.object({ flagAfter: v.number(), removeAfter: v.number() });

/** How positions from starts count, and change: a single row, absent until the admin first sets
 *  one. A threshold is absent until he tunes it (`FIRST_THRESHOLDS` in positionChanges.ts). */
export const positionSettingsFields = { approveMode, ...changeThresholds.partial().fields };

// One row per run of positionsSync.run, so a failed read is on record, never silent.
export const positionsSyncFields = {
  trigger: syncTrigger,
  ranAt: v.number(),
  outcome: v.union(
    v.object({
      ok: v.literal(true),
      /** Matches whose sheets were read this run, and those played but left for the next. */
      matchesRead: v.number(),
      matchesLeft: v.number(),
      /** Matches whose sheets do not draw the men they start, each with why: not filed, so read
       *  again next run. */
      matchesRefused: v.array(v.string()),
      startsAdded: v.number(),
      /** Men a squad or a sheet names whom FPL does not list (gone abroad, say): not held. */
      unmatchedPlayers: v.number(),
      labelsReceived: v.number(),
      labelsChanged: v.number(),
      /** What the tables in positionTables.ts do not know: each needs a row before it counts. */
      unknownFormations: v.array(v.string()),
      unknownLabels: v.array(v.string()),
    }),
    v.object({ ok: v.literal(false), error: v.string() }),
  ),
};

const positionsTables = {
  playerPositions: defineTable(playerPositionFields).index("by_code", ["code"]),
  /** Each match whose sheets the positions sync has filed, so none is filed twice. */
  positionSheets: defineTable({ fixtureCode: v.number() }).index("by_fixtureCode", ["fixtureCode"]),
  positionSettings: defineTable(positionSettingsFields),
  positionsSyncs: defineTable(positionsSyncFields),
};

// The live poller (#28): one row per tick that found a match live, so a failed one is on record.
export const liveStatsTickFields = {
  ranAt: v.number(),
  outcome: v.union(
    v.object({
      ok: v.literal(true),
      matches: v.array(matchSyncOutcome),
      /** The live matches' scores; absent on ticks before #49's scores. */
      scores: v.optional(scoreWrites),
    }),
    v.object({ ok: v.literal(false), error: v.string() }),
  ),
};

const liveStatsTables = {
  liveStatsTicks: defineTable(liveStatsTickFields),
};

// When the admin was last emailed that each feed failed (#319, spec/15): one row a feed, so he
// hears at most once a day for each (admin/feedFailureEmails.ts). `emailedAt` is the start of the
// failed run it emailed for, as the next failure is measured from its run's start.
const feedFailureEmailTables = {
  feedFailureEmails: defineTable({ feed: feedValidator, emailedAt: v.number() }).index("by_feed", ["feed"]),
};

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

/** Who held a role before, or null when nobody did. */
const replaced = v.union(v.string(), v.null());
/** A manager and their team, its name as it was then. */
const managerOfTeam = { email: v.string(), teamId: v.id("teams"), teamName: v.string() };

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

const joiningTables = {
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

// Squads (#31, spec/15 Assigning players): which team in a league owns each player, by FPL's
// season-stable code. A player is on one team in a league at most; any other is a free agent.

/** A player as a squad letter names him, and the team concerned. */
const playerOnTeam = { playerCode: v.number(), playerName: v.string(), teamId: v.id("teams"), teamName: v.string() };

/** What assigning players files for Mail. */
const squadEvents = [
  v.object({ kind: v.literal("playerAssigned"), ...playerOnTeam }),
  v.object({ kind: v.literal("playerMoved"), ...playerOnTeam, fromTeamId: v.id("teams"), fromTeamName: v.string() }),
  v.object({ kind: v.literal("playerReleased"), ...playerOnTeam }),
] as const;

const squadTables = {
  squadPlayers: defineTable({ leagueId: v.id("leagues"), teamId: v.id("teams"), playerCode: v.number() })
    .index("by_leagueId_and_playerCode", ["leagueId", "playerCode"])
    .index("by_teamId", ["teamId"]),
};

// The shortlist (#374, spec/19 The shortlist): each team's own list of players for the season, by
// FPL's season-stable code. Private to the team: only its manager reads or changes it.
const shortlistTables = {
  shortlistPlayers: defineTable({ leagueId: v.id("leagues"), teamId: v.id("teams"), playerCode: v.number() })
    .index("by_teamId_and_playerCode", ["teamId", "playerCode"])
    .index("by_leagueId_and_playerCode", ["leagueId", "playerCode"]),
};

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
);

const leagueEventFields = {
  leagueId: v.id("leagues"),
  at: v.number(),
  /** Who did it, by email. */
  by: v.string(),
  event: leagueEvent,
};

const leagueTables = {
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

// Mail (#26, spec/16). A letter is filed as one row for each person it's to, so who got it is
// fixed when it's filed: someone who joins later doesn't get the league's old letters.

const letterFields = {
  /** Whom this copy is to, by email. */
  to: v.string(),
  /** The league it is from; absent on a letter from the site to everyone, such as a patch to its
   *  scoring (#356), which no league's deletion takes with it. */
  leagueId: v.optional(v.id("leagues")),
  /** The league's name when it was filed; absent with `leagueId`. */
  leagueName: v.optional(v.string()),
  at: v.number(),
  /** Who wrote it, by email: absent on a letter the app files about something that happened. */
  from: v.optional(v.string()),
  subject: v.string(),
  body: v.string(),
  /** When `to` opened it; absent while unread. */
  readAt: v.optional(v.number()),
};

const mailTables = {
  letters: defineTable(letterFields)
    .index("by_to_and_at", ["to", "at"])
    .index("by_to_and_readAt", ["to", "readAt"])
    .index("by_leagueId", ["leagueId"]),
};

// Feedback to the admin (#357, spec/15): one row a message, kept for him to read on his dashboard.
const feedbackTables = {
  feedback: defineTable({
    /** Who sent it, by email. */
    from: v.string(),
    at: v.number(),
    message: v.string(),
  }).index("by_at", ["at"]),
};

/** How a version of the site's scoring was announced: a patch with a week's notice, or a fix at
 *  once (spec/14, Changes and corrections). */
export const siteScoringKind = v.union(v.literal("patch"), v.literal("fix"));

// A league's rules (#25, spec/03). Each change is a new row from the gameweek it takes effect, so
// past gameweeks keep the rules they were played under; who changed them is in leagueEvents.
const leagueRulesTables = {
  leagueRules: defineTable({ leagueId: v.id("leagues"), fromGameweek: v.number(), rules: storedLeagueRulesShape }).index(
    "by_leagueId_and_fromGameweek",
    ["leagueId", "fromGameweek"],
  ),
  /** One row: the rules the admin gives each new league. */
  defaultLeagueRules: defineTable({ rules: storedLeagueRulesShape }),
  /** The site's scoring set, which every league plays on and only the admin changes (spec/14, Who
   *  owns it, and Changes and corrections; #354, #355): one row per version, announced as a patch or
   *  a fix, from the moment it takes effect, so past gameweeks keep the set they were played under.
   *  With none, the first set (scoring/firstScoring.ts). */
  siteScoring: defineTable({
    scoring: scoringSetShape,
    kind: siteScoringKind,
    /** The year its season starts, 2026 for 2026/27 (football.ts's `seasonStartYear` of
     *  `takesEffectAt`); with `number`, its name: 26_27.1. */
    season: v.number(),
    /** 1 for the season's first version, each one after it the next. */
    number: v.number(),
    announcedAt: v.number(),
    takesEffectAt: v.number(),
  }).index("by_takesEffectAt", ["takesEffectAt"]),
  /** One row at most: the admin's patch saved as a draft, which changes nothing until announced,
   *  and the version it was made from (null for the first set). */
  siteScoringDraft: defineTable({ scoring: scoringSetShape, madeFrom: v.union(v.null(), v.id("siteScoring")), savedAt: v.number() }),
  /** Who dismissed a waiting patch's banner (spec/14, Changes and corrections; #356): one row a
   *  person and version, so it stays dismissed on every device. */
  patchBannerDismissals: defineTable({ email: v.string(), versionId: v.id("siteScoring") }).index("by_email_and_versionId", [
    "email",
    "versionId",
  ]),
  /** One row: the squad maximum a new league takes by its size, which Craig edits (#316). */
  squadMaximums: defineTable({ bands: v.array(squadMaximumBandShape) }),
  /** A league's deadline for a gameweek once it has passed (#150): where it fell stays put, even if
   *  the first match is then postponed (spec/05). One row a league and gameweek, written at or
   *  after the deadline by deadlineRecorder.ts. */
  passedDeadlines: defineTable({
    leagueId: v.id("leagues"),
    gameweek: v.number(),
    deadline: v.number(),
    recordedAt: v.number(),
  }).index("by_leagueId_and_gameweek", ["leagueId", "gameweek"]),
  /** A gameweek's first kickoff once it has passed (#414): where it fell stays put, even if that
   *  match then leaves the gameweek, so the site's scoring version for it can't change. One row a
   *  season and gameweek, site-wide, written by gameweeks/gameweekStarts.ts. */
  gameweekStarts: defineTable({
    /** The year the season starts, as football.ts's `seasonStartYear`. */
    season: v.number(),
    gameweek: v.number(),
    firstKickoff: v.number(),
    recordedAt: v.number(),
  }).index("by_season_and_gameweek", ["season", "gameweek"]),
};

// A league's head-to-head fixtures in each gameweek it has begun, stored once the gameweek begins
// and read from here ever after (#137); none in one begun with no head-to-head, such as before the
// league was made (#282). One row a league and gameweek, written only by
// convex/table/playedFixtures.ts, which says why.
const playedFixtureTables = {
  playedFixtures: defineTable({
    leagueId: v.id("leagues"),
    gameweek: v.number(),
    fixtures: v.array(v.object({ team: v.id("teams"), opponent: v.union(v.id("teams"), v.literal(LEAGUE_AVERAGE)) })),
    /** The teams left over with a bye, in a league whose odd team out has one. */
    byes: v.array(v.id("teams")),
    storedAt: v.number(),
  }).index("by_leagueId_and_gameweek", ["leagueId", "gameweek"]),
  /** Each team's points in a gameweek once they are final: every match in it locked, so no
   *  correction can change them (spec/07). One row a league, gameweek and team, written only by
   *  convex/table/finalScores.ts, which says when (#418). */
  finalScores: defineTable({
    leagueId: v.id("leagues"),
    gameweek: v.number(),
    teamId: v.id("teams"),
    points: v.number(),
    /** It had never saved a lineup, so it scored 0 (gameweekScores.ts's TeamGameweek). */
    noLineup: v.boolean(),
    storedAt: v.number(),
  }).index("by_leagueId_and_gameweek", ["leagueId", "gameweek"]),
};

// Each team's lineup (#8, spec/05): one row for each gameweek it was saved from, which
// lineup/lineups.ts writes and reads.

/** A starter and the cell he stands in: lineup.ts's Placement, its cell checked. */
export const placementShape = cellShape.extend({ playerCode: v.number() });

const lineupTables = {
  lineups: defineTable({
    leagueId: v.id("leagues"),
    teamId: v.id("teams"),
    fromGameweek: v.number(),
    starters: v.array(placementShape),
    /** Player codes, in the order auto-subs use. */
    bench: v.array(v.number()),
  }).index("by_leagueId_and_teamId_and_fromGameweek", ["leagueId", "teamId", "fromGameweek"]),
};

export default defineSchema({
  ...authTables,
  ...signInTables,
  ...feedCheckTables,
  ...footballTables,
  ...positionsTables,
  ...squadTables,
  ...shortlistTables,
  ...matchStatsTables,
  ...liveStatsTables,
  ...feedFailureEmailTables,
  ...leagueTables,
  ...joiningTables,
  ...mailTables,
  ...feedbackTables,
  ...leagueRulesTables,
  ...playedFixtureTables,
  ...lineupTables,
});
