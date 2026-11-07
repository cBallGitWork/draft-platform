/** Where a player's card opens (#381), as the router matches it: in a league, as it names who owns
 *  him there. A plain string, not `${LEAGUES_PATH}/…` as const, so .claude/hooks/screen_routes.py
 *  can read it and find the files rendering the card's approved picture. */
export const PLAYER_CARD_ROUTE = "/leagues/$leagueId/players/$playerCode";

/** One player's card in one league. */
export const playerCardPath = (leagueId: string, playerCode: number) =>
  PLAYER_CARD_ROUTE.replace("$leagueId", leagueId).replace("$playerCode", String(playerCode));
