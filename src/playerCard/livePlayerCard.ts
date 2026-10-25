import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { liveShortlist } from "../scouting/liveShortlist";
import type { PlayerCardSeam } from "./seam";

/** The player card's seam filled in by Convex. */
export const livePlayerCard: PlayerCardSeam = {
  ...liveShortlist,
  usePlayerCard: (leagueId, playerCode, now) => useQuery(api.playerCard.playerCard.card, { leagueId, playerCode, now }),
};
