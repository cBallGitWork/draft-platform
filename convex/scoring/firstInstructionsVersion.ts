import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { FIRST_INSTRUCTION_SCORING } from "./draftedInstructionScoring";
import { FIRST_ROLE_OWN_STATS } from "./draftedRoleAdjustments";
import { checkOwnStatsAgainstCatalogue } from "./ownStats";
import { validateScoringSet } from "./scoringSet";
import { addVersion } from "./siteScoring";
import { setOf, siteVersions, versionName } from "./siteVersions";

// The one-off that puts the team instructions' first values (draftedInstructionScoring.ts) into the
// site's scoring set (#990; Craig, 9 Nov 2026: "as roles: into the site's set from the next gameweek
// that hasn't begun, no letter, changed by patch after that"), as firstRolesVersion.ts did the
// roles'. It adds a version to the site's set as it stands, its rules and roles untouched, taking
// effect now, so as a fix it never reaches a gameweek already begun (siteVersions.ts). Run it once
// on each deployment; run again once the set scores instructions, it does nothing.
//   npx convex run scoring/firstInstructionsVersion:addFirstInstructions
//   npx convex run --prod scoring/firstInstructionsVersion:addFirstInstructions

/** Adds the version, returning its name and the first gameweek it reaches, or null when the site's
 *  set already scores instructions. Throws while a patch waits to take effect, as that patch was
 *  made without them and would drop them: run it once the patch has taken effect. */
export const addFirstInstructions = internalMutation({
  args: {},
  returns: v.union(v.null(), v.object({ name: v.string(), fromGameweek: v.number() })),
  handler: async (ctx) => {
    const history = await siteVersions(ctx);
    const latest = history.at(-1);
    const now = Date.now();
    if (latest !== undefined && latest.takesEffectAt > now) {
      throw new Error(`version ${versionName(latest)} waits to take effect and was made without the instructions, so they weren't added`);
    }
    const set = setOf(latest);
    if ((set.instructions ?? []).length > 0) return null;
    // Failed long balls and crosses are own stats the roles brought in; a set without them gets them.
    const held = new Set((set.ownStats ?? []).map(({ stat }) => stat));
    const ownStats = [...(set.ownStats ?? []), ...FIRST_ROLE_OWN_STATS.filter(({ stat }) => !held.has(stat))];
    const scoring = { ...set, ownStats, instructions: [...FIRST_INSTRUCTION_SCORING] };
    validateScoringSet(scoring);
    checkOwnStatsAgainstCatalogue(scoring.ownStats);
    const { name, fromGameweek } = await addVersion(ctx, history, { scoring, kind: "fix", takesEffectAt: now }, null);
    return { name, fromGameweek };
  },
});
