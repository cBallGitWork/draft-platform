import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { draftIsLive } from "../draft/draftRow";
import { latestBegun, nextDeadline, type LeagueDeadlines } from "../gameweeks/deadline";
import { gameweekUnderWay, inUnplayedGameweek } from "../gameweeks/gameweekEnd";
import { tradeRulesOf } from "../rules/firstRules";
import { rulesSinceBegun } from "../rules/rulesHistory";
import type { TradesShut } from "./tradeShutWords";

// When no trade is offered or accepted (spec/08 Trades; #383): while the league's draft is live,
// when only its picks change squads (S08.7, Craig, 11 Nov 2026, #1482); once its trade deadline,
// a league setting off by default, has passed, which is when that gameweek's last match is over
// (Craig, 6 Nov 2026); and through a
// gameweek the league doesn't play, from its deadline until its last match is over (spec/13:
// "when its international break, we lock everything"). And no offer goes to or from a team on
// the auto team (spec/09). The deadline is the one in force in the gameweek begun, never a change
// still waiting for the next (#1473).

/** Why the league's trades are shut at `now`, if they are. */
export async function tradesShut(ctx: QueryCtx, league: Doc<"leagues">, deadlines: LeagueDeadlines, now: number): Promise<TradesShut> {
  if (await draftIsLive(ctx, league._id)) return "draftLive";
  const begun = latestBegun(deadlines, now);
  if (begun === null) return null;
  const tradeDeadline = await tradeDeadlineInForce(ctx, league._id, deadlines, now);
  if (tradeDeadline !== null && begun >= tradeDeadline) {
    if (begun > tradeDeadline || !(await gameweekUnderWay(ctx, begun))) return "tradeDeadline";
  }
  if (await inUnplayedGameweek(ctx, league, deadlines, now)) return "unusedGameweek";
  return null;
}

/** The league's trade deadline gameweek in force at `now`, the one in the gameweek begun (#1473);
 *  null with none set, or before any gameweek has begun. */
export async function tradeDeadlineInForce(ctx: QueryCtx, leagueId: Id<"leagues">, deadlines: LeagueDeadlines, now: number): Promise<number | null> {
  const begun = latestBegun(deadlines, now);
  if (begun === null) return null;
  return tradeRulesOf(await rulesSinceBegun(ctx, leagueId, begun)).deadline;
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
