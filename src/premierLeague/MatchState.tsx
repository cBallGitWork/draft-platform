import type { GameweekMatch } from "./seam";
import { clockWords, fullTime, halfTime, kickoffDayWords, kickoffWords } from "./words";

/** Where a match stands: its kickoff, the clock, half-time or full time. `long` is the match page's
 *  wording ("Half-time", "Full time", the kickoff's day); short is the fixtures list's, half-time's
 *  clock and full time's short form with their long words on hover. */
export function MatchState({ kickoff, score, long }: Pick<GameweekMatch, "kickoff" | "score"> & { long: boolean }) {
  switch (score?.state) {
    case "live":
      return <span className="font-semibold text-derived">{clockWords(score.state, score.clockLabel, score.minutes)}</span>;
    case "halfTime":
      return long ? (
        <span className="font-semibold text-derived">{halfTime.long}</span>
      ) : (
        <abbr title={halfTime.long} className="font-semibold text-derived no-underline">
          {clockWords(score.state, score.clockLabel, score.minutes)}
        </abbr>
      );
    case "fullTime":
      return long ? (
        <span className="text-muted">{fullTime.long}</span>
      ) : (
        <abbr title={fullTime.long} className="text-muted no-underline">
          {fullTime.short}
        </abbr>
      );
    default:
      return <span className="text-muted">{kickoff === null ? "" : long ? kickoffDayWords(kickoff) : kickoffWords(kickoff)}</span>;
  }
}
