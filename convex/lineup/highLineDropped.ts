import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { GAMEWEEKS_MOST } from "../gameweeks/usedGameweeks";
import { fileLetter } from "../mail/letters";
import { classicFormationsOf, instructionsOf } from "../rules/firstRules";
import { heldRules, type LeagueRules, type RulesChanges } from "../rules/leagueRulesShape";
import { historyOf, RULES_CHANGES_MOST } from "../rules/rulesHistory";
import { scheduleEveryLeague, takeAllOrThrow } from "../shared/cappedRead";
import { getLeague, teamsOf } from "../shared/leagueAccess";
import { sameValue } from "../scouting/scoutingPlayers";
import { FIRST_INSTRUCTIONS, keptOrSwitched, SIDES, type FirstInstructionKey, type Instruction, type InstructionPair } from "./instructions";
import { lostInstructionsLetter, type LostInstruction } from "./instructionsWords";
import { PLANS_KEPT } from "./lineupWords";
import type { Cell } from "./pitch";

// The one-off for #1452 (spec/05 S05.37, S05.42, S05.48): the leagues already made, and the admin's
// default rules every new league copies, catch up with the first set (instructions.ts).
// - Hold a high line leaves each league's set until Sportmonks sends offsides won.
// - Press high and Shoot on sight take their new words, and Press high its two-up-front need, where
//   a league still holds them as they were before #1452; a commissioner's own words stay.
// - A preset's default or a classic formation's instruction that leaves goes to its formation's
//   default, as does a saved lineup's or plan's (Craig, 13 Nov 2026: "Formation's default"). Its
//   manager gets a Mail saying so, so he can pick another.
// Every rules row and lineup row moves, past ones included: the site isn't live, so there is no
// gameweek under way to keep (Craig, 12 Nov 2026: "the site isint live yet"). Each league runs in
// its own transaction, and running it again does nothing. Run it once on each deployment:
//   npx convex run lineup/highLineDropped:dropHighLine
//   npx convex run --prod lineup/highLineDropped:dropHighLine

/** The instruction #1452 drops. Its key is never reused. */
const DROPPED = "holdAHighLine";

/** The first set's words before #1452 redrew them, which a league made before then still holds. */
const WORDS_BEFORE: Partial<Record<FirstInstructionKey, string>> = {
  shootOnSight: "Rewards goals and shots on target from outside the box; costs long shots off target or blocked.",
  pressHigh: "Rewards possession won high and in midfield; costs fouls.",
};

/** A league's set as #1452 leaves it: Hold a high line gone, and Press high and Shoot on sight as the
 *  first set has them wherever they still hold the words and need from before. */
export function redrawnSet(set: readonly Instruction[]): Instruction[] {
  return set
    .filter(({ key }) => key !== DROPPED)
    .map((held) => {
      const first = FIRST_INSTRUCTIONS.find(({ key }) => key === held.key);
      if (first === undefined) return held;
      const oldWords = WORDS_BEFORE[first.key] === held.description;
      return { ...held, ...(oldWords && { description: first.description }), ...(first.key === "pressHigh" && held.needs === "threeInARow" && { needs: first.needs }) };
    });
}

/** The pair a formation holds under the redrawn set: each pick kept that its shape still offers,
 *  else its formation's default (instructions.ts `keptOrSwitched`). */
const keptPair = (pair: InstructionPair, cells: readonly Cell[], presets: LeagueRules["presets"], set: readonly Instruction[]) =>
  keptOrSwitched(pair, cells, presets, set).pair;

/** A league's rules as #1452 leaves them: its set redrawn, and each preset's default pair and each
 *  classic formation's pair one its shape offers in that set. Parts the rules don't hold, as rules
 *  saved before the instructions or classics were rules, stay unheld: they read the first rules'. */
export function redrawnRules(rules: LeagueRules): LeagueRules {
  const set = redrawnSet(instructionsOf(rules));
  const presets = rules.presets.map((preset) =>
    preset.instructions === undefined ? preset : { ...preset, instructions: keptPair(preset.instructions, preset.cells, [], set) },
  );
  const classics = classicFormationsOf(rules).map((classic) => ({ ...classic, instructions: keptPair(classic.instructions, classic.cells, presets, set) }));
  return {
    ...rules,
    presets,
    ...(rules.instructions !== undefined && { instructions: set }),
    ...(rules.classics !== undefined && { classics }),
  };
}

/** Redraws the admin's default rules, then schedules each league's own redraw. Returns whether the
 *  defaults changed. */
