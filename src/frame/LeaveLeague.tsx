import { useState } from "react";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import type { LeaguesSeam } from "../leagues/seam";
import { useChange } from "../shared/useChange";
import { Confirm } from "./Confirm";
import { Problem } from "./Panel";
import { leaveWords } from "./words";

/** The foot of the top bar's league list (spec/13, Leaving): a manager leaves the league they're
 *  in, after a plain confirm. Their team stays, for the commissioner to hand on. */
export function LeaveLeague({
  league,
  teamName,
  leaveLeague,
  onLeft,
}: {
  league: LeagueSummary;
  teamName: string;
  leaveLeague: LeaguesSeam["leaveLeague"];
  onLeft: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const { busy, problem, run } = useChange();

  async function leave() {
    if (await run(() => leaveLeague(league.leagueId))) onLeft();
  }

  return (
    <div className="border-t border-panel-rule">
      <Problem problem={problem} />
      {confirming ? (
        <div className="flex flex-col gap-2 px-3 py-2">
          <Confirm
            question={leaveWords.confirm(league.name, teamName)}
            yes={leaveWords.yes}
            no={leaveWords.no}
            busy={busy}
            onYes={() => void leave()}
            onNo={() => setConfirming(false)}
          />
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="flex min-h-tap w-full items-center px-3 text-left">
          {leaveWords.open}
        </button>
      )}
    </div>
  );
}
