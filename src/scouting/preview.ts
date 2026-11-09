// Scouting in the preview (src/app/preview.ts): a few players at three clubs, two of them owned and one on waivers, a few
// stats added up for each, filtered and sorted by the server's own rule (listOf).

import type { ListedPlayer } from "../../convex/scouting/playersList";
import { mainArea, per90PanelOf } from "../../convex/scouting/per90Figures";
import { listFigures, listOf, NO_FIGURES, shownStat } from "../../convex/scouting/playersOrder";
import { withOwnStats } from "../../convex/scoring/ownStats";
import { OWN_STAT_PREFIX } from "../../convex/scoring/statCatalogue";
import type { Stats } from "../../convex/stats/statTotals";
import { DAY_MS } from "../../convex/shared/time";
import { listedFromScouting, queueInPreview, setPreviewShortlisted } from "../draft/previewLists";
import { previewScouts } from "./scouts/preview";
import { previewShortlistOf } from "./shortlist/preview";
import type { ScoutingSeam, WaiverActionSeam } from "./seam";

export const ARSENAL = { code: 3, name: "Arsenal", shortName: "ARS" };
export const CHELSEA = { code: 8, name: "Chelsea", shortName: "CHE" };
export const LIVERPOOL = { code: 14, name: "Liverpool", shortName: "LIV" };

const player = (code: number, name: string, fullName: string, club: ListedPlayer["club"], positions: ListedPlayer["positions"], ownerTeamName: string | null = null): ListedPlayer => ({
  code,
  name,
  fullName,
  club,
  positions,
  ownerTeamName,
  onWaivers: null,
  seasonPoints: null,
  figures: NO_FIGURES,
  stat: null,
});

/** One player on waivers, so the filter and the player card's claim show: a run two days off first
 *  takes him. */
const onWaivers = (listed: ListedPlayer): ListedPlayer => ({ ...listed, onWaivers: { firstRunAt: Date.now() + 2 * DAY_MS } });

export const previewPlayers: readonly ListedPlayer[] = [
  player(1, "Saka", "Bukayo Saka", ARSENAL, ["W"], "Saka Potatoes"),
  player(2, "Rice", "Declan Rice", ARSENAL, ["CDM", "CM"]),
  player(3, "Raya", "David Raya Martín", ARSENAL, ["GK"]),
  player(4, "Palmer", "Cole Palmer", CHELSEA, ["CAM", "W"], "Kroos Control"),
  onWaivers(player(5, "James", "Reece James", CHELSEA, ["FB", "WB"])),
  player(6, "Salah", "Mohamed Salah", LIVERPOOL, ["W", "ST"]),
  player(7, "Van Dijk", "Virgil van Dijk", LIVERPOOL, ["CB"]),
];

/** A few of each player's season totals, by his code; a stat left out is 0. */
const previewTotals: Record<number, Stats> = {
  1: { goals_scored: 4, assists: 3, minutes: 720, expected_goals: 3.41 },
  2: { goals_scored: 1, assists: 2, minutes: 810, expected_goals: 0.92 },
  3: { saves: 21, clean_sheets: 4, minutes: 810 },
  4: { goals_scored: 6, assists: 2, minutes: 765, expected_goals: 4.87 },
  5: { assists: 1, minutes: 430, expected_goals: 0.3 },
  6: { goals_scored: 7, assists: 4, minutes: 800, expected_goals: 6.12 },
  7: { goals_scored: 1, clean_sheets: 4, minutes: 810, expected_goals: 0.65 },
};
/** The site's set in the preview, for its one own stat: goals and assists added up (#910). */
const PREVIEW_SET = {
  rules: [],
  wholePointsOnly: false,
  ownStats: [{ stat: `${OWN_STAT_PREFIX}goal_involvements`, name: "Goal involvements", shortCode: "GI", parts: [{ stat: "goals_scored", weight: 1 }, { stat: "assists", weight: 1 }] }],
};
/** Matches this season, the same for everyone in the preview. */
const PREVIEW_MATCHES = 9;

/** Rice and Salah are on the preview manager's shortlist to begin with, and feed his draft queue. */
const SHORTLISTED = [2, 6];
export const previewShortlist = previewShortlistOf(previewPlayers, SHORTLISTED);
setPreviewShortlisted(previewPlayers.filter(({ code }) => SHORTLISTED.includes(code)));

/** "Add to queue" on a shortlisted player: into the preview's draft queue (../draft/previewLists.ts). */
const addToQueue = async (_leagueId: unknown, playerCode: number) => {
  queueInPreview([listedFromScouting(previewPlayers.find(({ code }) => code === playerCode)!)]);
  return null;
};

/** Scouting's own part of the preview; the app adds the player card's pickup and claim
 *  (src/app/previewApp.tsx), whose preview reads these players. */
export const previewScouting: Omit<ScoutingSeam, keyof WaiverActionSeam> = {
  ...previewShortlist,
  ...previewScouts,
  useAddToQueue: () => addToQueue,
  useComparison: (_leagueId, codes) =>
    codes?.map((code) => ({ ...previewPlayers.find((each) => each.code === code)!, matches: PREVIEW_MATCHES, stats: previewTotals[code] ?? {} })),
  usePer90: (_leagueId, playerCode, stat) => {
    const weighed = (player: ListedPlayer) => ({ area: mainArea(player.positions), totals: withOwnStats(previewTotals[player.code] ?? {}, PREVIEW_SET) });
    const his = previewPlayers.find(({ code }) => code === playerCode);
    return his === undefined ? undefined : per90PanelOf(weighed(his), previewPlayers.map(weighed), stat);
  },
  usePlayersList: (_leagueId, filters, sort, stat) => ({
    clubs: [ARSENAL, CHELSEA, LIVERPOOL],
    ownStats: PREVIEW_SET.ownStats.map(({ stat, name, shortCode }) => ({ stat, name, shortCode })),
    players: listOf(
      previewPlayers.map((player) => ({ ...player, figures: listFigures(previewTotals[player.code]), stat: shownStat(withOwnStats(previewTotals[player.code] ?? {}, PREVIEW_SET), stat) })),
      filters,
      sort,
    ),
    pointsSeason: null,
  }),
};
