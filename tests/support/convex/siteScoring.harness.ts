// The site's scoring tests' shared setup (#354, #355): a deployment on a fixed day of 2026/27,
// the admin's changes to the site's set as the rules editor makes them, and two sets to change to.

import { beforeEach, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import type { MutationCtx } from "../../../convex/_generated/server";
import type { StoredScoringSet } from "../../../convex/scoring/scoringSetShape";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { PATCH_NOTICE_DAYS } from "../../../convex/scoring/siteScoring";
import { siteScoringInGameweek } from "../../../convex/scoring/siteVersions";
import { DAY_MS, WEEK_MS } from "../../../convex/shared/time";
import { KICKS_OFF_IN } from "./leagueRules.harness";
import { ADMIN, actingAs, type TestConvex } from "./leagues.harness";
import { fakeResend, signInDeployment } from "./signIn.harness";

type Rule = StoredScoringSet["rules"][number];

/** A Sunday in 2026/27, after gameweek 8 and before 9 in holdGameweeks' season. */
export const TODAY = Date.parse("2026-10-25T12:00:00Z");
export const NOTICE = PATCH_NOTICE_DAYS * DAY_MS;

/** The test's deployment, fresh for each test once `useSiteScoringDeployment` has run. */
export let t: TestConvex;

/** Gives each test of the file a fresh deployment, its clock at TODAY. */
export function useSiteScoringDeployment(): void {
  beforeEach(async () => {
    t = await signInDeployment();
    fakeResend();
    vi.setSystemTime(TODAY);
  });
}

export const as = (email: string) => actingAs(t, email);
export const viewAs = async (email: string) => (await as(email)).query(api.scoring.siteScoring.view, { now: Date.now() });
/** The site's latest version, as a screen that loaded it now would carry it to a change. */
export const siteRevision = () => t.run(async (ctx) => (await ctx.db.query("siteScoring").withIndex("by_takesEffectAt").collect()).at(-1)?._id ?? null);
/** When the held draft was saved, as a screen that loaded it now would carry it. */
export const draftSavedAt = () => t.run(async (ctx) => (await ctx.db.query("siteScoringDraft").unique())?.savedAt ?? null);
export const fixAs = async (email: string, scoring: StoredScoringSet, revision?: Id<"siteScoring"> | null) =>
  (await as(email)).mutation(api.scoring.siteScoring.fix, { scoring, revision: revision === undefined ? await siteRevision() : revision });
export const saveDraftAs = async (email: string, scoring: StoredScoringSet, savedAt?: number | null) =>
  (await as(email)).mutation(api.scoring.siteScoring.saveDraft, {
    scoring,
    revision: await siteRevision(),
    draftSavedAt: savedAt === undefined ? await draftSavedAt() : savedAt,
  });
export const announceAs = async (email: string, takesEffectAt: number, savedAt?: number) =>
  (await as(email)).mutation(api.scoring.siteScoring.announce, { draftSavedAt: savedAt ?? (await draftSavedAt())!, takesEffectAt });
/** The admin drafts `scoring` and announces it to take effect at `takesEffectAt`. */
export const patch = async (scoring: StoredScoringSet, takesEffectAt: number) => {
  await saveDraftAs(ADMIN, scoring);
  return announceAs(ADMIN, takesEffectAt);
};
export const inGameweek = (gameweek: number) => t.run((ctx) => siteScoringInGameweek(ctx, gameweek));
export const versions = () => t.run(async (ctx) => (await ctx.db.query("siteScoring").collect()).length);
export const names = async () => (await viewAs(ADMIN)).versions.map((version) => version.name);

/** The first scoring set with assists paying 4 and one more category, tackles at 1. */
export const EDITED: StoredScoringSet = {
  ...structuredClone(FIRST_SCORING),
  rules: [
    ...FIRST_SCORING.rules.map((rule): Rule => (rule.stat === "assists" ? { shape: "perAction", stat: "assists", values: { all: 4 } } : structuredClone(rule))),
    { shape: "perAction", stat: "tackles", values: { all: 1 } },
  ],
};
/** EDITED with tackles at 2. */
export const EDITED_AGAIN: StoredScoringSet = {
  ...structuredClone(EDITED),
  rules: EDITED.rules.map((rule): Rule => (rule.stat === "tackles" ? { shape: "perAction", stat: "tackles", values: { all: 2 } } : rule)),
};

/** When holdGameweeks' gameweek kicks off, held from TODAY: 9 KICKS_OFF_IN later, each a week apart. */
export const kickoffOf = (gameweek: number) => TODAY + KICKS_OFF_IN + (gameweek - 9) * WEEK_MS;

/** Writes a version of the site's scoring straight in, announced and in force from `at`, and
 *  returns its id. `scoring` is held as given: a caller that changes it later passes a copy. */
export const holdSiteScoring = (
  ctx: MutationCtx,
  { scoring, kind, season, number, at }: Pick<Doc<"siteScoring">, "scoring" | "kind" | "season" | "number"> & { at: number },
) => ctx.db.insert("siteScoring", { scoring, kind, season, number, announcedAt: at, takesEffectAt: at });
