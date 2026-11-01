// How the match's records land on the scores league (gameweekScores.harness.ts): the live tick, the
// full-time read and the lock, the Premier League's score read, the table storing its final
// gameweeks, and a match the football sync moves into gameweek 6 after they were stored.

import type { Infer } from "convex/values";
import { vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import type { PlayerMatchRecord } from "../../../convex/stats/matchRecords";
import type { matchState } from "../../../convex/schema";
import { HOUR_MS } from "../../../convex/shared/time";
import { GAMEWEEK, LEAGUE_FULL_TIME_READ, LEAGUE_KICKOFF, type ScoresLeague } from "./gameweekScores.harness";
import { HULL_EVERTON, mergedHullEverton } from "./matchStats.harness";
import { elapse } from "./test.harness";

/** The match's records as the live tick lands them, before full time, and what the landing did. */
export async function liveRecords({ t }: ScoresLeague, records: PlayerMatchRecord[], minute: number | null = null) {
  vi.setSystemTime(LEAGUE_KICKOFF + HOUR_MS);
  return t.mutation(internal.stats.liveStats.upsertLive, { fixtureCode: HULL_EVERTON, minute, records });
}

/** The match's records as the full-time read lands them: complete, its corrections window open. */
export async function fullTimeRecords({ t }: ScoresLeague, records: PlayerMatchRecord[] = mergedHullEverton()) {
  vi.setSystemTime(LEAGUE_FULL_TIME_READ);
  await t.mutation(internal.stats.matchStats.upsertMatch, { fixtureCode: HULL_EVERTON, readAt: LEAGUE_FULL_TIME_READ, records });
}

type MatchState = Infer<typeof matchState>;
/** The match's score as the Premier League's feed reads it: `state`, the minute on its clock, and
 *  its label for it, if any. */
export async function scoreRead({ t }: ScoresLeague, state: MatchState, minutes: number, fixtureCode: number = HULL_EVERTON, clockLabel: string | null = null) {
  await t.mutation(internal.football.matchScores.upsertScores, {
    feed: "pl",
    readAt: Date.now(),
    reads: [{ fixtureCode, state, homeGoals: 1, awayGoals: 2, minutes, clockLabel }],
  });
}

/** The corrections window passes and the match locks. */
export const lockMatch = ({ t }: ScoresLeague) => elapse(t, 2 * HOUR_MS);

/** A score no team made, written over a stored one to tell a stored read from a worked-out one. */
export const WRITTEN_OVER = 99;

/** The league stores its newly final gameweeks, as a match's lock asks it to. */
export const storeLeague = ({ t, leagueId }: ScoresLeague) => t.mutation(internal.table.finalScores.storeLeague, { leagueId });

/** Ann's stored row says WRITTEN_OVER. */
export const writeOverAnns = (league: ScoresLeague) =>
  league.t.run(async (ctx) => {
    const row = (await ctx.db.query("finalScores").collect()).find((each) => each.teamId === league.annsTeam)!;
    await ctx.db.patch("finalScores", row._id, { points: WRITTEN_OVER });
  });

/** A match the football sync moves into gameweek 6 after it was stored, between two clubs no squad
 *  here holds: the table's stored scores and the stat race's shares both reopen for it. */
export const MOVED_IN = 999_001;
const MOVED_IN_CLUBS = [901, 902] as const;
/** The moved-in match held in gameweek 6, as the football sync would put it there. */
export const holdMovedIn = ({ t }: ScoresLeague) =>
  t.run((ctx) =>
    ctx.db.insert("fixtures", { code: MOVED_IN, gameweek: GAMEWEEK, homeClubCode: MOVED_IN_CLUBS[0], awayClubCode: MOVED_IN_CLUBS[1], kickoff: Date.now() }),
  );
/** The moved-in match read at full time, its window passed and locked. */
export const lockMovedIn = ({ t }: ScoresLeague) =>
  t.run((ctx) => ctx.db.insert("matchStatsStatus", { fixtureCode: MOVED_IN, state: "locked", fullTimeAt: Date.now(), lockedAt: Date.now(), lastReadAt: Date.now() }));
