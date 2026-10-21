import { JOIN_PATH } from "../../convex/joiningShared";
import { leaguePage } from "../leagues/paths";

/** A league's invites and join requests, for its runners. */
export const { route: INVITES_ROUTE, path: invitesPath } = leaguePage("invites");

/** A league's invite link (convex/joiningShared.ts). */
export const JOIN_ROUTE = `${JOIN_PATH}/$token`;

/** The invite link's token, when this address is one. */
export function joinTokenAt(pathname: string): string | null {
  const [, first, token, ...rest] = pathname.split("/");
  return `/${first}` === JOIN_PATH && token && rest.length === 0 ? token : null;
}
