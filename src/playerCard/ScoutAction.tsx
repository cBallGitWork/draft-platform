import type { Id } from "../../convex/_generated/dataModel";
import type { ScoutsSeam } from "../scouting/scouts/seam";
import { freeScoutsWords, sendScoutWords } from "../scouting/scouts/words";
import { useChange } from "../shared/useChange";
import { Problem } from "../ui/Panel";

/** The card's Send a scout (spec/19, Scouts; the approved card), with how many of the team's scouts
 *  are free. Nothing for someone who runs no team, nor while it loads, nor for a player who has left
 *  the Premier League; not pressable with every scout out or one already on him, since there is no
 *  recall and only one scout on a player at a time (Craig, 6 Nov 2026, on #375). */
export function ScoutAction({ leagueId, playerCode, gone, seam }: { leagueId: Id<"leagues">; playerCode: number; gone: boolean; seam: ScoutsSeam }) {
  const mine = seam.useMyScouts(leagueId);
  const send = seam.useSendScout();
  const change = useChange();
  if (mine === null || mine === undefined || gone) return null;
  const free = Math.max(0, mine.scouts - mine.out.length);
  const onHim = mine.out.some((scout) => scout.playerCode === playerCode);
  return (
    <div className="border-t border-panel-rule">
      <Problem problem={change.problem} />
      <div className="flex flex-wrap items-center gap-3 px-3 py-2">
        <button
          type="button"
          disabled={change.busy || free === 0 || onHim}
          onClick={() => void change.run(() => send(leagueId, playerCode))}
          className="secondary-action"
        >
          {sendScoutWords}
        </button>
        <span className="text-soft">{freeScoutsWords(free, mine.scouts)}</span>
      </div>
    </div>
  );
}
