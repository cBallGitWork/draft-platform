import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { refusalOf } from "../refusal";
import type { SquadsSeam } from "./seam";
import { changeFailedWords } from "./words";

const useSquads: SquadsSeam["useSquads"] = (leagueId) => useQuery(api.squads.squads, { leagueId });

/** Blank text asks the server nothing, and finds no one. */
const useFoundPlayers: SquadsSeam["useFoundPlayers"] = (leagueId, text) => {
  const blank = !text.trim();
  const found = useQuery(api.squads.findPlayers, blank ? "skip" : { leagueId, text });
  return blank ? [] : found;
};

/** The squads seam filled in by Convex. A refusal comes back as the server's own words
 *  (convex/squads.ts); any other failure is logged and said plainly. */
export function useLiveSquads(): SquadsSeam {
  const assign = useMutation(api.squads.assign);
  const move = useMutation(api.squads.move);
  const release = useMutation(api.squads.release);
  return useMemo(
    () => ({
      useSquads,
      useFoundPlayers,
      assign: (leagueId, playerCode, teamId) => refusalOf(() => assign({ leagueId, playerCode, teamId }), "Assigning a player", changeFailedWords),
      move: (leagueId, playerCode, teamId) => refusalOf(() => move({ leagueId, playerCode, teamId }), "Moving a player", changeFailedWords),
      release: (leagueId, playerCode) => refusalOf(() => release({ leagueId, playerCode }), "Releasing a player", changeFailedWords),
    }),
    [assign, move, release],
  );
}
