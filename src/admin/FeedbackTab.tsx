import { useState } from "react";
import { FEEDBACK_SHOWN } from "../../convex/feedback/feedbackLimits";
import type { FeedbackList, FeedbackSeam } from "../feedback/seam";
import { Confirm } from "../ui/Confirm";
import { Loading, PAGE_STACK, Panel, PanelNote } from "../ui/Panel";
import { useChange, type Changing } from "../shared/useChange";
import { whenWords } from "../shared/words";
import { AdminHeader } from "./AdminHeader";
import { feedbackListTitle, feedbackLoadingWords, feedbackWords, moreFeedbackWords, noFeedbackWords } from "./words";

/** The dashboard's Feedback tab (#357; spec/15 The admin): what managers sent from the top bar's
 *  Feedback link, newest first, with who sent it and when; each one marked read or deleted (#395,
 *  S15.7). */
export function FeedbackTab({ seam }: { seam: FeedbackSeam }) {
  const list = seam.useFeedbackList();
  const change = useChange();
  return (
    <div className={PAGE_STACK}>
      <AdminHeader problem={change.problem} />
      {list === undefined ? (
        <Loading>{feedbackLoadingWords}</Loading>
      ) : (
        <Panel title={feedbackListTitle}>
          {list.entries.length === 0 && <PanelNote>{noFeedbackWords}</PanelNote>}
          {list.more && <p className="px-3 py-2 text-event">{moreFeedbackWords(FEEDBACK_SHOWN)}</p>}
          {list.entries.length > 0 && (
            <ul aria-label={feedbackListTitle}>
              {list.entries.map((entry) => (
                <Entry key={entry.feedbackId} entry={entry} seam={seam} change={change} />
              ))}
            </ul>
          )}
        </Panel>
      )}
    </div>
  );
}

/** One message: who sent it and when, read or not, the message, and its controls. */
function Entry({ entry, seam, change }: { entry: FeedbackList["entries"][number]; seam: FeedbackSeam; change: Changing }) {
  const { feedbackId, from, at, message, read } = entry;
  const [confirming, setConfirming] = useState(false);
  return (
    <li className="border-t border-panel-rule px-3 py-2">
      <span className="flex flex-wrap items-center gap-x-3">
        <span className={read ? "break-all" : "font-semibold break-all"}>{from}</span>
        <span className="text-muted">{whenWords(at)}</span>
        {read && <span className="text-muted">{feedbackWords.read}</span>}
        <span className="ml-auto flex flex-wrap gap-2">
          {!read && (
            <button
              type="button"
              disabled={change.busy}
              aria-label={feedbackWords.markReadLabel(from)}
              onClick={() => void change.run(() => seam.markRead(feedbackId))}
              className="secondary-action"
            >
              {feedbackWords.markRead}
            </button>
          )}
          {!confirming && (
            <button type="button" aria-label={feedbackWords.removeLabel(from)} onClick={() => setConfirming(true)} className="secondary-action">
              {feedbackWords.remove}
            </button>
          )}
        </span>
      </span>
      <span className="block whitespace-pre-wrap break-words">{message}</span>
      {confirming && (
        <div className="flex flex-col gap-2 pt-2">
          <Confirm
            question={feedbackWords.confirm(from)}
            yes={feedbackWords.yes}
            no={feedbackWords.no}
            busy={change.busy}
            onYes={() => void change.run(() => seam.remove(feedbackId))}
            onNo={() => setConfirming(false)}
          />
        </div>
      )}
    </li>
  );
}
