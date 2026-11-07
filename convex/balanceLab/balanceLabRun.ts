import { v } from "convex/values";
import { internal } from "../_generated/api";
import { action, internalAction, internalMutation, internalQuery, type ActionCtx } from "../_generated/server";
import { siteScoringRefusals } from "../scoring/siteScoring";
import { scoringSetShape, type StoredScoringSet } from "../scoring/scoringSetShape";
import { adminOf, refuse } from "../shared/leagueAccess";
import { zoneOf } from "../signIn/timeZone";
import { balanceLab, type PastStart } from "./balanceLab";
import { labReportShape, type LabReport } from "./labReportShape";

// Running the rule balance lab (spec/14, The rule balance lab; #843): the admin presses a button on
// the draft patch and gets its report back, saved nowhere; and, when a patch is announced, it runs
// once more by itself on exactly that set, its report kept with the version for the patch notes
// (Craig, 6 Nov 2026: "5 a"). The past seasons hold tens of thousands of rows, more than one query
// reads, so an action reads their starts a page at a time and works the report out itself.

/** The past seasons' rows one page reads: about 400 bytes each, so well inside a query's reads. */
export const PAST_ROWS_PAGE = 2000;

const pastStart = v.object({ season: v.number(), startingPosition: v.string(), stats: v.record(v.string(), v.number()) });

/** One page of the past seasons' rows from `cursor` (null for the first): the real starts on it,
 *  a match he came on in (no starting position) left out, and where the next page starts. */
export const startsPage = internalQuery({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.object({ starts: v.array(pastStart), cursor: v.string(), isDone: v.boolean() }),
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db.query("pastPlayerMatchStats").paginate({ numItems: PAST_ROWS_PAGE, cursor });
    const starts = page.page.flatMap(({ season, match }) =>
      match === null || match.startingPosition === null ? [] : [{ season, startingPosition: match.startingPosition, stats: match.stats }],
    );
    return { starts, cursor: page.continueCursor, isDone: page.isDone };
  },
});

/** The lab's report on `set` over every past season copied. */
async function labOn(ctx: ActionCtx, set: StoredScoringSet): Promise<LabReport> {
  const starts: PastStart[] = [];
  let cursor: string | null = null;
  for (;;) {
    const page: { starts: PastStart[]; cursor: string; isDone: boolean } = await ctx.runQuery(internal.balanceLab.balanceLabRun.startsPage, { cursor });
    starts.push(...page.starts);
    if (page.isDone) break;
    cursor = page.cursor;
  }
  return balanceLab(set, starts);
}

/** The admin's draft patch saved at `draftSavedAt`. Refused, with the reason, for anyone but the
 *  admin, with no draft, or one saved over since. */
export const draftToRun = internalQuery({
  args: { draftSavedAt: v.number() },
  returns: scoringSetShape,
  handler: async (ctx, { draftSavedAt }) => {
    const admin = await adminOf(ctx);
    const draft = await ctx.db.query("siteScoringDraft").unique();
    if (draft === null) refuse(siteScoringRefusals.noDraft);
    if (draft.savedAt !== draftSavedAt) refuse(siteScoringRefusals.draftChangedSince(draft.savedAt, await zoneOf(ctx, admin)));
    return draft.scoring;
  },
});

/** The admin runs the lab on the draft patch saved at `draftSavedAt`: its report, saved nowhere. */
export const run = action({
  args: { draftSavedAt: v.number() },
  returns: labReportShape,
  handler: async (ctx, { draftSavedAt }): Promise<LabReport> => {
    const set: StoredScoringSet = await ctx.runQuery(internal.balanceLab.balanceLabRun.draftToRun, { draftSavedAt });
    return labOn(ctx, set);
  },
});

/** The set of the version `versionId` names, or null once it is withdrawn. */
export const versionSet = internalQuery({
  args: { versionId: v.id("siteScoring") },
  returns: v.union(scoringSetShape, v.null()),
  handler: async (ctx, { versionId }) => (await ctx.db.get("siteScoring", versionId))?.scoring ?? null,
});

/** Keeps the report with the version, unless it was withdrawn while the lab ran. */
export const keepReport = internalMutation({
  args: { versionId: v.id("siteScoring"), report: labReportShape },
  returns: v.null(),
  handler: async (ctx, { versionId, report }) => {
    if ((await ctx.db.get("siteScoring", versionId)) !== null) await ctx.db.patch("siteScoring", versionId, { lab: report });
    return null;
  },
});

/** Runs the lab on the patch `versionId` names, just announced, and keeps its report with it for
 *  the patch notes. A patch withdrawn first is left alone. */
export const recordAnnounced = internalAction({
  args: { versionId: v.id("siteScoring") },
  returns: v.null(),
  handler: async (ctx, { versionId }) => {
    const set: StoredScoringSet | null = await ctx.runQuery(internal.balanceLab.balanceLabRun.versionSet, { versionId });
    if (set === null) return null;
    const report = await labOn(ctx, set);
    await ctx.runMutation(internal.balanceLab.balanceLabRun.keepReport, { versionId, report });
    return null;
  },
});