export const dropHighLine = internalMutation({
  args: {},
  returns: v.object({ defaultsMoved: v.boolean() }),
  handler: async (ctx) => {
    const defaults = await ctx.db.query("defaultLeagueRules").unique();
    let defaultsMoved = false;
    if (defaults !== null) {
      const held = heldRules(defaults.rules);
      const redrawn = redrawnRules(held);
      defaultsMoved = !sameValue(redrawn, held);
      if (defaultsMoved) await ctx.db.patch("defaultLeagueRules", defaults._id, { rules: redrawn });
    }
    await scheduleEveryLeague(ctx, internal.lineup.highLineDropped.dropInLeague, "so some would keep Hold a high line");
    return { defaultsMoved };
  },
});

/** One league's redraw: its rules rows, then each team's lineups and saved plans, and a Mail to each
 *  manager whose line-up or plans lost a pick. */
export const dropInLeague = internalMutation({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { leagueId }) => {
    const latest = await redrawRulesRows(ctx, leagueId);
    if (latest === null) return null;
    const league = await getLeague(ctx, leagueId);
    for (const team of await teamsOf(ctx, leagueId)) {
      const lost = await redrawTeam(ctx, team, latest);
      if (lost.length > 0 && team.managerEmail !== undefined) await fileLetter(ctx, league, "lineup",[team.managerEmail], lostInstructionsLetter(lost));
    }
    return null;
  },
});

/** Redraws each of the league's rules rows where it holds a part that moves, a row of changes only
 *  in the parts it changes. Returns the league's latest rules before and after, null with no rows. */
async function redrawRulesRows(ctx: MutationCtx, leagueId: Id<"leagues">): Promise<{ before: LeagueRules; after: LeagueRules } | null> {
  const history = await historyOf(ctx, leagueId);
  const rows = await takeAllOrThrow(
    ctx.db.query("leagueRules").withIndex("by_leagueId_and_fromGameweek", (q) => q.eq("leagueId", leagueId)),
    RULES_CHANGES_MOST,
    `League ${leagueId} holds more than ${RULES_CHANGES_MOST} rules rows, so some would keep Hold a high line`,
  );
  for (const row of rows) {
    const whole = history.find(({ _id }) => _id === row._id)!.rules;
    const redrawn = redrawnRules(whole);
    if (row.rules !== undefined) {
      if (!sameValue(redrawn, heldRules(row.rules))) await ctx.db.patch("leagueRules", row._id, { rules: redrawn });
    } else if (row.changes !== undefined) {
      const changes = Object.fromEntries(Object.keys(row.changes).map((part) => [part, redrawn[part as keyof LeagueRules]])) as RulesChanges;
      if (!sameValue(changes, row.changes)) await ctx.db.patch("leagueRules", row._id, { changes });
    }
  }
  const before = history.at(-1)?.rules;
  return before === undefined ? null : { before, after: redrawnRules(before) };
}

/** Moves each of the team's lineup rows and saved plans off a pick the redrawn rules no longer
 *  offer, returning what its newest lineup and its plans lost, for its manager's Mail. */
async function redrawTeam(ctx: MutationCtx, team: Doc<"teams">, { before, after }: { before: LeagueRules; after: LeagueRules }): Promise<LostInstruction[]> {
  const set = instructionsOf(after);
  const nameIn = (rules: LeagueRules, key: string) => instructionsOf(rules).find((each) => each.key === key)?.name ?? key;
  const lostIn = (held: InstructionPair, kept: InstructionPair, plan?: string): LostInstruction[] =>
    SIDES.filter((side) => held[side] !== kept[side])
      .map((side) => ({ from: held[side], fromName: nameIn(before, held[side]), toName: nameIn(after, kept[side]), ...(plan !== undefined && { plan }) }));

  const lost: LostInstruction[] = [];
  const rows = await ctx.db
    .query("lineups")
    .withIndex("by_leagueId_and_teamId_and_fromGameweek", (q) => q.eq("leagueId", team.leagueId).eq("teamId", team._id))
    // One row a gameweek at most (lineups.ts `save`).
    .take(GAMEWEEKS_MOST);
  const newest = rows.at(-1);
  for (const row of rows) {
    if (row.instructions === undefined) continue;
    const kept = keptPair(row.instructions, row.starters, after.presets, set);
    if (sameValue(kept, row.instructions)) continue;
    await ctx.db.patch("lineups", row._id, { instructions: kept });
    if (row === newest) lost.push(...lostIn(row.instructions, kept));
  }
  // save refuses a sixth plan, so a team never holds more than PLANS_KEPT: the bound cuts nothing.
  const plans = await ctx.db
    .query("savedPlans")
    .withIndex("by_leagueId_and_teamId_and_name", (q) => q.eq("leagueId", team.leagueId).eq("teamId", team._id))
    .take(PLANS_KEPT);
  for (const plan of plans) {
    if (plan.instructions === undefined) continue;
    const kept = keptPair(plan.instructions, plan.slots, after.presets, set);
    if (sameValue(kept, plan.instructions)) continue;
    await ctx.db.patch("savedPlans", plan._id, { instructions: kept });
    lost.push(...lostIn(plan.instructions, kept, plan.name));
  }
  return lost;
}
