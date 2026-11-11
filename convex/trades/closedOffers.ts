import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { closedWhy } from "../schema";
import { seasonStartAt } from "../shared/time";
import { pickName } from "./tradeWords";
import { namedPicks, teamNameIn, tradedPlayer, type TradedPlayer } from "./tradedPlayers";

// The Trades screen's Closed offers (#383; docs/design/approved/trades: "Closed offers lists
// rejected, countered, withdrawn and closed ones this season"): the manager's team's offers that
// ended this season without going through, newest first. tradeClose.ts `endOffer` keeps them.

/** The most closed offers the screen shows, to and from the team together: Claude's sizing, as
 *  Older shows only this season's. Past it the oldest are left out, and the read logs so. */
export const CLOSED_READ_MOST = 50;

export const closedOffer = v.object({
  closedId: v.id("closedTradeOffers"),
  fromTeamId: v.id("teams"),
  fromTeamName: v.string(),
  toTeamId: v.id("teams"),
  toTeamName: v.string(),
  gives: v.array(tradedPlayer),
  gets: v.array(tradedPlayer),
  picks: namedPicks,
  closedAt: v.number(),
  why: closedWhy,
});
export type ClosedOffer = Infer<typeof closedOffer>;

/** The team's offers that closed since the season `now` falls in began, newest first. `shown`
 *  shows a player as the screen does. */
export async function closedOffersOf(
  ctx: QueryCtx,
  teamId: Id<"teams">,
  teams: readonly Doc<"teams">[],
  now: number,
  shown: (code: number) => Promise<TradedPlayer>,
): Promise<ClosedOffer[]> {
  const since = seasonStartAt(now);
  const [from, to] = await Promise.all([
    ctx.db
      .query("closedTradeOffers")
      .withIndex("by_fromTeamId_and_closedAt", (q) => q.eq("fromTeamId", teamId).gte("closedAt", since))
      .order("desc")
      .take(CLOSED_READ_MOST + 1),
    ctx.db
      .query("closedTradeOffers")
      .withIndex("by_toTeamId_and_closedAt", (q) => q.eq("toTeamId", teamId).gte("closedAt", since))
      .order("desc")
      .take(CLOSED_READ_MOST + 1),
  ]);
  const all = [...from, ...to].sort((one, other) => other.closedAt - one.closedAt);
  if (all.length > CLOSED_READ_MOST) {
    console.warn(`Team ${teamId} has over ${CLOSED_READ_MOST} closed trade offers this season: the oldest aren't shown`);
  }
  const rows = all.slice(0, CLOSED_READ_MOST);
  return Promise.all(
    rows.map(async (row) => ({
      closedId: row._id,
      fromTeamId: row.fromTeamId,
      fromTeamName: teamNameIn(teams, row.fromTeamId, `Closed trade offer ${row._id}`),
      toTeamId: row.toTeamId,
      toTeamName: teamNameIn(teams, row.toTeamId, `Closed trade offer ${row._id}`),
      gives: await Promise.all(row.gives.map(shown)),
      gets: await Promise.all(row.gets.map(shown)),
      picks:
        row.picks === undefined
          ? null
          : { gives: await pickName(ctx, row.picks.gives), gets: await pickName(ctx, row.picks.gets) },
      closedAt: row.closedAt,
      why: row.why,
    })),
  );
}
