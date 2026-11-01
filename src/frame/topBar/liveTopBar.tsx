import { useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useMinute } from "../../shared/useMinute";
import { nextStep, type TopBarState } from "./topBarState";

/** A league's latest answer to whether the manager's lineup is due. */
type LineupDueAnswer = { leagueId: Id<"leagues">; due: boolean };

/** The top bar filled in by Convex: Mail's unread count (useLiveMail's), and whether the manager's
 *  lineup in the league the app is in is due. `watch` must be rendered: it asks that at the minute,
 *  as a query may not read the clock, and holds the minute itself, so the shell re-renders only
 *  when the answer changes, never each minute. Due only by the league's latest answer: not with no
 *  league, nor before the league first answers; while a new minute's answer loads, the last stands. */
export function useLiveTopBar(unreadMail: number, leagueId: Id<"leagues"> | null): { topBar: TopBarState; watch: ReactNode } {
  const [answer, setAnswer] = useState<LineupDueAnswer | null>(null);
  const lineupDue = answer !== null && answer.leagueId === leagueId && answer.due;
  const topBar = useMemo(() => ({ unreadMail, next: nextStep({ unreadMail, lineupDue }) }), [unreadMail, lineupDue]);
  // The same answer again keeps the state as it was, so the shell doesn't re-render for it.
  const onAnswer = useCallback(
    (next: LineupDueAnswer) => setAnswer((last) => (last?.leagueId === next.leagueId && last.due === next.due ? last : next)),
    [],
  );
  const watch = leagueId === null ? null : <LineupDueWatch key={leagueId} leagueId={leagueId} onAnswer={onAnswer} />;
  return { topBar, watch };
}

function LineupDueWatch({ leagueId, onAnswer }: { leagueId: Id<"leagues">; onAnswer: (answer: LineupDueAnswer) => void }) {
  const due = useQuery(api.lineup.lineupDue.isDue, { leagueId, now: useMinute() });
  useEffect(() => {
    if (due !== undefined) onAnswer({ leagueId, due });
  }, [due, leagueId, onAnswer]);
  return null;
}
