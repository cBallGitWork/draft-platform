import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { takeAllOrThrow } from "../shared/cappedRead";
import { latestBegun, latestOf, type LeagueDeadlines } from "../gameweeks/deadline";
import { passedDeadlinesOf } from "../gameweeks/passedDeadlines";
import { heldChanges, heldRules, type LeagueRules, type RulesChanges } from "./leagueRulesShape";

// A league's rules history (spec/03; #25), read: its rows, and the rules in force in a gameweek.
// leagueRules.ts saves the changes, each in the form `savedForm` gives.

/** The most rules rows a league holds: one per change saved, and a save made again before the same
 *  deadline is a row too, so five every gameweek of a season; rows are kept across seasons. A change
 *  past it is refused, and a read of more throws, never a silent cut, as the rules in force are the
 *  newest row (#214). Craig asked for "much higher" than the first 200 (1 Nov 2026; #894); 1,000 is
 *  Claude's number: five seasons at five a gameweek, and every rules read is still one league's rows,
 *  so its cost grows with that league's changes, not with teams. Craig kept it once a save stored
 *  only what it changed (11 Nov 2026, on #1617), so a thousand rows fit in one read. */
export const RULES_CHANGES_MOST = 1_000;

/** A rules row with its whole rules: its own as `heldRules` reads them, or the row before's with its
 *  changes. */
export type RulesRow = Omit<Doc<"leagueRules">, "rules" | "changes"> & { rules: LeagueRules };

/** Every rules row the league has, oldest first: one per change, at most RULES_CHANGES_MOST. A row
 *  holding only its changes (#1617) takes the rest from the row before it, so a read of the most
 *  rows is one league's first rules and its changes, never a thousand copies of the formations. */
export async function historyOf(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<RulesRow[]> {
  const rows = await takeAllOrThrow(
    ctx.db.query("leagueRules").withIndex("by_leagueId_and_fromGameweek", (q) => q.eq("leagueId", leagueId)),
    RULES_CHANGES_MOST,
    `League ${leagueId} holds more than ${RULES_CHANGES_MOST} rules rows, so its rules in force can't be known`,
  );
  let before: LeagueRules | undefined;
  return rows.map(({ rules: whole, changes, ...row }) => {
    before = rulesOfRow(before, whole, changes, row._id);
    return { ...row, rules: before };
  });
}

/** What a save of `rules` stores (#1617): only its `changed` parts on top of the row before, so a
 *  change of a waiver time doesn't copy the formations and classics again (Craig, 11 Nov 2026); the
 *  whole rules for a league with no row before (`changed` undefined), or when a changed part is
 *  left out, as a part a row lacks reads as the row before's. */
export function savedForm(rules: LeagueRules, changed: readonly (keyof LeagueRules)[] | undefined): { rules: LeagueRules } | { changes: RulesChanges } {
  if (changed === undefined || changed.some((part) => rules[part] === undefined)) return { rules };
  return { changes: Object.fromEntries(changed.map((part) => [part, rules[part]])) as RulesChanges };
}

/** A row's whole rules: its own, or `before` with its changes. Throws for a row holding only
 *  changes with no rules before it, which `changeRules` never writes. */
function rulesOfRow(
  before: LeagueRules | undefined,
  whole: Doc<"leagueRules">["rules"],
  changes: Doc<"leagueRules">["changes"],
  rowId: Id<"leagueRules">,
): LeagueRules {
  if (whole !== undefined) return heldRules(whole);
  if (changes === undefined || before === undefined) throw new Error(`Rules row ${rowId} holds changes with no rules before them`);
  return { ...before, ...heldChanges(changes) };
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

/** The league's latest rules, a waiting change's among them: what the draft and position warnings
 *  read. Squads, trades, free agents, plans and the waiver runs read `rulesInForceNow`,
 *  `rulesSinceBegun` or `rulesInForceAt` instead. */
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

/** The rules in force while `begun` is the latest gameweek the league has begun, or with none begun
 *  (null), those its first gameweek starts on; a change waiting for a later gameweek isn't among
 *  them. What the waiver run reads at its own moment (../waivers/waiverRun.ts). */
export function rulesSince(history: readonly RulesRow[], leagueId: Id<"leagues">, begun: number | null): LeagueRules {
  const first = (history[0] ?? newestRow(history, leagueId)).fromGameweek;
  return rulesInForce(history, leagueId, Math.max(begun ?? first, first));
}

/** The league's `rulesSince` from its history. What trades read: their review and deadline change
 *  from the next gameweek, like any rule (spec/03; #25, #1473). */
export async function rulesSinceBegun(ctx: QueryCtx, leagueId: Id<"leagues">, begun: number | null): Promise<LeagueRules> {
  return rulesSince(await historyOf(ctx, leagueId), leagueId, begun);
}

/** The rules in force at the moment `at`, `deadlines` saying which gameweek had begun by then: of
 *  those saved by then, so a waiver run time saved once its moment had gone never ran (#1468), a
 *  change saved mid-gameweek only from the next deadline (S03.11). Throws for a moment before the
 *  league had rules. Pure. */
export function rulesInForceAt(history: readonly RulesRow[], leagueId: Id<"leagues">, deadlines: LeagueDeadlines, at: number): LeagueRules {
  const saved = history.filter((row) => row._creationTime <= at);
  if (saved.length === 0) throw new Error(`League ${leagueId} has no rules saved by ${at}`);
  return rulesSince(saved, leagueId, latestBegun(deadlines, at));
}

/** The league's `rulesSinceBegun` for the latest gameweek its recorded deadlines say has begun
 *  (passedDeadlines.ts), so a read needs no clock. What squads, trades, free agents and plans read: a
 *  change saved mid-gameweek acts only from the next deadline (S03.11). */
export async function rulesInForceNow(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<LeagueRules> {
  return rulesSinceBegun(ctx, leagueId, latestOf([...(await passedDeadlinesOf(ctx, leagueId)).keys()]));
}

/** The league's rules over the season: its latest, a waiting change's among them, those in force in
 *  each gameweek, and those in force while a gameweek is the latest begun (`rulesSince`). */
export type SeasonRules = {
  latest: LeagueRules;
  inGameweek: (gameweek: number) => LeagueRules;
  sinceBegun: (begun: number | null) => LeagueRules;
};

/** The league's SeasonRules from one read of its history, as the fixtures read them (#266). */
export async function seasonRules(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<SeasonRules> {
  const history = await historyOf(ctx, leagueId);
  const latest = newestRow(history, leagueId);
  return {
    latest: latest.rules,
    inGameweek: (gameweek) => rulesInForce(history, leagueId, gameweek),
    sinceBegun: (begun) => rulesSince(history, leagueId, begun),
  };
}
