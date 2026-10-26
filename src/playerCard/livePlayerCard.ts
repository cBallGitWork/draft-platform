import { useMutation, useQuery } from "convex/react";
import { useCallback } from "react";
import { api } from "../../convex/_generated/api";
import { refusalOf } from "../refusal";
import { liveShortlist } from "../scouting/liveShortlist";
import type { PlayerCardSeam } from "./seam";
import { overrideFailedWords } from "./words";

/** The player card's seam filled in by Convex. A refused override comes back as the server's own
 *  words (convex/table/pointsOverrides.ts); any other failure is logged and said plainly. */
export const livePlayerCard: PlayerCardSeam = {
  ...liveShortlist,
  usePlayerCard: (leagueId, playerCode, now) => useQuery(api.playerCard.playerCard.card, { leagueId, playerCode, now }),
  useOverride: () => {
    const override = useMutation(api.table.pointsOverrides.override);
    return useCallback(
      (leagueId, change) => refusalOf(() => override({ leagueId, ...change }), "Overriding a player's points", overrideFailedWords),
      [override],
    );
  },
};
