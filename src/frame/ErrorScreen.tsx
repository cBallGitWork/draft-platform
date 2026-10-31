import type { ErrorComponentProps } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { BackToLeagues } from "../leagues/LeagueLinks";
import { ReadFailed } from "./ReadFailed";

/** What a page shows in place of itself when drawing it threw, such as a query that failed: the
 *  failed read, and the way back to "Your leagues". `children` are any other ways out beside it. */
export function ErrorScreen({ error, reset, children }: ErrorComponentProps & { children?: ReactNode }) {
  return (
    <ReadFailed error={error} onRetry={reset}>
      <BackToLeagues />
      {children}
    </ReadFailed>
  );
}
