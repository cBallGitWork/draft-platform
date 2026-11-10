// What Scouting says, in one place for Craig to change in the pull request.

import type { Area } from "../../convex/lineup/pitch";
import { RANKED_MINUTES } from "../../convex/scouting/per90Figures";
import { PERIOD_GAMEWEEKS } from "../../convex/scouting/periods";
import { lastSeasonPointsColumn } from "../draft/words";
import { noRunWords, runDayWords } from "../myTeam/claims/words";
import { STAT_WORD, weekdayTimeWords } from "../shared/words";
import type { Availability, Period } from "./seam";

export { figureWords, freeAgentWords, noFigureWords } from "../shared/words";

export const SCOUTING_TITLE = "Scouting";
export const PLAYERS_TITLE = "Players";

/** Scouting's tabs on its title plate (the approved picture). */
export const SCOUTING_TABS = ["players", "statRace"] as const;
export type ScoutingTab = (typeof SCOUTING_TABS)[number];
export const scoutingTabWords: Record<ScoutingTab, string> = { players: PLAYERS_TITLE, statRace: "Stat race" };
export const scoutingTabsLabel = "Scouting's views";
export const loadingWords = "Loading the players…";

/** The name box over the list (the approved picture). */
export const nameLabel = "Name";
export const namePlaceholder = "Find a player";

