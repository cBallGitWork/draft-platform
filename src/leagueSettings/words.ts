// What League settings says, in one place for Craig to change in the pull request. Why the server
// refused a change is in convex/rules/ (`rulesRefusals`, and leagueRulesCheck.ts's reasons), and
// reaches the screen as is.

import { PICK_SECONDS_FEWEST, PICK_SECONDS_MOST, TIMEOUTS_FEWEST, TIMEOUTS_MOST } from "../../convex/draft/draftLimits";
import type { UndraftedGoTo } from "../../convex/draft/draftRules";
import { FIRST_GAMEWEEK, GAMEWEEKS } from "../../convex/gameweeks/usedGameweeks";
import { MOST_IN_SQUAD } from "../../convex/leagues/leagueLimits";
import { STARTER_COUNT } from "../../convex/lineup/lineup";
import type { Area } from "../../convex/lineup/pitch";
import type { TradeReview, WEEKDAYS } from "../../convex/rules/leagueRulesShape";
import { hoursWords } from "../../convex/shared/time";
import type { OddTeamOut } from "../../convex/table/roundRobin";
import { REVIEW_MS } from "../../convex/trades/tradeLimits";
import { noNumberWords, savedFromWords } from "../rules/words";
import { AREA_WORDS, failedWords } from "../shared/words";
import { inUnit, type PickClockUnit } from "./pickClock";

export const SETTINGS_TITLE = "League settings";
export const loadingWords = "Loading the league settings…";
export const noRulesWords = "This league was made before leagues held their rules, so it has no settings to edit yet.";

export const fixturesTitle = "Fixtures";
export const oddTeamOutLabel = "With an odd number of teams, the team left over plays";
export const oddTeamOutWords: Record<OddTeamOut, string> = { leagueAverage: "The league's average", bye: "No one (a bye)" };
export const gamesLabel = "Head-to-head games each team plays a gameweek";
export const gamesHint = "A whole number, 1 or more. With fewer other teams than that, each team plays every other once a gameweek.";
/** Craig, 22 Oct 2026 (#266): "games played in past are done". */
export const redrawWords = "Saving either redraws the fixtures from the gameweek it applies from. Gameweeks already played keep theirs.";
export const blankGamesWords = noNumberWords("Games a gameweek");

export const squadTitle = "Squad";
export const squadMaximumLabel = "Most players in a squad";
export const squadMaximumHint = `A whole number, ${STARTER_COUNT} to ${MOST_IN_SQUAD}, a Premier League squad, and no fewer than the league's least squad size.`;
/** Why the draft can't start without a squad size limit (Craig, 5 Nov 2026, on #1088: "Can't start
 *  without a max"). */
export const noSquadSizeWords = "This league's squads have no size limit, so its draft can't start: the draft's rounds are the squads' most players.";
export const blankSquadMaximumWords = noNumberWords(squadMaximumLabel);
export const areaMinimumsLabel = "Fewest players in each area";
/** One area's box, for screen readers: "Fewest in Defence". */
export const areaMinimumLabel = (area: Area) => `Fewest in ${AREA_WORDS[area]}`;
export const areaMinimumsHint = "Whole numbers, 0 for none, adding up to no more than the squad's most. A player who plays two areas counts in one, whichever helps.";
export const blankAreaMinimumWords = (area: Area) => noNumberWords(areaMinimumLabel(area), "put 0");
export const clubMaximumWords = "A limit on players from one club";
export const clubMaximumLabel = "Most players from one club";
export const clubMaximumHint = "A whole number, 1 or more.";
export const blankClubMaximumWords = noNumberWords(clubMaximumLabel, "turn the limit off");

export const draftTitle = "Draft";
export const pickClockLabel = "Time for each pick";
export const pickClockUnitLabel = "Time for each pick, in";
export const pickClockUnitWords: Record<PickClockUnit, string> = { seconds: "Seconds", minutes: "Minutes", hours: "Hours" };
export const pickClockHint = `From ${PICK_SECONDS_FEWEST} seconds to ${inUnit(PICK_SECONDS_MOST, "hours")} hours.`;
export const blankPickClockWords = noNumberWords(pickClockLabel);
export const autoPickWords = "Auto-pick after timeouts";
export const timeoutsLabel = "Timeouts before auto-pick";
/** spec/04, Auto-pick. */
export const timeoutsHint = `A whole number, ${TIMEOUTS_FEWEST} to ${TIMEOUTS_MOST}. A clock that runs out makes the pick and counts as a timeout; a manager on auto-pick can take control back himself.`;
export const neverAutoPickWords = "Never: the clock runs for every pick.";
export const blankTimeoutsWords = noNumberWords(timeoutsLabel, "turn auto-pick after timeouts off");
export const undraftedLabel = "Players nobody drafts go to";
export const undraftedWords: Record<UndraftedGoTo, string> = { waivers: "Waivers", freeAgents: "Free agents" };
/** Craig, 4 Nov 2026, on #1087. */
export const undraftedHint = "Until waivers are built, they go to free agents.";

