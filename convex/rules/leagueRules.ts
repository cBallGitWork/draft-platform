import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import type { DeadlineRule } from "../gameweeks/deadline";
import { FIRST_RULES } from "./firstRules";
import { memberOf, refuse, runnerOf } from "../shared/leagueAccess";
import { recordEvent } from "../mail/letters";
import { checkLeagueRules, UnsoundRules } from "./leagueRulesCheck";
import { leagueRulesShape, type LeagueRules } from "./leagueRulesShape";
import { nextGameweek } from "../gameweeks/nextGameweek";
import { FIRST_GAMEWEEK } from "../gameweeks/usedGameweeks";

// A league's rules, held as data (spec/03; #25): a new league copies the admin's default rules, and
// its commissioner changes them from the next gameweek, so a past gameweek keeps the rules it had.
// Until the admin has a screen, the defaults are set from the dashboard or the command line:
// `npx convex run rules/leagueRules:setDefaults '{"rules": {…}}'`, checked as a commissioner's are.

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

/** JSON with each object's keys sorted, so two equal values read the same whatever their order. */
function sortedJson(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) =>
    inner !== null && typeof inner === "object" && !Array.isArray(inner)
      ? Object.fromEntries(Object.entries(inner).toSorted(([one], [other]) => one.localeCompare(other)))
      : inner,
  );
}

/** The league's latest rules, and the gameweek they take effect from: the next gameweek's, when a
 *  change is waiting for it. Null for a league made before rules were held. */
export const latest = query({
  args: { leagueId: v.id("leagues") },
  returns: v.union(v.null(), v.object({ fromGameweek: v.number(), rules: leagueRulesShape })),
  handler: async (ctx, { leagueId }) => {
    await memberOf(ctx, leagueId);
    const row = (await historyOf(ctx, leagueId)).at(-1);
    return row === undefined ? null : { fromGameweek: row.fromGameweek, rules: row.rules };
  },
});

/** The commissioner's change, whole: it takes effect from the next gameweek not begun under the
 *  rules it replaces nor under its own deadline, and never earlier than a change already waiting.
 *  Returns that gameweek. Refused, with the reason, if unsound. */
export const change = mutation({
  args: { leagueId: v.id("leagues"), rules: leagueRulesShape },
  returns: v.number(),
  handler: async (ctx, { leagueId, rules }) => {
    const { email } = await runnerOf(ctx, leagueId);
    refuseUnsound(rules);
    const history = await historyOf(ctx, leagueId);
    const { gameweeks, matches } = await heldSchedule(ctx);
    const nextUnder = (deadlineFor: (gameweek: number) => DeadlineRule) =>
      nextGameweek(gameweeks, matches, deadlineFor, Date.now());
    const latestRow = history.at(-1);
    // A later deadline must not reopen a gameweek the old one locked, nor an earlier one lock a
    // gameweek the moment it is saved; and a row from before a waiting one would be overridden by it.
    const fromGameweek = Math.max(
      nextUnder((gameweek) => (inForce(history, gameweek)?.rules ?? rules).deadline),
      nextUnder(() => rules.deadline),
      latestRow?.fromGameweek ?? FIRST_GAMEWEEK,
    );

    const changed = changedParts(latestRow?.rules, rules);
    if (latestRow !== undefined && changed.length === 0) return latestRow.fromGameweek;
    // A second change before the same deadline is a newer row from the same gameweek: it wins.
    await ctx.db.insert("leagueRules", { leagueId, fromGameweek, rules });
    await recordEvent(ctx, leagueId, email, { kind: "rulesChanged", fromGameweek, changed });
    return fromGameweek;
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
