import { useEffect, type ReactNode } from "react";
import { PageSection, Problem } from "./Panel";
import { ERROR_PAGE_TITLE, readFailedWords, tryAgainWords } from "./words";

/** What the app logs a failed read as, with the error itself. */
export const READ_FAILED_LOG = "Reading the page failed:";

/** What every screen shows in place of itself when reading its data failed (spec/12, The frame):
 *  plain words in the alert strip, never the server's, even for a refusal, and Try again, whose
 *  `onTryAgain` draws the failed part afresh so its queries are asked again; the failure is
 *  logged. `children` are the other ways out beside Try again. */
export function ReadFailed({ error, onTryAgain, children }: { error: unknown; onTryAgain: () => void; children?: ReactNode }) {
  useEffect(() => {
    console.error(READ_FAILED_LOG, error);
  }, [error]);
  return (
    <PageSection title={ERROR_PAGE_TITLE} className="max-w-xl bg-panel">
      <Problem problem={readFailedWords} />
      <div className="m-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="button" onClick={onTryAgain} className="action">
          {tryAgainWords}
        </button>
        {children}
      </div>
    </PageSection>
  );
}
