import { defineTable } from "convex/server";
import { v } from "convex/values";
import { cellShape, scoringSetShape, storedLeagueRulesShape } from "../rules/leagueRulesShape";
import { squadMaximumBandShape } from "../rules/squadMaximums";
import { LEAGUE_AVERAGE } from "../table/roundRobin";

/** How a version of the site's scoring was announced: a patch with a week's notice, or a fix at
 *  once (spec/14, Changes and corrections). */
export const siteScoringKind = v.union(v.literal("patch"), v.literal("fix"));

// A league's rules (#25, spec/03). Each change is a new row from the gameweek it takes effect, so
// past gameweeks keep the rules they were played under; who changed them is in leagueEvents.
export const leagueRulesTables = {
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
    /** The year its season starts, 2026 for 2026/27 (shared/time.ts's `seasonStartYear` of
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
    /** The year the season starts, as shared/time.ts's `seasonStartYear`. */
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
export const playedFixtureTables = {
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
    /** True on a row stored before #637 for a team that had never saved a lineup, so scored 0.
     *  Every team has had one since, so it is no longer written; such a row is read as it was. */
    noLineup: v.optional(v.boolean()),
    /** The gameweek's matches it was scored from: a match moved in or out since reopens it. */
    fixtureCodes: v.array(v.number()),
    storedAt: v.number(),
  }).index("by_leagueId_and_gameweek", ["leagueId", "gameweek"]),
  /** A commissioner's override of one player's points in one locked match (#32, spec/14): his
   *  points there in place of what his record scores. One row a league, match and player, a
   *  second override replacing the first; written only by convex/table/pointsOverrides.ts. */
  pointsOverrides: defineTable({
    leagueId: v.id("leagues"),
    gameweek: v.number(),
    fixtureCode: v.number(),
    playerCode: v.number(),
    points: v.number(),
    reason: v.string(),
    /** Who set it, by email, and when. */
    by: v.string(),
    at: v.number(),
  })
    .index("by_leagueId_and_fixtureCode_and_playerCode", ["leagueId", "fixtureCode", "playerCode"])
    .index("by_leagueId_and_playerCode", ["leagueId", "playerCode"]),
};

// Each team's lineup (#8, spec/05): one row for each gameweek it was saved from, which
// lineup/lineups.ts writes and reads.

/** A starter and the cell he stands in: lineup.ts's Placement, its cell checked. */
export const placementShape = cellShape.extend({
  playerCode: v.number(),
  /** The role he plays (lineup/roles.ts), absent until given: the slot's first (#10). */
  role: v.optional(v.string()),
});

export const lineupTables = {
  lineups: defineTable({
    leagueId: v.id("leagues"),
    teamId: v.id("teams"),
    fromGameweek: v.number(),
    starters: v.array(placementShape),
    /** Player codes, in the order auto-subs use. */
    bench: v.array(v.number()),
    /** True while it is the team's first lineup, picked from its squad and picked again as the
     *  squad changes (lineups.ts); absent once its manager has saved one. */
    firstLineup: v.optional(v.literal(true)),
  }).index("by_leagueId_and_teamId_and_fromGameweek", ["leagueId", "teamId", "fromGameweek"]),
};
