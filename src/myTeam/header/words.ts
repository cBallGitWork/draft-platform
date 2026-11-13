// What My team's header band says (spec/12, My team; the approved Tactics picture's header), in one
// place for Craig to change in the pull request.

import { figureWords, gameweekShort, gameweekWords, scoreWords } from "../../shared/words";
import { byeWords, leagueAverageWords } from "../words";
import { resultOf, type Result, type Winner } from "../../../convex/table/standings";
import { BYE } from "../../../convex/table/teamGames";
import type { TeamGame } from "./teamStanding";

export { liveWords, noFigureWords, noTeamWords, versusWords, whenWords } from "../words";
export { countdownWords, formHead, gameweekShort, placeWords, tableHead } from "../../shared/words";

/** The band's heads over each reading. */
export const deadlineHead = (gameweek: number) => `${gameweekShort(gameweek)} deadline`;
/** The band's readings, for screen readers, as a list. */
export const meterListLabel = "Your team at a glance";

/** On the hover of the no-deadline dash: why there is none. */
export const noDeadlineWords = (gameweek: number) => `${gameweekWords(gameweek)} has no deadline yet: none of its matches has a kickoff time.`;

/** The last game's result, as a line says it. */
const LAST_RESULT_WORDS: Record<Result, string> = { won: "Won", drawn: "Drew", lost: "Lost" };

/** Who a game is against, as the band names it. */
export const againstWords = (against: TeamGame["against"]) =>
  against.kind === "team" ? against.team : against.kind === BYE ? byeWords : leagueAverageWords;

/** The last game: "Won 54–41 v Rovers XI", or its score alone while live. */
export const lastGameWords = ({ against, score }: TeamGame & { score: NonNullable<TeamGame["score"]> }, mode: Winner) => {
  const line = `${scoreWords(score.team, score.opponent)} v ${againstWords(against)}`;
  return score.provisional ? line : `${LAST_RESULT_WORDS[resultOf(mode, score.team, score.opponent)]} ${line}`;
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
