import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useCallback } from "react";
import { api } from "../../convex/_generated/api";
import type { GameweeksSeam } from "./seam";
import { setFailedWords } from "./words";

/** The gameweeks seam filled in by Convex. A refusal comes back as the server's own words
 *  (convex/leagueGameweeks.ts); any other failure is logged and said plainly. */
export const liveGameweeks: GameweeksSeam = {
  useLeagueGameweeks(leagueId) {
    const gameweeks = useQuery(api.leagueGameweeks.ofLeague, { leagueId });
    const set = useMutation(api.leagueGameweeks.setUsed);
    const setUsed = useCallback(
      async (gameweek: number, used: boolean) => {
        try {
          await set({ leagueId, gameweek, used });
          return null;
        } catch (error) {
          if (error instanceof ConvexError && typeof error.data === "string") return error.data;
          console.error(`Ticking gameweek ${gameweek} failed:`, error);
          return setFailedWords;
        }
      },
      [set, leagueId],
    );
    return { gameweeks, setUsed };
  },
};
