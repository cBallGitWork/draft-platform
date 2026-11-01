import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo } from "react";
import { api } from "../../../convex/_generated/api";
import { answerOf } from "../../shared/refusal";
import type { TacticsSeam } from "./seam";
import { saveFailedWords } from "./words";

/** The Tactics seam filled in by Convex. A refusal comes back as the server's own words
 *  (convex/lineup/lineupWords.ts); any other failure is logged and said plainly. */
export const liveTactics: TacticsSeam = {
  useTactics: (leagueId, now) => useQuery(api.lineup.tactics.ofMyTeam, { leagueId, now }),
  useLineupChanges: () => {
    const save = useMutation(api.lineup.lineups.save);
    return useMemo(
      () => ({
        save: (leagueId, { starters, bench }) =>
          answerOf(() => save({ leagueId, lineup: { starters: [...starters], bench: [...bench] } }), "Saving a lineup", saveFailedWords),
      }),
      [save],
    );
  },
  useTacticsOpened: (leagueId, gameweek) => {
    const opened = useMutation(api.lineup.lineupDue.openedTactics);
    useEffect(() => {
      // Again for each gameweek the tab shows, so one left open past a deadline counts for the next.
      if (gameweek === null) return;
      opened({ leagueId }).catch((error: unknown) => console.error("Telling the server Tactics was opened failed:", error));
    }, [opened, leagueId, gameweek]);
  },
};
