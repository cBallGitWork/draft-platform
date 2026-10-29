import { ClubShort } from "../premierLeague/ClubName";
import { versusWords } from "../shared/words";
import type { PlayedMatch } from "./seam";

/** "ARS v COV", each club's full name on hover. */
export function MatchName({ match }: { match: Pick<PlayedMatch, "home" | "away"> }) {
  return (
    <>
      <ClubShort club={match.home} />{" "}
      {versusWords}{" "}
      <ClubShort club={match.away} />
    </>
  );
}
