import { Fragment, type ReactNode } from "react";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import type { Session } from "../signIn/seam";
import { currentLeagueOf } from "../leagues/roles";

const byLeague = (league: LeagueSummary) => league.leagueId;

/** A page for the league the app is in, made by `page`. The frame's guard lets in only someone in a
 *  league; should they leave it while here, this shows nothing until the guard sends them on.
 *  Keyed by `keyOf` (the league, unless a page says more), so a switch starts the page afresh rather
 *  than keeping the last league's state up. */
export function CurrentLeague({
  session,
  page,
  keyOf = byLeague,
}: {
  session: Session;
  page: (league: LeagueSummary) => ReactNode;
  keyOf?: (league: LeagueSummary) => string;
}) {
  const league = currentLeagueOf(session);
  return league ? <Fragment key={keyOf(league)}>{page(league)}</Fragment> : null;
}
