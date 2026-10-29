import { defineTable } from "convex/server";
import { v } from "convex/values";
import { scoringSetShape } from "../rules/leagueRulesShape";

/** How a version of the site's scoring was announced: a patch with a week's notice, or a fix at
 *  once (spec/14, Changes and corrections). */
export const siteScoringKind = v.union(v.literal("patch"), v.literal("fix"));

export const siteScoringTables = {
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
};
