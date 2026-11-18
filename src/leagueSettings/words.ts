// What League settings says, in one place for Craig to change in the pull request. Why the server
// refused a change is in convex/rules/ (`rulesRefusals`, and leagueRulesCheck.ts's reasons), and
// reaches the screen as is.

import { DRAFT_FEWEST_TEAMS, PICK_SECONDS_FEWEST, PICK_SECONDS_MOST, TIMEOUTS_FEWEST, TIMEOUTS_MOST } from "../../convex/draft/draftLimits";
import type { UndraftedGoTo } from "../../convex/draft/draftRules";
import { FIRST_GAMEWEEK } from "../../convex/gameweeks/usedGameweeks";
import { GAMES_FEWEST, MAX_PER_CLUB_FEWEST, MOST_IN_SQUAD } from "../../convex/leagues/leagueLimits";
import { STARTER_COUNT } from "../../convex/lineup/lineup";
import type { Area } from "../../convex/lineup/pitch";
import type { LeagueRules, TradeReview, WEEKDAYS } from "../../convex/rules/leagueRulesShape";
import type { DoubleGameweekRule } from "../../convex/scoring/values";
import { twelveHourWords } from "../../convex/shared/moments";
import { hoursWords } from "../../convex/shared/time";
import type { TieBreak } from "../../convex/table/standings";
import { REVIEW_MS } from "../../convex/trades/tradeLimits";
import { WAIVER_MS } from "../../convex/waivers/waiverLimits";
import { noNumberWords, savedFromWords } from "../rules/words";
import { AREA_PLAYER_WORDS, BID_ORDER_TITLE, commissionerVetoWords, failedWords, inReviewWords, leagueVoteWords, menuWords, notSetWords, pointsAgainstWords, pointsForWords } from "../shared/words";
import { inUnit, type PickClockUnit } from "./pickClock";

export const SETTINGS_TITLE = "League settings";
export const loadingWords = "Loading the league settings…";

export const fixturesTitle = "Fixtures";
export const gamesLabel = "Games a gameweek";
export const gamesUnit = "head-to-heads per team";
export const gamesHint = `A whole number, ${GAMES_FEWEST} or more. With fewer other teams than that, each team plays every other once a gameweek.`;
/** Craig, 22 Oct 2026 (#266): "games played in past are done". */
export const redrawWords = "Saving redraws the head-to-heads from the gameweek it applies from. Gameweeks already played keep theirs.";
export const blankGamesWords = noNumberWords(gamesLabel);
/** The format (spec/03, S03.1): its lock, and why, is said again by the server's refusal. */
export const formatLabel = "Format";
export const formatWords: Record<LeagueRules["format"], string> = { headToHead: "Head-to-head", totalPoints: "Total points" };
export const formatHint = "Locked once the first scored gameweek begins, so the table means the same all season.";
/** spec/03: both matches count by default. */
export const doubleGameweekLabel = "Double gameweeks";
export const doubleGameweekWords: Record<DoubleGameweekRule, string> = { bothMatches: "Both matches count", bestMatch: "Best match" };
/** The deadline (spec/03, S03.3). */
export const deadlineLabel = "Deadline";
export const deadlineUnit = "minutes before the gameweek's first kick-off";
export const deadlineHint = "A whole number, 0 or more.";
export const blankDeadlineWords = noNumberWords(deadlineLabel);

/** The table's tie-breaks, whose order the commissioner changes (spec/03, S03.2). */
export const tableTitle = "Table";
export const tieBreaksLabel = "Tie-breaks, in order";
export const tieBreakWords: Record<TieBreak, string> = { pointsFor: pointsForWords, headToHead: formatWords.headToHead, pointsAgainst: pointsAgainstWords };
/** spec/03's play-offs, which no rule holds yet: placeholders in their place (the approved picture). */
export const playOffTeamsLabel = "Play-off teams";
export const playOffLegsLabel = "Play-off legs";

export const squadTitle = "Squad";
export const squadMaximumLabel = "Most players in a squad";
export const squadMaximumHint = `A whole number from ${STARTER_COUNT} to ${MOST_IN_SQUAD} (a Premier League squad), and not below the squad's minimum size.`;
/** Why the draft can't start without a squad size limit (Craig, 5 Nov 2026, on #1088: "Can't start
 *  without a max"). */
export const noSquadSizeWords = "The draft can't start without a squad size limit. It has one round for each squad place.";
export const blankSquadMaximumWords = noNumberWords(squadMaximumLabel);
export const areaMinimumsLabel = "Fewest players by area";
/** One area's box, for screen readers: "Fewest defenders". */
export const areaMinimumLabel = (area: Area) => `Fewest ${AREA_PLAYER_WORDS[area]}`;
export const areaMinimumsHint = "Whole numbers, 0 for none. Together they can't be more than the squad size. A player who plays in two, such as defence and midfield, counts in whichever helps.";
export const blankAreaMinimumWords = (area: Area) => noNumberWords(areaMinimumLabel(area), "put 0");
export const clubMaximumWords = "A limit on players from one club";
export const clubMaximumLabel = "Most players from one club";
export const clubMaximumHint = `A whole number, ${MAX_PER_CLUB_FEWEST} or more.`;
export const blankClubMaximumWords = noNumberWords(clubMaximumLabel, "turn the limit off");

