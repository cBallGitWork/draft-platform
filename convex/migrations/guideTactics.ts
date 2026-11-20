import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { sectionsOf } from "../guide/guide";

// The one-off for #2775 (spec/23 S23.7, S23.16): the Guide's Tactics section, which lists an entry
// per formation and classic side. A section titled Tactics the admin already added becomes it;
// otherwise Tactics is added at the foot of the list. Running it again does nothing. Run it once on
// each deployment:
//   npx convex run migrations/guideTactics:addTactics
//   npx convex run --prod migrations/guideTactics:addTactics

const TACTICS = "Tactics";

/** Makes Tactics the section holding the formation entries; returns what it did. */
export const addTactics = internalMutation({
  args: {},
  returns: v.union(v.literal("held already"), v.literal("flagged"), v.literal("added")),
  handler: async (ctx) => {
    const sections = await sectionsOf(ctx);
    if (sections.some((section) => section.holdsFormations)) return "held already";
    const named = sections.find((section) => section.title === TACTICS);
    if (named !== undefined) {
      await ctx.db.patch("guideSections", named._id, { holdsFormations: true });
      return "flagged";
    }
    await ctx.db.insert("guideSections", { title: TACTICS, order: sections.length, holdsFormations: true });
    return "added";
  },
});