/** The filters over the list (spec/19, The players list). */
export const availabilityLabel = "Show";
export const availabilityWords: Record<Availability, string> = {
  all: "All",
  freeAgents: "Free agents",
  onWaivers: "On waivers",
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
 *  Period; #1028, story 3). */
export const periodLabel = "Period";
export const periodWords: Record<Period, string> = { season: "Season", last4: "Last 4 gameweeks", last6: "Last 6 gameweeks" };
/** A figure's period as a hover says it: "this season", "over the last 4 gameweeks". */
const overWords = (period: Period) => (period === "season" ? "this season" : `over the ${periodWords[period].toLowerCase()}`);

/** How many players the filters keep. */
export const countWords = (count: number) => (count === 1 ? "1 player" : `${count} players`);
export const noneMatchWords = "No player matches these filters.";

/** In the owner column, a player on waivers and the run that can first take him, in the viewer's
 *  own zone (Craig, 6 Nov 2026, on #1200): "Waivers, Thu 18:00"; just "Waivers" with no run times. */
export const onWaiversWords = (firstRunAt: number | null) => (firstRunAt === null ? "Waivers" : `Waivers, ${weekdayTimeWords(firstRunAt)}`);

/** The list's columns: a short head, and what it stands for (spec/14: dense tables use short codes,
 *  the full name on hover). */
export const columns = {
  name: { short: "Player", long: "Player" },
  club: { short: "Club", long: "Club" },
  positions: { short: "Pos", long: "Positions" },
  owner: { short: "Status", long: "The team that owns him in this league, or when he clears waivers" },
  minutes: { short: "Mins", long: "Minutes this season" },
  seasonPoints: { short: "Pts", long: "Season points under the site's scoring" },
  goals: { short: "G", long: "Goals this season" },
  assists: { short: "A", long: "Assists this season" },
  shotsOnTarget: { short: "SOT", long: "Shots on target this season" },
  roleFit: { short: "Fit", long: "Role fit" },
} as const;

/** The heads of the figures that follow the list's period, as its hover says them: over the last
 *  few gameweeks, the gameweeks counted, while any has finished. */
export function periodColumns(period: Period, gameweeks: readonly number[]) {
  if (period === "season") return {};
  const over = gameweeks.length === 0 ? overWords(period) : `over gameweeks ${gameweeks[0]} to ${gameweeks.at(-1)}`;
  return {
    minutes: { short: columns.minutes.short, long: `Minutes ${over}` },
    goals: { short: columns.goals.short, long: `Goals ${over}` },
    assists: { short: columns.assists.short, long: `Assists ${over}` },
    shotsOnTarget: { short: columns.shotsOnTarget.short, long: `Shots on target ${over}` },
    points: { short: columns.seasonPoints.short, long: `Points ${over} under the site's scoring` },
  };
}

/** The star after a shortlisted player's name, for screen readers and the hover. */
export const shortlistedLabel = "On your shortlist";
/** A row of the list, for screen readers: pressing it opens his panel. */
export const selectPlayerLabel = (name: string) => `Show ${name}'s panel`;

/** The selected player's panel at the top of the right column (the approved picture). */
export const panelSeasonPointsWords = "Season points";
/** His minutes over the period (the approved picture: "Minutes, last 6"). */
export const panelMinutesWords = (period: Period) => (period === "season" ? "Minutes this season" : `Minutes, last ${PERIOD_GAMEWEEKS[period]}`);
export const closePanelLabel = "Close his panel";
/** His figures per 90 over the period, ranked against the players of his area (the approved
 *  picture: "Per 90, last 6 gameweeks", "vs attacking mids"). */
export const per90Words = (period: Period) => `Per 90, ${periodWords[period].toLowerCase()}`;
export const AREA_PLAYERS: Record<Area, string> = {
  goalkeeper: "goalkeepers",
  defence: "defenders",
  defensiveMidfield: "defensive mids",
  midfield: "midfielders",
  attackingMidfield: "attacking mids",
  attack: "attackers",
};
/** The panel's own names for the stats it lists per 90, as the picture names them; a stat not here
 *  goes by its catalogue name. */
export const PER90_STAT_NAMES: Readonly<Record<string, string>> = {
  goals_scored: "Goals",
  assists: "Assists",
  total_att_assist: "Key passes",
  ontarget_scoring_att: "Shots on target",
  big_chance_created: "Big chances created",
  won_tackle: "Tackles won",
  saves: "Saves",
  goals_conceded: "Goals conceded",
  clean_sheets: "Clean sheets",
  total_pass: "Passes",
  interception: "Interceptions",
  total_clearance: "Clearances",
};
export const versusWords = (area: Area) => `vs ${AREA_PLAYERS[area]}`;
/** A percentile bar's hover and name: the figure it draws. */
export const percentileLabel = (percentile: number, area: Area) => `${percentile} percentile ${versusWords(area)}`;
/** Why a player has no percentile: too few minutes to be ranked. */
export const notRankedWords = `Ranked from ${RANKED_MINUTES} minutes`;
export const loadingPer90Words = "Loading his figures per 90…";
/** His panel, while the manager's claim on him is pending (Craig, 8 Nov 2026, the waivers
 *  README): "Your claim 2, Wed run", linking to My team's Transactions. */
export const yourClaimWords = (rank: number, runAt: number | null) => `Your claim ${rank}, ${runAt === null ? noRunWords : `${runDayWords(runAt)} run`}`;
export const compareWithAnotherWords = "Compare with another…";
/** The manager's own player at his main position (Craig, 9 Nov 2026, on #1028, answer 1). */
export const compareWithYourWords = (position: string, name: string) => `Compare with your ${position}, ${name}`;
export const pickSecondWords = (name: string) => `Pick a second player in the list to compare with ${name}.`;
export const playerCardLinkWords = "Player card ›";

/** The points' head: "Pts" for this season's, named by the season while they are last season's,
 *  before the new season's first match (spec/19; Craig, 6 Nov 2026, on #956: "Pts 25/26"). */
export const seasonPointsColumn = (lastSeason: number | null) =>
  lastSeason === null ? columns.seasonPoints : lastSeasonPointsColumn(lastSeason);

/** Why a figure isn't there yet: none of his matches is priced, or, before the first match, he
 *  wasn't in last season's data; and role fit waits on role stars and scouts (spec/19, Role stars). */
export const noPointsYetWords = "No points yet: none of his matches is scored.";
export const notLastSeasonWords = "No points: he isn't in last season's data.";
export const noPeriodPointsWords = "No points: none of his matches in these gameweeks is scored.";
export const noRoleFitYetWords = "No role fit yet: it waits on stars and scouts.";

/** Two players side by side (spec/19, The players list); "with your player" when the second is the
 *  manager's own at the first's position (the approved picture). */
export const COMPARE_TITLE = "Compare";
export const COMPARE_YOURS_TITLE = "Compare with your player";
/** After a player's name in Compare's head: the manager's own. */
export const yoursWords = "yours";
export const totalWords = "Total";
export const perNinetyWords = "Per 90";
/** Under Compare's figures: what they are over, and whom the bars rank them against. */
export const compareNoteWords = (area: Area, period: Period) =>
  `Totals and per 90 over the ${period === "season" ? "season" : periodWords[period].toLowerCase()}; bars rank each against ${AREA_PLAYERS[area]} with ${RANKED_MINUTES}+ minutes.`;
/** Compare's pickup or claim of the first player, naming the second when he goes (Craig, 9 Nov
 *  2026, on #1028, answer 4: only with the squad full). */
export const compareTakeWords = (kind: "pickUp" | "claim", name: string, dropName: string | null) =>
  `${kind === "claim" ? "Claim" : "Pick up"} ${name}${dropName === null ? "" : `, drop ${dropName}`}`;
export const comparingWords = "Loading the comparison…";
export const clearComparisonWords = "Clear";
