import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import type { DeadlineRule } from "../gameweeks/deadline";
import { FIRST_RULES } from "./firstRules";
import { isAdmin, memberOf, refuse, runnerOf } from "../shared/leagueAccess";
import { recordEvent } from "../mail/letters";
import { checkLeagueRules, UnsoundRules } from "./leagueRulesCheck";
import { leagueRulesShape, scoringSetShape, type LeagueRules } from "./leagueRulesShape";
import { categoryName } from "../scoring/categories";
import { sortedJson } from "../shared/sortedJson";
import { nextGameweek } from "../gameweeks/nextGameweek";
import { FIRST_GAMEWEEK } from "../gameweeks/usedGameweeks";
import { londonTime } from "../shared/londonTime";
import { adminByline } from "../mail/letterWords";

// A league's rules, held as data (spec/03; #25): a new league copies the admin's default rules, and
// its commissioner changes them from the next gameweek, so a past gameweek keeps the rules it had.
// Until the admin has a screen, the defaults are set from the dashboard or the command line:
// `npx convex run rules/leagueRules:setDefaults '{"rules": {…}}'`, checked as a commissioner's are.

/** Why a change to the rules is refused besides unsound rules, in the words the person is shown. */
export const rulesRefusals = {
  noRules: "This league was made before leagues held their rules, so it has none to change yet.",
  /** Someone saved the rules after these were loaded (Craig, 22 Oct 2026: a second save warns,
   *  never silently replaces the first). `who` is an email, or `adminByline`; null when no letter
   *  names them. */
  changedSince: (who: string | null, at: number) =>
    `${who ?? "Someone"} saved the league's rules on ${londonTime(at)}, after you opened them, so yours weren't saved.`,
};

/** The rules row a screen loaded, carried with its change so a save over someone else's is
 *  refused: the latest row's id, or null for a league that had none. */
export const revisionShape = v.union(v.null(), v.id("leagueRules"));
type Revision = Id<"leagueRules"> | null;

/** Refuses a change made from rules older than the league's latest, naming who saved those and
 *  when, from the letter that said so. */
async function refuseStale(ctx: QueryCtx, leagueId: Id<"leagues">, latestRow: Doc<"leagueRules"> | undefined, loaded: Revision): Promise<void> {
  if ((latestRow?._id ?? null) === loaded) return;
  const events = ctx.db.query("leagueEvents").withIndex("by_leagueId_and_at", (q) => q.eq("leagueId", leagueId)).order("desc");
  for await (const { by, at, event } of events) {
    if (event.kind === "rulesChanged") refuse(rulesRefusals.changedSince(isAdmin(by) ? adminByline : by, at));
  }
  refuse(rulesRefusals.changedSince(null, latestRow?._creationTime ?? Date.now()));
}

/** Refuses unsound rules, telling the commissioner or admin why. */
function refuseUnsound(rules: LeagueRules): void {
  try {
    checkLeagueRules(rules);
  } catch (error) {
    if (error instanceof UnsoundRules) refuse(error.message);
    throw error;
  }
}

