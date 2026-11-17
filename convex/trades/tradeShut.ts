import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { draftIsLive } from "../draft/draftRow";
import { latestBegun, nextDeadline, type LeagueDeadlines } from "../gameweeks/deadline";
import { gameweekUnderWay, unplayedUnderWay } from "../gameweeks/gameweekEnd";
import { tradeRulesOf } from "../rules/firstRules";
import type { TradeRules } from "../rules/leagueRulesShape";
import { rulesSinceBegun } from "../rules/rulesHistory";
import type { TradesShut } from "./tradeShutWords";

// When no trade is offered or accepted (spec/08 Trades; #383): while the league's draft is live,
// when only its picks change squads (S08.7, Craig, 11 Nov 2026, #1482); once its trade deadline,
// a league setting off by default, has passed, which is when that gameweek's last match is over
// (Craig, 6 Nov 2026); and through a
// gameweek the league doesn't play, from its deadline until its last match is over (spec/13:
// "when its international break, we lock everything"). And no offer goes to or from a team on
// the auto team (spec/09). The deadline is the one in force in the gameweek begun, never a change
// still waiting for the next (#1473). Each read turns on the clock only through the latest
// gameweek begun, so the Trades screen reads each one an hour can see (tradeScreen.ts, #2008).

/** Why the league's trades are shut at `now`, if they are. */
export async function tradesShut(ctx: QueryCtx, league: Doc<"leagues">, deadlines: LeagueDeadlines, now: number): Promise<TradesShut> {
  const begun = latestBegun(deadlines, now);
  return tradesShutOnceBegun(ctx, league, begun, (await tradeRulesOnceBegun(ctx, league._id, begun)).deadline);
}

/** Why the league's trades are shut while `begun` is the latest gameweek begun (null before any),
 *  with `tradeDeadline` the trade deadline then in force. */
export async function tradesShutOnceBegun(ctx: QueryCtx, league: Doc<"leagues">, begun: number | null, tradeDeadline: number | null): Promise<TradesShut> {
  if (await draftIsLive(ctx, league._id)) return "draftLive";
  if (begun === null) return null;
  if (tradeDeadline !== null && begun >= tradeDeadline) {
    if (begun > tradeDeadline || !(await gameweekUnderWay(ctx, begun))) return "tradeDeadline";
  }
  if (await unplayedUnderWay(ctx, league, begun)) return "unusedGameweek";
  return null;
}

/** The league's trade deadline gameweek in force at `now`, the one in the gameweek begun (#1473);
 *  null with none set, or before any gameweek has begun. */
export async function tradeDeadlineInForce(ctx: QueryCtx, leagueId: Id<"leagues">, deadlines: LeagueDeadlines, now: number): Promise<number | null> {
  return (await tradeRulesOnceBegun(ctx, leagueId, latestBegun(deadlines, now))).deadline;
}

/** The league's trade rules in force while `begun` is the latest gameweek begun (#1473), its trade
 *  deadline null before any has begun. */
export async function tradeRulesOnceBegun(ctx: QueryCtx, leagueId: Id<"leagues">, begun: number | null): Promise<TradeRules> {
  const rules = tradeRulesOf(await rulesSinceBegun(ctx, leagueId, begun));
  return begun === null ? { ...rules, deadline: null } : rules;
}

/** When an open offer made at `madeAt` closes unanswered: at the next deadline (spec/08), unless
 *  trades shut first, once the trade deadline's gameweek's last match is over (Craig, 6 Nov 2026,
 *  on #383), which has no time known ahead, so `at` is null (S08.9, Craig, 11 Nov 2026, on #1492).
 *  Pure. */
export function offerCloses(
  deadlines: LeagueDeadlines,
  madeAt: number,
  tradeDeadline: number | null,
): { gameweek: number; at: number | null } | null {
  const next = nextDeadline(deadlines, madeAt);
  if (next === null || tradeDeadline === null || next.gameweek <= tradeDeadline) return next;
  return { gameweek: tradeDeadline, at: null };
}
