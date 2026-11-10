import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { heldPositionsOf } from "../lineup/lineups";
import type { PlayerPositions } from "../lineup/lineup";
import { isRole } from "../lineup/roles";
import { droppedStarter } from "../stars/bestRole";
import { starsOfPlayers } from "../stars/playerStars";
import { sortedJson } from "../shared/sortedJson";
import { FIRST_ROLE_OWN_STATS, FIRST_ROLES } from "./draftedRoleAdjustments";
import { checkOwnStatsAgainstCatalogue } from "./ownStats";
import { validateScoringSet } from "./scoringSet";
import type { StoredScoringSet } from "./scoringSetShape";
import { addVersion } from "./siteScoring";
import { setOf, siteVersions, versionName } from "./siteVersions";

// The one-offs that put the roles' values (draftedRoleAdjustments.ts) into the site's scoring set.
// Each adds a version to the site's set as it stands, its rules untouched, taking effect now, so as
// a fix it never reaches a gameweek already begun (siteVersions.ts), with no letter.
// - addFirstRoles (#10; Craig, 5 Nov 2026: "put roles-first-values.md into the site's set now as the
//   starting rules, taking effect from the next gameweek that hasn't begun, with no letter. Later
//   changes go by patch"): once, into a set that scores no role.
//     npx convex run scoring/firstRolesVersion:addFirstRoles
// - addRedrawnRoles (#1445; spec/05 `S05.27`, `S05.3`): the mixes redrawn around Sportmonks' stats
//   (#1196), in place of the set's, from the next gameweek not begun. Every starter on a role the
//   set no longer holds moves to the role he'd get dropped into that slot, his lineup never refused
//   (spec/05, Roles' patch rule). Run it again and it does nothing.
//     npx convex run scoring/firstRolesVersion:addRedrawnRoles
// Add --prod to run either on production.

const added = v.object({ name: v.string(), fromGameweek: v.number() });

/** Adds the version, returning its name and the first gameweek it reaches, or null when the site's
 *  set already scores roles. Throws while a patch waits to take effect, as that patch was made
 *  without the roles and would drop them: run it once the patch has taken effect. */
export const addFirstRoles = internalMutation({
  args: {},
  returns: v.union(v.null(), added),
  handler: async (ctx) => {
    const latest = await latestInForce(ctx, "the roles");
    if ((setOf(latest.version).roles ?? []).length > 0) return null;
    const { name, fromGameweek } = await addRoles(ctx, latest);
    return { name, fromGameweek };
  },
});

/** Adds the version with the redrawn roles, returning its name, the first gameweek it reaches and
 *  how many starters moved off a cut role, or null when the site's set already scores them. Throws
 *  while a patch waits to take effect, as addFirstRoles does. */
export const addRedrawnRoles = internalMutation({
  args: {},
  returns: v.union(v.null(), v.object({ name: v.string(), fromGameweek: v.number(), moved: v.number() })),
  handler: async (ctx) => {
    const latest = await latestInForce(ctx, "the redrawn roles");
    const set = setOf(latest.version);
    if (sortedJson(set.roles ?? []) === sortedJson(FIRST_ROLES) && missingOwnStats(set).length === 0) return null;
    const { name, fromGameweek } = await addRoles(ctx, latest);
    return { name, fromGameweek, moved: await moveOffCutRoles(ctx, fromGameweek) };
  },
});

/** The site's versions and its latest, which must have taken effect: one waiting was made without
 *  `what`, and would drop them when it did. */
async function latestInForce(ctx: MutationCtx, what: string) {
  const history = await siteVersions(ctx);
  const version = history.at(-1);
  if (version !== undefined && version.takesEffectAt > Date.now()) {
    throw new Error(`version ${versionName(version)} waits to take effect and was made without ${what}, so they weren't added`);
  }
  return { history, version };
}

const missingOwnStats = (set: StoredScoringSet) => {
  const held = new Set((set.ownStats ?? []).map(({ stat }) => stat));
  return FIRST_ROLE_OWN_STATS.filter(({ stat }) => !held.has(stat));
};

/** The set as it stands with FIRST_ROLES as its roles, and the own stats they count, as a version
 *  taking effect now. */
async function addRoles(ctx: MutationCtx, { history, version }: { history: Doc<"siteScoring">[]; version: Doc<"siteScoring"> | undefined }) {
  const set = setOf(version);
  const scoring = { ...set, ownStats: [...(set.ownStats ?? []), ...missingOwnStats(set)], roles: [...FIRST_ROLES] };
  validateScoringSet(scoring);
  checkOwnStatsAgainstCatalogue(scoring.ownStats);
  return addVersion(ctx, history, { scoring, kind: "fix", takesEffectAt: Date.now() }, null);
}

/** Each lineup from `gameweek` on with a starter on a role no slot offers now, that starter moved to
 *  the role he'd get dropped into his slot on (stars/bestRole.ts): a row from `gameweek` or later
 *  changed in place, and the row in force before it copied to start at `gameweek`, so no gameweek
 *  begun changes. Returns how many starters moved. Reads every lineup in one mutation: run once, when
 *  the beta's one or two leagues hold a few hundred rows, far inside Convex's per-mutation read
 *  and write limits; a site with many leagues would need it in batches. */
async function moveOffCutRoles(ctx: MutationCtx, gameweek: number): Promise<number> {
  const rows = (await ctx.db.query("lineups").collect()).toSorted((one, other) => one.fromGameweek - other.fromGameweek);
  const reached = rows.filter((row, index) => row.fromGameweek >= gameweek || !rows.slice(index + 1).some((later) => sameTeam(later, row) && later.fromGameweek <= gameweek));
  let moved = 0;
  for (const row of reached.filter((each) => each.starters.some(onCutRole))) {
    const codes = row.starters.filter(onCutRole).map(({ playerCode }) => playerCode);
    const starters = movedStarters(row.starters, await heldPositionsOf(ctx, row.leagueId, codes), await starsOfPlayers(ctx, codes));
    moved += codes.length;
    if (row.fromGameweek >= gameweek) await ctx.db.patch("lineups", row._id, { starters });
    else {
      const { _id, _creationTime, ...copied } = row;
      await ctx.db.insert("lineups", { ...copied, fromGameweek: gameweek, starters });
    }
  }
  return moved;
}

const sameTeam = (one: Doc<"lineups">, other: Doc<"lineups">) => one.leagueId === other.leagueId && one.teamId === other.teamId;

const onCutRole = ({ role }: { role?: string }) => role !== undefined && !isRole(role);

/** The starters, each on a cut role dropped into his slot again in this formation. */
function movedStarters(
  starters: Doc<"lineups">["starters"],
  positions: PlayerPositions,
  stars: Awaited<ReturnType<typeof starsOfPlayers>>,
): Doc<"lineups">["starters"] {
  return starters.map((starter) =>
    onCutRole(starter) ? droppedStarter(starter.playerCode, starter, starters, stars.get(starter.playerCode) ?? [], positions.get(starter.playerCode) ?? []) : starter,
  );
}
