import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { matchupLink } from "./paths";
import { matchupLinkLabel } from "./words";

/** A fixture's middle cell, its score or "v", as a link to the team's matchup in the gameweek: from
 *  the table's fixtures and league home's head-to-heads. A full tap target on the phone. */
export function MatchupLink({
  teamId,
  team,
  opponent,
  gameweek,
  children,
}: {
  teamId: Id<"teams">;
  team: string;
  opponent: string | null;
  gameweek: number;
  children: ReactNode;
}) {
  return (
    <Link {...matchupLink(teamId, gameweek)} aria-label={matchupLinkLabel(team, opponent, gameweek)} className="flex min-h-tap items-center justify-center lg:min-h-0">
      {children}
    </Link>
  );
}
