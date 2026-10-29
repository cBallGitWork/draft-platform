import type { FeedState } from "../../convex/admin/feedState";
import { Loading, Panel, PanelNote } from "../frame/Panel";
import { whenWords } from "../shared/words";
import { AdminHeader } from "./AdminHeader";
import type { AdminSeam, FeedsReport } from "./seam";
import {
  agoWords,
  behindTitle,
  behindWords,
  changeWords,
  correctionOfWords,
  correctionsHint,
  correctionsTitle,
  moreCorrectionsWords,
  feedColumns,
  feedNames,
  feedsHint,
  feedsLoadingWords,
  feedStateWords,
  feedsTitle,
  fullTimeWords,
  lastErrorWords,
  matchWords,
  neverWords,
  noCorrectionsWords,
  noneBehindWords,
  seenWords,
} from "./words";

const cellClasses = "px-2 py-1 text-left align-top";
/** A row across the whole feeds table spans its columns. */
const FEED_COLUMN_COUNT = Object.keys(feedColumns).length;

/** A feed late or failing needs the admin: the event colour, and its bar down the row's edge. */
const NEEDS_YOU: readonly FeedState[] = ["late", "failing"];
const NEEDS_YOU_CLASSES = "font-semibold text-event";
const stateClasses: Record<FeedState, string> = {
  fine: "",
  late: NEEDS_YOU_CLASSES,
  failing: NEEDS_YOU_CLASSES,
  notRunningYet: "text-muted",
  notScheduled: "text-muted",
};

/** The dashboard's feeds tab (#35; spec/15 The admin): when each feed last brought data and
 *  whether it is late or failing; the matches whose scoring is behind; and stat corrections that
 *  came after a match's points locked. */
export function FeedsPage({ seam }: { seam: AdminSeam }) {
  const report = seam.useFeeds();
  return (
    <div className="flex max-w-5xl flex-col gap-2">
      <AdminHeader />
      {report === undefined ? (
        <Loading>{feedsLoadingWords}</Loading>
      ) : (
        <>
          <Feeds report={report} />
          <div className="grid items-start gap-2 lg:grid-cols-2">
            <Behind report={report} />
            <Corrections report={report} />
          </div>
        </>
      )}
    </div>
  );
}

function Feeds({ report }: { report: FeedsReport }) {
  return (
    <Panel title={feedsTitle}>
      <PanelNote>{feedsHint}</PanelNote>
      <table className="w-full border-collapse">
        <thead className="bg-head text-ground">
          <tr>
            <th scope="col" className={cellClasses}>{feedColumns.feed}</th>
            <th scope="col" className={cellClasses}>{feedColumns.arrived}</th>
            <th scope="col" className={cellClasses}>{feedColumns.state}</th>
          </tr>
        </thead>
        {report.feeds.map(({ feed, state, lastSuccessAt, lastError }) => {
          const edge = NEEDS_YOU.includes(state) ? "shadow-event-edge" : "";
          return (
            // A body per feed, so its error's row sits under it and is read with it.
            <tbody key={feed} className="border-t border-panel-rule">
              <tr className={edge}>
                <th scope="row" className={`${cellClasses} font-normal`}>
                  <span className="block font-semibold">{feedNames[feed].name}</span>
                  <span className="text-muted">{feedNames[feed].source}</span>
                </th>
                <td className={cellClasses}>
                  {lastSuccessAt === null ? (
                    <span className="text-muted">{neverWords}</span>
                  ) : (
                    <>
                      <span className="block">{agoWords(lastSuccessAt, report.now)}</span>
                      <span className="text-muted">{whenWords(lastSuccessAt)}</span>
                    </>
                  )}
                </td>
                <td className={`${cellClasses} ${stateClasses[state]}`}>{feedStateWords[state]}</td>
              </tr>
              {lastError && (
                <tr className={edge}>
                  <td colSpan={FEED_COLUMN_COUNT} className={`${cellClasses} break-words`}>
                    <span className="text-muted">{lastErrorWords(lastError.at)}</span> {lastError.error}
                  </td>
                </tr>
              )}
            </tbody>
          );
        })}
      </table>
    </Panel>
  );
}

function Behind({ report: { behind, moreBehind } }: { report: FeedsReport }) {
  const count = behindWords(behind.length, moreBehind);
  return (
    <Panel title={behindTitle}>
      {behind.length === 0 ? (
        <PanelNote>{noneBehindWords}</PanelNote>
      ) : (
        <>
          <p className="px-3 py-2">
            <span className="text-figure">{count.figure}</span>
            {count.after}
          </p>
          <ul aria-label={behindTitle}>
            {behind.map(({ fixtureCode, match, fullTimeAt }) => (
              <li key={fixtureCode} className="border-t border-panel-rule px-3 py-1">
                <span className="block font-semibold">{matchWords(match, fixtureCode)}</span>
                <span className="text-muted">{fullTimeWords(fullTimeAt)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

function Corrections({ report: { corrections, moreCorrections } }: { report: FeedsReport }) {
  return (
    <Panel title={correctionsTitle}>
      <PanelNote>{corrections.length === 0 ? noCorrectionsWords : correctionsHint}</PanelNote>
      {moreCorrections && <p className="px-3 pb-2 text-event">{moreCorrectionsWords(corrections.length)}</p>}
      {corrections.length > 0 && (
        <ul aria-label={correctionsTitle}>
          {corrections.map(({ fixtureCode, match, playerCode, player, seenAt, changes }) => (
            <li key={`${fixtureCode}-${playerCode}-${seenAt}`} className="border-t border-panel-rule px-3 py-1">
              <span className="block font-semibold">
                {correctionOfWords(player, playerCode, match, fixtureCode)}
              </span>
              {changes.map((change) => (
                <span key={change.stat} className="block">
                  {changeWords(change)}
                </span>
              ))}
              <span className="text-muted">{seenWords(seenAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
