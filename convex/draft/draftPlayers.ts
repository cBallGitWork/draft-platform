import { v, type Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { positionsNow } from "../positions/playerPositions";
import { latestRules } from "../rules/rulesHistory";
import { memberOf } from "../shared/leagueAccess";
import { currentClubs, currentPlayersAt } from "../shared/players";
import { squadOf } from "../squads/squadPlace";
import { newestSeasonWithTotals, seasonTotals } from "../stats/seasonStats";
import type { Stats } from "../stats/statTotals";
import { autoPickOrder } from "./autoPickOrder";
import { squadRulesOf, undraftedIn, whyNotLegalFor } from "./draftPicks";
import { draftRanking } from "./draftRanking";
import { draftOf, turnNow } from "./draftRow";
import { lastPricedSeason, lastSeasonPoints } from "./lastSeasonPoints";

// The draft room's players list's figures (spec/04, The draft room; #1099). The list itself is
// Scouting's (../scouting/playersList.ts); beside it:
// - its legal flag: which players the reader's team can't take as its next pick, and why, so the
//   list greys them out in their place ("yes" to Claude's recommendation, 4 Nov 2026) and his Draft
//   button can't be pressed. The rule is the pick's own (draftPicks.ts `whyNotLegalFor`,
//   legalPlayers.ts), so the list and the pick never disagree;
// - each player's place on the site's ranking, last season's points and the overview's stats, as
//   the approved draft room picture's columns have them.

const notLegal = v.union(v.literal("squadFull"), v.literal("clubFull"), v.literal("areasShort"), v.literal("noFinish"));

const greyedPlayer = v.object({ code: v.number(), reason: notLegal });
export type GreyedPlayer = Infer<typeof greyedPlayer>;

/** Every Premier League player now. */
async function everyPlayerNow(ctx: QueryCtx): Promise<Doc<"players">[]> {
  return (await Promise.all((await currentClubs(ctx)).map(({ code }) => currentPlayersAt(ctx, code)))).flat();
}

/** Every Premier League player now whom the caller's team may not take as its next pick, with why,
 *  while the draft is live. None before it starts, once it is over, or for a commissioner who runs
 *  no team. Players already drafted are listed too, as the rule says; the list shows them as taken.
 *  Refused to anyone outside the league. */
export const greyedOut = query({
  args: { leagueId: v.id("leagues") },
  returns: v.array(greyedPlayer),
  handler: async (ctx, { leagueId }) => {
    const { team } = await memberOf(ctx, leagueId);
    const draft = await draftOf(ctx, leagueId);
    const started = draft?.started;
    if (!team || draft === null || started === undefined || (await turnNow(ctx, draft)) === null) return [];
    // Squads are empty when the draft starts (spec/04, The picks), so each player in it is a pick made.
    const picksLeft = started.rounds - (await squadOf(ctx, team._id)).length;
    const why = await whyNotLegalFor(ctx, leagueId, started, team._id, picksLeft, await undraftedIn(ctx, leagueId));
    const players = await everyPlayerNow(ctx);
    const greyed = await Promise.all(players.map(async (player) => ({ code: player.code, reason: await why(player) })));
    return greyed.flatMap(({ code, reason }) => (reason === null ? [] : [{ code, reason }]));
  },
});

/** The draft room's overview (spec/04, The draft room: "a easy to see view first"; the approved
 *  picture's MP, G, A and CS): each by the catalogue stat's key whose season total it shows. */
export const OVERVIEW_STATS = { appearances: "appearances", goals: "goals_scored", assists: "assists", cleanSheets: "clean_sheets" } as const;
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
  /** The most players of one club a squad may hold under the rules the draft picks by: those it
   *  started under, or before it starts the league's latest, which it would start under; null for
   *  no limit. */
  maxPerClub: v.union(v.number(), v.null()),
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
 *  last season's points and the overview's season totals; and the club maximum the panel counts a
 *  squad against. No pick moves any of it, so a pick doesn't run it again. Refused to anyone
 *  outside the league. */
export const figures = query({
  // `now`, the screen's minute, no longer moves anything here: it stays until the draft room's seam
  // drops it, as that screen's change.
  args: { leagueId: v.id("leagues"), now: v.number() },
  returns: roomFigures,
  handler: async (ctx, { leagueId }) => {
    await memberOf(ctx, leagueId);
    const players = await everyPlayerNow(ctx);
    const points = await lastSeasonPoints(ctx, await positionsNow(ctx, leagueId));
    const ranked = (await draftRanking(ctx))?.players.map(({ code }) => code) ?? [];
    const rankOf = new Map(autoPickOrder(players, NO_LISTS, ranked, points).map((code, index) => [code, index + 1]));
    const season = await newestSeasonWithTotals(ctx);
    const totals = season === null ? new Map<number, Stats>() : await seasonTotals(ctx, season);
    const started = (await draftOf(ctx, leagueId))?.started;
    const squadRules = started === undefined ? (await latestRules(ctx, leagueId))?.squad : await squadRulesOf(ctx, leagueId, started);
    return {
      players: players.map(({ code }) => ({
        code,
        rank: rankOf.get(code)!,
        lastSeasonPoints: points.get(code) ?? null,
        overview: overviewOf(totals.get(code) ?? {}),
      })),
      lastSeason: await lastPricedSeason(ctx),
      statsSeason: season,
      maxPerClub: squadRules?.maxPerClub ?? null,
    };
  },
});
