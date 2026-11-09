// What the draft room says (spec/04, The draft room; the approved draft room pictures,
// docs/design/approved/draft-room/), in one place for Craig to change in the pull request.

import { DRAFT_LIST_MOST } from "../../convex/draft/draftLimits";
import { DAY_MS, HOUR_MS, MINUTE_MS, SECOND_MS } from "../../convex/shared/time";
import { failedWords, placeWords } from "../shared/words";

/** The page's title, its menu tab's too, and the state beside it. */
export const DRAFT_TITLE = "Draft";
export const stateWords = { waiting: "Not started", live: "Live", paused: "Paused", over: "Over" } as const;
export const loadingWords = "Loading the draft…";

/** The header's heads and readings, before the start. */
export const draftOrderHead = "Draft order";
/** How the order was set and when isn't held yet (#1098), so its reading is a placeholder. */
export const draftOrderPlaceholder = "How the order was set: not held yet";
export const youPickHead = "You pick";
export const clockHead = "Clock";
export const startsHead = (at: string | null) => (at === null ? "Starts" : `Starts ${at}`);
export const noStartWords = "When the commissioner starts it";
export const noClockWords = "No pick time set";

/** Where a team picks in the first two rounds: "8th, then 13th". */
export const youPickWords = (first: number, second: number | null) => (second === null ? placeWords(first) : `${placeWords(first)}, then ${placeWords(second)}`);

/** A pick time, short: "90s", "2m", "8h". */
export function pickTimeWords(seconds: number): string {
  if (seconds % 3600 === 0) return `${seconds / 3600}h`;
  if (seconds % 60 === 0) return `${seconds / 60}m`;
  return `${seconds}s`;
}
export const aPickWords = (seconds: number) => `${pickTimeWords(seconds)} a pick`;

