import { hasKickedOff, PlayedState } from "../shared/match/PlayedState";
import type { GameweekMatch } from "./seam";
import { kickoffDayWords, kickoffWords } from "./words";

/** Where a match stands: its kickoff, the clock, half-time or full time. `long` is the match page's
 *  wording ("Half-time", "Full time", the kickoff's day); short is the fixtures list's (PlayedState). */
export function MatchState({ kickoff, score, long }: Pick<GameweekMatch, "kickoff" | "score"> & { long: boolean }) {
  if (hasKickedOff(score)) return <PlayedState score={score} long={long} />;
  return <span className="text-muted">{kickoff === null ? "" : long ? kickoffDayWords(kickoff) : kickoffWords(kickoff)}</span>;
}
