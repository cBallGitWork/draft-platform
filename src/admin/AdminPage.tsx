import { Loading, PANEL_COLUMNS } from "../ui/Panel";
import { useChange } from "../shared/useChange";
import { AdminHeader } from "./AdminHeader";
import { FindPlayer } from "./FindPositions";
import { NewSignings, PositionChanges, Waiting } from "./QueuePanels";
import type { AdminSeam } from "./seam";
import { ApproveClub, ApproveMode, Thresholds } from "./SettingsPanels";
import { loadingWords } from "./words";
/** The admin's dashboard (spec/06 The admin oversees them; spec/15 The admin): the queue of new
 *  signings, starts waiting for him and positions flagged or removed; approving a club whole, how
 *  starts count and when positions change; and correcting any player's positions. Its first tab. */
export function AdminPage({ seam }: { seam: AdminSeam }) {
  const queue = seam.useQueue();
  const change = useChange();
  return (
    <div className="flex max-w-5xl flex-col gap-2">
      <AdminHeader problem={change.problem} />
      {queue === undefined ? (
        <Loading>{loadingWords}</Loading>
      ) : (
        <div className={PANEL_COLUMNS}>
          <div className="flex flex-col gap-2">
            <NewSignings queue={queue} seam={seam} change={change} />
            <Waiting queue={queue} seam={seam} change={change} />
            <PositionChanges queue={queue} />
          </div>
          <div className="flex flex-col gap-2">
            <ApproveClub queue={queue} seam={seam} change={change} />
            <ApproveMode queue={queue} seam={seam} change={change} />
            <Thresholds queue={queue} seam={seam} change={change} />
            <FindPlayer seam={seam} change={change} />
          </div>
        </div>
      )}
    </div>
  );
}

