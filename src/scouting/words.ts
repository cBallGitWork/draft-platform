// What Scouting says, in one place for Craig to change in the pull request.

import { STAT_WORD } from "../shared/words";
import type { Availability } from "./seam";

export { freeAgentWords, noFigureWords } from "../shared/words";

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
export const statLabel = STAT_WORD;
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

/** Why a figure isn't there yet: Scouting doesn't read season points yet, and role fit waits on
 *  role stars and scouts (spec/19, Role stars). */
export const noPointsYetWords = "No points yet: Scouting doesn't show season points yet.";
export const noRoleFitYetWords = "No role fit yet: it waits on stars and scouts.";

/** Two players side by side (spec/19, The players list). */
export const COMPARE_TITLE = "Compare";
/** A player's tick box in the list, for screen readers. */
export const compareLabel = (name: string) => `Compare ${name}`;
export const pickOneMoreWords = (name: string) => `${name} is ticked: tick one more player to compare him with.`;
export const comparingWords = "Loading the comparison…";
export const clearComparisonWords = "Clear";
export const matchesWords = "Matches this season";
/** The comparison's first column, which names each row: its head is read out, not drawn. A player's
 *  column is headed by his name, named by his full name. */
export const compareWhatColumn = { short: statLabel, long: "What's compared" };
export const noStatsYetWords = "Neither has a stat this season yet.";
