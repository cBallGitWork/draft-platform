// What the admin's dashboard says, in one place for Craig to change in the pull request. Why the
// server refused a change reaches the screen as is.

import type { ChangeThresholds } from "../../convex/positions/positionChanges";
import type { ApproveMode, PositionSource } from "../../convex/positions/positions";
import type { FeedState } from "../../convex/admin/feedState";
import { FEED_NAMES } from "../../convex/shared/feedSchedule";
import { FEEDBACK_TITLE } from "../feedback/words";
import { LOCALE } from "../../convex/shared/londonTime";
import { DAY_MS, HOUR_MS, MINUTE_MS } from "../../convex/shared/time";
import { versusWords, whenWords } from "../words";
import { READING_SITES, siteSearchUrl } from "./paths";

export { findLabel, findTitle, foundListLabel, noneFoundWords, searchingWords } from "../words";

export const ADMIN_TITLE = "Admin dashboard";
export const loadingWords = "Loading the queue…";

/** The dashboard's tabs (#35, #357): the positions queue, the feeds page, and managers' feedback. */
export const adminTabsLabel = "Admin";
export const positionsTabWords = "Positions";
export const feedsTabWords = "Feeds";
export const feedbackTabWords = FEEDBACK_TITLE;

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
/** What follows where a held position came from: that it is unconfirmed, or flagged. */
export const unconfirmedNote = ", unconfirmed";
export const flaggedNote = (startsElsewhere: number) => `, flagged: ${startsElsewhere} ${IN_A_ROW_ELSEWHERE}`;
export const removeLabel = (position: string, name: string) => `Remove ${position} from ${name}`;
export const setLabel = (name: string) => `Position to give ${name}`;
export const setWords = "Set";
export const removeWords = "Remove";
export const positionsListLabel = (name: string) => `${name}'s positions`;

/** Where to read up on a player, as a web search on one site each: nothing is fetched (spec/06). */
export const readingLinks = (fullName: string) => [
  { label: "Transfermarkt", href: siteSearchUrl(READING_SITES.transfermarkt, fullName) },
  { label: "FotMob", href: siteSearchUrl(READING_SITES.fotMob, fullName) },
  { label: "Understat", href: siteSearchUrl(READING_SITES.understat, fullName) },
];

// The feeds page (#35; spec/15 The admin).

export const feedsLoadingWords = "Loading the feeds…";
export const feedsTitle = "Feeds";
export const feedsHint = "When each feed last brought data. One late or failing needs you: a feed that stops is otherwise silent.";
export const feedColumns = { feed: "Feed", arrived: "Last arrived", state: "State" } as const;
/** Kept with the feeds themselves, as the admin's failure email names them too. */
export const feedNames = FEED_NAMES;
export const feedStateWords: Record<FeedState, string> = {
  fine: "On time",
  late: "Late",
  failing: "Failing",
  notRunningYet: "Not running yet",
  notScheduled: "Not scheduled: run by hand",
};
export const neverWords = "Never";

const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
/** From how long ago a time is said in days rather than hours. */
const DAYS_FROM_MS = 2 * DAY_MS;
/** How long before `now` a time was, in its largest whole unit: "3 minutes ago", "yesterday". */
export const agoWords = (at: number, now: number) => {
  const since = at - now;
  if (-since < HOUR_MS) return relative.format(Math.trunc(since / MINUTE_MS), "minute");
  if (-since < DAYS_FROM_MS) return relative.format(Math.trunc(since / HOUR_MS), "hour");
  return relative.format(Math.trunc(since / DAY_MS), "day");
};
export const lastErrorWords = (at: number) => `Last error, ${whenWords(at)}:`;

/** A match by its clubs' names, or null while the football sync holds no such match. */
type MatchName = { home: string; away: string } | null;

/** A match by its clubs, or by FPL's code for it while the football sync holds no such match. */
export const matchWords = (match: MatchName, fixtureCode: number) =>
  match === null ? `Match ${fixtureCode}` : `${match.home} ${versusWords} ${match.away}`;

export const behindTitle = "Scoring behind";
export const noneBehindWords = "No match is behind: each one at full time had every player's stats within its correction window.";
export const behindWords = (count: number, more: boolean) => ({
  figure: more ? `${count}+` : `${count}`,
  after: ` ${count === 1 && !more ? "match is" : "matches are"} still provisional past the correction window: a feed hasn't sent a player's stats, so the points can't lock.`,
});
export const fullTimeWords = (at: number) => `Full time ${whenWords(at)}`;

export const correctionsTitle = "Corrections after the lock";
export const correctionsHint = "A feed changed a stat after the match's points locked. The points didn't change.";
export const noCorrectionsWords = "No stat has changed after a lock.";
export const moreCorrectionsWords = (shown: number) => `More came than these: only the newest ${shown} are shown.`;
const playerWords = (player: string | null, playerCode: number) => player ?? `Player ${playerCode}`;
/** A correction's heading: whose stat, in which match. */
export const correctionOfWords = (player: string | null, playerCode: number, match: MatchName, fixtureCode: number) =>
  `${playerWords(player, playerCode)}, ${matchWords(match, fixtureCode)}`;
export const changeWords = ({ stat, locked, sent }: { stat: string; locked: number; sent: number }) => `${stat}: locked at ${locked}, sent ${sent}`;
export const seenWords = (at: number) => `Seen ${whenWords(at)}`;

/** The Feedback tab (#357): what managers sent from the top bar. */
export const feedbackListTitle = "Feedback from managers";
export const feedbackLoadingWords = "Loading the feedback…";
export const noFeedbackWords = "No feedback yet.";
/** Past the newest the list shows, said as the late corrections say it. */
export const moreFeedbackWords = moreCorrectionsWords;
