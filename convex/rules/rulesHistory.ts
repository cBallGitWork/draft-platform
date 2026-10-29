import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { takeAllOrThrow } from "../shared/cappedRead";
import { heldRules, type LeagueRules } from "./leagueRulesShape";

// A league's rules history (spec/03; #25), read: its rows, and the rules in force in a gameweek.
// leagueRules.ts saves the changes.

/** The most rules rows a league holds: one per change saved, and a save made again before the same
 *  deadline is a row too, so five every gameweek of a season; rows are kept across seasons. A change
 *  past it is refused, and a read of more throws, never a silent cut, as the rules in force are the
 *  newest row (#214). Claude's choice, not yet Craig's. */
export const RULES_CHANGES_MOST = 200;

/** A rules row with its rules as `heldRules` reads them. */
export type RulesRow = Omit<Doc<"leagueRules">, "rules"> & { rules: LeagueRules };

/** Every rules row the league has, oldest first: one per change, at most RULES_CHANGES_MOST. */
export async function historyOf(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<RulesRow[]> {
  const rows = await takeAllOrThrow(
    ctx.db.query("leagueRules").withIndex("by_leagueId_and_fromGameweek", (q) => q.eq("leagueId", leagueId)),
    RULES_CHANGES_MOST,
    `League ${leagueId} holds more than ${RULES_CHANGES_MOST} rules rows, so its rules in force can't be known`,
  );
  return rows.map((row) => ({ ...row, rules: heldRules(row.rules) }));
}

/** The row in force in this gameweek: the latest to take effect at or before it, and of two from
 *  one gameweek, the newer. */
export function inForce(history: readonly RulesRow[], gameweek: number): RulesRow | undefined {
  return history.findLast((row) => row.fromGameweek <= gameweek);
}

/** The league's latest rules, a waiting change's among them, or null for a league made before #25:
 *  what the squad's warnings read (#31), as a change of squad limits is best known at once. */
export async function latestRules(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<LeagueRules | null> {
  return (await historyOf(ctx, leagueId)).at(-1)?.rules ?? null;
}

/** The rules in force in this gameweek, from the league's history. Throws if none is, which only a
 *  league made before #25 can have. */
function rulesInForce(history: readonly RulesRow[], leagueId: Id<"leagues">, gameweek: number): LeagueRules {
  const row = inForce(history, gameweek);
  if (row === undefined) throw new Error(`League ${leagueId} has no rules for gameweek ${gameweek}`);
  return row.rules;
}

/** The league's rules over the season: its latest, a waiting change's among them, and those in
 *  force in each gameweek. */
export type SeasonRules = { latest: LeagueRules; inGameweek: (gameweek: number) => LeagueRules };

/** The league's SeasonRules from one read of its history, as the fixtures read them (#266). Null
 *  for a league made before #25. */
export async function seasonRules(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<SeasonRules | null> {
  const history = await historyOf(ctx, leagueId);
  const latest = history.at(-1);
  if (latest === undefined) return null;
  return { latest: latest.rules, inGameweek: (gameweek) => rulesInForce(history, leagueId, gameweek) };
}
