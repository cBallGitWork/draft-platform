import { defineTable } from "convex/server";
import { v } from "convex/values";
import { failureEmailKindValidator } from "../shared/feedSchedule";
import { failure } from "./football";

/** What one read of a feed found: a count of what came back, or why it failed. */
export const feedOutcome = v.union(
  v.object({ ok: v.literal(true), count: v.number() }),
  failure,
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

export const feedCheckTables = {
  feedChecks: defineTable(feedCheckFields),
};

// When the admin was last emailed that each feed failed (#319, spec/15), or that the football feed
// skipped a league (#980): one row a kind, so he
// hears at most once a day for each (admin/feedFailureEmails.ts). `emailedAt` is the start of the
// failed run it emailed for, as the next failure is measured from its run's start. A Sportmonks
// feed has one row a competition, by its league id (#1414), so one failing never quiets another's.
export const feedFailureEmailTables = {
  feedFailureEmails: defineTable({ feed: failureEmailKindValidator, competition: v.optional(v.number()), emailedAt: v.number() }).index(
    "by_feed_and_competition",
    ["feed", "competition"],
  ),
};
