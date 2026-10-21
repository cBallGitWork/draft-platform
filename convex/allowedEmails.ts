import { v } from "convex/values";
import { internalMutation, type MutationCtx, type QueryCtx } from "./_generated/server";

// Who may get a sign-in link in the closed beta (spec/02, spec/13#joining): the admin, and the
// emails on the allowed list. The admin puts an email on it from the CLI:
//   npx convex run allowedEmails:add '{"email":"someone@example.com"}'

/** How every email is stored and compared, so "Craig@X.com " and "craig@x.com" are one. */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** The admin's email, set on the server (spec/13#who-runs-it), never in the code. */
export function adminEmail(): string {
  const email = process.env.ADMIN_EMAIL;
  if (!email) throw new Error("ADMIN_EMAIL isn't set on this deployment: it names the admin (spec/13, Who runs it)");
  return normaliseEmail(email);
}

/** Whether a sign-in link may go to this (normalised) email. */
export async function isAllowed(ctx: QueryCtx, email: string): Promise<boolean> {
  if (email === adminEmail()) return true;
  const row = await ctx.db
    .query("allowedEmails")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();
  return row !== null;
}

/** Puts an email on the allowed list: the admin's `add`, an invite (#73), and the invite link,
 *  which lets anyone who opens it sign in to ask to join (spec/02). */
export async function admitEmail(ctx: MutationCtx, email: string): Promise<"added" | "already on the list"> {
  const normalised = normaliseEmail(email);
  if (!normalised.includes("@")) throw new Error(`"${email}" isn't an email address`);
  if (await isAllowed(ctx, normalised)) return "already on the list";
  await ctx.db.insert("allowedEmails", { email: normalised });
  return "added";
}

export const add = internalMutation({
  args: { email: v.string() },
  returns: v.union(v.literal("added"), v.literal("already on the list")),
  handler: (ctx, { email }) => admitEmail(ctx, email),
});
