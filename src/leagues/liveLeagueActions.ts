import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import type { LeagueActions } from "./actions";
import { createFailedWords, switchFailedWords } from "./words";

/** The leagues seam filled in by Convex. A refusal comes back as the server's own words
 *  (convex/leagueAccess.ts); any other failure is logged and said plainly. */
export function useLiveLeagueActions(): LeagueActions {
  const create = useMutation(api.leagues.create);
  const switchTo = useMutation(api.lastLeague.switchTo);
  return useMemo(
    () => ({
      createLeague: async (league) => {
        try {
          await create(league);
          return null;
        } catch (error) {
          if (error instanceof ConvexError && typeof error.data === "string") return error.data;
          console.error("Creating a league failed:", error);
          return createFailedWords;
        }
      },
      switchLeague: async (leagueId) => {
        try {
          await switchTo({ leagueId });
          return null;
        } catch (error) {
          if (error instanceof ConvexError && typeof error.data === "string") return error.data;
          console.error("Switching league failed:", error);
          return switchFailedWords;
        }
      },
    }),
    [create, switchTo],
  );
}
