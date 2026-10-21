import { useMutation } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { refusalOf } from "../refusal";
import type { LeagueActions } from "./actions";
import { createFailedWords, deleteFailedWords, switchFailedWords, undoFailedWords } from "./words";

/** The leagues seam filled in by Convex. A refusal comes back as the server's own words
 *  (convex/leagueAccess.ts); any other failure is logged and said plainly. */
export function useLiveLeagueActions(): LeagueActions {
  const create = useMutation(api.leagues.create);
  const deleteLeague = useMutation(api.leagueDeletion.deleteLeague);
  const undo = useMutation(api.leagueDeletion.undo);
  const switchTo = useMutation(api.lastLeague.switchTo);
  return useMemo(
    () => ({
      createLeague: (league) => refusalOf(() => create(league), "Creating a league", createFailedWords),
      deleteLeague: (leagueId) => refusalOf(() => deleteLeague({ leagueId }), "Deleting a league", deleteFailedWords),
      undoDeletion: (leagueId) => refusalOf(() => undo({ leagueId }), "Undoing a league's deletion", undoFailedWords),
      switchLeague: (leagueId) => refusalOf(() => switchTo({ leagueId }), "Switching league", switchFailedWords),
    }),
    [create, deleteLeague, undo, switchTo],
  );
}
