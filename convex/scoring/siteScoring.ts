import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import type { DeadlineRule } from "../gameweeks/deadline";
import { firstKickoffs, gameweekStartsOf } from "../gameweeks/gameweekStarts";
import { nextGameweek } from "../gameweeks/nextGameweek";
import { heldSchedule } from "../gameweeks/leagueDeadlines";
import { siteScoringKind } from "../schema";
import { scoringSetShape, type StoredScoringSet } from "../rules/leagueRulesShape";
import { takeAllOrThrow } from "../shared/cappedRead";
import { adminOf, callerEmail, isAdmin, refuse } from "../shared/leagueAccess";
import { momentIn } from "../shared/moments";
import { zoneOf } from "../signIn/timeZone";
import { sortedJson } from "../shared/sortedJson";
import { DAY_MS, seasonStartYear } from "../shared/time";
import { fileSiteLetter } from "../mail/letters";
import { versionLetter } from "../mail/letterWords";
import { FIRST_SCORING } from "./firstScoring";
import { scoringChanges } from "./patchChanges";
import { checkOwnStatsAgainstCatalogue } from "./ownStats";
import { UnsoundScoring, validateScoringSet } from "./scoringSet";

// The site's scoring set (spec/14, Who owns it, and Changes and corrections; #354, #355): one set
// every league plays on, which every signed-in person reads on Player scoring and only the admin
// changes, in the rules editor (#30). It changes by version, each named for its season and number
// (26_27.1) and taking effect from a moment:
// - a patch: saved as a draft, which changes nothing, then announced with the moment it takes
//   effect from, at least PATCH_NOTICE_DAYS after;
// - a fix: a mistake corrected at once, taking effect from the moment it is made.
// A gameweek plays the newest version to take effect at or before its first kickoff (once passed,
// the one recorded: gameweekStarts.ts, #414), so a version never reaches a gameweek already begun,
// nor a re-score of a played one; before any, the first set (firstScoring.ts). Scoring a league's
// match reads `siteScoringInGameweek`, never the league's rules. Versions take effect in the order
// they are announced, so a newer one never lands before an older one it was made from.

/** The most versions the site holds: a version each gameweek of five seasons is 190. One past it is
 *  refused, and a read of more throws, never a silent cut (#214). Claude's choice, not yet
 *  Craig's. */
export const SITE_SCORING_VERSIONS_MOST = 200;

/** The least notice a patch is announced with (spec/14: "week notice for updates"). */
export const PATCH_NOTICE_DAYS = 7;
const PATCH_NOTICE_MS = PATCH_NOTICE_DAYS * DAY_MS;

/** A version reaches a gameweek only if it took effect by the gameweek's first kickoff, whatever
 *  each league's deadline: so no match already begun is ever scored by it. */
const AT_FIRST_KICKOFF: DeadlineRule = { minutesBeforeFirstKickoff: 0 };

/** Why a change to the site's scoring is refused, in the words the admin is shown. */
export const siteScoringRefusals = {
  /** A save made in one tab after another's (spec/03: a second save never silently replaces the
   *  first). */
  changedSince: (at: number, zone: string | undefined) => `The site's scoring was saved on ${momentIn(at, zone)}, after you opened it, so yours wasn't saved.`,
  draftChangedSince: (at: number, zone: string | undefined) => `The draft patch was saved on ${momentIn(at, zone)}, after you opened it, so yours wasn't saved.`,
  noDraft: "There's no draft patch to announce: save one first.",
  draftOvertaken: (name: string) => `Version ${name} was announced after this draft was made, so it can't be announced: make it again from ${name}.`,
  draftUnchanged: "The draft patch changes nothing, so it wasn't announced.",
  notAMoment: "The moment the patch takes effect from isn't a date and time, so it wasn't announced.",
  tooSoon: (earliest: number, zone: string | undefined) =>
    `A patch takes effect at least ${PATCH_NOTICE_DAYS} days after it is announced: no sooner than ${momentIn(earliest, zone)}, so it wasn't announced.`,
  beforeWaiting: (name: string, at: number, zone: string | undefined) => `Version ${name} takes effect on ${momentIn(at, zone)}, so this one can't take effect before it.`,
  fixWhileWaiting: (name: string, at: number, zone: string | undefined) =>
    `Version ${name} is announced to take effect on ${momentIn(at, zone)} and was made without this fix, so the fix wasn't saved. Fix it once ${name} has taken effect.`,
  tooManyVersions: `The site's scoring has been changed ${SITE_SCORING_VERSIONS_MOST} times, the most it can hold, so this change wasn't saved.`,
  unsound: (reason: string) => `The scoring set can't be saved: ${reason}.`,
};

