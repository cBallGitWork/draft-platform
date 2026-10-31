import { FEEDBACK_SHOWN } from "../../convex/feedback/feedbackLimits";
import type { FeedbackSeam } from "../feedback/seam";
import { Loading, PAGE_STACK, Panel, PanelNote } from "../ui/Panel";
import { whenWords } from "../shared/words";
import { AdminHeader } from "./AdminHeader";
import { feedbackListTitle, feedbackLoadingWords, moreFeedbackWords, noFeedbackWords } from "./words";

/** The dashboard's Feedback tab (#357; spec/15 The admin): what managers sent from the top bar's
 *  Feedback link, newest first, with who sent it and when. */
export function FeedbackTab({ seam }: { seam: FeedbackSeam }) {
  const list = seam.useFeedbackList();
  return (
    <div className={PAGE_STACK}>
      <AdminHeader />
      {list === undefined ? (
        <Loading>{feedbackLoadingWords}</Loading>
      ) : (
        <Panel title={feedbackListTitle}>
          {list.entries.length === 0 && <PanelNote>{noFeedbackWords}</PanelNote>}
          {list.more && <p className="px-3 py-2 text-event">{moreFeedbackWords(FEEDBACK_SHOWN)}</p>}
          {list.entries.length > 0 && (
            <ul aria-label={feedbackListTitle}>
              {list.entries.map(({ feedbackId, from, at, message }) => (
                <li key={feedbackId} className="border-t border-panel-rule px-3 py-2">
                  <span className="flex flex-wrap gap-x-3">
                    <span className="font-semibold break-all">{from}</span>
                    <span className="text-muted">{whenWords(at)}</span>
                  </span>
                  <span className="block whitespace-pre-wrap break-words">{message}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </div>
  );
}
