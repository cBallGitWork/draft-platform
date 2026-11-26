import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type MutationCtx, type QueryCtx } from "../_generated/server";
import type { DeadlineOf } from "../gameweeks/deadline";
import { deadlineOf, leagueDeadlines } from "../gameweeks/leagueDeadlines";
import { seasonGameweekCount } from "../gameweeks/seasonGameweeks";
import { scoredGameweeksOf } from "../gameweeks/usedGameweeks";
import { fileLetter, wholeLeague } from "../mail/letters";
import { gameModeOf } from "../rules/gameMode";
import type { LeagueRules } from "../rules/leagueRulesShape";
import type { SeasonRules } from "../rules/rulesHistory";
import { LOCALE, LONDON_ZONE } from "../shared/moments";
import { takeAllOrThrow } from "../shared/cappedRead";
import { managerOf, teamsOf } from "../shared/leagueAccess";
import { managerOfTheMonthLetter } from "./awardWords";
import { startPlayerOfTheSeason } from "./playerOfTheSeason";
import { scheduleOf } from "./playedFixtures";
import type { GameweekFixtures } from "./roundRobin";
import { pointsOf, type Results } from "./sentTables";
import { headToHeadTable, totalPointsTable, type GameweekScores, type TieBreak } from "./standings";

// Manager of the Month (spec/09, Awards; #2677): the team with the most points over the gameweeks
// that start in a month (S09.5), a gameweek's start its league deadline (deadline.ts) and its month
// the one that falls in on UK time (S09.10). Teams level are split by the league's table tie-breaks,
// in its order, counting only that month's gameweeks (S09.6, S09.9). A month in which no gameweek
// starts has no award and sends nothing (S09.7). It is awarded once its gameweeks are all final and
// the month is over: the league's next gameweek starts in a later month, or it has none. Stored in
// `awards`, so it is awarded and Mailed once, and a score changed after never awards it again.
// Player of the Season is playerOfTheSeason.ts's, started here once the league's season is final.

const LONDON_MONTH = new Intl.DateTimeFormat(LOCALE, { timeZone: LONDON_ZONE, year: "numeric", month: "2-digit" });

/** The month `at` falls in on UK time, as "2026-10", whatever the clocks (S09.10). */
export function monthOf(at: number): string {
  const parts = LONDON_MONTH.formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((each) => each.type === type)!.value;
  return `${part("year")}-${part("month")}`;
}

/** A month and the league's gameweeks that start in it, in order. */
export type AwardMonth = { month: string; gameweeks: number[] };

/** The months ready to award among those holding one of `touched`, the gameweeks newly final: each
 *  of its gameweeks final, and the league's next gameweek after them starting in a later month, or
 *  none left. A gameweek with no deadline yet starts in no month known; one after a month's last
 *  holds it until it has one. */
export function monthsToAward(
  gameweeks: readonly number[],
  deadlineIn: DeadlineOf,
  isFinal: (gameweek: number) => boolean,
  touched: readonly number[],
): AwardMonth[] {
  const months = new Map<string, number[]>();
  for (const gameweek of gameweeks) {
    const deadline = deadlineIn(gameweek);
    if (deadline === null) continue;
    const month = monthOf(deadline);
    months.set(month, [...(months.get(month) ?? []), gameweek]);
  }
  return [...months]
    .filter(([month, inMonth]) => {
      if (!inMonth.some((gameweek) => touched.includes(gameweek)) || !inMonth.every(isFinal)) return false;
      const next = gameweeks.find((gameweek) => gameweek > inMonth.at(-1)!);
      if (next === undefined) return true;
      const nextDeadline = deadlineIn(next);
      return nextDeadline !== null && monthOf(nextDeadline) !== month;
    })
    .map(([month, inMonth]) => ({ month, gameweeks: inMonth }));
}

/** The month's Manager of the Month and their points for over `gameweeks`, the month's: the most
 *  points (the fewest, where the lower score wins), level teams split by `tieBreaks` over the
 *  month's games alone, any still level after the last in the league's order. Null with no
 *  gameweek of the month scored, or no team. Pure. */