export const draftTitle = "Draft";
/** The draft's start date (spec/04, Starting it; Craig, 11 Nov 2026, on #1476), saved with the
 *  rest of the settings. */
export const draftStartLabel = "Starts";
export const clearDraftStartWords = "Clear";
export const draftStartHint = `The draft starts itself at this time. With no date, you start it from the draft room. The date must be in the future, and the league needs at least ${DRAFT_FEWEST_TEAMS} teams.`;
export const draftStartedFixedWords = "The draft has started.";
export const draftStartLoadingWords = "Loading the draft's start…";
/** The bar once the date alone is saved (#1780): the settings' words name a gameweek, which a date has none of. */
export const draftStartSavedWords = "Saved.";
/** What a failed change leaves, live or in the preview. */
export const unchangedDraftStartOutcome = "the draft's start didn't change";
export const draftStartFailedWords = failedWords(unchangedDraftStartOutcome);
export const pickClockLabel = "Time for each pick";
export const pickClockUnitLabel = "Time for each pick, in";
export const pickClockUnitWords: Record<PickClockUnit, string> = { seconds: "Seconds", minutes: "Minutes", hours: "Hours" };
export const pickClockHint = `From ${PICK_SECONDS_FEWEST} seconds to ${inUnit(PICK_SECONDS_MOST, "hours")} hours.`;
export const blankPickClockWords = noNumberWords(pickClockLabel);
/** The Draft tab's row for auto-pick, the approved picture's short label. */
export const autoPickLabel = "Auto-pick"; // literal-ok: the settings row's label; the draft room's AUTO_PICK_TITLE is another feature's, which featureImports keeps out
export const autoPickWords = "Auto-pick after timeouts";
/** The Auto-pick line as 1440-draft.png has it: a tick, "After", the box, "timeouts". */
export const autoPickAfterWords = "After";
export const timeoutsUnitWords = "timeouts";
export const timeoutsLabel = "Timeouts before auto-pick";
/** spec/04, Auto-pick. */
export const timeoutsHint = `A whole number, ${TIMEOUTS_FEWEST} to ${TIMEOUTS_MOST}. When a clock runs out, the pick is made for him and counts as a timeout. A manager on auto-pick can take control back himself.`;
export const neverAutoPickWords = "Never: the clock runs for every pick.";
export const blankTimeoutsWords = noNumberWords(timeoutsLabel, "turn auto-pick after timeouts off");
export const undraftedLabel = "Undrafted players go to";
export const undraftedWords: Record<UndraftedGoTo, string> = { waivers: "Released", freeAgents: "Free agents" };

export const tradesTitle = "Trades";
export const tradeReviewLabel = "An accepted trade is reviewed by";
/** The Trades tab's rows, the approved picture's short labels. */
export const tradeReviewRowLabel = "Review";
export const tradeDeadlineRowLabel = "Trade deadline";
export const tradeReviewWords: Record<TradeReview, string> = {
  none: "No one",
  veto: commissionerVetoWords,
  vote: leagueVoteWords,
};
/** spec/08, Trades, and Craig's answers on #383 (31 Oct and 6 Nov 2026). */
export const tradeReviewHint =
  `With no one, an accepted trade goes through at once. A review lasts ${hoursWords(REVIEW_MS)}. With a veto, a trade the commissioner is in goes to the co-commissioner, or to a vote if there isn't one. With a vote, it's blocked only if most managers still playing vote against it.`;
export const tradeDeadlineWords = "A trade deadline";
/** The Trade deadline line as 1440-trades.png has it: a tick, "No trades after", the gameweek. */
export const tradeDeadlineAfterWords = "No trades after";
export const tradeDeadlineLabel = "No trades after gameweek";
/** Craig, 6 Nov 2026, on #383; the season's last gameweek is however many it has (#1618). */
export const tradeDeadlineHint = (seasonGameweeks: number) =>
  `A gameweek, ${FIRST_GAMEWEEK} to ${seasonGameweeks}. Trades stop after its last match. Open offers close, and a trade already in review still finishes.`;
export const blankTradeDeadlineWords = "The trade deadline has no gameweek. Choose one, or turn the deadline off, then save.";

/** How waivers run (spec/03, spec/08; #1200, the waivers picture's Waivers tab). The tab keeps
 *  "Waivers" as the rule's name; the rest says bids (SPEC.md Glossary, Craig, 18 Nov 2026). */
export const waiversTitle = "Waivers";
export const waiverOrderLabel = BID_ORDER_TITLE;
/** Each order type explained, and when a change applies (Craig, 6 Nov 2026, on #1200). */
export const waiverOrderHint =
  "Reverse table order: the bottom of the table bids first. A team that wins a bid drops to the bottom until the gameweek ends, then the order resets. Rotating: whoever last won a bid drops to the bottom, and it never resets. A change applies at once, from today's order.";
