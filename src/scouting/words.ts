// What Scouting says, in one place for Craig to change in the pull request.

import type { Area } from "../../convex/lineup/pitch";
import { RANKED_MINUTES } from "../../convex/scouting/per90Figures";
import { PERIOD_GAMEWEEKS } from "../../convex/scouting/periods";
import {
  ASSISTS,
  BIG_CHANCES_CREATED,
  CLEAN_SHEETS,
  CLEARANCES,
  GOALS,
  GOALS_CONCEDED,
  INTERCEPTIONS,
  KEY_PASSES,
  PASSES,
  SAVES,
  SHOTS_ON_TARGET,
  TACKLES_WON,
} from "../../convex/scoring/statKeys";
import { runNameWords, type FirstRun } from "../myTeam/claims/words";
import { AREA_PLAYER_WORDS, lastSeasonPointsColumn, PLAYERS_TITLE, STAT_WORD, statNames, underSiteScoringWords } from "../shared/words";
import { afterLastMatchWords, gameweekShort, seasonShortWords, weekdayTimeWords } from "../shared/when/words";
import type { HeldByFilter, Period } from "./seam";

export { figureWords, noFigureWords } from "../shared/words";

export const SCOUTING_TITLE = "Scouting";
export { PLAYERS_TITLE };

/** Scouting's tabs on its title plate (the approved picture). */
export const SCOUTING_TABS = ["players", "statRace"] as const;
export type ScoutingTab = (typeof SCOUTING_TABS)[number];
export const scoutingTabWords: Record<ScoutingTab, string> = { players: PLAYERS_TITLE, statRace: "Leaders" };
export const scoutingTabsLabel = "Scouting's views";

/** Leaders, once the stat race (#800, spec/19 The stat race; SPEC.md Glossary, Craig, 18 Nov 2026). */
export const STAT_RACE_TITLE = scoutingTabWords.statRace;
export const rankByLabel = "Rank by";
export const countsWhatCountedWords = "Counts players who started, and bench players only in matches they came on.";
/** Where a league drafted mid-season's totals start (Craig, 6 Nov 2026, on #800). */
export const sinceWords = (gameweek: number) => `Since ${gameweekShort(gameweek)}`;
export const raceLoadingWords = "Loading the leaders…";
export const raceColumns = {
  rank: { short: "#", long: "Rank" },
  team: { short: "Team", long: "Team" },
} as const;
/** The chosen team's panel: every category, with its total and its rank. */
export const everyCategoryWords = "every category";
export const categoryColumns = {
  category: { short: "Category", long: "Category" },
  total: { short: "Total", long: "Season total" },
  rank: { short: "Rank", long: "Rank in the league" },
} as const;
export const rankWords = (rank: number, teams: number) => `${rank} of ${teams}`;
export { loadingPlayersWords as loadingWords } from "../shared/words";

/** The name box over the list (the approved picture). */
export const nameLabel = "Name";
export const namePlaceholder = "Find a player";

/** The filters over the list (spec/19, The players list). */
export const availabilityLabel = "Show";
export const availabilityWords: Record<HeldByFilter, string> = {
  all: "All",
  freeAgents: "Free agents",
  onWaivers: "Released",
  owned: "Owned",
};
export const positionLabel = "Position";
export const everyPositionWords = "Every position";
export const clubLabel = "Club";
export const everyClubWords = "Every club";
/** The stat shown as a season total beside the list, and sorted by (spec/19, "sortable by any stat"). */
export const statLabel = STAT_WORD;
export const noStatWords = "None";
/** What the list's figures, his panel's per 90 and Compare are over (the approved picture's
 *  Period; #1028, story 3): "Period: Season" (SPEC.md Glossary, Craig, 18 Nov 2026). */
export const periodLabel = "Period";
export const periodWords: Record<Period, string> = {
  season: "Season",
  last4: `Last ${PERIOD_GAMEWEEKS.last4} gameweeks`,
  last6: `Last ${PERIOD_GAMEWEEKS.last6} gameweeks`,
};
/** The period inside a line: "season", "last 4 gameweeks". */
const periodInLine = (period: Period) => periodWords[period].toLowerCase();
/** A figure's period as a hover says it: "this season", "over the last 4 gameweeks". */
const overWords = (period: Period) => (period === "season" ? "this season" : `over the ${periodInLine(period)}`);