/** Every rules row the league has, oldest first: one per change, so a few a season. */
async function historyOf(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Doc<"leagueRules">[]> {
  const rows = [];
  for await (const row of ctx.db
    .query("leagueRules")
    .withIndex("by_leagueId_and_fromGameweek", (q) => q.eq("leagueId", leagueId))) {
    rows.push(row);
  }
  return rows;
}

/** The row in force in this gameweek: the latest to take effect at or before it, and of two from
 *  one gameweek, the newer. */
function inForce(history: readonly Doc<"leagueRules">[], gameweek: number): Doc<"leagueRules"> | undefined {
  return history.findLast((row) => row.fromGameweek <= gameweek);
}

/** The league's latest rules, a waiting change's among them, or null for a league made before #25:
 *  what the squad's warnings read (#31), as a change of squad limits is best known at once. */
export async function latestRules(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<LeagueRules | null> {
  return (await historyOf(ctx, leagueId)).at(-1)?.rules ?? null;
}

/** The league's rules in a gameweek, for scoring (#29) and the lineup's checks. Throws for a
 *  league with none, which only one made before #25 can be. */
export async function rulesInGameweek(ctx: QueryCtx, leagueId: Id<"leagues">, gameweek: number): Promise<LeagueRules> {
  const row = inForce(await historyOf(ctx, leagueId), gameweek);
  if (row === undefined) throw new Error(`League ${leagueId} has no rules for gameweek ${gameweek}`);
  return row.rules;
}

function defaultsRow(ctx: QueryCtx) {
  return ctx.db.query("defaultLeagueRules").unique();
}

async function writeDefaults(ctx: MutationCtx, rules: LeagueRules): Promise<void> {
  const row = await defaultsRow(ctx);
  if (row === null) await ctx.db.insert("defaultLeagueRules", { rules });
  else await ctx.db.patch("defaultLeagueRules", row._id, { rules });
}

/** Gives a new league the admin's default rules from gameweek 1. The first league a deployment
 *  makes writes the first rules (firstRules.ts) as those defaults. */
export async function giveDefaultRules(ctx: MutationCtx, leagueId: Id<"leagues">): Promise<void> {
  const defaults = (await defaultsRow(ctx))?.rules;
  if (defaults === undefined) await writeDefaults(ctx, FIRST_RULES);
  await ctx.db.insert("leagueRules", { leagueId, fromGameweek: FIRST_GAMEWEEK, rules: defaults ?? FIRST_RULES });
}

/** The season's gameweeks and matches as held, less those the football layer no longer sends. */
async function heldSchedule(ctx: QueryCtx) {
  const gameweeks = [];
  for await (const { number, deadline, droppedAt } of ctx.db.query("gameweeks")) {
    if (droppedAt === undefined) gameweeks.push({ number, deadline });
  }
  const matches = [];
  // A season's 380, at most a few seasons' worth: the fixtures table has no gameweek index.
  for await (const { gameweek, kickoff, droppedAt } of ctx.db.query("fixtures")) {
    if (droppedAt === undefined) matches.push({ gameweek, kickoff });
  }
  return { gameweeks, matches };
}

/** The parts of the rules that differ, by name: all of them, from a league that had none. */
function changedParts(from: LeagueRules | undefined, to: LeagueRules): (keyof LeagueRules)[] {
  const parts = Object.keys(leagueRulesShape.fields) as (keyof LeagueRules)[];
  return parts.filter((part) => from === undefined || sortedJson(from[part]) !== sortedJson(to[part]));
}

/** The league's latest rules, and the gameweek they take effect from: the next gameweek's, when a
 *  change is waiting for it. Null for a league made before rules were held. */
export const latest = query({
  args: { leagueId: v.id("leagues") },
  returns: v.union(v.null(), v.object({ fromGameweek: v.number(), rules: leagueRulesShape, revision: v.id("leagueRules") })),
  handler: async (ctx, { leagueId }) => {
    await memberOf(ctx, leagueId);
    const row = (await historyOf(ctx, leagueId)).at(-1);
    return row === undefined ? null : { fromGameweek: row.fromGameweek, rules: row.rules, revision: row._id };
  },
});

/** The gameweek a change to `rules` made at `now` takes effect from: the next not begun under the
 *  rules it replaces nor under its own deadline, and never earlier than a change already waiting.
 *  A later deadline must not reopen a gameweek the old one locked, nor an earlier one lock a
 *  gameweek the moment it is saved; and a row from before a waiting one would be overridden by it. */
async function takesEffectFrom(
  ctx: QueryCtx,
  history: readonly Doc<"leagueRules">[],
  rules: LeagueRules,
  now: number,
): Promise<number> {
  const { gameweeks, matches } = await heldSchedule(ctx);
  const nextUnder = (deadlineFor: (gameweek: number) => DeadlineRule) => nextGameweek(gameweeks, matches, deadlineFor, now);
  return Math.max(
    nextUnder((gameweek) => (inForce(history, gameweek)?.rules ?? rules).deadline),
    nextUnder(() => rules.deadline),
    history.at(-1)?.fromGameweek ?? FIRST_GAMEWEEK,
  );
}

/** Saves `rules` as the league's from the gameweek they can take effect, and files the letter
 *  saying what changed and from when. The same rules again change nothing and file nothing.
 *  Returns that gameweek. Refused, with the reason, if someone saved the rules since `loaded` was
 *  the latest, or if unsound. */
async function changeRules(ctx: MutationCtx, leagueId: Id<"leagues">, email: string, rules: LeagueRules, loaded: Revision): Promise<number> {
  const history = await historyOf(ctx, leagueId);
  const latestRow = history.at(-1);
  await refuseStale(ctx, leagueId, latestRow, loaded);
  refuseUnsound(rules);
  const fromGameweek = await takesEffectFrom(ctx, history, rules, Date.now());
  const changed = changedParts(latestRow?.rules, rules);
  if (latestRow !== undefined && changed.length === 0) return latestRow.fromGameweek;
  // A second change before the same deadline is a newer row from the same gameweek: it wins.
  await ctx.db.insert("leagueRules", { leagueId, fromGameweek, rules });
  await recordEvent(ctx, leagueId, email, { kind: "rulesChanged", fromGameweek, changed, ...scoringChanges(latestRow?.rules.scoring, rules.scoring) });
  return fromGameweek;
}

type Scoring = LeagueRules["scoring"];

/** What a letter says of a scoring change (spec/15: nothing changes quietly): the categories whose
 *  rules were added, removed or changed, by full name as they were named then, and whole points
 *  only, when it was switched. Nothing for a league that had no rules. */
function scoringChanges(from: Scoring | undefined, to: Scoring): { categories?: string[]; wholePointsOnly?: boolean } {
  if (from === undefined) return {};
  const rulesFor = (scoring: Scoring, stat: string) => sortedJson(scoring.rules.filter((rule) => rule.stat === stat));
  const stats = [...new Set([...to.rules, ...from.rules].map((rule) => rule.stat))];
  const categories = stats
    .filter((stat) => rulesFor(from, stat) !== rulesFor(to, stat))
    .map((stat) => categoryName(stat, to.ownStats ?? from.ownStats));
  return {
    ...(categories.length > 0 && { categories }),
    ...(from.wholePointsOnly !== to.wholePointsOnly && { wholePointsOnly: to.wholePointsOnly }),
  };
}

/** The commissioner's change, whole, made from the rules `revision` names: it takes effect from
 *  the gameweek `takesEffectFrom` gives. Returns that gameweek. Refused, with the reason, if the
 *  rules changed since or if unsound. */
export const change = mutation({
  args: { leagueId: v.id("leagues"), rules: leagueRulesShape, revision: revisionShape },
  returns: v.number(),
  handler: async (ctx, { leagueId, rules, revision }) => {
    const { email } = await runnerOf(ctx, leagueId);
    return await changeRules(ctx, leagueId, email, rules, revision);
  },
});

/** The league's scoring set as the rules editor (#30) edits it: the latest, a waiting change's
 *  among them, the rules row it is from (for the save to carry), and the gameweek a change made at
 *  `now` would take effect from. Null for a league
 *  made before rules were held. For whoever runs the league. `now` is the screen's, moved on each
 *  minute, as a query must not read the clock (convex/admin/feeds.ts says why). */
export const scoring = query({
  args: { leagueId: v.id("leagues"), now: v.number() },
  returns: v.union(v.null(), v.object({ scoring: scoringSetShape, revision: v.id("leagueRules"), changesFrom: v.number() })),
  handler: async (ctx, { leagueId, now }) => {
    await runnerOf(ctx, leagueId);
    const history = await historyOf(ctx, leagueId);
    const latestRow = history.at(-1);
    if (latestRow === undefined) return null;
    return { scoring: latestRow.rules.scoring, revision: latestRow._id, changesFrom: await takesEffectFrom(ctx, history, latestRow.rules, now) };
  },
});

/** The rules editor's change (#30): the league's latest rules with this scoring set, saved as
 *  `change` saves them, made from the rules `revision` names. Returns the gameweek it takes effect
 *  from. Refused, with the reason, if the league has no rules yet, if they changed since, or if
 *  unsound. */
export const changeScoring = mutation({
  args: { leagueId: v.id("leagues"), scoring: scoringSetShape, revision: revisionShape },
  returns: v.number(),
  handler: async (ctx, { leagueId, scoring, revision }) => {
    const { email } = await runnerOf(ctx, leagueId);
    const latest = await latestRules(ctx, leagueId);
    if (latest === null) refuse(rulesRefusals.noRules);
    return await changeRules(ctx, leagueId, email, { ...latest, scoring }, revision);
  },
});

/** The admin changes the rules new leagues get. Leagues already made keep their own. */
export const setDefaults = internalMutation({
  args: { rules: leagueRulesShape },
  returns: v.null(),
  handler: async (ctx, { rules }) => {
    refuseUnsound(rules);
    await writeDefaults(ctx, rules);
    return null;
  },
});
