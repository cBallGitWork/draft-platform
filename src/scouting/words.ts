// What Scouting says, in one place for Craig to change in the pull request.

import type { Availability } from "./seam";

export { freeAgentWords, noFigureWords } from "../words";

export const SCOUTING_TITLE = "Scouting";
export const PLAYERS_TITLE = "Players";
export const loadingWords = "Loading the players…";

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
export const statLabel = "Stat";
export const noStatWords = "None";

/** How many players the filters keep. */
export const countWords = (count: number) => (count === 1 ? "1 player" : `${count} players`);
export const noneMatchWords = "No player matches these filters.";
/** Said for "On waivers", which keeps nobody until waivers are built. */
export const noWaiversWords = "No player is on waivers: the app doesn't run waivers yet.";

/** The list's columns: a short head, and what it stands for (spec/14: dense tables use short codes,
 *  the full name on hover). */
export const columns = {
  compare: { short: "Cmp", long: "Compare: tick two players" },
  name: { short: "Player", long: "Player" },
  club: { short: "Club", long: "Club" },
  positions: { short: "Pos", long: "Positions" },
  owner: { short: "Team", long: "The team that owns him in this league" },
  seasonPoints: { short: "Pts", long: "Season points under the site's scoring" },
  roleFit: { short: "Fit", long: "Role fit" },
} as const;

/** Why a figure isn't there yet: season points before matches are scored, role fit before roles exist. */
export const noPointsYetWords = "No points yet: the app doesn't score matches yet.";
export const noRoleFitYetWords = "No role fit yet: roles aren't built yet.";
/** Beside the head of the column sorted by, which way: decoration, as the head says so to screen
 *  readers through aria-sort. */
export const ascendingGlyph = "▲";
export const descendingGlyph = "▼";
/** A sortable column's head, for screen readers: what pressing it does. */
export const sortByLabel = (column: string) => `Sort by ${column}`;

/** Two players side by side (spec/19, The players list). */
export const COMPARE_TITLE = "Compare";
/** A player's tick box in the list, for screen readers. */
export const compareLabel = (name: string) => `Compare ${name}`;
export const pickOneMoreWords = (name: string) => `${name} is ticked: tick one more player to compare him with.`;
export const comparingWords = "Loading the comparison…";
export const clearComparisonWords = "Clear";
export const matchesWords = "Matches this season";
export const noStatsYetWords = "Neither has a stat this season yet.";
