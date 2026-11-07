import type { TeamSquad } from "./seam";
import {
  difficultyNotRatedWords,
  figureWords,
  nextFixtureLong,
  nextFixtureShort,
  noFigureWords,
  noNextFixtureWords,
  noPointsWords,
  shortThenLongName,
  whenWords,
} from "./words";

// The cells the Squad and Tactics tabs' tables and panels both draw, written once (#1042).

/** A points figure in bold; none yet is a muted dash, saying why on hover. Undefined while his row
 *  loads draws the cell empty. */
export function PointsCell({ className, points }: { className: string; points: number | null | undefined }) {
  if (points === undefined) return <td className={className} />;
  return points === null ? (
    <td title={noPointsWords} className={`${className} text-muted`}>
      {noFigureWords}
    </td>
  ) : (
    <td className={`${className} font-bold text-figure`}>{figureWords(points)}</td>
  );
}

/** His club's next matches, each a cell whose fill waits for fixture difficulty (the README's
 *  placeholders), so it is the placeholder's outline round the match. */
export function NextMatches({ matches }: { matches: TeamSquad["players"][number]["nextFixtures"] }) {
  if (matches.length === 0) {
    return (
      <span title={noNextFixtureWords} className="text-muted">
        {noFigureWords}
      </span>
    );
  }
  return (
    <span className="flex gap-px">
      {matches.map((match) => {
        const short = nextFixtureShort(match.opponent.shortName, match.home);
        const long = `${nextFixtureLong(match.opponent.name, match.home, whenWords(match.kickoff))}, ${difficultyNotRatedWords}`;
        return (
          <abbr key={match.kickoff} title={long} aria-label={shortThenLongName({ short, long })} className="grow basis-0 border border-muted px-1 text-center whitespace-nowrap no-underline">
            {short}
          </abbr>
        );
      })}
    </span>
  );
}
