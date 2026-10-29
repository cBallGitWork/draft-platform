import { versusWords } from "../shared/words";
import type { PlayedMatch } from "./seam";

/** "ARS v COV", each club's full name on hover. */
export function MatchName({ match }: { match: Pick<PlayedMatch, "home" | "away"> }) {
  return (
    <>
      <abbr title={match.home.name} className="no-underline">
        {match.home.shortName}
      </abbr>{" "}
      {versusWords}{" "}
      <abbr title={match.away.name} className="no-underline">
        {match.away.shortName}
      </abbr>
    </>
  );
}
