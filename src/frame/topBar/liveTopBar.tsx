import { useQuery } from "convex/react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useMinute } from "../../shared/useMinute";
import { nextStep, type TopBarState } from "./topBarState";

/** The top bar filled in by Convex: Mail's unread count (useLiveMail's), and whether the manager's
 *  lineup in the league the app is in is due. `watch` must be rendered: it asks that at the minute,
 *  as a query may not read the clock, and holds the minute itself, so the shell re-renders only
 *  when the answer changes, never each minute. With no league, or while it loads, it isn't due. */
export function useLiveTopBar(unreadMail: number, leagueId: Id<"leagues"> | null): { topBar: TopBarState; watch: ReactNode } {
  const [watchedDue, setWatchedDue] = useState(false);
  const lineupDue = leagueId !== null && watchedDue;
  const topBar = useMemo(() => ({ unreadMail, next: nextStep({ unreadMail, lineupDue }) }), [unreadMail, lineupDue]);
  // Keyed by the league, so a switch starts from "not due" until the new league answers.
  const watch = leagueId === null ? null : <LineupDueWatch key={leagueId} leagueId={leagueId} onAnswer={setWatchedDue} />;
  return { topBar, watch };
}

function LineupDueWatch({ leagueId, onAnswer }: { leagueId: Id<"leagues">; onAnswer: (due: boolean) => void }) {
  const due = useQuery(api.lineup.lineupDue.isDue, { leagueId, now: useMinute() }) ?? false;
  useEffect(() => onAnswer(due), [due, onAnswer]);
  return null;
}
