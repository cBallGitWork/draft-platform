// What League settings says, in one place for Craig to change in the pull request. Why the server
// refused a change is in convex/rules/ (`rulesRefusals`, and leagueRulesCheck.ts's reasons), and
// reaches the screen as is.

import { PICK_SECONDS_FEWEST, PICK_SECONDS_MOST, TIMEOUTS_FEWEST, TIMEOUTS_MOST } from "../../convex/draft/draftLimits";
import type { UndraftedGoTo } from "../../convex/draft/draftRules";
import { MOST_IN_SQUAD } from "../../convex/leagues/leagueLimits";
import { STARTER_COUNT } from "../../convex/lineup/lineup";
import type { Area } from "../../convex/lineup/pitch";
import type { OddTeamOut } from "../../convex/table/roundRobin";
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

/** What a failed save leaves, live or in the preview. */
export const unsavedOutcome = "the settings didn't change";
export const saveFailedWords = failedWords(unsavedOutcome);
