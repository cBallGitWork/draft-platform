// How Trades' New offer starts (#383): empty, filled with the offer a counter answers, or, from a
// player card's Offer a trade, with his owner chosen and him asked for (#1027).

import type { Id } from "../../convex/_generated/dataModel";
import { sidesOf } from "./offerSides";
import type { TradePick, TradesView } from "./seam";

/** From a player card: the team to trade with, and their player asked for. */
export type Asked = { team?: Id<"teams">; player?: number };

/** How the offer starts: the team to trade with, the codes ticked on each side, and a pick ticked
 *  each way for a counter to a pick offer (#1471). */
export type Start = {
  teamId: Id<"teams">;
  gives: number[];
  gets: number[];
  givePick?: TradePick | null;
  getPick?: TradePick | null;
};

/** The offer to the manager that a counter answers, from his side, as the offer starts. */
export type Countered = Start & { offerId: Id<"tradeOffers"> };

/** The offer `offerId` as a counter starts, or null for a new offer, or one he can't counter. A
 *  player or pick held in a trade under review is left out, as from a card (#1483). A pick offer
 *  starts with its picks ticked from his side (#1471). */
export function counterOf(view: TradesView, offerId: Id<"tradeOffers"> | undefined): Countered | null {
  const offer = view.offers.find((each) => each.offerId === offerId);
  if (offer === undefined) return null;
  const sides = sidesOf(offer, view.myTeamId);
  if (sides.group !== "toYou") return null;
  const held = new Set(view.teams.flatMap((team) => team.players.filter((each) => each.held).map(({ code }) => code)));
  const free = (players: { code: number }[]) => players.map(({ code }) => code).filter((code) => !held.has(code));
  const freePick = (pick: TradePick | undefined) =>
    pick !== undefined &&
    view.teams.some((team) => team.picks.some((each) => each.round === pick.round && each.teamId === pick.teamId && !each.held))
      ? { round: pick.round, teamId: pick.teamId }
      : null;
  return {
    offerId: offer.offerId,
    teamId: sides.otherTeamId,
    gives: free(sides.youGive),
    gets: free(sides.youGet),
    givePick: freePick(offer.pickTerms?.gets),
    getPick: freePick(offer.pickTerms?.gives),
  };
}

/** A card's Offer a trade as the offer starts: the team, when it can be traded with, and their
 *  player ticked, when he is still theirs and not held in a trade under review. Null otherwise. */
export function askedOf(view: TradesView, { team, player }: Asked): Start | null {
  const partner = view.teams.slice(1).find((each) => each.teamId === team && !each.onAutoTeam);
  if (partner === undefined) return null;
  const his = partner.players.find((each) => each.code === player && !each.held);
  return { teamId: partner.teamId, gives: [], gets: his === undefined ? [] : [his.code] };
}
