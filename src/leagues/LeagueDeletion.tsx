import { useState } from "react";
import type { LeagueSummary } from "../../convex/myLeagues";
import type { LeagueActions } from "./actions";
import { beingDeleted, confirmDelete, confirmDeleteWords, deleteLeagueWords, unemailed, undoWords, unsentLinkWords } from "./words";

export type DeletionActions = Pick<LeagueActions, "deleteLeague" | "undoDeletion">;

/** A league's row on "Your leagues" for deleting it (spec/13, Deleting): "Delete league" with a
 *  plain confirm for the admin or its commissioner; while it is being deleted, when it goes, who
 *  wasn't told, and Undo, which only whoever deleted it and the admin see. */
export function LeagueDeletionRow({ league, canDelete, actions }: { league: LeagueSummary; canDelete: boolean; actions: DeletionActions }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function run(change: DeletionActions[keyof DeletionActions]) {
    setBusy(true);
    const refused = await change(league.leagueId);
    setBusy(false);
    setProblem(refused);
    if (refused === null) setConfirming(false);
  }

  const { deletion } = league;
  if (!deletion && !canDelete) return null;
  return (
    <tr>
      <td colSpan={4} className={deletion ? "alert-strip" : "px-2 pb-2"}>
        <div className="flex flex-col items-start gap-2">
          {deletion ? (
            <>
              <p>{beingDeleted(deletion.deletesAt)}</p>
              {deletion.unemailed.map(({ email, reason }) => (
                <p key={email}>{unemailed(email, unsentLinkWords[reason])}</p>
              ))}
              <button type="button" disabled={busy} onClick={() => run(actions.undoDeletion)} className="action">
                {undoWords}
              </button>
            </>
          ) : confirming ? (
            <>
              <p className="text-event">{confirmDelete(league.name)}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => run(actions.deleteLeague)} className="action">
                  {confirmDeleteWords.yes}
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="secondary-action">
                  {confirmDeleteWords.no}
                </button>
              </div>
            </>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className="secondary-action">
              {deleteLeagueWords}
            </button>
          )}
          {problem && (
            <p role="alert" className="text-event">
              {problem}
            </p>
          )}
        </div>
      </td>
    </tr>
  );
}
