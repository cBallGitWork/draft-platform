import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { DEFAULT_DEADLINE_RULE } from "../gameweeks/deadline";
import { firstKickoffs, gameweekStartsOf } from "../gameweeks/gameweekStarts";
import { scheduledMatches } from "../gameweeks/leagueDeadlines";
import { nextGameweek } from "../gameweeks/nextGameweek";
import { seasonGameweekCount } from "../gameweeks/seasonGameweeks";
import { seasonGameweeks } from "../gameweeks/usedGameweeks";
import { takeAllOrThrow } from "../shared/cappedRead";
import { MINUTE_MS } from "../shared/time";
import { FIRST_SCORING } from "./firstScoring";
import type { StoredScoringSet } from "./scoringSetShape";

// The site's scoring versions as held, and which one is in force in each gameweek: the rule, and
// the changes that add a version, are siteScoring.ts's.

/** The most versions the site holds: a version each gameweek of five seasons is 190. One past it is
 *  refused, and a read of more throws, never a silent cut (#214). Claude's choice, not yet
 *  Craig's. */
export const SITE_SCORING_VERSIONS_MOST = 200;

/** A version reaches a gameweek only if it took effect by the site's one deadline for it: the
 *  default deadline, 15 minutes before the gameweek's first kickoff, whatever deadline a league sets
 *  (spec/14 S14.1; Craig, 10 Nov 2026, on #902: "one site deadline"). So every league scores a
 *  gameweek under the same version, and none lands after the gameweek's default lock. */
const SITE_DEADLINE_RULE = DEFAULT_DEADLINE_RULE;

/** The site's deadline for a gameweek whose first kickoff is `firstKickoff`. */
export function siteDeadline(firstKickoff: number): number {
  return firstKickoff - SITE_DEADLINE_RULE.minutesBeforeFirstKickoff * MINUTE_MS;
}

/** Each gameweek's site deadline, from its first kickoffs by gameweek. */
function siteDeadlines(firstKickoffs: ReadonlyMap<number, number>): Map<number, number> {
  return new Map([...firstKickoffs].map(([gameweek, kickoff]) => [gameweek, siteDeadline(kickoff)]));
}

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

/** A version's moment, all the rule below reads. */
type Timed = Pick<Doc<"siteScoring">, "takesEffectAt">;

/** Whether `version` still waits to take effect at `now`: its moment is after `now`. One taking
 *  effect exactly at `now` is in force, never waiting (`inForceAt`). */
export function isWaiting(version: Timed, now: number): boolean {
  return version.takesEffectAt > now;
}

/** The version in force at `at`: the newest in `history` (in the order they take effect) to take
 *  effect by then, one exactly at `at` included; undefined before any. */
export function inForceAt<Version extends Timed>(history: readonly Version[], at: number): Version | undefined {
  return history.findLast((version) => !isWaiting(version, at));
}

/** The versions still to take effect after `now`, soonest first, read through the index (#1617):
 *  what the banner every signed-in page runs looks through, never the whole history. The index's
 *  `gt` is `isWaiting`'s rule, which a query range can't call. */
export function versionsWaitingAt(ctx: QueryCtx, now: number) {
  return ctx.db.query("siteScoring").withIndex("by_takesEffectAt", (q) => q.gt("takesEffectAt", now));
}

/** A version's set, or the first set when there is no version yet. */
export function setOf(version: Doc<"siteScoring"> | undefined): StoredScoringSet {
  return version?.scoring ?? FIRST_SCORING;
}

/** The site's latest scoring set: the newest version announced, in force or still waiting, the first
 *  set before any. What Player scoring shows and Scouting ranks by; `siteScoringAt` is the one in
 *  force. */
export async function latestSiteScoring(ctx: QueryCtx): Promise<StoredScoringSet> {
  return setOf((await siteVersions(ctx)).at(-1));
}

/** The site's scoring set in force at `at`: the newest version to take effect by then, the first
 *  set before any. What stars price every match under, whichever gameweek it was (Craig, 1 Nov
 *  2026: today's scoring, so a patch re-rates everyone). */
export async function siteScoringAt(ctx: QueryCtx, at: number): Promise<StoredScoringSet> {
  return setOf(inForceAt(await siteVersions(ctx), at));
}

/** The site's scoring set in a gameweek, which every league scores that gameweek's matches by: the
 *  newest version to take effect at or before its site deadline (`siteDeadline`, from its first
 *  kickoff, the recorded one once passed), the first set before any. A
 *  gameweek with no kickoff time yet plays the one in force, never a waiting patch. */
export async function siteScoringInGameweek(ctx: QueryCtx, gameweek: number): Promise<StoredScoringSet> {
  return (await siteScoringByGameweek(ctx))(gameweek);
}

/** `siteScoringInGameweek` for any gameweek, reading the versions and the schedule once: for a
 *  read that prices matches across many gameweeks, such as a player's card (#381). */
export async function siteScoringByGameweek(ctx: QueryCtx): Promise<(gameweek: number) => StoredScoringSet> {
  const versionIn = await siteVersionByGameweek(ctx);
  return (gameweek) => versionIn(gameweek).set;
}