/** The version a screen loaded, carried with its change: the latest's id, or null while the site
 *  plays the first set. */
export const siteRevisionShape = v.union(v.null(), v.id("siteScoring"));

/** A version's name: its season's two years and its number, 26_27.1. */
export function versionName({ season, number }: Pick<Doc<"siteScoring">, "season" | "number">): string {
  const twoDigits = (year: number) => String(year % 100).padStart(2, "0");
  return `${twoDigits(season)}_${twoDigits(season + 1)}.${number}`;
}

/** Every version the site has, in the order they take effect, at most SITE_SCORING_VERSIONS_MOST. */
export function siteVersions(ctx: QueryCtx): Promise<Doc<"siteScoring">[]> {
  return takeAllOrThrow(
    ctx.db.query("siteScoring").withIndex("by_takesEffectAt"),
    SITE_SCORING_VERSIONS_MOST,
    `The site holds more than ${SITE_SCORING_VERSIONS_MOST} scoring versions, so the one in force can't be known`,
  );
}

/** A version's set, or the first set when there is no version yet. */
export function setOf(version: Doc<"siteScoring"> | undefined): StoredScoringSet {
  return version?.scoring ?? FIRST_SCORING;
}

/** The site's scoring set in a gameweek, which every league scores that gameweek's matches by: the
 *  newest version to take effect at or before its first kickoff, the first set before any. A
 *  gameweek with no kickoff time yet plays the newest. */
export async function siteScoringInGameweek(ctx: QueryCtx, gameweek: number): Promise<StoredScoringSet> {
  return (await siteScoringByGameweek(ctx))(gameweek);
}

/** `siteScoringInGameweek` for any gameweek, reading the versions and the schedule once: for a
 *  read that prices matches across many gameweeks, such as a player's card (#381). */
export async function siteScoringByGameweek(ctx: QueryCtx): Promise<(gameweek: number) => StoredScoringSet> {
  const history = await siteVersions(ctx);
  const { matches } = await heldSchedule(ctx);
  const recordedStarts = await gameweekStartsOf(ctx, matches);
  const kickoffs = firstKickoffs(matches);
  return (gameweek) => {
    const firstKickoff = recordedStarts.get(gameweek) ?? kickoffs.get(gameweek) ?? null;
    const inForce = firstKickoff === null ? history.at(-1) : history.findLast((row) => row.takesEffectAt <= firstKickoff);
    return setOf(inForce);
  };
}

/** The first gameweek a version taking effect at `at` reaches: the first whose first kickoff is at
 *  or after it, as `siteScoringInGameweek` reads it, after the last that kicked off before it (a
 *  postponed gameweek behind one is passed over, #413). Once every held gameweek has kicked off,
 *  the one after the last (`nextGameweek`). */
async function firstGameweekFrom(ctx: QueryCtx, at: number): Promise<number> {
  const { gameweeks, matches } = await heldSchedule(ctx);
  // nextGameweek counts a gameweek begun at its kickoff; a version taking effect then still reaches it.
  return nextGameweek(gameweeks, matches, () => AT_FIRST_KICKOFF, await gameweekStartsOf(ctx, matches), at - 1);
}

/** Refuses, with the reason, a set that would score wrong or an own stat named as a catalogue
 *  stat is. Anything else the checks throw is the bug it is, never a refusal. */
