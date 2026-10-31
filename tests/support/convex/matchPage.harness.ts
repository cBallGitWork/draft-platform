// The match page's backend tests' league (#45, #771; spec/10, The match page): Hull v Everton, Ann
// owning Hull's men and Bob Everton's, each with a saved lineup, and how the tests read the page.

import { api } from "../../../convex/_generated/api";
import type { MatchMan } from "../../../convex/match/matchPage";
import { fullTimeRecords, holdHullAndEverton, HULL_SCORER, scoresLeague, type ScoresLeague } from "./gameweekScores.harness";
import { actingAs } from "./leagues.harness";
import { HULL_EVERTON } from "./matchStats.harness";

/** The scores league, with both clubs held, as the football sync holds them. */
export async function matchLeague(): Promise<ScoresLeague> {
  const league = await scoresLeague();
  await holdHullAndEverton(league);
  return league;
}

export async function matchAs(league: ScoresLeague, email: string, fixtureCode: number = HULL_EVERTON) {
  return (await actingAs(league.t, email)).query(api.match.matchPage.ofMatch, { leagueId: league.leagueId, fixtureCode });
}

/** One commentary line naming `playerCodes`, as the live tick stores it. */
export const storedLine = (sourceId: number, text: string, minute: number | null, type: string, playerCodes: number[] = []) => ({ sourceId, text, minute, addedMinute: 0, type, playerCodes });

/** Hull v Everton's commentary as just these `lines`, newest first, not delayed. */
export const holdLines = ({ t }: ScoresLeague, lines: ReturnType<typeof storedLine>[]) =>
  t.run((ctx) => ctx.db.insert("matchCommentary", { fixtureCode: HULL_EVERTON, lines, delayed: null }));

export const manOf =(men: readonly MatchMan[], playerCode: number) => men.find((man) => man.playerCode === playerCode)!;

/** The league as before its gameweek's deadline: no gameweek recorded as begun. */
export const notYetBegun = ({ t }: ScoresLeague) =>
  t.run(async (ctx) => {
    for (const row of await ctx.db.query("passedDeadlines").collect()) await ctx.db.delete("passedDeadlines", row._id);
  });

/** The match at full time, Hull's scorer taken out of every squad, so no lineup holds him at the
 *  deadline: a free agent. */
export async function scorerFreeLeague(): Promise<ScoresLeague> {
  const league = await matchLeague();
  await fullTimeRecords(league);
  await league.t.run(async (ctx) => {
    const owned = (await ctx.db.query("squadPlayers").collect()).find((row) => row.playerCode === HULL_SCORER)!;
    await ctx.db.delete("squadPlayers", owned._id);
  });
  return league;
}
