import { useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import type { ScoutsSeam, ScoutTrip } from "../scouting/scouts/seam";
import { noReportWords, olderReportWords, reportDayWords, SCOUT_REPORT_TITLE, scoutOutWords } from "../scouting/scouts/words";
import { Panel, PANEL_BODY, PanelNote } from "../ui/Panel";

type Reported = ScoutTrip & { report: NonNullable<ScoutTrip["report"]> };
const isReported = (trip: ScoutTrip): trip is Reported => trip.report !== null;

/** His team's scouts' reports on him (spec/19, The report; Craig, 6 Nov 2026, on #375): the newest,
 *  dated, and under it each older one, which opens in place (the approved card's "Older report").
 *  A scout out on him says when his report is in. Only his own team's, so nothing for someone who
 *  runs no team, nor while it loads. */
export function ScoutReport({ leagueId, playerCode, seam }: { leagueId: Id<"leagues">; playerCode: number; seam: ScoutsSeam }) {
  const trips = seam.useScoutsOn(leagueId, playerCode);
  if (trips === null || trips === undefined) return null;
  const out = trips.find((trip) => trip.state === "out");
  const [newest, ...older] = trips.filter(isReported).toSorted((one, other) => other.report.writtenAt - one.report.writtenAt);
  return (
    <Panel title={SCOUT_REPORT_TITLE} aside={newest && <span className="text-soft">{reportDayWords(newest.report.writtenAt)}</span>}>
      {out !== undefined && <PanelNote>{scoutOutWords(out.dueAt)}</PanelNote>}
      {newest === undefined ? (
        out === undefined && <PanelNote>{noReportWords}</PanelNote>
      ) : (
        <>
          <p className={PANEL_BODY}>{newest.report.text}</p>
          {older.length > 0 && (
            <ul className="pb-2">
              {older.map((trip) => (
                <OlderReport key={trip.sentAt} report={trip.report} />
              ))}
            </ul>
          )}
        </>
      )}
    </Panel>
  );
}

function OlderReport({ report }: { report: Reported["report"] }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="px-3">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="text-soft hover:underline">
        {olderReportWords(report.writtenAt)}
      </button>
      {open && <p className="py-1">{report.text}</p>}
    </li>
  );
}