function checkScoringSet(scoring: StoredScoringSet): void {
  try {
    validateScoringSet(scoring);
    // On saving only: ownStats.ts's validateOwnStats says why.
    checkOwnStatsAgainstCatalogue(scoring.ownStats ?? []);
  } catch (error) {
    if (error instanceof UnsoundScoring) refuse(siteScoringRefusals.unsound(error.message));
    throw error;
  }
}

/** Refuses a change made from a version other than the latest, telling the time in `zone`, the admin's. */
function checkRevision(latest: Doc<"siteScoring"> | undefined, revision: Id<"siteScoring"> | null, zone: string | undefined): void {
  if ((latest?._id ?? null) !== revision) refuse(siteScoringRefusals.changedSince(latest?._creationTime ?? Date.now(), zone));
}

/** Adds a version taking effect at `takesEffectAt`, numbered next in its season, and files the
 *  letter telling every manager what it changes (spec/14: a patch is announced by a Mail letter, and
 *  a fix is announced as a fix, so it gets one too; #356). Returns its name and the first gameweek
 *  it reaches. */
async function addVersion(
  ctx: MutationCtx,
  history: readonly Doc<"siteScoring">[],
  version: Pick<Doc<"siteScoring">, "scoring" | "kind" | "takesEffectAt">,
  by: string,
): Promise<{ name: string; fromGameweek: number }> {
  if (history.length >= SITE_SCORING_VERSIONS_MOST) refuse(siteScoringRefusals.tooManyVersions);
  const season = seasonStartYear(version.takesEffectAt);
  const number = Math.max(0, ...history.filter((row) => row.season === season).map((row) => row.number)) + 1;
  await ctx.db.insert("siteScoring", { ...version, season, number, announcedAt: Date.now() });
  const name = versionName({ season, number });
  const fromGameweek = await firstGameweekFrom(ctx, version.takesEffectAt);
  const changes = scoringChanges(setOf(history.at(-1)), version.scoring);
  const news = { name, kind: version.kind, takesEffectAt: version.takesEffectAt, fromGameweek, changes };
  await fileSiteLetter(ctx, (zone) => versionLetter(news, zone), by);
  return { name, fromGameweek };
}

const versionSummary = v.object({ name: v.string(), kind: siteScoringKind, takesEffectAt: v.number() });
const draftShape = v.object({ part: scoringSetShape, savedAt: v.number() });

/** Player scoring's read: the site's latest set, a waiting patch's among them; the version it is
 *  (for a change to carry); the gameweek a fix made at `now` would first reach; whether the reader
 *  may change it, which only the admin may; every version, oldest first; and, for the admin alone,
 *  the draft patch. `now` is the screen's, moved on each minute, as a query must not read the clock
 *  (convex/admin/feeds.ts says why). */
export const view = query({
  args: { now: v.number() },
  returns: v.object({
    part: scoringSetShape,
    revision: siteRevisionShape,
    changesFrom: v.number(),
    canEdit: v.boolean(),
    versions: v.array(versionSummary),
    draft: v.union(v.null(), draftShape),
  }),
  handler: async (ctx, { now }) => {
    const canEdit = isAdmin(await callerEmail(ctx));
    const history = await siteVersions(ctx);
    const latest = history.at(-1);
    const draft = canEdit ? await ctx.db.query("siteScoringDraft").unique() : null;
    return {
      part: setOf(latest),
      revision: latest?._id ?? null,
      changesFrom: await firstGameweekFrom(ctx, now),
      canEdit,
      versions: history.map((row) => ({ name: versionName(row), kind: row.kind, takesEffectAt: row.takesEffectAt })),
      draft: draft && { part: draft.scoring, savedAt: draft.savedAt },
    };
  },
});

/** The admin's patch saved as a draft, made from the version `revision` names, over the draft saved
 *  at `draftSavedAt` (null when there was none): it changes nothing until announced. Returns when it
 *  was saved. Refused, with the reason, for anyone but the admin, if a version or another draft was
 *  saved since, or if unsound. */