export const tradesTitle = "Trades";
export const tradeReviewLabel = "An accepted trade is reviewed by";
export const tradeReviewWords: Record<TradeReview, string> = {
  none: "No one",
  veto: "Commissioner veto",
  vote: "League vote",
};
/** spec/08, Trades, and Craig's answers on #383 (31 Oct and 6 Nov 2026). */
export const tradeReviewHint =
  `With no one, an accepted trade goes through at once; a review lasts ${hoursWords(REVIEW_MS)}. Under a veto, a trade the commissioner is in goes to the co-commissioner, or to a vote if there is none. Under a vote, it is blocked only if most of the managers still playing vote against it.`;
export const tradeDeadlineWords = "A trade deadline";
export const tradeDeadlineLabel = "No trades after gameweek";
/** Craig, 6 Nov 2026, on #383. */
export const tradeDeadlineHint = `A gameweek, ${FIRST_GAMEWEEK} to ${GAMEWEEKS}. Trades stop once its last match is over: open offers close, and a trade already in review finishes it.`;
export const blankTradeDeadlineWords = noNumberWords(tradeDeadlineLabel, "turn the trade deadline off");

/** How waivers run (spec/03, spec/08; #1200, the waivers picture's Waivers tab). */
export const waiversTitle = "Waivers";
export const waiverOrderLabel = "Waiver order";
/** Each order type explained, and when a change applies (Craig, 6 Nov 2026, on #1200). */
export const waiverOrderHint =
  "Reverse table order: the bottom of the table claims first; a team that wins a claim drops to the bottom until the gameweek ends, when the order is worked out again. Rotating: whoever last won a claim drops to the bottom, and it never resets. A change applies at once, from today's order.";
export const runsLabel = "Runs, UK time";
export const runDayLabel = (run: number) => `Run ${run}'s day`;
export const runTimeLabel = (run: number) => `Run ${run}'s time`;
export const removeRunWords = "Remove";
export const removeRunLabel = (run: number) => `Remove run ${run}`;
export const addRunWords = "Add a run";
export const runsHint = "Each run takes every player whose 24 hours on waivers are up. A run between a deadline and the gameweek's last match is skipped.";
export const runTwiceWords = "Two runs are at the same time: change one or remove it.";
export const dayWords: Record<(typeof WEEKDAYS)[number], string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};
/** A run's time of day: "18:00". */
export const runTimeWords = (hour: number, minute: number) => `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

/** The draft order, which the commissioner sets or draws at random (Craig, 4 Nov 2026, on #1087
 *  and #1089). */
export const teamOrderTitle = "Draft order";
export const teamOrderHint = "Teams start in the order they joined, and a team that joins later goes to the bottom. A move or a draw saves at once.";
export const drawOrderWords = "Draw at random";
export const draftStartedWords = "The draft has started, so this order is fixed.";
export const teamOrderLoadingWords = "Loading the draft order…";
export const noTeamsWords = "No teams have joined yet.";
export const moveUpWords = "Up";
export const moveDownWords = "Down";
/** Each move button, for screen readers: "Move Team 3 up". */
export const moveUpLabel = (team: string) => `Move ${team} up`;
export const moveDownLabel = (team: string) => `Move ${team} down`;
/** What a failed move leaves, live or in the preview. */
export const unmovedOutcome = "the draft order didn't change";
export const teamOrderFailedWords = failedWords(unmovedOutcome);

export const savedWords = (gameweek: number) => savedFromWords("The new settings apply", gameweek, ", and the league has a letter saying so");

/** The scoring start (spec/04, After the draft; Craig, 5 Nov 2026, on #1097), on Fixtures (#1190),
 *  saved at once, apart from the settings' Save, as it isn't one of the league's rules rows. */
export const scoringStartLabel = "Scoring starts in";
export const scoringStartHint = "Earlier gameweeks score nothing and have no head-to-heads.";
export const savesAtOnceWords = "A change saves at once.";
/** The picker's choice while none is set. */
export const noScoringStartWords = "Not set";
export const noScoringStartHint = "Not set: every ticked gameweek scores until the draft ends, which sets it to the next gameweek.";
export const scoringStartFixedAfter = (deadline: string) => `Fixed after ${deadline}.`;
export const scoringStartFixedWords = (deadline: string) => `Fixed: its deadline, ${deadline}, has passed.`;
export const noScoringStartChoicesWords = "No ticked gameweek with a known deadline is still to begin, so scoring can't start in one.";
export const scoringStartLoadingWords = "Loading the scoring start…";
/** What a failed change leaves, live or in the preview. */
export const unchangedStartOutcome = "the scoring start didn't change";
export const scoringStartFailedWords = failedWords(unchangedStartOutcome);

/** What a failed save leaves, live or in the preview. */
export const unsavedOutcome = "the settings didn't change";
export const saveFailedWords = failedWords(unsavedOutcome);
