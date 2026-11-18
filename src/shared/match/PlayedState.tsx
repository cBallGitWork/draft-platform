import type { PlayingState } from "../../../convex/football/matchScores";
import { clockWords, fullTime, halfTime } from "./words";

type Played = { state: PlayingState | "fullTime"; clockLabel: string | null; minutes: number | null };

/** Whether a match's newest score says it has kicked off. */
export const hasKickedOff = <Score extends { state: string }>(score: Score | null): score is Score & Played => score !== null && score.state !== "upcoming";

/** Where a match that has kicked off stands: the clock, half-time or full time. `long` is the match
 *  page's wording ("Half-time", "Full time"); short is a list's, half-time's clock and full time's
 *  short form with their long words on hover. The Premier League's pages and Home's panel alike. */
export function PlayedState({ score, long }: { score: Played; long: boolean }) {
  switch (score.state) {
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
  }
}
