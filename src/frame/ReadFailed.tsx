import { useEffect, type ReactNode } from "react";
import { PageSection, Problem } from "../ui/Panel";
import { ERROR_PAGE_TITLE, readFailedWords, retryWords } from "./words";

/** What the app logs a failed read as, with the error itself. */
export const READ_FAILED_LOG = "Reading the page failed:";

/** What every screen shows in place of itself when reading its data failed (spec/12, The frame):
 *  plain words in the alert strip, never the server's, even for a refusal, and Retry, whose
 *  `onRetry` draws the failed part afresh so its queries are asked again; the failure is
 *  logged. `children` are the other ways out beside Retry. */
export function ReadFailed({ error, onRetry, children }: { error: unknown; onRetry: () => void; children?: ReactNode }) {
  useEffect(() => {
    console.error(READ_FAILED_LOG, error);
  }, [error]);
  return (
    <PageSection title={ERROR_PAGE_TITLE} className="max-w-xl bg-panel">
      <Problem problem={readFailedWords} />
      <div className="p-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="button" onClick={onRetry} className="action">
          {retryWords}
        </button>
        {children}
      </div>
    </PageSection>
  );
}
