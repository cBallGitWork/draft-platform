import { LEAGUES_PATH } from "../leagues/paths";

/** Where a player's card opens (#381), as the router matches it: in a league, as it names who owns
 *  him there. */
export const PLAYER_CARD_ROUTE = `${LEAGUES_PATH}/$leagueId/players/$playerCode` as const;

/** One player's card in one league. */
export const playerCardPath = (leagueId: string, playerCode: number) =>
  PLAYER_CARD_ROUTE.replace("$leagueId", leagueId).replace("$playerCode", String(playerCode));
