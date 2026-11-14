import type { MutationCtx, QueryCtx } from "../_generated/server";
import { takeAllOrThrow } from "../shared/cappedRead";
import { currentFixtures, gameweekFixtures } from "../shared/fixtures";
import { seasonStartYear } from "../shared/time";
import type { ScheduledMatch } from "./deadline";
import { GAMEWEEKS_MOST } from "./usedGameweeks";

// Each gameweek's first and last kickoff, kept in `gameweekKickoffs` (#2009; Part of #1995, the
// Convex quota): every deadline read wants only those, so it reads a row a gameweek, about 5 KB,
// never the season's 380 matches, about 72 KB. Kept by season as well as gameweek, so while last
// season's matches are still held beside a new season's, each season's first kickoff stays its
// own (gameweekStarts.ts reads only this season's). Every write that adds, drops, moves or
// re-times a match keeps the gameweeks it touched in the same transaction: the football sync's
// (footballSync.ts) and the admin's move (matchMoves.ts). Until the first of those on a deployment,
// none are held, and the read takes the matches as before.

/** The most rows held: a row a gameweek in each of two seasons, while a new season's matches
 *  arrive before last season's are dropped. More throws, never a silent cut. */
const KICKOFF_ROWS_MOST = 2 * GAMEWEEKS_MOST;

type KickoffRow = { gameweek: number; season: number; firstKickoff: number; lastKickoff: number };

/** The rows `matches` make: each gameweek's first and last kickoff in each season. A match with no
 *  gameweek or no kickoff time makes none. Pure. */
export function kickoffRows(matches: readonly ScheduledMatch[]): KickoffRow[] {
  const rows = new Map<string, KickoffRow>();
  for (const { gameweek, kickoff } of matches) {
    if (gameweek === null || kickoff === null) continue;
    const season = seasonStartYear(kickoff);
    const key = `${gameweek}/${season}`;
    const held = rows.get(key);
    rows.set(key, {
      gameweek,
      season,
      firstKickoff: Math.min(kickoff, held?.firstKickoff ?? kickoff),
      lastKickoff: Math.max(kickoff, held?.lastKickoff ?? kickoff),
    });
  }
  return [...rows.values()];
}

/** The matches as a deadline reads them: each gameweek's first and last kickoff in each season, so
 *  each gameweek's earliest and latest, and the season's, are those of the matches the feed still
 *  sends. Read from `gameweekKickoffs`, or from the matches while none are held. */
export async function heldKickoffs(ctx: QueryCtx): Promise<ScheduledMatch[]> {
  const rows = await takeAllOrThrow(
    ctx.db.query("gameweekKickoffs"),
    KICKOFF_ROWS_MOST,
    `More than ${KICKOFF_ROWS_MOST} gameweek kickoff rows are held, so some gameweeks' deadlines would be lost`,
  );
  if (rows.length === 0) return (await currentFixtures(ctx)).map(({ gameweek, kickoff }) => ({ gameweek, kickoff }));
  return rows.flatMap(({ gameweek, firstKickoff, lastKickoff }) => [
    { gameweek, kickoff: firstKickoff },
    { gameweek, kickoff: lastKickoff },
  ]);
}

/** Keeps the rows of `gameweeks`, those whose matches a write just added, dropped, moved or
 *  re-timed, equal to the matches now held: one gameweek's matches read for each, and a row
 *  written only where it changed. With none held yet, every gameweek's are written from the
 *  matches. A null gameweek, a match's with none, is passed over. */
export async function keepGameweekKickoffs(ctx: MutationCtx, gameweeks: Iterable<number | null>): Promise<void> {
  if ((await ctx.db.query("gameweekKickoffs").first()) === null) {
    for (const row of kickoffRows(await currentFixtures(ctx))) await ctx.db.insert("gameweekKickoffs", row);
    return;
  }
  for (const gameweek of new Set(gameweeks)) {
    if (gameweek === null) continue;
    const matches = await gameweekFixtures(ctx, gameweek, "its deadline would be read from some of them");
    const wanted = kickoffRows(matches);
    const held = await takeAllOrThrow(
      ctx.db.query("gameweekKickoffs").withIndex("by_gameweek_and_season", (q) => q.eq("gameweek", gameweek)),
      KICKOFF_ROWS_MOST,
      `More than ${KICKOFF_ROWS_MOST} kickoff rows are held for gameweek ${gameweek}`,
    );
    for (const row of held) {
      const want = wanted.find(({ season }) => season === row.season);
      if (want === undefined) await ctx.db.delete("gameweekKickoffs", row._id);
      else if (want.firstKickoff !== row.firstKickoff || want.lastKickoff !== row.lastKickoff) await ctx.db.patch("gameweekKickoffs", row._id, want);
    }
    for (const want of wanted) if (!held.some(({ season }) => season === want.season)) await ctx.db.insert("gameweekKickoffs", want);
  }
}