export const runsLabel = "Bids settle, UK time";
export const runDayLabel = (run: number) => `Settle ${run}, day`;
export const runTimeLabel = (run: number) => `Settle ${run}, time`;
export const removeRunWords = "Remove";
export const removeRunLabel = (run: number) => `Remove settle time ${run}`;
export const addRunWords = "Add a settle time";
export const runsHint = `Bids settle on every player released for ${hoursWords(WAIVER_MS)} or more. A settle time between a deadline and the gameweek's last match is skipped.`;
export const runTwiceWords = "Two settle times are the same. Change or remove one.";
export const weekdayNames: Record<(typeof WEEKDAYS)[number], string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};
/** A run's time of day, 12-hour as every screen says a time: "6pm". */
export const runTimeWords = (hour: number, minute: number) => twelveHourWords(hour, minute);

/** The draft order, which the commissioner sets or draws at random (Craig, 4 Nov 2026, on #1087
 *  and #1089). */
export const teamOrderTitle = "Draft order";
export const teamOrderHint = "Teams start in the order they joined. Later joiners go to the bottom. Moves and draws save at once.";
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

export const savedWords = (gameweek: number) => savedFromWords("The new settings apply", gameweek, ", and the league gets a letter about it");

/** The scoring start (spec/04, After the draft; Craig, 5 Nov 2026, on #1097), on Fixtures (#1190),
 *  saved at once, apart from the settings' Save, as it isn't one of the league's rules rows. */
export const scoringStartLabel = "Scoring starts in";
export const scoringStartHint = "Earlier gameweeks score nothing and have no head-to-heads.";
export const savesAtOnceWords = "A change saves at once.";
/** The picker's choice while none is set. */
export const noScoringStartWords = notSetWords;
export const noScoringStartHint = "Not set. Every ticked gameweek scores until the draft ends, which sets it to the next gameweek.";
export const scoringStartFixedAfter = (deadline: string) => `Fixed after ${deadline}.`;
export const scoringStartFixedWords = (deadline: string) => `Fixed. Its deadline, ${deadline}, has passed.`;
/** None set in a league that has already scored a gameweek, so none set is fixed (#1588). */
export const seasonBegunStartHint = "Fixed. The league has scored a gameweek already, so every ticked gameweek scores.";
export const noScoringStartChoicesWords = "Nothing to choose. No ticked gameweek ahead has a known deadline yet.";
export const scoringStartLoadingWords = "Loading the scoring start…";
/** What a failed change leaves, live or in the preview. */
export const unchangedStartOutcome = "the scoring start didn't change";
export const scoringStartFailedWords = failedWords(unchangedStartOutcome);

/** What a failed save leaves, live or in the preview. */
export const unsavedOutcome = "the settings didn't change";
export const saveFailedWords = failedWords(unsavedOutcome);

/** The tabs on the title plate, in the approved pictures' order (docs/design/approved/settings/):
 *  each holds its own panels, and the edits are kept as they switch. */
export const SETTINGS_TABS = ["fixtures", "squad", "draft", "waivers", "trades", "draftOrder"] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];
export const settingsTabsLabel = "League settings' tabs";
export const settingsTabWords: Record<SettingsTab, string> = {
  fixtures: fixturesTitle,
  squad: squadTitle,
  draft: draftTitle,
  waivers: waiversTitle,
  trades: tradesTitle,
  draftOrder: teamOrderTitle,
};

/** The right-hand widgets (README, Interaction notes): what each tab's rules lead to. */
export const gameweeksWidgetTitle = "Gameweeks";
export const editGameweeksWords = "Edit ›";
export const gameweeksLoadingWords = "Loading the gameweeks…"; // one-home-ok: the Gameweeks screen's own words are another feature's, which featureImports keeps out
/** A ticked gameweek before the scoring start, the start itself, and an unticked gameweek. */
export const noScoresWords = "No scores";
export const scoringStartsWords = "Scoring starts";
export const notUsedWords = "Not used";
export const draftWidgetTitle = "The draft";
export const draftRoundsLabel = "Rounds";
export const draftPicksLabel = "Picks";
export const draftTeamsLabel = "Teams";
/** The draft's start once it has begun. */
export const draftBegunWords = "Started";
export const draftRoomWords = "Draft room ›";
export const draftOrderLinkWords = "Draft order ›";
/** The Trades tab's widget (S08.30). */
export const inReviewWidgetTitle = inReviewWords;
export const inReviewLoadingWords = "Loading the trades in review…";
export const tradeInReviewWords = (fromTeamName: string, toTeamName: string) => `${fromTeamName} ⇄ ${toTeamName}`;
export const reviewEndsAtWords = (when: string) => `Ends ${when}`;
export const noneInReviewWords = "None in review";
export const tradesLinkWords = `${menuWords.trades} ›`;
/** The Draft order tab's widget: the snake's second round (S04.18). */
export const roundTwoWidgetTitle = "Round 2";
export const reversedWords = "Reversed";
/** The Squad tab's widget, read-only (S03.10). */
export const presetsWidgetTitle = "Formation presets";
