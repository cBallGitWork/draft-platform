import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { closedWhy } from "../schema/trades";
import { seasonStartAt } from "../shared/time";
import { pickName } from "./tradeClose";
import { tradedPlayer, type TradedPlayer } from "./tradedPlayers";

// The Trades screen's Closed offers (#383; docs/design/approved/trades: "Closed offers lists
// rejected, countered, withdrawn and closed ones this season"): the manager's team's offers that
// ended this season without going through, newest first. tradeClose.ts `endOffer` keeps them.

/** The most closed offers the screen reads each way, to and from the team: Claude's sizing, as
 *  Older shows only this season's. */
export const CLOSED_READ_MOST = 50;

export const closedOffer = v.object({
  closedId: v.id("closedTradeOffers"),
  fromTeamId: v.id("teams"),
  fromTeamName: v.string(),
  toTeamId: v.id("teams"),
  toTeamName: v.string(),
  gives: v.array(tradedPlayer),
  gets: v.array(tradedPlayer),
  /** A pick trade's picks, each as its letters name it; null for a players' trade. */
  picks: v.union(v.object({ gives: v.string(), gets: v.string() }), v.null()),
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
      .take(CLOSED_READ_MOST),
    ctx.db
      .query("closedTradeOffers")
      .withIndex("by_toTeamId_and_closedAt", (q) => q.eq("toTeamId", teamId).gte("closedAt", since))
      .order("desc")
      .take(CLOSED_READ_MOST),
  ]);
  const rows = [...from, ...to]
    .sort((one, other) => other.closedAt - one.closedAt)
    .slice(0, CLOSED_READ_MOST);
  const nameOf = (row: Doc<"closedTradeOffers">, id: Id<"teams">) => {
    const team = teams.find((each) => each._id === id);
    if (team === undefined) throw new Error(`Closed trade offer ${row._id} names team ${id}, which isn't in its league`);
    return team.name;
  };
  return Promise.all(
    rows.map(async (row) => ({
      closedId: row._id,
      fromTeamId: row.fromTeamId,
      fromTeamName: nameOf(row, row.fromTeamId),
      toTeamId: row.toTeamId,
      toTeamName: nameOf(row, row.toTeamId),
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
