import { useState } from "react";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { Confirm } from "../ui/Confirm";
import { Problem } from "../ui/Panel";
import { useChange } from "../shared/useChange";
import type { LeaguesSeam } from "./seam";
import { leagueColumnCount } from "./LeagueLinks";
import { beingDeleted, confirmDelete, confirmDeleteWords, deleteLeagueWords, undoWords } from "./words";

export type DeletionActions = Pick<LeaguesSeam, "deleteLeague" | "undoDeletion">;

/** A league's row on "Your leagues" for deleting it (spec/13, Deleting): "Delete league" with a
 *  plain confirm for the admin or its commissioner; while it is being deleted, when it goes, and
 *  Undo, which only its commissioner and the admin see. */
export function LeagueDeletionRow({ league, canDelete, actions }: { league: LeagueSummary; canDelete: boolean; actions: DeletionActions }) {
  const [confirming, setConfirming] = useState(false);
  const { busy, problem, run: runChange } = useChange();

  async function run(change: DeletionActions[keyof DeletionActions]) {
    if (await runChange(() => change(league.leagueId))) setConfirming(false);
  }

  const { deletion } = league;
  if (!deletion && !canDelete) return null;
  return (
    <tr>
      <td colSpan={leagueColumnCount} className={deletion ? "alert-strip" : "px-2 pb-2"}>
        <div className="flex flex-col items-start gap-2">
          {deletion ? (
            <>
              <p>{beingDeleted(deletion.deletesAt)}</p>
              <button type="button" disabled={busy} onClick={() => run(actions.undoDeletion)} className="action">
                {undoWords}
              </button>
            </>
          ) : confirming ? (
            <Confirm
              question={confirmDelete(league.name)}
              yes={confirmDeleteWords.yes}
              no={confirmDeleteWords.no}
              busy={busy}
              onYes={() => void run(actions.deleteLeague)}
              onNo={() => setConfirming(false)}
            />
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className="secondary-action">
              {deleteLeagueWords}
            </button>
          )}
          {deletion ? problem && <p role="alert">{problem}</p> : <Problem problem={problem} />}
        </div>
      </td>
    </tr>
  );
}
