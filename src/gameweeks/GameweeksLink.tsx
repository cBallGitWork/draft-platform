import { Link } from "@tanstack/react-router";
import type { LeagueSummary } from "../../convex/myLeagues";
import { gameweeksPath, runs } from "./paths";
import { GAMEWEEKS_TITLE } from "./words";

/** The way to a league's gameweeks from "Your leagues", for someone who runs it. */
export function GameweeksLink({ league, isAdmin }: { league: LeagueSummary; isAdmin: boolean }) {
  if (!runs(league, isAdmin)) return null;
  return (
    <Link to={gameweeksPath(league.leagueId)} className="flex min-h-tap items-center self-start font-normal lg:min-h-0">
      {GAMEWEEKS_TITLE}
    </Link>
  );
}
