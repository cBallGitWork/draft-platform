import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
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
    // Once a visit, for the league, and only of the gameweek it began in: a tab left open past a
    // deadline hasn't been opened in the next ("until he opens Tactics that gameweek", spec/12). A
    // failed tell is tried again, of that same gameweek, the next time the effect runs.
    const visit = useRef<{ leagueId: Id<"leagues">; gameweek: number; told: boolean } | null>(null);
    useEffect(() => {
      if (gameweek === null) return;
      if (visit.current?.leagueId !== leagueId) visit.current = { leagueId, gameweek, told: false };
      const shown = visit.current;
      if (shown.told) return;
      shown.told = true;
      opened({ leagueId, gameweek: shown.gameweek }).catch((error: unknown) => {
        shown.told = false;
        console.error("Telling the server Tactics was opened failed:", error);
      });
    }, [opened, leagueId, gameweek]);
  },
};