/** Time left, as a clock counts it: "0:48" under an hour, then "5h 12m", then "1d 4h". */
export function timeLeftWords(left: number): string {
  const ms = Math.max(0, left);
  if (ms < HOUR_MS) {
    const seconds = Math.ceil(ms / SECOND_MS);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }
  const days = Math.floor(ms / DAY_MS);
  const hours = Math.floor((ms % DAY_MS) / HOUR_MS);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${Math.floor((ms % HOUR_MS) / MINUTE_MS)}m`;
}
export const inWords = (left: number) => `in ${timeLeftWords(left)}`;

/** The header's heads and readings, while the draft runs. */
export const pickOfHead = (pick: number, picks: number) => `Pick ${pick} of ${picks}`;
export const roundPickWords = (round: number, pickInRound: number) => `Round ${round}, pick ${pickInRound}`;
export const onTheClockHead = "On the clock";
export const yourTeamWords = (name: string) => `${name}, you`;
export const clockAPickHead = (seconds: number) => `${clockHead}, ${aPickWords(seconds)}`;
export const nextHead = "Next";
export const nextWords = (names: readonly string[]) => names.join(", then ");
export const yourNextHead = (onTheClock: boolean) => (onTheClock ? "Your next after this" : "Your next pick");
export const inPicksWords = (picks: number) => (picks === 1 ? "in 1 pick" : `in ${picks} picks`);

/** The board. */
export const BOARD_TITLE = "Board";
export const roundsShownWords = (first: number, last: number, rounds: number) => `Rounds ${first} to ${last} of ${rounds}`;
export const theOrderRoundsWords = (first: number, last: number, rounds: number) => `The order, rounds ${first} to ${last} of ${rounds}`;
export const wholeBoardWords = "Whole board";
export const roundHead = { short: "Rd", long: "Round" };
/** Which way a round runs, for screen readers: the snake turns each round. */
export const roundWayLabel = (leftToRight: boolean) => (leftToRight ? "runs left to right" : "runs right to left");
/** A pick's slot, as the board writes it: round 4's 3rd pick is "4.03". */
export const slotWords = (round: number, pickInRound: number) => `${round}.${String(pickInRound).padStart(2, "0")}`;
/** Before the time it has left: "4.03, 0:48". */
export const onTheClockSlotWords = (slot: string) => `${slot}, `;
/** A pick made: "MCI, 1.01", and "MCI, 1.01, auto" for one auto-pick made, which the whole league
 *  sees (Craig, 5 Nov 2026, on #1100). */
export const pickedWords = (clubShortName: string, slot: string, auto: boolean) => `${clubShortName}, ${slot}${auto ? `, ${autoWords}` : ""}`;
export const autoWords = "auto";
/** A traded pick (#1096): "via" the team it came from, whose turn it falls on, under the team that
 *  holds it now (spec/04, The picks; the approved draft room picture): "via Bale Out". */
export const viaWords = (team: string) => `via ${team}`;
/** A traded pick made or on the clock, whose first lines are taken: "Rovers XI via Bale Out". */
export const heldViaWords = (owner: string, team: string) => `${owner} ${viaWords(team)}`;
/** A pick whose player the football data no longer holds (#323). */
export const lostPlayerWords = "Player missing from the football data";
/** The queue and do-not-draft panels (spec/04, The queue and the ranking; #1100). */
export const QUEUE_TITLE = "Your queue";
export const queueAside = (count: number) => `${count}, only you see it`;
export const loadingListsWords = "Loading your queue…";
export const emptyQueueWords = "No one in your queue.";
export const fromShortlistWords = "Add from your Scouting shortlist";
export const addWholeShortlistWords = "Add my whole shortlist";
/** What "Add my whole shortlist" did, as the queue's limit left it (Craig, 4 Nov 2026, on #1137). */
export function shortlistAddedWords(added: number, leftOut: number): string {
  const put = `${added === 1 ? "1 player" : `${added} players`} added to your queue.`;
  return leftOut === 0 ? put : `${put} ${leftOut} left out: a queue holds at most ${DRAFT_LIST_MOST}.`;
}
export const DO_NOT_DRAFT_TITLE = "Do not draft";
export const doNotDraftAside = (count: number) => `${count}, auto-pick skips them`;
/** The lists, for screen readers. */
export const queueListLabel = "Your queue, first choice first";
export const doNotDraftListLabel = "Your do-not-draft list";
/** On a row's cross, for screen readers: whom it takes off which list. */
export const takeOffLabel = (name: string, list: "queue" | "doNotDraft") =>
  list === "queue" ? `Take ${name} off your queue` : `Take ${name} off your do-not-draft list`;
/** On a queued row's handle, for screen readers: it drags, or moves a place with the arrow keys. */
export const moveLabel = (name: string, place: number) => `Move ${name}, ${placeWords(place)} in your queue: drag, or press the up or down arrow`;
export const listChangeFailedWords = failedWords("your draft lists didn't change");

/** The auto-pick panel (spec/04, Auto-pick; #1100). */
export const AUTO_PICK_TITLE = "Auto-pick";
export const autoPickAside = (on: boolean) => (on ? "on auto-pick" : "you pick");
export const timeoutsHead = "Timeouts";
/** After "Timeouts 1 of 2": what the limit does, or that the league has none. */
export const timeoutsWords = (limit: number | null) =>
  limit === null ? "Your league never puts you on auto-pick." : `At ${limit} you go on auto-pick, from your queue first, then the site's ranking.`;
/** While on it: his last pick, if the draft made it (Craig, 5 Nov 2026, on #1100). */
export const onAutoPickWords = (lastAutoSlot: string | null) =>
  lastAutoSlot === null
    ? "On auto-pick: your picks are made for you at once, from your queue first, then the site's ranking."
    : `On auto-pick: your last pick, ${lastAutoSlot}, was made for you`;
export const turnOnAutoPickWords = "Turn auto-pick on";
export const takeControlBackWords = "Take control back";

/** The players list (spec/04, The draft room; #1099): Scouting's, each player the reader's team
 *  can't take greyed out in his place, with why. */
export const PLAYERS_TITLE = "Players";
export const loadingPlayersWords = "Loading the players…";
export const leftWords =(count: number) => `${count} left`;
export const notLegalWords = {
  squadFull: "Squad full",
  clubFull: "Club full",
  areasShort: "Squad needs other positions",
  /** Picking him would leave no legal squad from the players still undrafted (#1088). */
  noFinish: "Leaves no legal squad",
} as const;
export const selectLabel = (name: string) => `Show ${name}`;
export const closePanelLabel = "Close";
/** The players list's title bar (the approved picture): the position tabs, Find and the stats. */
export const positionTabsLabel = "Position";
export const everyPositionTabWords = "All";
export const findLabel = "Find";
export const findPlaceholder = "Player or club";
export const statsLabel = "Stats:";
/** The stats the list opens on (spec/04, The draft room: "a easy to see view first"). */
export const overviewWords = "Overview";
/** A season by the years it spans: 2025's is "25/26". */
export const seasonShortWords = (startYear: number) => `${String(startYear % 100).padStart(2, "0")}/${String((startYear + 1) % 100).padStart(2, "0")}`;
/** The list's own columns besides Scouting's Pos and Player: a short head, and what it stands for. */
export const draftColumns = {
  rank: { short: "Rank", long: "Place on the site's ranking" },
  appearances: { short: "MP", long: "Matches played" },
  goals: { short: "G", long: "Goals" },
  assists: { short: "A", long: "Assists" },
  cleanSheets: { short: "CS", long: "Clean sheets" },
} as const;
/** Last season's points' head, named by the season they are from; with none priced, "last season". */
export const lastSeasonPointsColumn = (season: number | null) =>
  season === null
    ? { short: "Pts last season", long: "Points last season under the site's scoring" }
    : { short: `Pts ${seasonShortWords(season)}`, long: `Points in ${seasonShortWords(season)} under the site's scoring` };
/** A row's mark for a player in the reader's queue, by his place in it. */
export const queueMarkWords = (place: number) => `Queue ${place}`;

/** The selected player's panel. */
export const draftPlayerWords = (name: string) => `Draft ${name}`;
/** Under the Draft button while the reader is on the clock: "Pick 4.03, 0:48 left". */
export const pickLeftWords = (slot: string) => `Pick ${slot}, `;
export const leftSuffixWords = " left";
export const notYourPickWords = "Not your pick";
export const pausedPickWords = "The draft is paused";
export const notStartedPickWords = "The draft hasn't started";
export const takenWords = (teamName: string) => `On ${teamName}`;
export const playsHead = "Plays";
export const rankHead = "Rank";
export const onTheRankingWords = " on the site's ranking";
/** After last season's points: "in 36 games". */
export const inGamesWords = (games: number) => (games === 1 ? " in 1 game" : ` in ${games} games`);
/** A player not in last season's data (Craig, 4 Nov 2026). */
export const newcomerWords = "Not in last season's data";
export const yourSquadHead = "Your squad";
/** How many of his position and of his club the reader's squad holds: "CAM 0, MUN 1 of 2", the club
 *  maximum left off where the league sets none. */
export const yourSquadWords = (position: string, atPosition: number, club: string, atClub: number, maxPerClub: number | null) =>
  `${position} ${atPosition}, ${club} ${atClub}${maxPerClub === null ? "" : ` of ${maxPerClub}`}`;
export { playerCardWords } from "../shared/words";
export const pickFailedWords = "The pick couldn't be made. Try again.";

export const noRoundsWords = "The draft's rounds are its squads' most players, and this league's squads have no size limit yet.";

/** The commissioner's panel (spec/04, The commissioner; #1101), which only whoever runs the league
 *  sees. */
export const COMMISSIONER_TITLE = "Commissioner";
export const onlyYouWords = "only you see this";
export const startNowWords = "Start the draft now";
export const pauseWords = "Pause the draft";
export const resumeWords = "Resume the draft";
export const undoLastWords = "Undo last pick";
export const pickForTeamWords = (team: string) => `I'll pick for ${team}`;
export const stopPickingForWords = (team: string) => `Stop picking for ${team}`;
export const unmanagedWords = (team: string) => `${team} has no manager, so it is on auto-pick unless you pick for it`;
export const youPickForWords = (team: string) => `You pick for ${team}: its clock runs, and if it runs out the draft picks for it`;
export const lastPickWords = (team: string, player: string, slot: string) => `Last pick: ${team} took ${player}, ${slot}`;
export const pickTimeLabel = "Pick time";
export const whilePausedWords = "change it while paused";
export const badPickTimeWords = "Type the pick time in seconds, minutes or hours: 90s, 2m or 8h.";
