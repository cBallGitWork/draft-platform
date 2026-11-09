import { Link } from "@tanstack/react-router";
import type { Id } from "../../../convex/_generated/dataModel";
import { timeLeftWords } from "../../draft/words";
import { playerCardPath } from "../../playerCard/paths";
import { ScoutAction } from "../../playerCard/ScoutAction";
import { closeGlyph, playerCardWords } from "../../shared/words";
import { Loading, Panel, PANEL_BODY } from "../../ui/Panel";
import type { MyScouts, ScoutsSeam } from "./seam";
import {
  closeReportLabel,
  earlierReportWords,
  freeScoutWords,
  loadingScoutsWords,
  outOnWords,
  readNamedLabel,
  readWords,
  reportsListLabel,
  reportInOnWords,
  reportInSoonWords,
  reportTitle,
  scoutAgainWords,
  scoutNumberWords,
  SCOUTS_TITLE,
  scoutsOutWords,
  writtenWords,
} from "./words";

/** One of the team's reports, as `mine` reads it. */
export type TeamReport = MyScouts["reports"][number];

const ROW = "flex min-h-tap items-center gap-3 border-t border-panel-rule px-3";

/** The team's scouts on Scouting (spec/19, Scouts; Craig, 6 Nov 2026, on #375; the approved
 *  Scouting picture): a row for each scout, out on a player with the time left, back with a report
 *  in, or free, then the team's other reports, newest first. **Read ›** opens one (`read`). Nothing
 *  for someone who runs no team. */
export function ScoutsPanel({ leagueId, seam, read }: { leagueId: Id<"leagues">; seam: ScoutsSeam; read: (report: TeamReport) => void }) {
  const mine = seam.useMyScouts(leagueId);
  if (mine === null) return null;
  if (mine === undefined) {
    return (
      <Panel title={SCOUTS_TITLE}>
        <Loading className="px-3 py-2">{loadingScoutsWords}</Loading>
      </Panel>
    );
  }
  // A scout is free once his report lands (Craig, 6 Nov 2026), so the free ones show the newest reports in.
  const free = Math.max(0, mine.scouts - mine.out.length);
  const reportsIn = mine.reports.slice(0, free);
  const earlier = mine.reports.slice(free);
  const now = Date.now();
  return (
    <Panel title={SCOUTS_TITLE} aside={<span className="text-soft">{scoutsOutWords(mine.out.length, mine.scouts)}</span>}>
      <ol aria-label={SCOUTS_TITLE}>
        {Array.from({ length: mine.scouts }, (_, index) => {
          const out = mine.out[index];
          const report = out === undefined ? reportsIn[index - mine.out.length] : undefined;
          return (
            <li key={index} className={ROW}>
              <span className="w-16 shrink-0 text-soft">{scoutNumberWords(index + 1)}</span>
              {out !== undefined ? (
                <>
                  <span>{outOnWords(out.name)}</span>
                  <span className="ml-auto text-figure">{reportInSoonWords(timeLeftWords(out.dueAt - now))}</span>
                </>
              ) : report !== undefined ? (
                <>
                  <span>{reportInOnWords(report.name)}</span>
                  <ReadButton report={report} read={read} />
                </>
              ) : (
                <span className="text-soft">{freeScoutWords}</span>
              )}
            </li>
          );
        })}
      </ol>
      {earlier.length > 0 && (
        <ul aria-label={reportsListLabel}>
          {earlier.map((report) => (
            <li key={`${report.playerCode}-${report.writtenAt}`} className={ROW}>
              <span>{earlierReportWords(report.name, report.writtenAt)}</span>
              <ReadButton report={report} read={read} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ReadButton({ report, read }: { report: TeamReport; read: (report: TeamReport) => void }) {
  return (
    <button type="button" onClick={() => read(report)} aria-label={readNamedLabel(report.name, report.writtenAt)} className="ml-auto hover:underline">
      {readWords}
    </button>
  );
}

/** One report opened from the Scouts panel (the approved Scouting picture's "Report: Wood"): when it
 *  was written, its sentences, **Scout him again** (which writes a new one) and his player card. */
export function OpenReport({ leagueId, report, seam, close }: { leagueId: Id<"leagues">; report: TeamReport; seam: ScoutsSeam; close: () => void }) {
  return (
    <Panel
      title={reportTitle(report.name)}
      aside={
        <button type="button" onClick={close} aria-label={closeReportLabel} className="min-h-tap min-w-tap">
          {closeGlyph}
        </button>
      }
    >
      <div className={PANEL_BODY}>
        <p className="text-soft">{writtenWords(report.writtenAt)}</p>
        <p>{report.text}</p>
        <div className="flex flex-wrap items-center gap-2">
          <ScoutAction leagueId={leagueId} playerCode={report.playerCode} gone={false} seam={seam} label={scoutAgainWords} />
          <Link to={playerCardPath(leagueId, report.playerCode)} className="ml-auto hover:underline">
            {playerCardWords} ›
          </Link>
        </div>
      </div>
    </Panel>
  );
}
