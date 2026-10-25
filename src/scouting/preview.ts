// Scouting in the preview (src/preview.ts): a few players at three clubs, two of them owned, a few
// stats added up for each, filtered and sorted by the server's own rule (listOf).

import type { ListedPlayer } from "../../convex/scouting/playersList";
import { listOf } from "../../convex/scouting/playersOrder";
import type { Stats } from "../../convex/stats/statTotals";
import { previewShortlistOf } from "./previewShortlist";
import type { ScoutingSeam } from "./seam";

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
  seasonPoints: null,
});

export const previewPlayers: readonly ListedPlayer[] = [
  player(1, "Saka", "Bukayo Saka", ARSENAL, ["W"], "Saka Potatoes"),
  player(2, "Rice", "Declan Rice", ARSENAL, ["CDM", "CM"]),
  player(3, "Raya", "David Raya Martín", ARSENAL, ["GK"]),
  player(4, "Palmer", "Cole Palmer", CHELSEA, ["CAM", "W"], "Kroos Control"),
  player(5, "James", "Reece James", CHELSEA, ["FB", "WB"]),
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
/** Matches this season, the same for everyone in the preview. */
const PREVIEW_MATCHES = 9;

/** Rice and Salah are on the preview manager's shortlist to begin with. */
export const previewShortlist = previewShortlistOf(previewPlayers, [2, 6]);

export const previewScouting: ScoutingSeam = {
  ...previewShortlist,
  useComparison: (_leagueId, codes) =>
    codes?.map((code) => ({ ...previewPlayers.find((each) => each.code === code)!, matches: PREVIEW_MATCHES, stats: previewTotals[code] ?? {} })),
  usePlayersList: (_leagueId, filters, sort) => ({ clubs: [ARSENAL, CHELSEA, LIVERPOOL], players: listOf(previewPlayers, filters, sort) }),
};
