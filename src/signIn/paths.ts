import { appPathOrNone } from "../../convex/signIn/nextPath";
import { linkProblemWords, type LinkProblem } from "./words";

/** The sign-in page (spec/02), all a signed-out visitor sees. */
export const SIGN_IN_PATH = "/sign-in";

/** The search param a sign-in link carries its code in (Convex Auth's). */
export const LINK_CODE_PARAM = "code";

/** The sign-in page's search: what was wrong with a link, `join`, the invite link a signed-out
 *  visitor opened, which their sign-in link leads back to (#73), and `next`, any other address
 *  they opened, which it leads back to as well (UI-063, UI-064). */
export type SignInSearch = { link?: LinkProblem; join?: string; next?: string };

const isLinkProblem = (value: unknown): value is LinkProblem => typeof value === "string" && Object.hasOwn(linkProblemWords, value);

/** The search as the address holds it, anything else dropped; each always set, if only to
 *  undefined, since a route's search is laid over the address's own. */
export function signInSearchOf(search: Record<string, unknown>): SignInSearch {
  const { link, join, next } = search;
  return {
    link: isLinkProblem(link) ? link : undefined,
    join: typeof join === "string" && join ? join : undefined,
    next: appPathOrNone(next),
  };
}

/** The sign-in page's address with its search, `link` first and `join` and `next` only when set. */
export function signInAddress({ link, join, next }: SignInSearch): string {
  const search = new URLSearchParams({ ...(link && { link }), ...(join && { join }), ...(next && { next }) });
  const query = search.toString();
  return query ? `${SIGN_IN_PATH}?${query}` : SIGN_IN_PATH;
}

/** What a signed-out visitor opening `href` (a path with its search) is sent to sign in with: the
 *  invite link's token on an invite link, else the address itself, so signing in lands there;
 *  nothing for the landing address, where signing in lands anyway. */
export function signInSearchFor(href: string, joinToken: string | null, landing: string): SignInSearch {
  if (joinToken) return { join: joinToken };
  return { next: href === landing ? undefined : appPathOrNone(href) };
}