export const saveDraft = mutation({
  args: { scoring: scoringSetShape, revision: siteRevisionShape, draftSavedAt: v.union(v.null(), v.number()) },
  returns: v.number(),
  handler: async (ctx, { scoring, revision, draftSavedAt }) => {
    const zone = await zoneOf(ctx, await adminOf(ctx));
    checkRevision((await siteVersions(ctx)).at(-1), revision, zone);
    const held = await ctx.db.query("siteScoringDraft").unique();
    if ((held?.savedAt ?? null) !== draftSavedAt) refuse(siteScoringRefusals.draftChangedSince(held?.savedAt ?? Date.now(), zone));
    checkScoringSet(scoring);
    const draft = { scoring, madeFrom: revision, savedAt: Date.now() };
    if (held) await ctx.db.replace("siteScoringDraft", held._id, draft);
    else await ctx.db.insert("siteScoringDraft", draft);
    return draft.savedAt;
  },
});

/** The admin announces the draft patch saved at `draftSavedAt`, to take effect at `takesEffectAt`:
 *  a new version for every league, named next in its season. Returns its name and the first
 *  gameweek it reaches. Refused, with the reason, for anyone but the admin; if the draft was saved
 *  over, a version was announced since it was made, or it changes nothing; if it would take effect
 *  less than PATCH_NOTICE_DAYS from now, or before a version already announced. */
export const announce = mutation({
  args: { draftSavedAt: v.number(), takesEffectAt: v.number() },
  returns: v.object({ name: v.string(), fromGameweek: v.number() }),
  handler: async (ctx, { draftSavedAt, takesEffectAt }) => {
    const admin = await adminOf(ctx);
    const zone = await zoneOf(ctx, admin);
    const draft = await ctx.db.query("siteScoringDraft").unique();
    if (draft === null) refuse(siteScoringRefusals.noDraft);
    if (draft.savedAt !== draftSavedAt) refuse(siteScoringRefusals.draftChangedSince(draft.savedAt, zone));
    const history = await siteVersions(ctx);
    const latest = history.at(-1);
    if (latest !== undefined && latest._id !== draft.madeFrom) refuse(siteScoringRefusals.draftOvertaken(versionName(latest)));
    if (sortedJson(setOf(latest)) === sortedJson(draft.scoring)) refuse(siteScoringRefusals.draftUnchanged);
    // NaN is never less than the earliest, so it would pass the check below.
    if (!Number.isFinite(takesEffectAt)) refuse(siteScoringRefusals.notAMoment);
    const earliest = Date.now() + PATCH_NOTICE_MS;
    if (takesEffectAt < earliest) refuse(siteScoringRefusals.tooSoon(earliest, zone));
    if (latest !== undefined && takesEffectAt < latest.takesEffectAt) refuse(siteScoringRefusals.beforeWaiting(versionName(latest), latest.takesEffectAt, zone));
    const added = await addVersion(ctx, history, { scoring: draft.scoring, kind: "patch", takesEffectAt }, admin);
    await ctx.db.delete("siteScoringDraft", draft._id);
    return added;
  },
});

/** The admin's fix to the site's set, made from the version `revision` names: a new version for
 *  every league, taking effect now, so it never reaches a gameweek already begun. The same set again
 *  changes nothing. Returns the first gameweek it reaches. Refused, with the reason, for anyone but
 *  the admin, if saved since `revision`, while a patch waits to take effect, or if unsound. */
export const fix = mutation({
  args: { scoring: scoringSetShape, revision: siteRevisionShape },
  returns: v.number(),
  handler: async (ctx, { scoring, revision }) => {
    const admin = await adminOf(ctx);
    const zone = await zoneOf(ctx, admin);
    const history = await siteVersions(ctx);
    const latest = history.at(-1);
    checkRevision(latest, revision, zone);
    checkScoringSet(scoring);
    const now = Date.now();
    if (sortedJson(setOf(latest)) === sortedJson(scoring)) return firstGameweekFrom(ctx, now);
    if (latest !== undefined && latest.takesEffectAt > now) refuse(siteScoringRefusals.fixWhileWaiting(versionName(latest), latest.takesEffectAt, zone));
    return (await addVersion(ctx, history, { scoring, kind: "fix", takesEffectAt: now }, admin)).fromGameweek;
  },
});
