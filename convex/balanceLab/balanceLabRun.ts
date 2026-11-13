import { v } from "convex/values";
import { internal } from "../_generated/api";
import { action, internalAction, internalMutation, internalQuery, type ActionCtx } from "../_generated/server";
import { siteScoringRefusals } from "../scoring/siteScoring";
import { scoringSetShape, type StoredScoringSet } from "../scoring/scoringSetShape";
import { adminOf, refuse } from "../shared/leagueAccess";
import { zoneOf } from "../signIn/timeZone";
import { balanceLab, startersWithNoPosition, type PastStart } from "./balanceLab";
import { labReportShape, type LabReport } from "./labReportShape";

// Running the rule balance lab (spec/14, The rule balance lab; #843): the admin presses a button on
// the draft patch and gets its report back, saved nowhere; and, when a patch is announced, it runs
// once more by itself on exactly that set, its report kept with the version for the patch notes
// (Craig, 6 Nov 2026: "5 a"). The past seasons hold tens of thousands of rows, more than one query
// reads, so an action reads their starts a page at a time and works the report out itself.

/** The past seasons' rows one page reads: at most about 910 bytes each with the roles' stats (#10),
 *  so about 1.8 MB, well inside a query's reads. */
const PAST_ROWS_PAGE = 2000;

const pastStart = v.object({
  season: v.number(),
  player: v.union(v.number(), v.string()),
  kickoff: v.number(),
  club: v.optional(v.string()),
  startingPosition: v.string(),
  stats: v.record(v.string(), v.number()),
});

/** One page of the past seasons' rows from `cursor` (null for the first): the real starts on it,
 *  each with its match and club, so the lab forms each club's XI; a match he came on in (no
 *  starting position) left out; and where the next page starts. */
export const startsPage = internalQuery({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.object({ starts: v.array(pastStart), cursor: v.string(), isDone: v.boolean() }),
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db.query("pastPlayerMatchStats").paginate({ numItems: PAST_ROWS_PAGE, cursor });
    const starts = page.page.flatMap((row) => {
      const { season, match } = row;
      if (match === null || match.startingPosition === null) return [];
      const player = "person" in row ? row.person : row.playerCode;
      const club = match.club === undefined ? {} : { club: match.club };
      return [{ season, player, kickoff: match.kickoff, ...club, startingPosition: match.startingPosition, stats: match.stats }];
    });
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
  const { count, first } = startersWithNoPosition(starts);
  const names: string[] = await ctx.runQuery(internal.balanceLab.balanceLabRun.pastNames, { players: first.map(({ player }) => player) });
  const named = first.map(({ club, kickoff }, at) => ({ name: names[at]!, ...(club === undefined ? {} : { club }), kickoff }));
  return { ...balanceLab(set, starts), noPosition: { count, first: named } };
}

/** A past player today's players table no longer holds, by his FPL code. */
const pastCodeWords = (code: number) => `FPL code ${code}`;
/** A past player with no FPL code, by ai-carling's person id. */
const pastPersonWords = (person: string) => `Person ${person}`;

/** Each past player's name, in order: an FPL code's from the players table, falling back on the
 *  code where today's list no longer holds him; a person id (a man with no FPL code, S14.24) is
 *  the only name the copy keeps for him. */
export const pastNames = internalQuery({
  args: { players: v.array(v.union(v.number(), v.string())) },
  returns: v.array(v.string()),
  handler: async (ctx, { players }) =>
    Promise.all(
      players.map(async (player) => {
        if (typeof player === "string") return pastPersonWords(player);
        const known = await ctx.db
          .query("players")
          .withIndex("by_code", (q) => q.eq("code", player))
          .first();
        return known?.fullName ?? pastCodeWords(player);
      }),
    ),
});

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
 *  the patch notes. A patch withdrawn first is left alone. A run that fails says so in the logs,
 *  naming the patch whose notes will lack the report, and still fails. */
export const recordAnnounced = internalAction({
  args: { versionId: v.id("siteScoring") },
  returns: v.null(),
  handler: async (ctx, { versionId }) => {
    try {
      const set: StoredScoringSet | null = await ctx.runQuery(internal.balanceLab.balanceLabRun.versionSet, { versionId });
      if (set === null) return null;
      const report = await labOn(ctx, set);
      await ctx.runMutation(internal.balanceLab.balanceLabRun.keepReport, { versionId, report });
      return null;
    } catch (error) {
      console.error(`The rule balance lab didn't run on announced patch ${versionId}, so its patch notes have no lab report:`, error);
      throw error;
    }
  },
});
