import { useMutation, useQuery } from "convex/react";
import { useCallback } from "react";
import { api } from "../../convex/_generated/api";
import { refusalOf } from "../shared/refusal";
import type { GameweeksSeam } from "./seam";
import { setFailedWords } from "./words";

/** The gameweeks seam filled in by Convex. A refusal comes back as the server's own words
 *  (convex/gameweeks/leagueGameweeks.ts); any other failure is logged and said plainly. */
export const liveGameweeks: GameweeksSeam = {
  useLeagueGameweeks(leagueId) {
    const gameweeks = useQuery(api.gameweeks.leagueGameweeks.ofLeague, { leagueId });
    const set = useMutation(api.gameweeks.leagueGameweeks.setUsed);
    const setUsed = useCallback(
      (gameweek: number, used: boolean) =>
        refusalOf(() => set({ leagueId, gameweek, used }), `Ticking gameweek ${gameweek}`, setFailedWords),
      [set, leagueId],
    );
    return { gameweeks, setUsed };
  },
};
