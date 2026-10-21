import { PanelTitle } from "../frame/Panel";
import type { PanelProps } from "./panelProps";
import {
  approveLabel,
  approveWords,
  confirmLabel,
  confirmWords,
  labelWords,
  newSigningsHint,
  newSigningsTitle,
  noNewSigningsWords,
  noWaitingWords,
  proposalsWords,
  readingLinks,
  waitingHint,
  waitingTitle,
} from "./words";

// The admin's queue (spec/06, The admin oversees them): new signings on their label, and starts
// waiting for his approval.

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
    <section aria-labelledby="new-signings-title" className="bg-panel">
      <PanelTitle id="new-signings-title">{newSigningsTitle}</PanelTitle>
      <p className="px-3 py-2 text-muted">{newSigningsHint}</p>
      {queue.newSignings.length === 0 ? (
        <p className="px-3 pb-2 text-muted">{noNewSigningsWords}</p>
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
    <section aria-labelledby="waiting-title" className="bg-panel">
      <PanelTitle id="waiting-title">{waitingTitle}</PanelTitle>
      <p className="px-3 py-2 text-muted">{waitingHint}</p>
      {queue.waiting.length === 0 ? (
        <p className="px-3 pb-2 text-muted">{noWaitingWords}</p>
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

