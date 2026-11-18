// What the gameweeks screen says, in one place for Craig to change in the pull request. Why the
// server refused a change is in convex/gameweeks/leagueGameweeks.ts (`gameweekRefusals`), and reaches the
// screen as is.

import { failedWords } from "../shared/words";
import { gameweekColumn } from "../shared/when/words";

export const GAMEWEEKS_TITLE = "Gameweeks";

export const howTickingWorks =
  "An unticked gameweek has no scores or head-to-heads. Line-ups, bids, signings and trades " +
  "stay locked until its last match ends. A gameweek can't be changed once its deadline passes.";

/** "… plays N of M gameweeks.", M being however many the season has (#1618). */
export const playsWords = (name: string, seasonGameweeks: number) => ({ before: `${name} plays `, after: ` of ${seasonGameweeks} gameweeks.` });

export const gameweekColumns = {
  gameweek: gameweekColumn,
  deadline: { short: "Deadline", long: "Its deadline, when it begins" },
  plays: { short: "Plays", long: "Whether the league plays it" },
} as const;
export const begunWords = "Begun";
export const noDeadlineWords = "Not known yet";
export const loadingWords = "Loading the gameweeks…";

/** When ticking failed before the server could say why: the connection, or the server itself. */
export const setFailedWords = failedWords("the gameweek wasn't changed");
