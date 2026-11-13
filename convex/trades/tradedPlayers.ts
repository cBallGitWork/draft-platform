import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { PositionsNow } from "../positions/playerPositions";
import { clubRecord, position } from "../schema";
import { playerByCode, type Clubs } from "../shared/players";
import { unheldTradedWords } from "./tradeWords";

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

/** A pick trade's picks, each as its letters name it; null for a players' trade. */
export const namedPicks = v.union(v.object({ gives: v.string(), gets: v.string() }), v.null());

/** The name of team `teamId`, from the league's teams: one an offer names is always there, so
 *  missing, it throws, `what` naming the row that named it. */
export function teamNameIn(teams: readonly Doc<"teams">[], teamId: Id<"teams">, what: string): string {
  const team = teams.find((each) => each._id === teamId);
  if (team === undefined) throw new Error(`${what} names team ${teamId}, which isn't in its league`);
  return team.name;
}

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

/** A traded player as the screen shows him: an offer names only players the sync holds (tradeWords.ts). */
export async function tradedShown(
  ctx: QueryCtx,
  code: number,
  positionsOf: PositionsNow,
  clubOf: Clubs,
): Promise<TradedPlayer> {
  const shown = await shownPlayer(ctx, code, positionsOf, clubOf);
  if (shown === null) throw new Error(unheldTradedWords(code));
  return shown;
}