/** How many players the filters keep. */
export { playersCount as countWords } from "../shared/words";
export const noneMatchWords = "No player matches these filters.";

/** In the owner column, a player on waivers and when bids on him first settle, in the viewer's
 *  own zone (Craig, 6 Nov 2026, on #1200): "Released, Thu 6pm"; just "Released" with no run times. */
export const onWaiversWords = (firstRun: FirstRun) =>
  firstRun === null ? "Released" : `Released, ${firstRun.skippedIf !== null ? afterLastMatchWords(firstRun.skippedIf) : weekdayTimeWords(firstRun.at)}`;

/** The figures by name, from which each one's hover is built ("Goals this season", "Goals over
 *  gameweeks 4 to 9", "Goals in 25/26"). */
const FIGURE_NAMES = { minutes: "Minutes", goals: "Goals", assists: "Assists", shotsOnTarget: "Shots on target" } as const;
type Figure = keyof typeof FIGURE_NAMES;

/** The list's columns: a short head, and what it stands for (spec/14: dense tables use short codes,
 *  the full name on hover). */
export const columns = {
  name: { short: "Player", long: "Player" },
  club: { short: "Club", long: "Club" },
  positions: { short: "Pos", long: "Positions" },
  owner: { short: "Status", long: "The team that owns him in this league, or when bids on him settle" },
  minutes: { short: "Mins", long: `${FIGURE_NAMES.minutes} this season` },
  seasonPoints: { short: "Pts", long: `Season points ${underSiteScoringWords}` },
  goals: { short: "G", long: `${FIGURE_NAMES.goals} this season` },
  assists: { short: "A", long: `${FIGURE_NAMES.assists} this season` },
  shotsOnTarget: { short: "SOT", long: `${FIGURE_NAMES.shotsOnTarget} this season` },
  roleFit: { short: "Fit", long: "Role fit" },
} as const;

/** The heads of the figures that follow the list's period, as its hover says them: over the last
 *  few gameweeks, the gameweeks counted, while any has finished. */
export function periodColumns(period: Period, gameweeks: readonly number[]) {
  if (period === "season") return {};
  const over = gameweeks.length === 0 ? overWords(period) : `over gameweeks ${gameweeks[0]} to ${gameweeks.at(-1)}`;
  const figure = (column: Figure) => ({ short: columns[column].short, long: `${FIGURE_NAMES[column]} ${over}` });
  return {
    minutes: figure("minutes"),
    goals: figure("goals"),
    assists: figure("assists"),
    shotsOnTarget: figure("shotsOnTarget"),
    points: { short: columns.seasonPoints.short, long: `Points ${over} ${underSiteScoringWords}` },
  };
}

/** The star after a shortlisted player's name, for screen readers and the hover. */
export const shortlistedLabel = "On your shortlist";
/** A row of the list, for screen readers: pressing it opens his panel. The chip it shows, if any,
 *  comes first (WCAG 2.5.3; S12.14): "CDM: show Rice's panel". */
export const selectPlayerLabel = (name: string, chip: string | null) => `${chip === null ? "" : `${chip}: `}Show ${name}'s panel`;

/** The selected player's panel at the top of the right column (the approved picture). */
export { SEASON_POINTS_WORDS as panelSeasonPointsWords } from "../shared/words";
/** His minutes over the period (the approved picture: "Minutes, last 6"). */
export const panelMinutesWords = (period: Period, lastSeason: number | null) =>
  period !== "season" ? `Minutes, last ${PERIOD_GAMEWEEKS[period]}` : lastSeason === null ? columns.minutes.long : `Minutes in ${seasonShortWords(lastSeason)}`;
export const closePanelLabel = "Close his panel";
/** His figures per 90 over the period, ranked against the players of his area (the approved
 *  picture: "Per 90, last 6 gameweeks", "vs attacking midfielders"). */
export const per90Words = (period: Period) => `Per 90, ${periodInLine(period)}`;
/** The panel's own names for the stats it lists per 90, as the picture names them; a stat not here
 *  goes by its catalogue name. */
