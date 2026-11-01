import Resend from "@auth/core/providers/resend";
import { convexAuth } from "@convex-dev/auth/server";
import { joinByInvites } from "./joining/invites";
import { sendSignInEmail } from "./signIn/signInEmail";
import { claimAsk } from "./signIn/signInLinks";
import { testAccount } from "./signIn/testAccount";
import { DAY_MS } from "./shared/time";

// Convex Auth (ARCHITECTURE.md, Libraries): emailed sign-in links, no passwords (spec/02). The
// sign-in page asks through signIn/signInLinks:ask, never `signIn` with an email; the browser redeems a
// link's code with `signIn`, and refreshes and ends its session with `signIn` and `signOut`.
// The one test account signs in with a secret instead, and no page offers it (signIn/testAccount.ts).

/** spec/02: a link works once and lasts an hour. */
export const LINK_LIFETIME_S = 60 * 60;
/** spec/02: signed in, a manager stays signed in on that device for 30 days. */
const SESSION_MS = 30 * DAY_MS;

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Resend({ maxAge: LINK_LIFETIME_S, sendVerificationRequest: sendSignInEmail }), testAccount],
  session: { totalDurationMs: SESSION_MS, inactiveDurationMs: SESSION_MS },
  callbacks: {
    // Runs inside the mutation that makes a link ("email"), before the link is saved and before
    // any earlier one is deleted, so a refusal here leaves nothing written (signInLinks.ts).
    async afterUserCreatedOrUpdated(ctx, { type, profile }) {
      if (type === "email") await claimAsk(ctx, profile.email ?? "");
      // Opening a link: the person joins every league whose invite to them is live (spec/13).
      if (type === "verification") await joinByInvites(ctx, profile.email ?? "");
    },
  },
});
