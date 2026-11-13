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
 *  plain confirm, for the admin or its commissioner. */
export function DeleteLeagueRow({ league, actions }: { league: LeagueSummary; actions: DeletionActions }) {
  const [confirming, setConfirming] = useState(false);
  const { busy, problem, run } = useChange();

  async function deleteIt() {
    if (await run(() => actions.deleteLeague(league.leagueId))) setConfirming(false);
  }

  return (
    <tr>
      <td colSpan={leagueColumnCount} className="px-2 pb-2">
        <div className="flex flex-col items-start gap-2">
          {confirming ? (
            <Confirm
              question={confirmDelete(league.name)}
              yes={confirmDeleteWords.yes}
              no={confirmDeleteWords.no}
              busy={busy}
              onYes={() => void deleteIt()}
              onNo={() => setConfirming(false)}
            />
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className="secondary-action">
              {deleteLeagueWords}
            </button>
          )}
          <Problem problem={problem} />
        </div>
      </td>
    </tr>
  );
}

/** A league being deleted, as a strip under "Your leagues", as its approved picture draws it: its
 *  name, when it goes, and Undo at the far end, which only its commissioner and the admin see. */
export function DeletedLeagueStrip({
  league,
  deletesAt,
  actions,
}: {
  league: LeagueSummary;
  deletesAt: number;
  actions: DeletionActions;
}) {
  const { busy, problem, run } = useChange();
  return (
    <div className="alert-strip flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>
          <strong>{league.name}</strong> <span>{beingDeleted(deletesAt)}</span>
        </p>
        <button type="button" disabled={busy} onClick={() => void run(() => actions.undoDeletion(league.leagueId))} className="action">
          {undoWords}
        </button>
      </div>
      {problem && <p role="alert">{problem}</p>}
    </div>
  );
}