export function managerOfTheMonth<Team>(
  format: LeagueRules["format"],
  teams: readonly Team[],
  schedule: readonly GameweekFixtures<Team>[],
  scores: GameweekScores<Team>,
  tieBreaks: readonly TieBreak[],
  gameweeks: readonly number[],
): { team: Team; points: number } | null {
  const monthScores = new Map([...scores].filter(([gameweek]) => gameweeks.includes(gameweek)));
  if (monthScores.size === 0 || teams.length === 0) return null;
  const mode = gameModeOf({ format });
  const monthSchedule = schedule.filter((drawn) => gameweeks.includes(drawn.gameweek));
  const [top] = mode.hasMatchups
    ? headToHeadTable(mode, teams, monthSchedule, monthScores, tieBreaks, (row) => (mode.higherWins ? row.pointsFor : -row.pointsFor))
    : totalPointsTable(mode, teams, monthScores);
  return { team: top.team, points: top.pointsFor };
}

/** Gives the awards the gameweeks just stored final make ready (finalScores.ts), from `results`,
 *  every gameweek of the league's season scored, begun or not: each month's, and once every one of
 *  the league's gameweeks is final, the season's Player of the Season. An award given already is
 *  left as it is. */
export async function giveAwards(
  ctx: MutationCtx,
  league: Doc<"leagues">,
  season: SeasonRules,
  results: Results,
  stored: readonly number[],
): Promise<void> {
  if (stored.length === 0) return;
  const gameweeks = scoredGameweeksOf(league, await seasonGameweekCount(ctx));
  const isFinal = (gameweek: number) => {
    const scored = results.get(gameweek);
    return scored !== undefined && [...scored.values()].every((total) => !total.provisional);
  };
  await awardMonths(ctx, league, season, results, gameweeks, isFinal, stored);
  if (gameweeks.length > 0 && gameweeks.every(isFinal)) await startPlayerOfTheSeason(ctx, league._id, gameweeks);
}

/** Awards each month made ready by the gameweeks just `stored` final, and Mails the whole league. */
async function awardMonths(
  ctx: MutationCtx,
  league: Doc<"leagues">,
  season: SeasonRules,
  results: Results,
  gameweeks: readonly number[],
  isFinal: (gameweek: number) => boolean,
  stored: readonly number[],
): Promise<void> {
  const deadlineIn = deadlineOf(await leagueDeadlines(ctx, league._id));
  for (const { month, gameweeks: inMonth } of monthsToAward(gameweeks, deadlineIn, isFinal, stored)) {
    if ((await awardOf(ctx, league._id, month)) !== null) continue;
    const teams = await teamsOf(ctx, league._id);
    const rules = season.latest;
    const schedule = gameModeOf(rules).hasMatchups ? await scheduleOf(ctx, league, season) : [];
    const { tieBreaks } = season.sinceBegun(inMonth.at(-1)!);
    const teamIds = teams.map((team) => team._id);
    const winner = managerOfTheMonth(rules.format, teamIds, schedule, pointsOf(results), tieBreaks, inMonth);
    if (winner === null) continue;
    await ctx.db.insert("awards", { leagueId: league._id, month, teamId: winner.team, points: winner.points, awardedAt: Date.now() });
    const teamName = teams.find((team) => team._id === winner.team)!.name;
    await fileLetter(ctx, league, "league", await wholeLeague(ctx, league), managerOfTheMonthLetter(teamName, month, winner.points));
  }
}

const awardOf = (ctx: MutationCtx, leagueId: Id<"leagues">, month: string) =>
  ctx.db
    .query("awards")
    .withIndex("by_leagueId_and_month", (q) => q.eq("leagueId", leagueId).eq("month", month))
    .unique();

/** The most awards one team's page reads: ten seasons of a month each. Past it the read throws. */
const TEAM_AWARDS_MOST = 120;

/** The months a team was Manager of the Month in, as "2026-10", oldest first: what its page lists
 *  (S09.8). */
export async function awardsOfTeam(ctx: QueryCtx, teamId: Id<"teams">): Promise<string[]> {
  const awards = await takeAllOrThrow(
    ctx.db.query("awards").withIndex("by_teamId_and_month", (q) => q.eq("teamId", teamId)),
    TEAM_AWARDS_MOST,
    `A team holds more than ${TEAM_AWARDS_MOST} awards, so its page would leave some out`,
  );
  return awards.flatMap((award) => ("month" in award ? [award.month] : []));
}

/** The awards the caller's own team has won, for My team's header band (S09.8). */
export const ofMyTeam = query({
  args: { leagueId: v.id("leagues") },
  returns: v.array(v.string()),
  handler: async (ctx, { leagueId }) => awardsOfTeam(ctx, (await managerOf(ctx, leagueId)).team._id),
});
