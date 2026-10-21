import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import type { LeagueActions } from "./actions";
import { createFailedWords, deleteFailedWords, undoFailedWords } from "./words";

/** The leagues seam filled in by Convex. A refusal comes back as the server's own words
 *  (convex/leagueAccess.ts); any other failure is logged and said plainly. */
export function useLiveLeagueActions(): LeagueActions {
  const create = useMutation(api.leagues.create);
  const deleteLeague = useMutation(api.leagueDeletion.deleteLeague);
  const undo = useMutation(api.leagueDeletion.undo);
  return useMemo(
    () => ({
      createLeague: (league) => refusalOf(() => create(league), "Creating a league", createFailedWords),
      deleteLeague: (leagueId) => refusalOf(() => deleteLeague({ leagueId }), "Deleting a league", deleteFailedWords),
      undoDeletion: (leagueId) => refusalOf(() => undo({ leagueId }), "Undoing a league's deletion", undoFailedWords),
    }),
    [create, deleteLeague, undo],
  );
}

/** Null once `change` is made, the server's words if it refused, or `failedWords` (and the failure
 *  logged as what `doing` failed) if anything else went wrong. */
async function refusalOf(change: () => Promise<unknown>, doing: string, failedWords: string): Promise<string | null> {
  try {
    await change();
    return null;
  } catch (error) {
    if (error instanceof ConvexError && typeof error.data === "string") return error.data;
    console.error(`${doing} failed:`, error);
    return failedWords;
  }
}
