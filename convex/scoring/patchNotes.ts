import { v, type Infer } from "convex/values";
import { mutation, query } from "../_generated/server";
import { siteScoringKind } from "../schema";
import { callerEmail, refuse, signedInEmail } from "../shared/leagueAccess";
import { FIRST_SCORING } from "./firstScoring";
import { scoringChanges } from "./patchChanges";
import { historyOf, versionName } from "./siteScoring";

// The patch notes and the banner (spec/14, Changes and corrections; #356): a page listing every
// version of the site's scoring with what it changed, worked out from the stored versions
// (patchChanges.ts); and, from a patch's announcement until it takes effect, a banner, which each
// manager can dismiss. The letter announcing each version is filed as it is made (siteScoring.ts).

/** Why a banner change was refused, as the person who asked is told it. */
export const patchBannerRefusals = { noPatch: "That patch doesn't exist." };

const versionNotes = v.object({
  name: v.string(),
  kind: siteScoringKind,
  announcedAt: v.number(),
  takesEffectAt: v.number(),
  changes: v.array(v.string()),
});
export type VersionNotes = Infer<typeof versionNotes>;

/** Every version of the site's scoring, newest first, each with what it changed from the one
 *  before it (the first set, for the first). None when signed out. */
export const notes = query({
  args: {},
  returns: v.array(versionNotes),
  handler: async (ctx) => {
    if ((await signedInEmail(ctx)) === null) return [];
    const history = await historyOf(ctx);
    return history
      .map((row, index) => ({
        name: versionName(row),
        kind: row.kind,
        announcedAt: row.announcedAt,
        takesEffectAt: row.takesEffectAt,
        changes: scoringChanges(history[index - 1]?.scoring ?? FIRST_SCORING, row.scoring),
      }))
      .reverse();
  },
});

const waitingPatch = v.object({ versionId: v.id("siteScoring"), name: v.string(), takesEffectAt: v.number() });
export type WaitingPatch = Infer<typeof waitingPatch>;

/** The banner the signed-in person sees at `now`: the soonest patch announced and not yet in
 *  effect that they haven't dismissed; null when there is none, or signed out. `now` is the
 *  screen's, moved on each minute, as a query must not read the clock (convex/admin/feeds.ts says
 *  why). */
export const banner = query({
  args: { now: v.number() },
  returns: v.union(v.null(), waitingPatch),
  handler: async (ctx, { now }) => {
    const email = await signedInEmail(ctx);
    if (email === null) return null;
    for (const row of await historyOf(ctx)) {
      if (row.takesEffectAt <= now) continue;
      const dismissed = await ctx.db
        .query("patchBannerDismissals")
        .withIndex("by_email_and_versionId", (q) => q.eq("email", email).eq("versionId", row._id))
        .unique();
      if (dismissed === null) return { versionId: row._id, name: versionName(row), takesEffectAt: row.takesEffectAt };
    }
    return null;
  },
});

/** The signed-in person dismisses a patch's banner, once: everywhere they sign in. One dismissed in
 *  the minute it took effect, its banner gone anyway, is no harm. Refused for a version that
 *  doesn't exist. */
export const dismissBanner = mutation({
  args: { versionId: v.id("siteScoring") },
  returns: v.null(),
  handler: async (ctx, { versionId }) => {
    const email = await callerEmail(ctx);
    if ((await ctx.db.get("siteScoring", versionId)) === null) refuse(patchBannerRefusals.noPatch);
    const held = await ctx.db
      .query("patchBannerDismissals")
      .withIndex("by_email_and_versionId", (q) => q.eq("email", email).eq("versionId", versionId))
      .unique();
    if (held === null) await ctx.db.insert("patchBannerDismissals", { email, versionId });
    return null;
  },
});
