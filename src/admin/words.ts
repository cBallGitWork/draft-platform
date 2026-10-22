// What the admin's dashboard says, in one place for Craig to change in the pull request. Why the
// server refused a change reaches the screen as is.

import type { ChangeThresholds } from "../../convex/positions/positionChanges";
import type { ApproveMode, PositionSource } from "../../convex/positions/positions";
import { failedWords } from "../words";

export { findLabel, findTitle, foundListLabel, noneFoundWords, searchingWords } from "../words";

export const ADMIN_TITLE = "Admin dashboard";
export const loadingWords = "Loading the queue…";

export const newSigningsTitle = "New signings";
export const newSigningsHint = "No starts to go on yet, so each plays on the Premier League's label for him until you confirm it.";
export const noNewSigningsWords = "No new signings wait for you.";
export const labelWords = (label: string) => `Label: ${label}`;
export const confirmWords = "Confirm";
export const confirmLabel = (name: string) => `Confirm ${name}'s label`;

export const waitingTitle = "Starts waiting for you";
export const waitingHint = "Positions his starts give him, three at a place, which count once you approve them.";
export const noWaitingWords = "No starts wait for you.";
export const proposalsWords = (positions: readonly string[]) => `From his starts: ${positions.join(", ")}`;
export const approveWords = "Approve";
export const approveLabel = (name: string) => `Approve ${name}'s starts`;

/** What flags a position, then removes it (spec/06, When positions change). */
const IN_A_ROW_ELSEWHERE = "starts in a row elsewhere";

export const changesTitle = "Position changes";
export const changesHint = ({ flagAfter, removeAfter }: ChangeThresholds) =>
  `A position from his starts is flagged after ${flagAfter} ${IN_A_ROW_ELSEWHERE}, and removed after ${removeAfter}, judged between gameweeks. To keep one, set it on him.`;
export const noChangesWords = "No position is flagged or removed.";
export const flaggedTitle = "Flagged";
export const flaggedWords = (position: string, startsElsewhere: number) => `${position}: ${startsElsewhere} ${IN_A_ROW_ELSEWHERE}`;
export const removedTitle = "Removed";
export const removedWords = (position: string) => `${position} removed`;

export const clubTitle = "Approve a whole club";
export const clubLabel = "Club";
export const approveClubWords = "Approve the club";

export const modeTitle = "How starts count";
export const modeWords: Record<ApproveMode, string> = {
  proposals: "They wait for you to approve them.",
  countAtOnce: "They count at once, unconfirmed until you approve them.",
};
export const switchModeWords: Record<ApproveMode, string> = {
  proposals: "Make them wait for me",
  countAtOnce: "Let them count at once",
};

export const thresholdsTitle = "When positions change";
export const flagAfterLabel = `Flag after this many ${IN_A_ROW_ELSEWHERE}`;
export const removeAfterLabel = `Remove after this many ${IN_A_ROW_ELSEWHERE}`;
export const saveThresholdsWords = "Save";

export const findHint = "Set or remove any player's positions. What you set stays until you remove it, and a position you remove stays off.";
export const noPositionsWords = "No positions yet.";
export const sourceWords: Record<PositionSource, string> = { starts: "from his starts", label: "from his label", admin: "set by you" };
export const unconfirmedWords = "unconfirmed";
export const flaggedPositionWords = (startsElsewhere: number) => `flagged: ${startsElsewhere} ${IN_A_ROW_ELSEWHERE}`;
export const removeLabel = (position: string, name: string) => `Remove ${position} from ${name}`;
export const setLabel = (name: string) => `Position to give ${name}`;
export const setWords = "Set";
export const removeWords = "Remove";
export const positionsListLabel = (name: string) => `${name}'s positions`;

/** Where to read up on a player, as a web search on one site each: nothing is fetched (spec/06). */
const searchOn = (site: string, fullName: string) => `https://www.google.com/search?q=${encodeURIComponent(`site:${site} ${fullName}`)}`;
export const readingLinks = (fullName: string) => [
  { label: "Transfermarkt", href: searchOn("transfermarkt.co.uk", fullName) },
  { label: "FotMob", href: searchOn("fotmob.com", fullName) },
  { label: "Understat", href: searchOn("understat.com", fullName) },
];

export const changeFailedWords = failedWords("nothing changed");
