import { JOIN_PATH } from "../../convex/joinLinks";
import { LEAGUES_PATH } from "../leagues/paths";

/** A league's invites and join requests, for its runners. */
export const INVITES_ROUTE = `${LEAGUES_PATH}/$leagueId/invites`;
export const invitesPath = (leagueId: string) => `${LEAGUES_PATH}/${leagueId}/invites`;

/** A league's invite link (convex/joinLinks.ts). */
export const JOIN_ROUTE = `${JOIN_PATH}/$token`;

/** The invite link's token, when this address is one. */
export function joinTokenAt(pathname: string): string | null {
  const [, first, token, ...rest] = pathname.split("/");
  return `/${first}` === JOIN_PATH && token && rest.length === 0 ? token : null;
}
