// What the scouts say on screen (#375, spec/19 Scouts), in one place for Craig to change. Why the
// server refused a scout is in convex/scouting/scoutWords.ts (`scoutRefusals`), and reaches the
// screen as is.

import { dayWords, whenWords } from "../../shared/words";

/** The card's action, and how many of the team's scouts are free (the approved card: "Send a scout
 *  2 of 3 free"). */
export const sendScoutWords = "Send a scout";
export const freeScoutsWords = (free: number, scouts: number) => `${free} of ${scouts} free`;
export const sendScoutFailedWords = "The scout couldn't be sent. Try again.";

/** The card's report panel (spec/19, The report; Craig, 6 Nov 2026, on #375): his newest report,
 *  dated, and the older ones under it. */
export const SCOUT_REPORT_TITLE = "Scout report";
export const reportDayWords = dayWords;
/** A scout out on him now, and when his report is in. */
export const scoutOutWords = (dueAt: number) => `Scout out: report in ${whenWords(dueAt)}`;
export const noReportWords = "Not scouted";
/** The approved card's "Older report, 12 Oct", which opens it. */
export const olderReportWords = (writtenAt: number) => `Older report, ${dayWords(writtenAt)}`;

/** Scouting's Scouts panel (the approved Scouting picture; Craig, 6 Nov 2026, on #375): each of the
 *  team's scouts, out with the time left, back with a report in, or free; then the team's other
 *  reports. */
export const SCOUTS_TITLE = "Scouts";
export const scoutsOutWords = (out: number, scouts: number) => `${out} of ${scouts} out`;
export const scoutNumberWords = (number: number) => `Scout ${number}`;
export const outOnWords = (name: string) => `Out on ${name}`;
export const reportInSoonWords = (left: string) => `report in ${left}`;
export const reportInOnWords = (name: string) => `Report in on ${name}`;
export const freeScoutWords = "Free: send him from a player's panel";
export const readWords = "Read ›";
export const readNamedLabel = (name: string, writtenAt: number) => `Read the report on ${name}, ${dayWords(writtenAt)}`;
export const earlierReportWords = (name: string, writtenAt: number) => `Report on ${name}, ${dayWords(writtenAt)}`;
export const reportsListLabel = "Your team's earlier reports";
export const loadingScoutsWords = "Loading your scouts…";
/** The report opened from the panel: whom, when, and its two actions. */
export const reportTitle = (name: string) => `Report: ${name}`;
export const writtenWords = (writtenAt: number) => `Written ${dayWords(writtenAt)}`;
export const scoutAgainWords = "Scout him again";
export const closeReportLabel = "Close the report";
