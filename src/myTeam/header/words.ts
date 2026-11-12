// What My team's header band says (spec/12, My team; the approved Tactics picture's header), in one
// place for Craig to change in the pull request.

import { DAY_MS, HOUR_MS, MINUTE_MS } from "../../../convex/shared/time";
import { figureWords, gameweekShort, gameweekWords, scoreWords } from "../../shared/words";
import { byeWords, leagueAverageWords } from "../words";
import { resultOf, type Result } from "../../../convex/table/standings";
import { BYE } from "../../../convex/table/teamGames";
import type { TeamGame } from "./teamStanding";

export { liveWords, noFigureWords, noTeamWords, versusWords, whenWords } from "../words";
export { gameweekShort, placeWords } from "../../shared/words";

/** The band's heads over each reading. */
export const deadlineHead = (gameweek: number) => `${gameweekShort(gameweek)} deadline`;
export const formHead = "Form";
export const tableHead = "Table";
/** The band's readings, for screen readers, as a list. */
export const meterListLabel = "Your team at a glance";

/** "in 1d 17h", "in 5h 12m", "in 12m": the two largest units, counted down a minute at a time. */
export function countdownWords(left: number): string {
  if (left < MINUTE_MS) return "in under a minute";
  const days = Math.floor(left / DAY_MS);
  const hours = Math.floor((left % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((left % HOUR_MS) / MINUTE_MS);
  if (days > 0) return `in ${days}d ${hours}h`;
  if (hours > 0) return `in ${hours}h ${minutes}m`;
  return `in ${minutes}m`;
}
/** On the hover of the no-deadline dash: why there is none. */
export const noDeadlineWords = (gameweek: number) => `${gameweekWords(gameweek)} has no deadline yet: none of its matches has a kickoff time.`;

/** Form's chips and label, as League home says them. */
export { formLabel, liveFormLabel, liveResultWords, resultWords } from "../../shared/words";
/** The last game's result, as a line says it. */
const LAST_RESULT_WORDS: Record<Result, string> = { won: "Won", drawn: "Drew", lost: "Lost" };

/** Who a game is against, as the band names it. */
export const againstWords = (against: TeamGame["against"]) =>
  against.kind === "team" ? against.team : against.kind === BYE ? byeWords : leagueAverageWords;

/** The last game: "Won 54–41 v Rovers XI", or its score alone while live. */
export const lastGameWords = ({ against, score }: TeamGame & { score: NonNullable<TeamGame["score"]> }) => {
  const line = `${scoreWords(score.team, score.opponent)} v ${againstWords(against)}`;
  return score.provisional ? line : `${LAST_RESULT_WORDS[resultOf(score.team, score.opponent)]} ${line}`;
};

/** The band's Auto team reading and its panel (spec/09, The auto team; docs/design/approved/auto-team/). */
export { autoTeamWords as autoTeamHead, autoTeamWhatWords } from "../../shared/words";
export const autoTeamStateWords = ({ on, endsAfter }: { on: boolean; endsAfter: number | null }) =>
  !on ? "Off" : endsAfter === null ? "On" : `On, to ${gameweekShort(endsAfter)}`;
export const untilEndOfWords = "Until the end of";
export const endGameweekLabel = "The gameweek it ends after";
export const untilSwitchedOffWords = "Until I switch it off";
export const switchOnWords = "Switch on";
export const switchOffWords = "Switch off";
export { cancelWords } from "../../shared/words";

/** Points, short as the band says them: "18 pts". */
export const pointsShort = (points: number) => `${figureWords(points)} pts`;
