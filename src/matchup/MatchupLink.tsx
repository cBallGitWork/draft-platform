import { Link } from "@tanstack/react-router";
import type { Id } from "../../convex/_generated/dataModel";
import { matchupLink } from "./paths";
import { liveWords } from "../shared/match/words";
import { matchupLinkLabel, scoreWords, versusWords } from "./words";

/** A fixture's middle cell, its score or "v", as a link to the team's matchup in the gameweek, that
 *  game's own where the team plays two (`game`, from 1; `matchupLink` leaves the first out of the
 *  address; #913): from
 *  the table's fixtures, league home's head-to-heads and My team's fixtures. A full tap target on the
 *  phone. Points of null draw "v". Passing `live` (My team's fixtures) wraps the score with room for
 *  the Live tag, shown while `live` is true; without it the score is a single span. */
export function MatchupLink({
  teamId,
  team,
  opponent,
  gameweek,
  game,
  points,
  live,
}: {
  teamId: Id<"teams">;
  team: string;
  opponent: string | null;
  gameweek: number;
  game: number;
  points: { team: number; opponent: number } | null;
  live?: boolean;
}) {
  const score = points === null ? versusWords : scoreWords(points.team, points.opponent);
  // What it shows starts its name (WCAG 2.5.3; S12.14), the Live tag included.
  const shown = live === true ? `${score} ${liveWords}` : score;
  return (
    <Link {...matchupLink(teamId, gameweek, game)} aria-label={matchupLinkLabel(shown, team, opponent, gameweek)} className="flex min-h-tap min-w-tap items-center justify-center lg:min-h-0 lg:min-w-0">
      {points === null ? (
        <span>{versusWords}</span>
      ) : live === undefined ? (
        <span className="whitespace-nowrap font-bold text-figure">{score}</span>
      ) : (
        <span className="whitespace-nowrap">
          <span className="font-bold text-figure">{score}</span>
          {live && (
            <>
              {" "}
              <span className="text-derived">{liveWords}</span>
            </>
          )}
        </span>
      )}
    </Link>
  );
}
