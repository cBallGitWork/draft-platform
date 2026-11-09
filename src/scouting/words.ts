// What Scouting says, in one place for Craig to change in the pull request.

import { lastSeasonPointsColumn } from "../draft/words";
import { STAT_WORD, weekdayTimeWords } from "../shared/words";
import type { Availability } from "./seam";

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

/** The star after a shortlisted player's name, for screen readers and the hover. */
export const shortlistedLabel = "On your shortlist";
/** A row of the list, for screen readers: pressing it opens his panel. */
export const selectPlayerLabel = (name: string) => `Show ${name}'s panel`;

/** The selected player's panel at the top of the right column (the approved picture). */
export const panelSeasonPointsWords = "Season points";
export const panelMinutesWords = "Minutes this season";
export const closePanelLabel = "Close his panel";
export const compareWithAnotherWords = "Compare with another…";
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
export const noRoleFitYetWords = "No role fit yet: it waits on stars and scouts.";

/** Two players side by side (spec/19, The players list). */
export const COMPARE_TITLE = "Compare";
export const comparingWords = "Loading the comparison…";
export const clearComparisonWords = "Clear";
export const matchesWords = "Matches this season";
/** The comparison's first column, which names each row: its head is read out, not drawn. A player's
 *  column is headed by his name, named by his full name. */
export const compareWhatColumn = { short: statLabel, long: "What's compared" };
export const noStatsYetWords = "Neither has a stat this season yet.";
