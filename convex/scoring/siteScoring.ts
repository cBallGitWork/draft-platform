import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { mutation, query, type QueryCtx } from "../_generated/server";
import type { DeadlineRule } from "../gameweeks/deadline";
import { nextGameweek } from "../gameweeks/nextGameweek";
import { FIRST_GAMEWEEK } from "../gameweeks/usedGameweeks";
import { heldSchedule } from "../rules/leagueRules";
import { scoringSetShape, type StoredScoringSet } from "../rules/leagueRulesShape";
import { takeAllOrThrow } from "../shared/cappedRead";
import { adminOf, callerEmail, isAdmin, refuse } from "../shared/leagueAccess";
import { londonTime } from "../shared/londonTime";
import { sortedJson } from "../shared/sortedJson";
import { FIRST_SCORING } from "./firstScoring";
import { checkOwnStatsAgainstCatalogue } from "./ownStats";
import { validateScoringSet } from "./scoringSet";

// The site's scoring set (spec/14, Who owns it; #354): one set every league plays on, which every
// signed-in person reads on Player scoring and only the admin changes, in the rules editor (#30).
// Each save is a new version, a row from the gameweek it takes effect, so a gameweek already played
// keeps the version it was played under; before any save, every gameweek plays the first set
// (firstScoring.ts). Scoring a league's match reads `siteScoringInGameweek`, never the league's
// rules. Patches (#355) build on these versions: a draft, a week's notice, a name like 26_27.1.

/** The most versions the site holds: a save each gameweek of five seasons is 190. A save past it
 *  is refused, and a read of more throws, never a silent cut (#214). Claude's choice, not yet
 *  Craig's. */
export const SITE_SCORING_VERSIONS_MOST = 200;

/** Until patches (#355) give a change its own deadline, a change takes effect from the first
 *  gameweek none of whose matches has kicked off, whatever each league's deadline: so no match
 *  already begun is ever scored by it. */
const AT_FIRST_KICKOFF: DeadlineRule = { minutesBeforeFirstKickoff: 0 };

/** Why a change to the site's scoring is refused, in the words the admin is shown. */
export const siteScoringRefusals = {
  /** A save made in one tab after another's (spec/03: a second save never silently replaces the
   *  first). */
  changedSince: (at: number) => `The site's scoring was saved on ${londonTime(at)}, after you opened it, so yours wasn't saved.`,
  tooManyVersions: `The site's scoring has been changed ${SITE_SCORING_VERSIONS_MOST} times, the most it can hold, so this change wasn't saved.`,
  unsound: (reason: string) => `The scoring set can't be saved: ${reason}.`,
};

/** The version a screen loaded, carried with its change: the latest's id, or null while the site
 *  plays the first set. */
export const siteRevisionShape = v.union(v.null(), v.id("siteScoring"));

/** Every version the site has, oldest first, at most SITE_SCORING_VERSIONS_MOST. */
function historyOf(ctx: QueryCtx): Promise<Doc<"siteScoring">[]> {
  return takeAllOrThrow(
    ctx.db.query("siteScoring").withIndex("by_fromGameweek"),
    SITE_SCORING_VERSIONS_MOST,
    `The site holds more than ${SITE_SCORING_VERSIONS_MOST} scoring versions, so the one in force can't be known`,
  );
}

/** The set in force in this gameweek: the latest version to take effect at or before it, and of
 *  two from one gameweek the newer; the first set before any. */
function inForce(history: readonly Doc<"siteScoring">[], gameweek: number): StoredScoringSet {
  return history.findLast((row) => row.fromGameweek <= gameweek)?.scoring ?? FIRST_SCORING;
}

/** The site's scoring set in a gameweek, which every league scores that gameweek's matches by. */
export async function siteScoringInGameweek(ctx: QueryCtx, gameweek: number): Promise<StoredScoringSet> {
  return inForce(await historyOf(ctx), gameweek);
}

/** The gameweek a change made at `now` takes effect from (AT_FIRST_KICKOFF), never earlier than a
 *  change already waiting, which would otherwise override it. */
async function takesEffectFrom(ctx: QueryCtx, history: readonly Doc<"siteScoring">[], now: number): Promise<number> {
  const { gameweeks, matches } = await heldSchedule(ctx);
  const notKickedOff = nextGameweek(gameweeks, matches, () => AT_FIRST_KICKOFF, new Map(), now);
  return Math.max(notKickedOff, history.at(-1)?.fromGameweek ?? FIRST_GAMEWEEK);
}

/** Refuses, with the reason, a set that would score wrong or an own stat named as a catalogue
 *  stat is. */
function checkScoringSet(scoring: StoredScoringSet): void {
  try {
    validateScoringSet(scoring);
    // On saving only: ownStats.ts's validateOwnStats says why.
    checkOwnStatsAgainstCatalogue(scoring.ownStats ?? []);
  } catch (error) {
    refuse(siteScoringRefusals.unsound((error as Error).message));
  }
}

/** Player scoring's read: the site's latest set, a waiting change's among them; the version it is
 *  (for a save to carry); the gameweek a change made at `now` would take effect from; and whether
 *  the reader may change it, which only the admin may. `now` is the screen's, moved on each minute,
 *  as a query must not read the clock (convex/admin/feeds.ts says why). */
export const view = query({
  args: { now: v.number() },
  returns: v.object({ part: scoringSetShape, revision: siteRevisionShape, changesFrom: v.number(), canEdit: v.boolean() }),
  handler: async (ctx, { now }) => {
    const email = await callerEmail(ctx);
    const history = await historyOf(ctx);
    const latest = history.at(-1);
    return {
      part: latest?.scoring ?? FIRST_SCORING,
      revision: latest?._id ?? null,
      changesFrom: await takesEffectFrom(ctx, history, now),
      canEdit: isAdmin(email),
    };
  },
});

/** The admin's change to the site's set, made from the version `revision` names: a new version
 *  from the gameweek `takesEffectFrom` gives, for every league. The same set again changes nothing.
 *  Returns the gameweek it takes effect from. Refused, with the reason, for anyone but the admin,
 *  if saved since `revision`, or if unsound. */
export const change = mutation({
  args: { scoring: scoringSetShape, revision: siteRevisionShape },
  returns: v.number(),
  handler: async (ctx, { scoring, revision }) => {
    await adminOf(ctx);
    const history = await historyOf(ctx);
    const latest = history.at(-1);
    if ((latest?._id ?? null) !== revision) {
      refuse(siteScoringRefusals.changedSince(latest?._creationTime ?? Date.now()));
    }
    checkScoringSet(scoring);
    if (sortedJson(latest?.scoring ?? FIRST_SCORING) === sortedJson(scoring)) return latest?.fromGameweek ?? FIRST_GAMEWEEK;
    if (history.length >= SITE_SCORING_VERSIONS_MOST) refuse(siteScoringRefusals.tooManyVersions);
    const fromGameweek = await takesEffectFrom(ctx, history, Date.now());
    // A second change before the same kickoff is a newer row from the same gameweek: it wins.
    await ctx.db.insert("siteScoring", { fromGameweek, scoring });
    return fromGameweek;
  },
});
