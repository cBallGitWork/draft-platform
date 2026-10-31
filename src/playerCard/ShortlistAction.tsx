import type { Id } from "../../convex/_generated/dataModel";
import { Problem } from "../ui/Panel";
import type { ShortlistSeam } from "../scouting/shortlist/seam";
import { addToShortlistWords, onShortlistWords, removeFromShortlistWords } from "../scouting/shortlist/words";
import { useChange } from "../shared/useChange";

/** The card's shortlist action (spec/12, The player card): add him to the manager's own shortlist,
 *  or take him off it. Nothing for someone who runs no team, who has no shortlist, nor while it
 *  loads; and no adding a player who has left the Premier League, which the server refuses. */
export function ShortlistAction({ leagueId, playerCode, gone, seam }: { leagueId: Id<"leagues">; playerCode: number; gone: boolean; seam: ShortlistSeam }) {
  const players = seam.useShortlist(leagueId);
  const changes = seam.useShortlistChanges();
  const change = useChange();
  if (players === null || players === undefined) return null;
  const onIt = players.some((player) => player.code === playerCode);
  if (!onIt && gone) return null;
  return (
    <div className="border-t border-panel-rule">
      <Problem problem={change.problem} />
      <div className="flex flex-wrap items-center gap-3 px-3 py-2">
        <button
          type="button"
          disabled={change.busy}
          onClick={() => void change.run(() => (onIt ? changes.remove(leagueId, playerCode) : changes.add(leagueId, playerCode)))}
          className="secondary-action"
        >
          {onIt ? removeFromShortlistWords : addToShortlistWords}
        </button>
        {onIt && <span className="text-soft">{onShortlistWords}</span>}
      </div>
    </div>
  );
}
