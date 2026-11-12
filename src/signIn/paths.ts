import { linkProblemWords, type LinkProblem } from "./words";

/** The sign-in page (spec/02), all a signed-out visitor sees. */
export const SIGN_IN_PATH = "/sign-in";

/** The search param a sign-in link carries its code in (Convex Auth's). */
export const LINK_CODE_PARAM = "code";

/** The sign-in page's search: what was wrong with a link, and `join`, the invite link a signed-out
 *  visitor opened, which their sign-in link leads back to (#73). */
export type SignInSearch = { link?: LinkProblem; join?: string };

const isLinkProblem = (value: unknown): value is LinkProblem => typeof value === "string" && Object.hasOwn(linkProblemWords, value);

/** The search as the address holds it, anything else dropped; each always set, if only to
 *  undefined, since a route's search is laid over the address's own. */
export function signInSearchOf(search: Record<string, unknown>): SignInSearch {
  const { link, join } = search;
  return {
    link: isLinkProblem(link) ? link : undefined,
    join: typeof join === "string" && join ? join : undefined,
  };
}

/** The sign-in page's address with its search, `link` first and `join` only when set. */
export function signInAddress({ link, join }: SignInSearch): string {
  const search = new URLSearchParams({ ...(link && { link }), ...(join && { join }) });
  const query = search.toString();
  return query ? `${SIGN_IN_PATH}?${query}` : SIGN_IN_PATH;
}
