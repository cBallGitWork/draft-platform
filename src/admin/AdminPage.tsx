import { PageTitle, Problem } from "../frame/Panel";
import { BackToLeagues } from "../leagues/LeagueLinks";
import { useChange } from "../useChange";
import { FindPlayer } from "./FindPositions";
import { NewSignings, Waiting } from "./QueuePanels";
import type { AdminSeam } from "./seam";
import { ApproveClub, ApproveMode } from "./SettingsPanels";
import { ADMIN_TITLE, loadingWords } from "./words";
/** The admin's dashboard (spec/06 The admin oversees them; spec/15 The admin): the queue of new
 *  signings and starts waiting for him, approving a club whole, how starts count, and correcting
 *  any player's positions. */
export function AdminPage({ seam }: { seam: AdminSeam }) {
  const queue = seam.useQueue();
  const change = useChange();
  return (
    <div className="flex max-w-5xl flex-col gap-2">
      <section aria-labelledby="page-title" className="bg-panel">
        <PageTitle>{ADMIN_TITLE}</PageTitle>
        <p className="px-3 py-2">
          <BackToLeagues />
        </p>
        <Problem problem={change.problem} />
      </section>
      {queue === undefined ? (
        <p className="text-muted">{loadingWords}</p>
      ) : (
        <div className="grid items-start gap-2 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <NewSignings queue={queue} seam={seam} change={change} />
            <Waiting queue={queue} seam={seam} change={change} />
          </div>
          <div className="flex flex-col gap-2">
            <ApproveClub queue={queue} seam={seam} change={change} />
            <ApproveMode queue={queue} seam={seam} change={change} />
            <FindPlayer seam={seam} change={change} />
          </div>
        </div>
      )}
    </div>
  );
}