export const PER90_STAT_NAMES: Readonly<Record<string, string>> = {
  [GOALS]: "Goals",
  [ASSISTS]: "Assists",
  [KEY_PASSES]: statNames.keyPasses,
  [SHOTS_ON_TARGET]: "Shots on target",
  [BIG_CHANCES_CREATED]: "Big chances created",
  [TACKLES_WON]: "Tackles won",
  [SAVES]: "Saves",
  [GOALS_CONCEDED]: statNames.goalsConceded,
  [CLEAN_SHEETS]: "Clean sheets",
  [PASSES]: "Passes",
  [INTERCEPTIONS]: "Interceptions",
  [CLEARANCES]: "Clearances",
};
export const versusWords = (area: Area) => `vs ${AREA_PLAYER_WORDS[area]}`;
/** A percentile bar's hover and name: the figure it draws. */
export const percentileLabel = (percentile: number, area: Area) => `${percentile} percentile ${versusWords(area)}`;
/** Why a player has no percentile: too few minutes to be ranked. */
export const notRankedWords = `Not ranked until ${RANKED_MINUTES} minutes`;
export const loadingPer90Words = "Loading his figures per 90…";
/** His panel, while the manager's bid on him is waiting (Craig, 8 Nov 2026, the waivers
 *  README): "Your bid 2, settles Wed", linking to My team's Transactions. */
export const yourClaimWords = (rank: number, run: FirstRun) => {
  const settles = runNameWords(run);
  return `Your bid ${rank}, ${settles[0].toLowerCase()}${settles.slice(1)}`;
};
export const compareWithAnotherWords = "Compare with another…";
/** The manager's own player at his main position (Craig, 9 Nov 2026, on #1028, answer 1). */
export const compareWithYourWords = (position: string, name: string) => `Compare with your ${position}, ${name}`;
export const pickSecondWords = (name: string) => `Pick a second player in the list to compare with ${name}.`;
export const playerCardLinkWords = "Player card ›";

/** The points' head: "Pts" for this season's, named by the season while they are last season's,
 *  before the new season's first match (spec/19; Craig, 6 Nov 2026, on #956: "Pts 25/26"). */
export const seasonPointsColumn = (lastSeason: number | null) =>
  lastSeason === null ? columns.seasonPoints : lastSeasonPointsColumn(lastSeason);

/** The season figures' heads: as `columns` says them, the points' named by the season and the
 *  others' hovers too ("Goals in 25/26") while the totals are last season's (spec/19; #1566). */
export function seasonColumns(lastSeason: number | null) {
  const figure = (column: Figure) =>
    lastSeason === null ? columns[column] : { short: columns[column].short, long: `${FIGURE_NAMES[column]} in ${seasonShortWords(lastSeason)}` };
  return {
    minutes: figure("minutes"),
    points: seasonPointsColumn(lastSeason),
    goals: figure("goals"),
    assists: figure("assists"),
    shotsOnTarget: figure("shotsOnTarget"),
  };
}

/** Why a figure isn't there yet (shared/words.ts), and role fit waits on role stars and scouts
 *  (spec/19, Role stars). */
export { noSeasonPointsWords } from "../shared/words";
export const noPeriodPointsWords = "No points: none of his matches in these gameweeks is scored.";
export const noRoleFitYetWords = "No role fit until stars and scouts are in.";

/** Two players side by side (spec/19, The players list); "with your player" when the second is the
 *  manager's own at the first's position (the approved picture). */
export const COMPARE_TITLE = "Compare";
export const COMPARE_YOURS_TITLE = "Compare with your player";
/** After a player's name in Compare's head: the manager's own. */
export const yoursWords = "yours";
export { TOTAL_WORDS as totalWords } from "../shared/words";
export const perNinetyWords = "Per 90";
/** Under Compare's figures: what they are over, and whom the bars rank them against. */
export const compareNoteWords = (area: Area, period: Period) =>
  `Totals and per 90 over the ${periodInLine(period)}. Bars rank each against ${AREA_PLAYER_WORDS[area]} with ${RANKED_MINUTES}+ minutes.`;
/** Compare's signing of or bid for the first player, naming the second when he goes (Craig, 9 Nov
 *  2026, on #1028, answer 4: only with the squad full): "Bid for James, dropping Watkins". */
export const compareTakeWords = (kind: "pickUp" | "claim", name: string, dropName: string | null) =>
  `${kind === "claim" ? "Bid for" : "Sign"} ${name}${dropName === null ? "" : `, dropping ${dropName}`}`;
export const comparingWords = "Loading the comparison…";
export const clearComparisonWords = "Clear";
