import type { ErrorComponentProps } from "@tanstack/react-router";
import { BackToLeagues } from "../leagues/LeagueLinks";
import { ReadFailed } from "./ReadFailed";

/** What a page shows in place of itself when drawing it threw, such as a query that failed: the
 *  shared failed read, whose Try again draws the page afresh, so its queries are asked again, and
 *  the way back to "Your leagues". */
export function ErrorScreen({ error, reset }: ErrorComponentProps) {
  return (
    <ReadFailed error={error} onTryAgain={reset}>
      <BackToLeagues />
    </ReadFailed>
  );
}
