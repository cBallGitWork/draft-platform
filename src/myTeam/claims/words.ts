// What My team's Transactions tab says of waiver claims, the waiver order and the runs (#1200), in
// one place for Craig to change in the pull request. League settings' Waivers tab says the order's
// and the runs' the same way.

import type { WaiverOrderType } from "../../../convex/rules/leagueRulesShape";
import { LOCALE, LONDON_ZONE } from "../../../convex/shared/moments";
import { placeWords, pointsShort } from "../header/words";

export { placeWords, pointsShort };

export const PENDING_CLAIMS_TITLE = "Pending claims";
export const CLAIMS_TITLE = "Claims";
export const HISTORY_TITLE = "History";
export const newestFirstWords = "Newest first";
/** The pending claims' count, as their plate says it: "3, by run". */
export const claimsCountWords = (claims: number) => `${claims}, by run`;
export const noClaimsWords = "No pending claims.";
export const claimsLoadingWords = "Loading your claims…";
export const claimsClosedWords = "Claims are closed until the gameweek's last match is over.";
export const claimsNotOpenWords = "Claims open once the league's draft is over.";
export const playersOnWaiversWords = "Players on waivers, in Scouting ›";

export const claimColumns = {
  handle: { short: "", long: "Drag to reorder" },
  rank: { short: "Rank", long: "Its rank in its run" },
  positions: { short: "Pos", long: "Positions" },
  claim: { short: "Claim", long: "The player claimed" },
  points: { short: "Pts", long: "Points this season" },
  run: { short: "Run", long: "The run that can first take him" },
  drop: { short: "Drop", long: "Who goes if it succeeds" },
};
export const claimsTableLabel = "Your pending claims";
export const everyTeamTableLabel = "Every team's pending claims";

const ukWhen = new Intl.DateTimeFormat(LOCALE, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: LONDON_ZONE });
const ukDayTime = new Intl.DateTimeFormat(LOCALE, { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: LONDON_ZONE });
const ukDay = new Intl.DateTimeFormat(LOCALE, { weekday: "short", timeZone: LONDON_ZONE });
/** A run, UK time: "Wed 11 Nov, 18:00". */
export const runWords = (at: number) => ukWhen.format(at);
/** A run, short: "Wed 18:00". */
export const runShort = (at: number) => ukDayTime.format(at).replace(",", "");
/** A run's day alone: "Wed". */
export const runDayWords = (at: number) => ukDay.format(at);
/** A claim whose player is no longer on waivers, or a league with no run times: no run takes it. */
export const noRunWords = "No run";
/** A run's group in the pending claims: "Wed 11 Nov, 18:00 run", and how many it holds. */
export const runGroupWords = (at: number | null) => (at === null ? noRunWords : `${runWords(at)} run`);
export const claimsInWords = (claims: number) => `${claims} ${claims === 1 ? "claim" : "claims"}`;
/** Who goes when a claim names nobody. */
export const freePlaceWords = "Free place";
/** A claim whose drop an earlier claim in its run names too. */
export const failsIfWords = (rank: number) => `Fails if claim ${rank} wins`;
/** The selected claim's panel title: "Wed run, claim 2: Eze". */
export const claimPanelTitle = (runAt: number | null, rank: number, playerName: string) =>
  `${runAt === null ? noRunWords : `${runDayWords(runAt)} run`}, claim ${rank}: ${playerName}`;
export const runLabel = "Run";
export const clashWords = (rank: number, dropName: string) => `Claim ${rank} also drops ${dropName}.`;
export const dropLabel = "Drop";
export const dropNobodyWords = "Nobody";
export const moveUpWords = "Move up";
export const moveDownWords = "Move down";
export const withdrawWords = "Withdraw";
export const playerCardWords = "Player card ›";
export const dragHandleLabel = (playerName: string) => `Drag the claim for ${playerName} to reorder it`;
export const dragGlyph = "⋮⋮";
export const selectClaimLabel = (playerName: string) => `Open the claim for ${playerName}`;
export const claimFailedWords = "That claim couldn't be changed. Try again.";

/** The commissioner's switch between his own claims and every team's. */
export const claimsViews = ["mine", "everyTeam"] as const;
export type ClaimsView = (typeof claimsViews)[number];
export const claimsViewWords: Record<ClaimsView, string> = { mine: "Mine", everyTeam: "Every team" };
export const claimsViewLabel = "Whose claims";
/** A team's group under Every team: "1st in the waiver order, 1 claim". */
export const teamGroupWords = (place: number | null, claims: number) =>
  `${place === null ? "" : `${placeWords(place)} in the waiver order, `}${claimsInWords(claims)}`;
export const teamsWithoutClaimsWords = (teams: number) => `${teams} ${teams === 1 ? "team" : "teams"}: no claims`;

export const WAIVER_ORDER_TITLE = "Waiver order";
export const waiverOrderWords: Record<WaiverOrderType, string> = { reverseStandings: "Reverse table order", rotating: "Rotating" };
/** A team's line in the waiver order: "8th in the table," then its points. */
export const tablePlaceWords = (place: number) => `${placeWords(place)} in the table, `;
/** Under the waiver order: how it works now, naming the gameweek whose end resets it (the one under
 *  way in the lock, else the next deadline's). */
export const waiverOrderNote = (type: WaiverOrderType, resetsAfter: number | null) =>
  type === "rotating"
    ? "Whoever last won a claim drops to the bottom, and it never resets."
    : `The bottom of the table claims first. A team that wins a claim drops to the bottom until ${resetsAfter === null ? "the gameweek" : `GW${resetsAfter}`} ends, when the order is worked out again. Teams level on points go by the table's tie-breaks.`;
export const waiverOrderLoadingWords = "Loading the waiver order…";

export const RUNS_TITLE = "Runs";
export const ukTimeWords = "UK time";
export const nextRunWords = "Next";
export const freeAgentsWords = "Free agents";
/** Free agents before the league's draft is over (S08.1), matching `claimsNotOpenWords`. */
export const freeAgentsNotOpenWords = "Open once the league's draft is over";
/** A run that falls after a gameweek's deadline: it is skipped if that gameweek's last match isn't
 *  over by then, which isn't known ahead (Craig, 11 Nov 2026, on #1488). */
export const skippedIfWords = (gameweek: number) => `Skipped if GW${gameweek} is still on`;
/** When free agents can be picked up: never before the league's draft is over (S08.1). In the lock,
 *  or shut with its first run after the next deadline, it waits on `waitsOn`'s last match, whose
 *  time isn't known ahead, so it says so in words (Craig, 11 Nov 2026: "after GW12's last match"). */
export const windowWords = ({ drafted, open, locked, firstRun, waitsOn, gameweek }: { drafted: boolean; open: boolean; locked: boolean; firstRun: number | null; waitsOn: number | null; gameweek: number | null }) => {
  if (!drafted) return freeAgentsNotOpenWords;
  const to = gameweek === null ? "" : ` to the GW${gameweek} deadline`;
  if (open && !locked) return `Open${to}`;
  if (locked || waitsOn !== null) return `From the first run after ${waitsOn === null ? "the gameweek" : `GW${waitsOn}`}'s last match${to}`;
  return firstRun === null ? "Closed" : `From ${runShort(firstRun)}${to}`;
};
