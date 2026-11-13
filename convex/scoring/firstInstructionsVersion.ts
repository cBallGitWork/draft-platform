import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import type { FirstInstructionKey } from "../lineup/instructions";
import { sameValue } from "../scouting/scoutingPlayers";
import { FIRST_INSTRUCTION_SCORING } from "./draftedInstructionScoring";
import { latestInForce, withFirstOwnStats } from "./firstRolesVersion";
import type { StoredScoringSet } from "./scoringSetShape";
import { addVersion, checkScoringSet } from "./siteScoring";
import { setOf } from "./siteVersions";

// The one-off that puts the team instructions' first values (draftedInstructionScoring.ts) into the
// site's scoring set (#990; Craig, 9 Nov 2026: "as roles: into the site's set from the next gameweek
// that hasn't begun, no letter, changed by patch after that"), as firstRolesVersion.ts did the
// roles'. It adds a version to the site's set as it stands, its rules and roles untouched, taking
// effect now, so as a fix it never reaches a gameweek already begun (siteVersions.ts). Run it once
// on each deployment, and again when an instruction joins the first values (Keep it tight early
// did, once records held the half-time score): it adds only those the set doesn't score yet, the
// rest as the set holds them, and once it scores every one it does nothing.
//   npx convex run scoring/firstInstructionsVersion:addFirstInstructions
//   npx convex run --prod scoring/firstInstructionsVersion:addFirstInstructions

/** Adds the version, returning its name and the first gameweek it reaches, or null when the site's
 *  set already scores every first instruction. Throws while a patch waits to take effect, as that patch was
 *  made without them and would drop them: run it once the patch has taken effect. */
export const addFirstInstructions = internalMutation({
  args: {},
  returns: v.union(v.null(), v.object({ name: v.string(), fromGameweek: v.number() })),
  handler: async (ctx) => {
    const { history, version } = await latestInForce(ctx, "the instructions");
    const set = setOf(version);
    const scored = new Set((set.instructions ?? []).map(({ instruction }) => instruction));
    const missing = FIRST_INSTRUCTION_SCORING.filter(({ instruction }) => !scored.has(instruction));
    if (missing.length === 0) return null;
    // Failed long balls and crosses are own stats the roles brought in; a set without them gets them.
    const scoring = { ...set, ownStats: withFirstOwnStats(set), instructions: [...(set.instructions ?? []), ...missing] };
    checkScoringSet(scoring);
    const { name, fromGameweek } = await addVersion(ctx, history, { scoring, kind: "fix", takesEffectAt: Date.now() }, null);
    return { name, fromGameweek };
  },
});

// The one-off for #1452: Shoot on sight and Press high were redrawn around the stats Sportmonks
// sends (spec/05 S05.37, S05.42), so the site's set takes their new lines in place of the ones it
// holds, the same way: a fix taking effect now, no letter, everything else as the set holds it. The
// site isn't live (Craig, 12 Nov 2026: "the site isint live yet"), so no gameweek under way is
// protected beyond what a fix already keeps. Run it once on each deployment:
//   npx convex run scoring/firstInstructionsVersion:redrawForSportmonks
//   npx convex run --prod scoring/firstInstructionsVersion:redrawForSportmonks

type InstructionScoring = NonNullable<StoredScoringSet["instructions"]>[number];

/** The instructions #1452 redrew. */
const REDRAWN: readonly FirstInstructionKey[] = ["shootOnSight", "pressHigh"];

/** Swaps in the redrawn instructions' first lines, returning the version's name and first gameweek,
 *  or null when the set already scores them so or scores neither (addFirstInstructions adds them). */
export const redrawForSportmonks = internalMutation({
  args: {},
  returns: v.union(v.null(), v.object({ name: v.string(), fromGameweek: v.number() })),
  handler: async (ctx) => {
    const { history, version } = await latestInForce(ctx, "the redrawn instructions");
    const set = setOf(version);
    const redrawn = (held: InstructionScoring): InstructionScoring =>
      (REDRAWN.some((key) => key === held.instruction) && FIRST_INSTRUCTION_SCORING.find(({ instruction }) => instruction === held.instruction)) || held;
    const held = set.instructions ?? [];
    const instructions = held.map(redrawn);
    if (sameValue(instructions, held)) return null;
    const scoring = { ...set, instructions };
    checkScoringSet(scoring);
    const { name, fromGameweek } = await addVersion(ctx, history, { scoring, kind: "fix", takesEffectAt: Date.now() }, null);
    return { name, fromGameweek };
  },
});
