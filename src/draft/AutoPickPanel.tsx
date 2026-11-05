import type { Id } from "../../convex/_generated/dataModel";
import { useChange } from "../shared/useChange";
import { Panel, PANEL_BODY, Problem } from "../ui/Panel";
import { pickInRoundOf, roundOf } from "./board";
import type { DraftBoard, DraftSeam } from "./seam";
import {
  AUTO_PICK_TITLE,
  autoPickAside,
  onAutoPickWords,
  slotWords,
  takeControlBackWords,
  timeoutsHead,
  timeoutsWords,
  turnOnAutoPickWords,
} from "./words";

// The draft room's auto-pick panel (spec/04, Auto-pick; #1100), under the queue as the approved
// picture has it. Off it: his timeouts against the league's limit, and "Turn auto-pick on", which
// he can press before the draft or during it, his picks then made at once (Craig, 5 Nov 2026, on
// #1100). On it: that his last pick was made for him, when it was, and "Take control back".
// Nothing shows for someone who runs no team.

export function AutoPickPanel({ leagueId, board, teams, seam }: { leagueId: Id<"leagues">; board: DraftBoard; teams: number; seam: DraftSeam }) {
  const changes = seam.useListChanges();
  const change = useChange();
  const { yourAutoPick, yourTeamId } = board;
  if (yourAutoPick === null || yourTeamId === null) return null;
  const { on, timeouts, limit } = yourAutoPick;
  const last = board.picks.filter(({ teamId }) => teamId === yourTeamId).at(-1);
  const lastAutoSlot = last?.auto ? slotWords(roundOf(last.pick, teams), pickInRoundOf(last.pick, teams)) : null;
  return (
    <Panel title={AUTO_PICK_TITLE} aside={<span className="text-soft">{autoPickAside(on)}</span>}>
      <Problem problem={change.problem} />
      <div className={PANEL_BODY}>
        {on ? (
          <p>{onAutoPickWords(lastAutoSlot)}</p>
        ) : (
          <p>
            {timeoutsHead} <span className="font-bold text-figure">{timeouts}</span>
            {limit !== null && ` of ${limit}`}. {timeoutsWords(limit)}
          </p>
        )}
        <div>
          <button
            type="button"
            disabled={change.busy}
            onClick={() => void change.run(() => (on ? changes.takeControlBack(leagueId) : changes.turnOnAutoPick(leagueId)))}
            className="secondary-action"
          >
            {on ? takeControlBackWords : turnOnAutoPickWords}
          </button>
        </div>
      </div>
    </Panel>
  );
}
