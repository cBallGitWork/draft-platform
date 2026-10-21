import { Link } from "@tanstack/react-router";
import type { LeagueSummary } from "../../convex/myLeagues";
import { leagueRowLinkClasses } from "../leagues/LeagueLinks";
import { runs } from "../leagues/roles";
import { gameweeksPath } from "./paths";
import { GAMEWEEKS_TITLE } from "./words";

/** The way to a league's gameweeks from "Your leagues", for someone who runs it. */
export function GameweeksLink({ league, isAdmin }: { league: LeagueSummary; isAdmin: boolean }) {
  if (!runs(league, isAdmin)) return null;
  return (
    <Link to={gameweeksPath(league.leagueId)} className={leagueRowLinkClasses}>
      {GAMEWEEKS_TITLE}
    </Link>
  );
}
