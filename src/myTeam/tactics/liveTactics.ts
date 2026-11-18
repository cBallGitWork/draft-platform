import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { answerAt } from "../../../convex/gameweeks/hourAnswers";
import { clockHourOf } from "../../../convex/home/homeAt";
import { answerOf, refusalOf } from "../../shared/refusal";
import { useLastLoaded } from "../../shared/useLastLoaded";
import type { TacticsSeam } from "./seam";
import { planDeleteFailedWords, planSaveFailedWords, saveFailedWords } from "./words";

/** The Tactics seam filled in by Convex. A refusal comes back as the server's own words
 *  (convex/lineup/lineupWords.ts); any other failure is logged and said plainly. */
export const liveTactics: TacticsSeam = {
  // Asked for the hour, never the minute (#2008): the gameweek being set moves on at a deadline, so
  // the hour's answers are picked from at the screen's minute (hourAnswers.ts). The last is held
  // while the next hour's loads, so the tab doesn't blank at the hour's turn.
  useTactics: function useTactics(leagueId, now) {
    const loaded = useQuery(api.lineup.tactics.ofMyTeam, { leagueId, hour: clockHourOf(now) });
    return useLastLoaded(loaded && answerAt(loaded, now)?.tactics, leagueId);
  },
  useLineupChanges: () => {
    const save = useMutation(api.lineup.lineups.save);
    return useMemo(
      () => ({
        save: (leagueId, { starters, bench, classicFormation, instructions }, basedOn) =>
          answerOf(() => save({ leagueId, lineup: { starters: [...starters], bench: [...bench], classic: classicFormation, instructions }, basedOn }), "Saving a line-up", saveFailedWords),
      }),
      [save],
    );
  },
  usePlans: (leagueId) => useQuery(api.lineup.savedPlans.mine, { leagueId }),
  // By the hour too (#2008): the card's roles and last season's prices turn when a scoring version
  // takes effect, so the hour's cards are picked from at the minute, the last held at the hour's turn.
  useRoleCard: function useRoleCard(leagueId, playerCode, cell, formation, now) {
    const cells = formation.map(({ area, lane }) => ({ area, lane }));
    const loaded = useQuery(api.lineup.roleCard.forSlot, { leagueId, playerCode, cell, formation: cells, hour: clockHourOf(now) });
    return useLastLoaded(loaded && answerAt(loaded, now)?.card, JSON.stringify([leagueId, playerCode, cell, cells]));
  },
  usePlanChanges: () => {
    const save = useMutation(api.lineup.savedPlans.save);
    const remove = useMutation(api.lineup.savedPlans.remove);
    return useMemo(
      () => ({
        save: (leagueId, name, slots, instructions) => refusalOf(() => save({ leagueId, name, slots: [...slots], instructions }), "Saving a plan", planSaveFailedWords),
        remove: (leagueId, name) => refusalOf(() => remove({ leagueId, name }), "Deleting a plan", planDeleteFailedWords),
      }),
      [save, remove],
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
