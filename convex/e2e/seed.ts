import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import { sendInvite } from "../joining/invites";
import { createLeague } from "../leagues/leagues";
import { getLeague } from "../shared/leagueAccess";
import { adminEmail } from "../signIn/allowedEmails";
import { refuseUnlessE2E } from "./e2eGate";

// An e2e test's starting league (spec/20, S20.17; #2288): the admin, a commissioner and four
// managers, made through the app's own functions as people would, never raw rows. The admin makes
// the league naming the commissioner, the commissioner invites each manager, and each takes the
// invite up as signing in does. Every call makes a league and people of its own, so tests never
// share one. A test signs each in through the fake world's caught emails (scripts/fake-world.mjs).

/** The managers a seeded league has, one team each, and so its maximum of teams. */
export const SEEDED_MANAGERS = 4;
/** The seeded people's emails' domain: example.com's, which never receives mail. */
const SEEDED_DOMAIN = "e2e.example.com";

/** Makes the league, the commissioner and the managers, each on a team of their own, and says who
 *  they are. The admin is the deployment's own (ADMIN_EMAIL). */
export const seed = internalMutation({
  args: {},
  returns: v.object({
    leagueId: v.id("leagues"),
    leagueName: v.string(),
    admin: v.string(),
    commissioner: v.string(),
    managers: v.array(v.string()),
  }),
  handler: async (ctx) => {
    refuseUnlessE2E();
    const tag = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const admin = adminEmail();
    const commissioner = `commissioner-${tag}@${SEEDED_DOMAIN}`;
    const managers = Array.from({ length: SEEDED_MANAGERS }, (_, i) => `manager${i + 1}-${tag}@${SEEDED_DOMAIN}`);
    const leagueName = `E2E ${tag}`;

    const leagueId = await createLeague(ctx, admin, { name: leagueName, maxTeams: SEEDED_MANAGERS, commissionerEmail: commissioner });
    for (const email of managers) {
      const inviteId = await sendInvite(ctx, commissioner, await getLeague(ctx, leagueId), { email });
      await ctx.runMutation(internal.joining.invites.takeUp, { inviteId, email });
      const invite = await ctx.db.get("invites", inviteId);
      if (invite?.joined === undefined) throw new Error(`${email} couldn't take up the seed's invite: ${invite?.couldNotJoin ?? "it is gone"}`);
    }
    return { leagueId, leagueName, admin, commissioner, managers };
  },
});
