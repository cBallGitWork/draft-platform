// Scouting in the preview (src/preview.ts): a few players at three clubs, two of them owned, filtered
// and sorted by the server's own rule (listOf).

import type { ListedPlayer } from "../../convex/scouting/playersList";
import { listOf } from "../../convex/scouting/playersOrder";
import type { ScoutingSeam } from "./seam";

const ARSENAL = { code: 3, name: "Arsenal", shortName: "ARS" };
const CHELSEA = { code: 8, name: "Chelsea", shortName: "CHE" };
const LIVERPOOL = { code: 14, name: "Liverpool", shortName: "LIV" };

const player = (code: number, name: string, fullName: string, club: ListedPlayer["club"], positions: ListedPlayer["positions"], ownerTeamName: string | null = null): ListedPlayer => ({
  code,
  name,
  fullName,
  club,
  positions,
  ownerTeamName,
  seasonPoints: null,
});

const players: readonly ListedPlayer[] = [
  player(1, "Saka", "Bukayo Saka", ARSENAL, ["W"], "Saka Potatoes"),
  player(2, "Rice", "Declan Rice", ARSENAL, ["CDM", "CM"]),
  player(3, "Raya", "David Raya Martín", ARSENAL, ["GK"]),
  player(4, "Palmer", "Cole Palmer", CHELSEA, ["CAM", "W"], "Kroos Control"),
  player(5, "James", "Reece James", CHELSEA, ["FB", "WB"]),
  player(6, "Salah", "Mohamed Salah", LIVERPOOL, ["W", "ST"]),
  player(7, "Van Dijk", "Virgil van Dijk", LIVERPOOL, ["CB"]),
];

export const previewScouting: ScoutingSeam = {
  usePlayersList: (_leagueId, filters, sort) => ({ clubs: [ARSENAL, CHELSEA, LIVERPOOL], players: listOf(players, filters, sort) }),
};
