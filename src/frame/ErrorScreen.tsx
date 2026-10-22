import type { ErrorComponentProps } from "@tanstack/react-router";
import { useEffect } from "react";
import { BackToLeagues } from "../leagues/LeagueLinks";
import { refusalIn } from "../refusal";
import { PageSection, Problem } from "./Panel";
import { ERROR_PAGE_TITLE, readFailedWords } from "./words";

/** What a page shows in place of itself when drawing it threw, such as a query the server refused:
 *  the server's own words for a refusal, or plain words for any other failure, which is logged; and
 *  the way back to "Your leagues" either way. */
export function ErrorScreen({ error }: ErrorComponentProps) {
  const refusal = refusalIn(error);
  useEffect(() => {
    if (refusal === null) console.error("Drawing the page failed:", error);
  }, [error, refusal]);
  return (
    <PageSection title={ERROR_PAGE_TITLE} className="max-w-xl bg-panel">
      <Problem problem={refusal ?? readFailedWords} />
      <BackToLeagues className="px-3 py-2" />
    </PageSection>
  );
}
