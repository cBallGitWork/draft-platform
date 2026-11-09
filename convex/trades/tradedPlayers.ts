import { v, type Infer } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { PositionsNow } from "../positions/playerPositions";
import { clubRecord, position } from "../schema";
import { playerByCode, type Clubs } from "../shared/players";

// A player in a trade as the Trades screen shows him (#383; docs/design/approved/trades): name,
// main position and club only. Split from tradeScreen.ts, so its open offers and closedOffers.ts's
// closed ones show him alike.

export const tradedPlayer = v.object({
  code: v.number(),
  name: v.string(),
  /** His main position now; null while no feed has named one. */
  position: v.union(position, v.null()),
  club: clubRecord,
});
export type TradedPlayer = Infer<typeof tradedPlayer>;

/** A player as the screen shows him; null for one the football sync doesn't hold. */
export async function shownPlayer(
  ctx: QueryCtx,
  code: number,
  positionsOf: PositionsNow,
  clubOf: Clubs,
): Promise<TradedPlayer | null> {
  const player = await playerByCode(ctx, code);
  if (player === null) return null;
  return {
    code,
    name: player.name,
    position: (await positionsOf(code))[0] ?? null,
    club: await clubOf(player.clubCode),
  };
}

/** A traded player as the screen shows him: an offer names only players the sync holds (tradeClose.ts). */
export async function tradedShown(
  ctx: QueryCtx,
  code: number,
  positionsOf: PositionsNow,
  clubOf: Clubs,
): Promise<TradedPlayer> {
  const shown = await shownPlayer(ctx, code, positionsOf, clubOf);
  if (shown === null)
    throw new Error(
      `A trade offer names player ${code}, whom the football sync doesn't hold`,
    );
  return shown;
}
