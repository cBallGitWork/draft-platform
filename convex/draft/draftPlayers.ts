import { v, type Infer } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { positionsNow } from "../positions/playerPositions";
import { ASSISTS, CLEAN_SHEETS, GOALS } from "../scoring/statKeys";
import { memberOf, runnerOf } from "../shared/leagueAccess";
import { newestSeasonWithTotals, seasonTotals } from "../stats/seasonStats";
import type { Stats } from "../stats/statTotals";
import { autoPickOrder } from "./autoPickOrder";
import { whyNotLegalFor } from "./draftPicks";
import { everyPlayerNow, undraftedIn } from "./undrafted";
import { draftRanking } from "./draftRanking";
import { notLegal } from "./legalPlayers";
import { draftOf, picksLeftOf, turnNow, type Turn } from "./draftRow";
import { lastPricedSeason, lastSeasonPoints } from "../pastSeasons/lastSeasonPoints";

// The draft room's players list's figures (spec/04, The draft room; #1099). The list itself is
// Scouting's (../scouting/playersList.ts); beside it:
// - its legal flag: which players the reader's team can't take as its next pick, and why, so the
//   list greys them out in their place ("yes" to Claude's recommendation, 4 Nov 2026) and his Draft
//   button can't be pressed. The rule is the pick's own (draftPicks.ts `whyNotLegalFor`,
//   legalPlayers.ts), so the list and the pick never disagree; and for the commissioner, the same
//   for the team on the clock, which his "Pick for <team>" is greyed by (#1475);
// - each player's place on the site's ranking, last season's points and the overview's stats, as
//   the approved draft room picture's columns have them.

const greyedPlayer = v.object({ code: v.number(), reason: notLegal });
export type GreyedPlayer = Infer<typeof greyedPlayer>;

/** Every Premier League player now whom the caller's team may not take as its next pick, with why,
 *  while the draft is live. None before it starts, once it is over, or for a commissioner who runs
 *  no team. Players already drafted are listed too, as the rule says; the list shows them as taken.
 *  Refused to anyone outside the league. */
export const greyedOut = query({
  args: { leagueId: v.id("leagues") },
  returns: v.array(greyedPlayer),
  handler: async (ctx, { leagueId }) => {
    const { team } = await memberOf(ctx, leagueId);
    return team ? await greyedFor(ctx, leagueId, () => team._id) : [];
  },
});

/** Every Premier League player now whom the team on the clock may not take, with why: the
 *  commissioner's "Pick for <team>" is greyed by that team's squad rules, not his own (Craig, 5 Nov
 *  2026, on #1101). None before the draft starts or once it is over. Refused to anyone who doesn't
 *  run the league. */
export const greyedOnTheClock = query({
  args: { leagueId: v.id("leagues") },
  returns: v.array(greyedPlayer),
  handler: async (ctx, { leagueId }) => {
    await runnerOf(ctx, leagueId);
    return await greyedFor(ctx, leagueId, (turn) => turn.team);
  },
});

/** The players the team `teamOf` names may not take as its next pick, with why, while the draft is
 *  live; none before it starts or once it is over. */
async function greyedFor(ctx: QueryCtx, leagueId: Id<"leagues">, teamOf: (turn: Turn) => Id<"teams">): Promise<GreyedPlayer[]> {
  const draft = await draftOf(ctx, leagueId);
  const started = draft?.started;
  const turn = draft === null ? null : await turnNow(ctx, draft);
  if (draft === null || started === undefined || turn === null) return [];
  const teamId = teamOf(turn);
  const picksLeft = await picksLeftOf(ctx, draft, started, teamId);
  const players = await everyPlayerNow(ctx);
  const why = await whyNotLegalFor(ctx, leagueId, started, teamId, picksLeft, await undraftedIn(ctx, leagueId, players), await positionsNow(ctx, leagueId));
  const greyed = await Promise.all(players.map(async (player) => ({ code: player.code, reason: await why(player) })));
  return greyed.flatMap(({ code, reason }) => (reason === null ? [] : [{ code, reason }]));
}

/** The draft room's overview (spec/04, The draft room: "a easy to see view first"; the approved
 *  picture's MP, G, A and CS): each by the catalogue stat's key whose season total it shows. */
const OVERVIEW_STATS = { appearances: "appearances", goals: GOALS, assists: ASSISTS, cleanSheets: CLEAN_SHEETS } as const;
export type OverviewStat = keyof typeof OVERVIEW_STATS;

const overview = v.object({ appearances: v.number(), goals: v.number(), assists: v.number(), cleanSheets: v.number() });

const roomFigure = v.object({
  code: v.number(),
  /** Where he stands on the site's ranking, 1 the best: the admin's ranking, then last season's
   *  points, then newcomers by name, as auto-pick takes them (autoPickOrder.ts). */
  rank: v.number(),
  /** His points in `lastSeason` under the site's scoring now, or null for a newcomer. */
  lastSeasonPoints: v.union(v.number(), v.null()),
  /** His season totals of the overview's stats, in the season Scouting shows (seasonStats.ts). */
  overview,
});
export type RoomFigure = Infer<typeof roomFigure>;

const roomFigures = v.object({
  players: v.array(roomFigure),
  /** The season his points are from, by the year it starts, or null while none is priced. */
  lastSeason: v.union(v.number(), v.null()),
  /** The season the overview's totals are from, by the year it starts, or null while none is held. */
  statsSeason: v.union(v.number(), v.null()),
});
export type RoomFigures = Infer<typeof roomFigures>;

/** No queue and no do-not-draft list: the site's ranking alone. */
const NO_LISTS = { queue: [], doNotDraft: [] };

/** A player's season totals of the overview's stats, 0 for one he has none of. */
const overviewOf = (stats: Stats): RoomFigure["overview"] => {
  const of = (stat: OverviewStat) => stats[OVERVIEW_STATS[stat]] ?? 0;
  return { appearances: of("appearances"), goals: of("goals"), assists: of("assists"), cleanSheets: of("cleanSheets") };
};

/** The draft room's figures for every Premier League player now: his place on the site's ranking,
 *  last season's points and the overview's season totals. It reads nothing a pick or the clock
 *  writes, so neither runs it again: the club maximum, which needs the draft's row, is the board's
 *  (draftBoard.ts; #1537). Refused to anyone outside the league. */
export const figures = query({
  // No minute: one would reload the room's figures as the minute turns (#1531).
  args: { leagueId: v.id("leagues") },
  returns: roomFigures,
  handler: async (ctx, { leagueId }) => {
    await memberOf(ctx, leagueId);
    const players = await everyPlayerNow(ctx);
    const points = await lastSeasonPoints(ctx, await positionsNow(ctx, leagueId));
    const ranked = (await draftRanking(ctx))?.players.map(({ code }) => code) ?? [];
    const rankOf = new Map(autoPickOrder(players, NO_LISTS, ranked, points).map((code, index) => [code, index + 1]));
    const season = await newestSeasonWithTotals(ctx);
    const totals = season === null ? new Map<number, Stats>() : await seasonTotals(ctx, season);
    return {
      players: players.map(({ code }) => ({
        code,
        rank: rankOf.get(code)!,
        lastSeasonPoints: points.get(code) ?? null,
        overview: overviewOf(totals.get(code) ?? {}),
      })),
      lastSeason: await lastPricedSeason(ctx),
      statsSeason: season,
    };
  },
});