/** The scoring a gameweek was scored under: its set, and its version's name, null for the first
 *  set (spec/14, On screen: a breakdown says the version it was scored under). */
interface VersionInForce {
  set: StoredScoringSet;
  name: string | null;
}

/** `siteScoringByGameweek`, with the version's name beside each gameweek's set. */
export async function siteVersionByGameweek(ctx: QueryCtx): Promise<(gameweek: number) => VersionInForce> {
  const history = await siteVersions(ctx);
  const matches = await scheduledMatches(ctx);
  const recordedStarts = await gameweekStartsOf(ctx, matches);
  const kickoffs = firstKickoffs(matches);
  const unscheduled = versionInForceUnscheduled(history, recordedStarts, kickoffs);
  return (gameweek) => {
    const firstKickoff = recordedStarts.get(gameweek) ?? kickoffs.get(gameweek) ?? null;
    const deadline = firstKickoff === null ? null : siteDeadline(firstKickoff);
    const inForce = deadline === null ? unscheduled : inForceAt(history, deadline);
    return { set: setOf(inForce), name: inForce === undefined ? null : versionName(inForce) };
  };
}

/** The version a gameweek with no kickoff time yet plays: the one in force, never a patch still
 *  waiting (Craig, 1 Nov 2026, on #901: "old", though gameweeks always have a time). A query must
 *  not read the clock, so in force is what the schedule shows: a fix takes effect when it is made,
 *  so is in force; a patch is once a gameweek has begun whose site deadline is at or after its
 *  moment, or if its moment came before the season's first site deadline (with no kickoffs held,
 *  nothing is scored, so any is).
 *  Undefined for the first set. */
function versionInForceUnscheduled(
  history: readonly Doc<"siteScoring">[],
  recordedStarts: ReadonlyMap<number, number>,
  kickoffs: ReadonlyMap<number, number>,
): Doc<"siteScoring"> | undefined {
  const latestBegun = siteDeadline(Math.max(-Infinity, ...recordedStarts.values()));
  const seasonFirst = siteDeadline(Math.min(Infinity, ...kickoffs.values(), ...recordedStarts.values()));
  return history.findLast((row) => row.kind === "fix" || row.takesEffectAt <= latestBegun || row.takesEffectAt < seasonFirst);
}

/** The first gameweek a version taking effect at `at` reaches: the first whose site deadline is at
 *  or after it, as `siteScoringInGameweek` reads it, after the last whose deadline came before it (a
 *  postponed gameweek behind one is passed over, #413). Once all of the season's gameweeks have
 *  kicked off, the one after its last (`nextGameweek`). It counts the season's gameweeks (#1618),
 *  never reads the held gameweek rows, whose read throws past `GAMEWEEKS_MOST` (#832). */
export async function firstGameweekFrom(ctx: QueryCtx, at: number): Promise<number> {
  return (await firstGameweekFromAny(ctx))(at);
}

/** `firstGameweekFrom` for any moment, reading the schedule once: for the versions list. */
export async function firstGameweekFromAny(ctx: QueryCtx): Promise<(at: number) => number> {
  const matches = await scheduledMatches(ctx);
  const passed = siteDeadlines(await gameweekStartsOf(ctx, matches));
  const gameweeks = seasonGameweeks(await seasonGameweekCount(ctx)).map((number) => ({ number }));
  // nextGameweek counts a gameweek begun at its deadline; a version taking effect then still reaches it.
  return (at) => nextGameweek(gameweeks, matches, () => SITE_DEADLINE_RULE, passed, at - 1);
}

/** A gameweek a patch can be announced to take effect from, and the moment that is. */
export type PatchGameweek = { gameweek: number; takesEffectAt: number };

/** The gameweeks a patch announced at `now` can take effect from (Craig, 6 Nov 2026, on #368: "you
 *  pick a gameweek and it takes effect from that gameweek's deadline; only gameweeks at least 7 days
 *  away are offered"), in order. The site's scoring has no league, so a gameweek's moment is the one
 *  every version is read by: its site deadline (`siteDeadline`). Offered: a gameweek not
 *  yet begun, with a kickoff time, at least `noticeMs` after `now` and none before the latest
 *  version takes effect, as `announce` refuses a patch landing before one already announced. */
export async function patchGameweeks(ctx: QueryCtx, now: number, noticeMs: number): Promise<PatchGameweek[]> {
  const matches = await scheduledMatches(ctx);
  const starts = await gameweekStartsOf(ctx, matches);
  const latestAt = (await siteVersions(ctx)).at(-1)?.takesEffectAt ?? -Infinity;
  return [...siteDeadlines(firstKickoffs(matches))]
    .filter(([gameweek, deadline]) => !starts.has(gameweek) && deadline >= now + noticeMs && deadline >= latestAt)
    .map(([gameweek, takesEffectAt]) => ({ gameweek, takesEffectAt }))
    .toSorted((one, other) => one.gameweek - other.gameweek);
}
