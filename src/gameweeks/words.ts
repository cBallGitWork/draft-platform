// What the gameweeks screen says, in one place for Craig to change in the pull request. Why the
// server refused a change is in convex/leagueGameweeks.ts (`gameweekRefusals`), and reaches the
// screen as is.

import { GAMEWEEKS } from "../../convex/usedGameweeks";
import { failedWords } from "../words";

export const GAMEWEEKS_TITLE = "Gameweeks";

export const howTickingWorks =
  "Untick a gameweek the league won't play, such as over Christmas: it scores nothing and has no " +
  "head-to-head, while waivers, free agency and trades carry on through it. A gameweek begins at " +
  "its deadline, and from then on it can't be changed.";

export const playsWords = (name: string) => ({ before: `${name} plays `, after: ` of ${GAMEWEEKS} gameweeks.` });

export const tickLabel = (gameweek: number) => `Gameweek ${gameweek}`;
export const begunWords = "Begun";
export const noDeadlineWords = "Not known yet";
export const loadingWords = "Loading the gameweeks…";

const deadlineFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
/** A deadline in the viewer's own time, e.g. "Sat 15 Aug, 11:00". */
export const deadlineWords = (deadline: number) => deadlineFormat.format(deadline);

/** When ticking failed before the server could say why: the connection, or the server itself. */
export const setFailedWords = failedWords("the gameweek wasn't changed");
