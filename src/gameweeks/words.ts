// What the gameweeks screen says, in one place for Craig to change in the pull request. Why the
// server refused a change is in convex/gameweeks/leagueGameweeks.ts (`gameweekRefusals`), and reaches the
// screen as is.

import { GAMEWEEKS } from "../../convex/gameweeks/usedGameweeks";
import { failedWords } from "../shared/words";

export const GAMEWEEKS_TITLE = "Gameweeks";

export const howTickingWorks =
  "An unticked gameweek scores nothing and has no head-to-head, while waivers, free agency and " +
  "trades carry on through it. A gameweek can't be changed from its deadline.";

export const playsWords = (name: string) => ({ before: `${name} plays `, after: ` of ${GAMEWEEKS} gameweeks.` });

export const gameweekColumns = {
  gameweek: { short: "GW", long: "Gameweek" },
  deadline: { short: "Deadline", long: "When it begins: its deadline" },
  plays: { short: "Plays", long: "Whether the league plays it" },
} as const;
export const begunWords = "Begun";
export const noDeadlineWords = "Not known yet";
export const loadingWords = "Loading the gameweeks…";

/** When ticking failed before the server could say why: the connection, or the server itself. */
export const setFailedWords = failedWords("the gameweek wasn't changed");
