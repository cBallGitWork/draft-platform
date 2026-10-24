import { v, type Validator } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { leagueDeadline, type DeadlineRule, type ScheduledMatch } from "../gameweeks/deadline";
import { FIRST_RULES } from "./firstRules";
import { getLeague, isAdmin, memberOf, refuse, runnerOf } from "../shared/leagueAccess";
import { recordEvent } from "../mail/letters";
import { checkGamesFor, checkLeagueRules, gamesWords, UnsoundRules, whyMostGames } from "./leagueRulesCheck";
import { roundsInARoundRobin } from "../table/roundRobin";
import { leagueRulesShape, scoringSetShape, type LeagueRules } from "./leagueRulesShape";
import { categoryName } from "../scoring/categories";
import { sortedJson } from "../shared/sortedJson";
import { nextGameweek } from "../gameweeks/nextGameweek";
import { passedDeadlinesOf } from "../gameweeks/passedDeadlines";
import { FIRST_GAMEWEEK, SEASON_GAMEWEEKS } from "../gameweeks/usedGameweeks";
import { londonTime } from "../shared/londonTime";
import { adminByline } from "../mail/letterWords";
import { checkSquadMaximums, squadMaximumBandShape, squadMaximumFor, STARTING_SQUAD_MAXIMUMS, withSquadMaximum, type SquadMaximumBand } from "./squadMaximums";

// A league's rules, held as data (spec/03; #25): a new league copies the admin's default rules, and
// its commissioner changes them from the next gameweek, so a past gameweek keeps the rules it had.
// Its squad maximum is the site's for its size instead (squadMaximums.ts). Until the admin has a
// screen, the defaults are set from the dashboard or the command line:
// `npx convex run rules/leagueRules:setDefaults '{"rules": {…}}'`, checked as a commissioner's are,
// and the squad maximums by size likewise:
// `npx convex run rules/leagueRules:setSquadMaximums '{"bands": [{"fromTeams": 2, "maximum": 20}, …]}'`.

