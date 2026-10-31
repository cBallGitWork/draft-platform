import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { DeadlineRule } from "../gameweeks/deadline";
import { firstKickoffs, gameweekStartsOf } from "../gameweeks/gameweekStarts";
import { heldSchedule } from "../gameweeks/leagueDeadlines";
import { nextGameweek } from "../gameweeks/nextGameweek";
import { takeAllOrThrow } from "../shared/cappedRead";
import { FIRST_SCORING } from "./firstScoring";
import type { StoredScoringSet } from "./scoringSetShape";

// The site's scoring versions as held, and which one is in force in each gameweek: the rule, and
// the changes that add a version, are siteScoring.ts's.

/** The most versions the site holds: a version each gameweek of five seasons is 190. One past it is
 *  refused, and a read of more throws, never a silent cut (#214). Claude's choice, not yet
 *  Craig's. */
export const SITE_SCORING_VERSIONS_MOST = 200;

/** A version reaches a gameweek only if it took effect by the gameweek's first kickoff, whatever
 *  each league's deadline: so no match already begun is ever scored by it. */
const AT_FIRST_KICKOFF: DeadlineRule = { minutesBeforeFirstKickoff: 0 };

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
  const versionIn = await siteVersionByGameweek(ctx);
  return (gameweek) => versionIn(gameweek).set;
}

/** The scoring a gameweek was scored under: its set, and its version's name, null for the first
 *  set (spec/14, On screen: a breakdown says the version it was scored under). */
export interface VersionInForce {
  set: StoredScoringSet;
  name: string | null;
}

/** `siteScoringByGameweek`, with the version's name beside each gameweek's set. */
export async function siteVersionByGameweek(ctx: QueryCtx): Promise<(gameweek: number) => VersionInForce> {
  const history = await siteVersions(ctx);
  const { matches } = await heldSchedule(ctx);
  const recordedStarts = await gameweekStartsOf(ctx, matches);
  const kickoffs = firstKickoffs(matches);
  return (gameweek) => {
    const firstKickoff = recordedStarts.get(gameweek) ?? kickoffs.get(gameweek) ?? null;
    const inForce = firstKickoff === null ? history.at(-1) : history.findLast((row) => row.takesEffectAt <= firstKickoff);
    return { set: setOf(inForce), name: inForce === undefined ? null : versionName(inForce) };
  };
}

/** The first gameweek a version taking effect at `at` reaches: the first whose first kickoff is at
 *  or after it, as `siteScoringInGameweek` reads it, after the last that kicked off before it (a
 *  postponed gameweek behind one is passed over, #413). Once every held gameweek has kicked off,
 *  the one after the last (`nextGameweek`). */
export async function firstGameweekFrom(ctx: QueryCtx, at: number): Promise<number> {
  const { gameweeks, matches } = await heldSchedule(ctx);
  // nextGameweek counts a gameweek begun at its kickoff; a version taking effect then still reaches it.
  return nextGameweek(gameweeks, matches, () => AT_FIRST_KICKOFF, await gameweekStartsOf(ctx, matches), at - 1);
}
