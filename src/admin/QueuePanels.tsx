import { PanelNote, PanelTitle } from "../frame/Panel";
import type { PanelProps } from "./panelProps";
import {
  approveLabel,
  approveWords,
  changesHint,
  changesTitle,
  confirmLabel,
  confirmWords,
  flaggedTitle,
  flaggedWords,
  labelWords,
  newSigningsHint,
  newSigningsTitle,
  noChangesWords,
  noNewSigningsWords,
  noWaitingWords,
  proposalsWords,
  readingLinks,
  removedTitle,
  removedWords,
  waitingHint,
  waitingTitle,
} from "./words";

const NEW_SIGNINGS_TITLE_ID = "new-signings-title";
const WAITING_TITLE_ID = "waiting-title";
const CHANGES_TITLE_ID = "changes-title";

// The admin's queue (spec/06, The admin oversees them): new signings on their label, starts
// waiting for his approval, and positions flagged or removed.

/** Where to read up on him: a search on each site, opened apart from the app. */
function ReadingLinks({ fullName }: { fullName: string }) {
  return (
    <span className="flex flex-wrap gap-x-4">
      {readingLinks(fullName).map((link) => (
        <a key={link.label} href={link.href} target="_blank" rel="noreferrer" className="flex min-h-tap items-center">
          {link.label}
        </a>
      ))}
    </span>
  );
}

export function NewSignings({ queue, seam, change }: PanelProps) {
  return (
    <section aria-labelledby={NEW_SIGNINGS_TITLE_ID} className="bg-panel">
      <PanelTitle id={NEW_SIGNINGS_TITLE_ID}>{newSigningsTitle}</PanelTitle>
      <PanelNote>{newSigningsHint}</PanelNote>
      {queue.newSignings.length === 0 ? (
        <PanelNote edge="b">{noNewSigningsWords}</PanelNote>
      ) : (
        <ul aria-label={newSigningsTitle} className="border-t border-panel-rule">
          {queue.newSignings.map((player) => (
            <li key={player.code} className="flex flex-col gap-1 border-b border-panel-rule px-3 py-2">
              <span className="text-lead font-semibold">{player.fullName}</span>
              <span className="text-event">{labelWords(player.label)}</span>
              <ReadingLinks fullName={player.fullName} />
              <button
                type="button"
                disabled={change.busy}
                onClick={() => void change.run(() => seam.approvePlayer(player.code))}
                className="secondary-action self-start"
                aria-label={confirmLabel(player.name)}
              >
                {confirmWords}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Waiting({ queue, seam, change }: PanelProps) {
  return (
    <section aria-labelledby={WAITING_TITLE_ID} className="bg-panel">
      <PanelTitle id={WAITING_TITLE_ID}>{waitingTitle}</PanelTitle>
      <PanelNote>{waitingHint}</PanelNote>
      {queue.waiting.length === 0 ? (
        <PanelNote edge="b">{noWaitingWords}</PanelNote>
      ) : (
        <ul aria-label={waitingTitle} className="border-t border-panel-rule">
          {queue.waiting.map((player) => (
            <li key={player.code} className="flex items-center justify-between gap-2 border-b border-panel-rule px-3 py-1">
              <span className="flex flex-col">
                <span className="font-semibold">{player.fullName}</span>
                <span className="text-event">{proposalsWords(player.proposals)}</span>
              </span>
              <button
                type="button"
                disabled={change.busy}
                onClick={() => void change.run(() => seam.approvePlayer(player.code))}
                className="secondary-action"
                aria-label={approveLabel(player.name)}
              >
                {approveWords}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Positions from starts a run elsewhere has flagged, which need him (he can set one to keep it),
 *  and those it has removed (spec/06, When positions change). */
export function PositionChanges({ queue }: Pick<PanelProps, "queue">) {
  const { flagged, removed } = queue;
  return (
    <section aria-labelledby={CHANGES_TITLE_ID} className="bg-panel">
      <PanelTitle id={CHANGES_TITLE_ID}>{changesTitle}</PanelTitle>
      <PanelNote>{changesHint(queue.thresholds)}</PanelNote>
      {flagged.length === 0 && removed.length === 0 && <PanelNote edge="b">{noChangesWords}</PanelNote>}
      {flagged.length > 0 && (
        <ul aria-label={flaggedTitle} className="border-t border-panel-rule">
          {flagged.map((each) => (
            <li key={`${each.code}-${each.position}`} className="flex flex-col border-b border-panel-rule px-3 py-1">
              <span className="font-semibold">{each.fullName}</span>
              <span className="text-event">{flaggedWords(each.position, each.startsElsewhere)}</span>
            </li>
          ))}
        </ul>
      )}
      {removed.length > 0 && (
        <ul aria-label={removedTitle} className="border-t border-panel-rule text-muted">
          {removed.map((each) => (
            <li key={`${each.code}-${each.position}`} className="flex flex-col border-b border-panel-rule px-3 py-1">
              <span>{each.fullName}</span>
              <span>{removedWords(each.position)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
