import { Link } from "@tanstack/react-router";
import type { Id } from "../../convex/_generated/dataModel";
import { matchupLink } from "./paths";
import { liveWords } from "../shared/words";
import { matchupLinkLabel, scoreWords, versusWords } from "./words";

/** A fixture's middle cell, its score or "v", as a link to the team's matchup in the gameweek: from
 *  the table's fixtures, league home's head-to-heads and My team's fixtures. A full tap target on the
 *  phone. Points of null draw "v". Passing `live` (My team's fixtures) wraps the score with room for
 *  the Live tag, shown while `live` is true; without it the score is a single span. */
export function MatchupLink({
  teamId,
  team,
  opponent,
  gameweek,
  points,
  live,
}: {
  teamId: Id<"teams">;
  team: string;
  opponent: string | null;
  gameweek: number;
  points: { team: number; opponent: number } | null;
  live?: boolean;
}) {
  return (
    <Link {...matchupLink(teamId, gameweek)} aria-label={matchupLinkLabel(team, opponent, gameweek)} className="flex min-h-tap min-w-tap items-center justify-center lg:min-h-0 lg:min-w-0">
      {points === null ? (
        <span>{versusWords}</span>
      ) : live === undefined ? (
        <span className="whitespace-nowrap font-bold text-figure">{scoreWords(points.team, points.opponent)}</span>
      ) : (
        <span className="whitespace-nowrap">
          <span className="font-bold text-figure">{scoreWords(points.team, points.opponent)}</span>
          {live && <span className="ml-1 text-derived">{liveWords}</span>}
        </span>
      )}
    </Link>
  );
}
