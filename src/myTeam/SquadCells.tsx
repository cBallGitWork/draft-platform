import type { TeamSquad } from "./seam";
import {
  difficultyNotRatedWords,
  figureWords,
  nextFixtureLong,
  nextFixtureShort,
  noFigureWords,
  noKickoffWords,
  noNextFixtureWords,
  noPointsWords,
  shortThenLongName,
  whenWords,
} from "./words";

// The cells the Squad and Tactics tabs' tables and panels both draw, written once (#1042).

type Row = TeamSquad["players"][number];

/** A points figure in bold; none yet is a muted dash, saying why on hover. */
export function PointsCell({ className, points }: { className: string; points: number | null }) {
  return points === null ? (
    <td title={noPointsWords} className={`${className} text-muted`}>
      {noFigureWords}
    </td>
  ) : (
    <td className={`${className} font-bold text-figure`}>{figureWords(points)}</td>
  );
}

/** A figure in bold, a muted "—" while there is none, and nothing while it loads; `words` writes
 *  it, signed for an adjustment. The Squad and Tactics player panels'. */
export function Figure({ points, words = figureWords }: { points: number | null | undefined; words?: (value: number) => string }) {
  if (points === undefined) return null;
  return points === null ? <span className="text-muted">{noFigureWords}</span> : <span className="font-bold text-figure">{words(points)}</span>;
}

/** His club's next matches, each a cell whose fill waits for fixture difficulty (the README's
 *  placeholders), so it is the placeholder's outline round the match. */
export function NextMatches({ matches }: { matches: Row["nextFixtures"] }) {
  if (matches.length === 0) {
    return (
      <span title={noNextFixtureWords} className="text-muted">
        {noFigureWords}
      </span>
    );
  }
  return (
    <span className="flex gap-px">
      {matches.map((match) => (
        <MatchMark key={match.kickoff} match={match} />
      ))}
    </span>
  );
}

/** One of his club's matches: the opponent's code and where, named in full in its hover. */
export function MatchMark({ match }: { match: { opponent: Row["club"]; home: boolean; kickoff: number | null } }) {
  const short = nextFixtureShort(match.opponent.shortName, match.home);
  const when = match.kickoff === null ? noKickoffWords : whenWords(match.kickoff);
  const long = `${nextFixtureLong(match.opponent.name, match.home, when)}, ${difficultyNotRatedWords}`;
  return (
    <abbr title={long} aria-label={shortThenLongName({ short, long })} className="grow basis-0 border border-muted px-1 text-center whitespace-nowrap no-underline">
      {short}
    </abbr>
  );
}
