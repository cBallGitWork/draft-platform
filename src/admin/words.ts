// What the admin's dashboard says, in one place for Craig to change in the pull request. Why the
// server refused a change reaches the screen as is.

import type { ApproveMode, PositionSource } from "../../convex/positions";
import { failedWords } from "../words";

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

export const findTitle = "Find a player";
export const findLabel = "Name";
export const findHint = "Set or remove any player's positions. What you set stays until you remove it, and a position you remove stays off.";
export const searchingWords = "Searching…";
export const noneFoundWords = "No player of that name in the Premier League.";
export const noPositionsWords = "No positions yet.";
export const sourceWords: Record<PositionSource, string> = { starts: "from his starts", label: "from his label", admin: "set by you" };
export const unconfirmedWords = "unconfirmed";
export const removeLabel = (position: string, name: string) => `Remove ${position} from ${name}`;
export const setLabel = (name: string) => `Position to give ${name}`;
export const setWords = "Set";
export const removeWords = "Remove";
export const foundListLabel = "Players found";
export const positionsListLabel = (name: string) => `${name}'s positions`;

/** Where to read up on a player, as a web search on one site each: nothing is fetched (spec/06). */
const searchOn = (site: string, fullName: string) => `https://www.google.com/search?q=${encodeURIComponent(`site:${site} ${fullName}`)}`;
export const readingLinks = (fullName: string) => [
  { label: "Transfermarkt", href: searchOn("transfermarkt.co.uk", fullName) },
  { label: "FotMob", href: searchOn("fotmob.com", fullName) },
  { label: "Understat", href: searchOn("understat.com", fullName) },
];

export const changeFailedWords = failedWords("nothing changed");
