// What the gameweeks screen says, in one place for Craig to change in the pull request. Why the
// server refused a change is in convex/gameweeks/leagueGameweeks.ts (`gameweekRefusals`), and reaches the
// screen as is.

import { GAMEWEEKS } from "../../convex/gameweeks/usedGameweeks";
import { failedWords } from "../words";

export const GAMEWEEKS_TITLE = "Gameweeks";

export const howTickingWorks =
  "Untick a gameweek the league won't play, such as over Christmas: it scores nothing and has no " +
  "head-to-head, while waivers, free agency and trades carry on through it. A gameweek begins at " +
  "its deadline, and from then on it can't be changed.";

export const playsWords = (name: string) => ({ before: `${name} plays `, after: ` of ${GAMEWEEKS} gameweeks.` });

export const gameweekColumns = { gameweek: "GW", deadline: "Deadline", plays: "Plays" } as const;
export const begunWords = "Begun";
export const noDeadlineWords = "Not known yet";
export const loadingWords = "Loading the gameweeks…";

/** When ticking failed before the server could say why: the connection, or the server itself. */
export const setFailedWords = failedWords("the gameweek wasn't changed");
