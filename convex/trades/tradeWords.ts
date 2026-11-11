import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { pickWords, type TradeWords } from "../mail/tradeLetterWords";
import type { TradedSide } from "../schema/squads";
import { heldPlayerByCode } from "../shared/players";
import type { TradePick } from "./tradePicks";

// A trade as its letters name it (spec/08 Trades; #383): its teams, players and picks by name, and
// who its letters go to. Split from tradeClose.ts, which closes offers.

/** The log line for an offer naming a player the football sync doesn't hold. */
export const unheldTradedWords = (playerCode: number) => `A trade offer names player ${playerCode}, whom the football sync doesn't hold`;

/** A player's name, as a trade's letters name him: an offer names only players the football sync
 *  holds, and it never deletes one. */
export async function tradedName(ctx: QueryCtx, playerCode: number): Promise<string> {
  return (await heldPlayerByCode(ctx, playerCode, unheldTradedWords(playerCode))).name;
}

/** A trade as its letters read it: an offer, or a pick trade that went through (tradePicks.ts). */
type TradeTerms = Pick<Doc<"tradeOffers">, "fromTeamId" | "toTeamId" | "gives" | "gets" | "picks" | "note">;

/** The offer as its letters name it. */
export async function tradeWordsOf(ctx: QueryCtx, offer: TradeTerms): Promise<TradeWords> {
  const [from, to] = await Promise.all([ctx.db.get("teams", offer.fromTeamId), ctx.db.get("teams", offer.toTeamId)]);
  if (from === null || to === null) throw new Error(`A trade between teams ${offer.fromTeamId} and ${offer.toTeamId} names a team that no longer exists`);
  const { picks } = offer;
  if (picks !== undefined) {
    const [gives, gets] = await Promise.all([pickName(ctx, picks.gives), pickName(ctx, picks.gets)]);
    return { fromTeamName: from.name, toTeamName: to.name, gives: [gives], gets: [gets], note: offer.note ?? null };
  }
  return {
    fromTeamName: from.name,
    toTeamName: to.name,
    gives: await Promise.all(offer.gives.map((code) => tradedName(ctx, code))),
    gets: await Promise.all(offer.gets.map((code) => tradedName(ctx, code))),
    note: offer.note ?? null,
  };
}

/** A draft pick in a trade (#1096), as its letters name it: by the team whose pick it is. */
export async function pickName(ctx: QueryCtx, pick: TradePick): Promise<string> {
  const { round, teamName } = await namedPick(ctx, pick);
  return pickWords(round, teamName);
}

/** A draft pick in a trade with the name of the team whose pick it is. */
async function namedPick(ctx: QueryCtx, pick: TradePick) {
  const team = await ctx.db.get("teams", pick.teamId);
  if (team === null) throw new Error(`A trade offer names a pick of team ${pick.teamId}, which no longer exists`);
  return { round: pick.round, teamId: pick.teamId, teamName: team.name };
}

/** One side of a trade as its `tradeMade` event names it (#1491): its players, and its pick, if any. */
export async function tradedSideOf(ctx: QueryCtx, playerCodes: readonly number[], pick: TradePick | undefined): Promise<TradedSide> {
  return {
    players: await Promise.all(playerCodes.map(async (playerCode) => ({ playerCode, playerName: await tradedName(ctx, playerCode) }))),
    picks: pick === undefined ? [] : [await namedPick(ctx, pick)],
  };
}

/** Both teams' managers, by email: those a trade's own letters go to. */
export async function managersOf(ctx: QueryCtx, offer: Pick<TradeTerms, "fromTeamId" | "toTeamId">): Promise<string[]> {
  const teams = await Promise.all([ctx.db.get("teams", offer.fromTeamId), ctx.db.get("teams", offer.toTeamId)]);
  return teams.flatMap((team) => team?.managerEmail ?? []);
}

/** The league, which a trade's letters are filed in the name of. */
export async function leagueOf(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Doc<"leagues">> {
  const league = await ctx.db.get("leagues", leagueId);
  if (league === null) throw new Error(`League ${leagueId} doesn't exist, so its trade letters can't be filed`);
  return league;
}
