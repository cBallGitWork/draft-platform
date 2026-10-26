import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { refusalOf } from "../refusal";
import type { TacticsSeam } from "./tacticsSeam";
import { saveFailedWords } from "./tacticsWords";

/** The Tactics seam filled in by Convex. A refusal comes back as the server's own words
 *  (convex/lineup/lineupWords.ts); any other failure is logged and said plainly. */
export const liveTactics: TacticsSeam = {
  useTactics: (leagueId, now) => useQuery(api.lineup.tactics.ofMyTeam, { leagueId, now }),
  useLineupChanges: () => {
    const save = useMutation(api.lineup.lineups.save);
    return useMemo(
      () => ({
        save: (leagueId, { starters, bench }) =>
          refusalOf(() => save({ leagueId, lineup: { starters: [...starters], bench: [...bench] } }), "Saving a lineup", saveFailedWords),
      }),
      [save],
    );
  },
};