/** Why a change to the rules is refused besides unsound rules, in the words the person is shown. */
export const rulesRefusals = {
  noRules: "This league was made before leagues held their rules, so it has none to change yet.",
  /** Someone saved the rules after these were loaded (Craig, 22 Oct 2026: a second save warns,
   *  never silently replaces the first). `who` is an email, or `adminByline`; null when no letter
   *  names them. */
  changedSince: (who: string | null, at: number) =>
    `${who ?? "Someone"} saved the league's rules on ${londonTime(at)}, after you opened them, so yours weren't saved.`,
  /** A new league too small for the admin's default games a gameweek: the defaults are the cause. */
  defaultGamesTooMany: (games: number, maxTeams: number) =>
    `The admin's default rules play ${gamesWords(games)} a gameweek, but with ${maxTeams} teams a team can play at most ` +
    `${gamesWords(roundsInARoundRobin(maxTeams))}: ${whyMostGames(maxTeams)}.`,
  /** A new league whose defaults, with the squad maximum for its size, are unsound: the defaults
   *  or the squad maximums are the cause, not the person making the league. */
  defaultsUnsound: (maxTeams: number, reason: string) =>
    `The admin's default rules, with the squad maximum for ${maxTeams} teams, can't make this league: ${reason}`,
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

/** Refuses unsound rules, telling the commissioner or admin why: a league's, of `maxTeams` teams,
 *  or the admin's defaults, which belong to no league. */
function refuseUnsound(rules: LeagueRules, maxTeams?: number): void {
  asRefusal(() => checkLeagueRules(rules, maxTeams));
}

/** Runs a check of the rules, its UnsoundRules a refusal and anything else the bug it is. */
function asRefusal(check: () => void): void {
  try {
    check();
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

/** The rules in force in this gameweek, from the league's history. Throws if none is, which only a
 *  league made before #25 can have. */
function rulesInForce(history: readonly Doc<"leagueRules">[], leagueId: Id<"leagues">, gameweek: number): LeagueRules {
  const row = inForce(history, gameweek);
  if (row === undefined) throw new Error(`League ${leagueId} has no rules for gameweek ${gameweek}`);
  return row.rules;
}

/** The league's rules in a gameweek, for scoring (#29) and the lineup's checks. Throws for a
 *  league with none, which only one made before #25 can be. */
export async function rulesInGameweek(ctx: QueryCtx, leagueId: Id<"leagues">, gameweek: number): Promise<LeagueRules> {
  return rulesInForce(await historyOf(ctx, leagueId), leagueId, gameweek);
}

/** The league's rules over the season from one read of its history: its latest, a waiting
 *  change's among them, and those in force in each gameweek, as the fixtures read them (#266).
 *  Null for a league made before #25. */
export async function seasonRules(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
): Promise<{ latest: LeagueRules; inGameweek: (gameweek: number) => LeagueRules } | null> {
  const history = await historyOf(ctx, leagueId);
  const latest = history.at(-1);
  if (latest === undefined) return null;
  return { latest: latest.rules, inGameweek: (gameweek) => rulesInForce(history, leagueId, gameweek) };
}

function defaultsRow(ctx: QueryCtx) {
  return ctx.db.query("defaultLeagueRules").unique();
}

async function writeDefaults(ctx: MutationCtx, rules: LeagueRules): Promise<void> {
  const row = await defaultsRow(ctx);
  if (row === null) await ctx.db.insert("defaultLeagueRules", { rules });
  else await ctx.db.patch("defaultLeagueRules", row._id, { rules });
}

function squadMaximumsRow(ctx: QueryCtx) {
  return ctx.db.query("squadMaximums").unique();
}

/** The site's squad maximums by size; the first league a deployment makes writes the starting
 *  data (squadMaximums.ts) as them. */
async function squadMaximumBands(ctx: MutationCtx): Promise<readonly SquadMaximumBand[]> {
  const row = await squadMaximumsRow(ctx);
  if (row !== null) return row.bands;
  await ctx.db.insert("squadMaximums", { bands: [...STARTING_SQUAD_MAXIMUMS] });
  return STARTING_SQUAD_MAXIMUMS;
}

/** Gives a new league of `maxTeams` the admin's default rules from gameweek 1, its squad maximum
 *  the site's for that many teams. Refused if that many teams can't play their games a gameweek, or
 *  if that maximum leaves the rules unsound. The first league a deployment makes writes the first
 *  rules (firstRules.ts) as those defaults. */
export async function giveDefaultRules(ctx: MutationCtx, leagueId: Id<"leagues">, maxTeams: number): Promise<void> {
  const defaults = (await defaultsRow(ctx))?.rules;
  if (defaults === undefined) await writeDefaults(ctx, FIRST_RULES);
  const rules = withSquadMaximum(defaults ?? FIRST_RULES, squadMaximumFor(await squadMaximumBands(ctx), maxTeams));
  const games = rules.gamesPerGameweek;
  if (games !== undefined && games > roundsInARoundRobin(maxTeams)) refuse(rulesRefusals.defaultGamesTooMany(games, maxTeams));
  try {
    checkLeagueRules(rules, maxTeams);
  } catch (error) {
    if (error instanceof UnsoundRules) refuse(rulesRefusals.defaultsUnsound(maxTeams, error.message));
    throw error;
  }
  await ctx.db.insert("leagueRules", { leagueId, fromGameweek: FIRST_GAMEWEEK, rules });
}

/** Refuses `maxTeams` for a league whose `rules` play more games a gameweek than that many teams
 *  can: when its maximum is lowered. A team joining can't change it. */
export function refuseTooFewForGames(rules: LeagueRules | null, maxTeams: number): void {
  const games = rules?.gamesPerGameweek;
  if (games !== undefined) asRefusal(() => checkGamesFor(games, maxTeams));
}

/** The season's gameweeks and matches as held, less those the football layer no longer sends. */
export async function heldSchedule(ctx: QueryCtx) {
  const gameweeks = [];
  for await (const { number, droppedAt } of ctx.db.query("gameweeks")) {
    if (droppedAt === undefined) gameweeks.push({ number });
  }
  const matches = [];
  // A season's 380, at most a few seasons' worth: the fixtures table has no gameweek index.
  for await (const { gameweek, kickoff, droppedAt } of ctx.db.query("fixtures")) {
    if (droppedAt === undefined) matches.push({ gameweek, kickoff });
  }
  return { gameweeks, matches };
}

/** The league's own deadline for each of gameweeks 1 to 38: the one recorded once it passed
 *  (#150), else the one under the rule in force in it. When each begins, for its screens, refusals
 *  and recorder (#138, #139). Null where none of the gameweek's matches has a kickoff time held,
 *  and for every gameweek of a league made before rules were held, which has no deadline rule. */
export async function leagueDeadlines(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Map<number, number | null>> {
  return leagueDeadlinesIn(ctx, leagueId, (await heldSchedule(ctx)).matches);
}

/** `leagueDeadlines` against matches already read (`heldSchedule`), so one read serves every
 *  league. */
export async function leagueDeadlinesIn(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  matches: readonly ScheduledMatch[],
): Promise<Map<number, number | null>> {
  const history = await historyOf(ctx, leagueId);
  const passed = await passedDeadlinesOf(ctx, leagueId);
  return new Map(
    SEASON_GAMEWEEKS.map((gameweek) => {
      const row = inForce(history, gameweek);
      const recorded = passed.get(gameweek) ?? null;
      return [gameweek, row === undefined ? recorded : leagueDeadline(gameweek, matches, row.rules.deadline, recorded)];
    }),
  );
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
  leagueId: Id<"leagues">,
  history: readonly Doc<"leagueRules">[],
  rules: LeagueRules,
  now: number,
): Promise<number> {
  const { gameweeks, matches } = await heldSchedule(ctx);
  const passed = await passedDeadlinesOf(ctx, leagueId);
  const nextUnder = (deadlineFor: (gameweek: number) => DeadlineRule) => nextGameweek(gameweeks, matches, deadlineFor, passed, now);
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
  refuseUnsound(rules, (await getLeague(ctx, leagueId)).maxTeams);
  const fromGameweek = await takesEffectFrom(ctx, leagueId, history, rules, Date.now());
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

/** What a screen editing part of the rules reads (`editorViewOf` validates it): the part as the
 *  latest rules have it, a waiting change's among them, the rules row it is from (for
 *  the save to carry), and the gameweek a change made at `now` would take effect from. Null for a
 *  league made before rules were held. For whoever runs the league. `now` is the screen's, moved on
 *  each minute, as a query must not read the clock (convex/admin/feeds.ts says why). */
export async function editorView<Part>(ctx: QueryCtx, leagueId: Id<"leagues">, now: number, partOf: (rules: LeagueRules) => Part) {
  await runnerOf(ctx, leagueId);
  const history = await historyOf(ctx, leagueId);
  const latestRow = history.at(-1);
  if (latestRow === undefined) return null;
  return { part: partOf(latestRow.rules), revision: latestRow._id, changesFrom: await takesEffectFrom(ctx, leagueId, history, latestRow.rules, now) };
}

/** `editorView`'s returns validator, for a part shaped as `part`. */
export const editorViewOf = <Part extends Validator<unknown, "required", string>>(part: Part) =>
  v.union(v.null(), v.object({ part, revision: v.id("leagueRules"), changesFrom: v.number() }));

/** A screen's change to part of the rules: the league's latest with `changed` applied, saved as
 *  `change` saves them, made from the rules `revision` names, so a change to the rest made
 *  meanwhile is neither undone nor saved over. Returns the gameweek it takes effect from. Refused,
 *  with the reason, if the league has no rules yet, if they changed since, or if unsound. */
export async function changeLatest(
  ctx: MutationCtx,
  leagueId: Id<"leagues">,
  revision: Revision,
  changed: (latest: LeagueRules) => LeagueRules,
): Promise<number> {
  const { email } = await runnerOf(ctx, leagueId);
  const latest = await latestRules(ctx, leagueId);
  if (latest === null) refuse(rulesRefusals.noRules);
  return await changeRules(ctx, leagueId, email, changed(latest), revision);
}

/** The league's scoring set as Player scoring, the rules editor (#30), edits it. */
export const scoring = query({
  args: { leagueId: v.id("leagues"), now: v.number() },
  returns: editorViewOf(scoringSetShape),
  handler: (ctx, { leagueId, now }) => editorView(ctx, leagueId, now, (rules) => rules.scoring),
});

/** The rules editor's change (#30): the latest rules with this scoring set, as `changeLatest`
 *  saves them. */
export const changeScoring = mutation({
  args: { leagueId: v.id("leagues"), scoring: scoringSetShape, revision: revisionShape },
  returns: v.number(),
  handler: (ctx, { leagueId, scoring, revision }) => changeLatest(ctx, leagueId, revision, (latest) => ({ ...latest, scoring })),
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

/** Craig changes the squad maximums by size that new leagues take theirs from (#316). Leagues
 *  already made keep their own. Refused, with the reason, if unsound. */
export const setSquadMaximums = internalMutation({
  args: { bands: v.array(squadMaximumBandShape) },
  returns: v.null(),
  handler: async (ctx, { bands }) => {
    asRefusal(() => checkSquadMaximums(bands));
    const row = await squadMaximumsRow(ctx);
    if (row === null) await ctx.db.insert("squadMaximums", { bands });
    else await ctx.db.patch("squadMaximums", row._id, { bands });
    return null;
  },
});
