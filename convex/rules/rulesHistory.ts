import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { takeAllOrThrow } from "../shared/cappedRead";
import { heldRules, type LeagueRules } from "./leagueRulesShape";

// A league's rules history (spec/03; #25), read: its rows, and the rules in force in a gameweek.
// leagueRules.ts saves the changes.

/** The most rules rows a league holds: one per change saved, and a save made again before the same
 *  deadline is a row too, so five every gameweek of a season; rows are kept across seasons. A change
 *  past it is refused, and a read of more throws, never a silent cut, as the rules in force are the
 *  newest row (#214). Craig asked for "much higher" than the first 200 (1 Nov 2026; #894); 1,000 is
 *  Claude's number: five seasons at five a gameweek, and every rules read is still one league's rows,
 *  so its cost grows with that league's changes, not with teams. */
export const RULES_CHANGES_MOST = 1_000;

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

/** The newest row of the league's history. Throws for a league with none: every league is given
 *  its rules when it is made (leagueRules.ts, `giveDefaultRules`), and #147 checked each deployment
 *  holds no league without them. */
export function newestRow(history: readonly RulesRow[], leagueId: Id<"leagues">): RulesRow {
  const row = history.at(-1);
  if (row === undefined) throw new Error(`League ${leagueId} has no rules`);
  return row;
}

/** The league's latest rules, a waiting change's among them: what the squad's warnings read (#31),
 *  as a change of squad limits is best known at once. Trades read `rulesSinceBegun` instead. */
export async function latestRules(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<LeagueRules> {
  return newestRow(await historyOf(ctx, leagueId), leagueId).rules;
}

/** The rules in force in this gameweek, from the league's history. Throws if none is, which no
 *  gameweek from the first can have. */
function rulesInForce(history: readonly RulesRow[], leagueId: Id<"leagues">, gameweek: number): LeagueRules {
  const row = inForce(history, gameweek);
  if (row === undefined) throw new Error(`League ${leagueId} has no rules for gameweek ${gameweek}`);
  return row.rules;
}

/** The league's rules in force while `begun` is the latest gameweek it has begun, or with none begun
 *  (null), those its first gameweek starts on; a change waiting for a later gameweek isn't among
 *  them. What trades read: their review and deadline change from the next gameweek, like any rule
 *  (spec/03; #25, #1473). */
export async function rulesSinceBegun(ctx: QueryCtx, leagueId: Id<"leagues">, begun: number | null): Promise<LeagueRules> {
  const history = await historyOf(ctx, leagueId);
  const first = (history[0] ?? newestRow(history, leagueId)).fromGameweek;
  return rulesInForce(history, leagueId, Math.max(begun ?? first, first));
}

/** The league's rules over the season: its latest, a waiting change's among them, and those in
 *  force in each gameweek. */
export type SeasonRules = { latest: LeagueRules; inGameweek: (gameweek: number) => LeagueRules };

/** The league's SeasonRules from one read of its history, as the fixtures read them (#266). */
export async function seasonRules(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<SeasonRules> {
  const history = await historyOf(ctx, leagueId);
  const latest = newestRow(history, leagueId);
  return { latest: latest.rules, inGameweek: (gameweek) => rulesInForce(history, leagueId, gameweek) };
}
