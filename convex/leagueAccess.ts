import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, type Infer } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { adminEmail, normaliseEmail } from "./allowedEmails";
import { FEWEST_TEAMS, MOST_TEAMS, TEAM_NAME_MAX } from "./leagueLimits";
import type { leagueEvent } from "./schema";

// Who may do what in a league (spec/13, Who runs it), checked on the server for every change.
// The admin may do anything anywhere; the commissioner runs one league; the co-commissioner has
// every commissioner power except naming or removing either of them, and deleting the league.

/** Why a change was refused, as the person who asked is told it. */
export const refusals = {
  signedOut: "Sign in first.",
  noLeague: "That league doesn't exist.",
  noTeam: "That team isn't in this league.",
  notAdmin: "Only the admin can do that.",
  notRunner: "Only the league's commissioner, its co-commissioner or the admin can do that.",
  notNamer: "Only the league's commissioner or the admin can name or remove a commissioner or co-commissioner.",
  notManager: "Only the team's manager or the admin can do that.",
  runsNoTeam: "You don't run a team in this league.",
  blankName: "Give it a name.",
  teamNameTooLong: `A team's name is up to ${TEAM_NAME_MAX} characters.`,
  teamNameTaken: (name: string) => `A team in this league is already called "${name}".`,
  maxOutOfRange: `A league holds ${FEWEST_TEAMS} to ${MOST_TEAMS} teams.`,
  belowTeams: (teams: number) => `The league already has ${teams} teams: the maximum can't go below that.`,
  full: (maxTeams: number) => `The league is full: it has all ${maxTeams} of its teams.`,
  notVacated: "That team already has a manager.",
  noManager: "That team has no manager.",
  notEmail: (typed: string) => `"${typed}" isn't an email address.`,
  alreadyManager: (email: string) => `${email} already runs a team in this league.`,
  alreadyCommissioner: (email: string) => `${email} is already this league's commissioner.`,
  alreadyCoCommissioner: (email: string) => `${email} is the co-commissioner: remove them as co-commissioner first.`,
} as const;

export function refuse(reason: string): never {
  throw new ConvexError(reason);
}

/** A typed email, as every email is stored (`normaliseEmail`), or a refusal. */
export function namedEmail(typed: string): string {
  const email = normaliseEmail(typed);
  if (!email.includes("@")) refuse(refusals.notEmail(typed));
  return email;
}

/** The signed-in person's email, or null when signed out. */
export async function signedInEmail(ctx: QueryCtx): Promise<string | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  const user = await ctx.db.get("users", userId);
  // A session outlives its user only if the user row was deleted by hand.
  if (user === null) return null;
  if (user.email === undefined) throw new Error(`User ${userId} signed in without an email`);
  return user.email;
}

/** The signed-in person's email, or a refusal. */
export async function callerEmail(ctx: QueryCtx): Promise<string> {
  return (await signedInEmail(ctx)) ?? refuse(refusals.signedOut);
}

async function getLeague(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Doc<"leagues">> {
  return (await ctx.db.get("leagues", leagueId)) ?? refuse(refusals.noLeague);
}

/** Whether this (normalised) email is the admin's. */
export const isAdmin = (email: string) => email === adminEmail();

/** What this email may do in this league. */
function powersIn(league: Doc<"leagues">, email: string) {
  const admin = isAdmin(email);
  const isCommissioner = email === league.commissionerEmail;
  return {
    /** Names and removes the commissioner and co-commissioner (and, in #75, deletes the league). */
    names: admin || isCommissioner,
    /** Every other commissioner power. */
    runs: admin || isCommissioner || email === league.coCommissionerEmail,
  };
}

/** The caller and the league, if the caller may run it. */
export async function runnerOf(ctx: QueryCtx, leagueId: Id<"leagues">) {
  const email = await callerEmail(ctx);
  const league = await getLeague(ctx, leagueId);
  if (!powersIn(league, email).runs) refuse(refusals.notRunner);
  return { email, league };
}

/** The caller and the league, if the caller may name its commissioner and co-commissioner. */
export async function namerOf(ctx: QueryCtx, leagueId: Id<"leagues">) {
  const email = await callerEmail(ctx);
  const league = await getLeague(ctx, leagueId);
  if (!powersIn(league, email).names) refuse(refusals.notNamer);
  return { email, league };
}

/** Every team in the league, in the order they were made. A league never holds more than
 *  MOST_TEAMS, so this reads them all. */
export function teamsOf(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Doc<"teams">[]> {
  return ctx.db
    .query("teams")
    .withIndex("by_leagueId_and_number", (q) => q.eq("leagueId", leagueId))
    .take(MOST_TEAMS);
}

/** Files what happened, for Mail (#26) to turn into a letter. */
export async function recordEvent(
  ctx: MutationCtx,
  leagueId: Id<"leagues">,
  by: string,
  event: Infer<typeof leagueEvent>,
): Promise<void> {
  await ctx.db.insert("leagueEvents", { leagueId, at: Date.now(), by, event });
}
