import { useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useMinute } from "../../shared/useMinute";
import { nextStep, type TopBarState } from "./topBarState";

/** A league's latest answer to whether the manager's lineup is due. */
type LineupDueAnswer = { leagueId: Id<"leagues">; due: boolean };

/** The top bar filled in by Convex: Mail's unread count (useLiveMail's), whether the manager's
 *  lineup in the league the app is in is due, his pending claims there and the trade offers waiting
 *  for his answer (#1553). `watch` must be rendered: it asks whether the lineup is due at the minute,
 *  as a query may not read the clock, and holds the minute itself, so the shell re-renders only
 *  when the answer changes, never each minute. Due only by the league's latest answer: not with no
 *  league, nor before the league first answers; while a new minute's answer loads, the last stands. */
export function useLiveTopBar(unreadMail: number, leagueId: Id<"leagues"> | null): { topBar: TopBarState; watch: ReactNode } {
  const [answer, setAnswer] = useState<LineupDueAnswer | null>(null);
  const [claims, setClaims] = useState<CountAnswer | null>(null);
  const [offers, setOffers] = useState<CountAnswer | null>(null);
  const lineupDue = answer !== null && answer.leagueId === leagueId && answer.due;
  const pendingClaims = countIn(claims, leagueId);
  const offersWaiting = countIn(offers, leagueId);
  const topBar = useMemo(
    () => ({ unreadMail, next: nextStep({ unreadMail, lineupDue, offersWaiting }), pendingClaims }),
    [unreadMail, lineupDue, offersWaiting, pendingClaims],
  );
  // The same answer again keeps the state as it was, so the shell doesn't re-render for it.
  const onAnswer = useCallback(
    (next: LineupDueAnswer) => setAnswer((last) => (last?.leagueId === next.leagueId && last.due === next.due ? last : next)),
    [],
  );
  const onClaims = useCallback((next: CountAnswer) => setClaims((last) => sameCount(last, next)), []);
  const onOffers = useCallback((next: CountAnswer) => setOffers((last) => sameCount(last, next)), []);
  const watch =
    leagueId === null ? null : (
      <>
        <LineupDueWatch key={leagueId} leagueId={leagueId} onAnswer={onAnswer} />
        <CountWatch key={`claims-${leagueId}`} query={api.waivers.waiverClaims.countMine} leagueId={leagueId} onAnswer={onClaims} />
        <CountWatch key={`offers-${leagueId}`} query={api.trades.tradeOffers.countWaitingForMe} leagueId={leagueId} onAnswer={onOffers} />
      </>
    );
  return { topBar, watch };
}

/** A league's latest count of something of the manager's: his pending claims, or the trade offers
 *  waiting for his answer. */
type CountAnswer = { leagueId: Id<"leagues">; count: number };
type CountQuery = FunctionReference<"query", "public", { leagueId: Id<"leagues"> }, number>;

/** The count in the league the app is in: none before that league first answers. */
const countIn = (answer: CountAnswer | null, leagueId: Id<"leagues"> | null) => (answer !== null && answer.leagueId === leagueId ? answer.count : 0);
/** The same answer again keeps the state as it was, so the shell doesn't re-render for it. */
const sameCount = (last: CountAnswer | null, next: CountAnswer) => (last?.leagueId === next.leagueId && last.count === next.count ? last : next);

function CountWatch({ query, leagueId, onAnswer }: { query: CountQuery; leagueId: Id<"leagues">; onAnswer: (answer: CountAnswer) => void }) {
  const count = useQuery(query, { leagueId });
  useEffect(() => {
    if (count !== undefined) onAnswer({ leagueId, count });
  }, [count, leagueId, onAnswer]);
  return null;
}

function LineupDueWatch({ leagueId, onAnswer }: { leagueId: Id<"leagues">; onAnswer: (answer: LineupDueAnswer) => void }) {
  const due = useQuery(api.lineup.lineupDue.isDue, { leagueId, now: useMinute() });
  useEffect(() => {
    if (due !== undefined) onAnswer({ leagueId, due });
  }, [due, leagueId, onAnswer]);
  return null;
}
