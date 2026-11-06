import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { FIRST_ROLE_OWN_STATS, FIRST_ROLES } from "./draftedRoleAdjustments";
import { checkOwnStatsAgainstCatalogue } from "./ownStats";
import { validateScoringSet } from "./scoringSet";
import { addVersion } from "./siteScoring";
import { setOf, siteVersions, versionName } from "./siteVersions";

// The one-off that puts the roles' first values (draftedRoleAdjustments.ts) into the site's scoring set (#10;
// Craig, 5 Nov 2026: "put roles-first-values.md into the site's set now as the starting rules,
// taking effect from the next gameweek that hasn't begun, with no letter. Later changes go by
// patch"). It adds a version to the site's set as it stands, its rules untouched, taking effect
// now, so as a fix it never reaches a gameweek already begun (siteVersions.ts). Run it once on each
// deployment; run again once the set scores roles, it does nothing.
//   npx convex run scoring/firstRolesVersion:addFirstRoles
//   npx convex run --prod scoring/firstRolesVersion:addFirstRoles

/** Adds the version, returning its name and the first gameweek it reaches, or null when the site's
 *  set already scores roles. Throws while a patch waits to take effect, as that patch was made
 *  without the roles and would drop them: run it once the patch has taken effect. */
export const addFirstRoles = internalMutation({
  args: {},
  returns: v.union(v.null(), v.object({ name: v.string(), fromGameweek: v.number() })),
  handler: async (ctx) => {
    const history = await siteVersions(ctx);
    const latest = history.at(-1);
    const now = Date.now();
    if (latest !== undefined && latest.takesEffectAt > now) {
      throw new Error(`version ${versionName(latest)} waits to take effect and was made without the roles, so they weren't added`);
    }
    const set = setOf(latest);
    if ((set.roles ?? []).length > 0) return null;
    const held = new Set((set.ownStats ?? []).map(({ stat }) => stat));
    const scoring = { ...set, ownStats: [...(set.ownStats ?? []), ...FIRST_ROLE_OWN_STATS.filter(({ stat }) => !held.has(stat))], roles: [...FIRST_ROLES] };
    validateScoringSet(scoring);
    checkOwnStatsAgainstCatalogue(scoring.ownStats);
    const { name, fromGameweek } = await addVersion(ctx, history, { scoring, kind: "fix", takesEffectAt: now }, null);
    return { name, fromGameweek };
  },
});
