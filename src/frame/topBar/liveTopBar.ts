import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useMinute } from "../../shared/useMinute";
import { nextStep, type TopBarState } from "./topBarState";

/** The top bar filled in by Convex: Mail's unread count (useLiveMail's), and whether the manager's
 *  lineup in the league the app is in is due, asked at the minute, as a query may not read the
 *  clock. Not asked with no league; while it loads, it isn't due. */
export function useLiveTopBar(unreadMail: number, leagueId: Id<"leagues"> | null): TopBarState {
  const now = useMinute();
  const lineupDue = useQuery(api.lineup.lineupDue.isDue, leagueId === null ? "skip" : { leagueId, now }) ?? false;
  return useMemo(() => ({ unreadMail, next: nextStep({ unreadMail, lineupDue }) }), [unreadMail, lineupDue]);
}
