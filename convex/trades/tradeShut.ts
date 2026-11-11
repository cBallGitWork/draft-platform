import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { draftIsLive } from "../draft/draftRow";
import type { LeagueDeadlines } from "../gameweeks/deadline";
import { tradeRulesOf } from "../rules/firstRules";
import { rulesSinceBegun } from "../rules/rulesHistory";
import { gameweekUnderWay, inUnplayedGameweek, latestBegun } from "../waivers/waiverLock";

// When no trade is offered or accepted (spec/08 Trades; #383): while the league's draft is live,
// when only its picks change squads (S08.7, Craig, 11 Nov 2026, #1482); once its trade deadline,
// a league setting off by default, has passed, which is when that gameweek's last match is over
// (Craig, 6 Nov 2026); and through a
// gameweek the league doesn't play, from its deadline until its last match is over (spec/13:
// "when its international break, we lock everything"). And no offer goes to or from a team on
// the auto team (spec/09). The deadline is the one in force in the gameweek begun, never a change
// still waiting for the next (#1473).

/** Why trades are shut, or null while they are open. */
export type TradesShut = "draftLive" | "tradeDeadline" | "unusedGameweek" | null;

/** Why the league's trades are shut at `now`, if they are. */
export async function tradesShut(ctx: QueryCtx, league: Doc<"leagues">, deadlines: LeagueDeadlines, now: number): Promise<TradesShut> {
  if (await draftIsLive(ctx, league._id)) return "draftLive";
  const begun = latestBegun(deadlines, now);
  if (begun === null) return null;
  const rules = await rulesSinceBegun(ctx, league._id, begun);
  const tradeDeadline = tradeRulesOf(rules).deadline;
  if (tradeDeadline !== null && begun >= tradeDeadline) {
    if (begun > tradeDeadline || !(await gameweekUnderWay(ctx, begun))) return "tradeDeadline";
  }
  if (await inUnplayedGameweek(ctx, league, deadlines, now)) return "unusedGameweek";
  return null;
}

/** Whether the team is on the auto team: switched on by a person, or with no manager (spec/09). */
export const onAutoTeam = (team: Doc<"teams">) => team.autoTeam !== undefined || team.managerEmail === undefined;
