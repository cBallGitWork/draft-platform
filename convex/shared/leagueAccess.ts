import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { adminEmail, isEmailAddress, normaliseEmail } from "../signIn/allowedEmails";
import { FEWEST_TEAMS, MOST_TEAMS, TEAM_NAME_MAX } from "../leagues/leagueLimits";

// Who may do what in a league (spec/13, Who runs it), checked on the server for every change.
// The admin may do anything anywhere; the commissioner runs one league; the co-commissioner has
// every commissioner power except naming or removing either of them, and deleting the league.
// It also holds the refusals' shared words and the reads of a league's teams.

/** Why a change was refused, as the person who asked is told it. */
export const refusals = {
  signedOut: "Sign in first.",
  noLeague: "That league doesn't exist.",
  noTeam: "That team isn't in this league.",
  notAdmin: "Only the admin can do that.",
  notRunner: "Only the league's commissioner, its co-commissioner or the admin can do that.",
  notNamer: "Only the league's commissioner or the admin can name or remove a commissioner or co-commissioner.",
  notDeleter: "Only the league's commissioner or the admin can delete it.",
  beingDeleted: "This league is being deleted, so nothing in it can change unless that is undone.",
  notBeingDeleted: "This league isn't being deleted.",
  notUndoer: "Only the league's commissioner or the admin can undo it.",
  tooLateToUndo: "It's too late to undo: the league is being deleted for good.",
  notManager: "Only the team's manager or the admin can do that.",
  runsNoTeam: "You don't run a team in this league.",
  notInLeague: "You aren't in this league.",
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
  if (!isEmailAddress(email)) refuse(refusals.notEmail(typed));
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

/** The league, or a refusal if it doesn't exist or is being deleted: a league being deleted is
 *  frozen, so every change to it starts here (spec/13, Deleting). */
export async function getLeague(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Doc<"leagues">> {
  const league = (await ctx.db.get("leagues", leagueId)) ?? refuse(refusals.noLeague);
  if (league.deletion) refuse(refusals.beingDeleted);
  return league;
}

/** Whether this (normalised) email is the admin's. */
export const isAdmin = (email: string) => email === adminEmail();

/** What this email may do in this league. */
function powersIn(league: Doc<"leagues">, email: string) {
  const admin = isAdmin(email);
  const isCommissioner = email === league.commissionerEmail;
  return {
    /** Names and removes the commissioner and co-commissioner, and deletes the league. */
    names: admin || isCommissioner,
    /** Every other commissioner power. */
    runs: admin || isCommissioner || email === league.coCommissionerEmail,
  };
}

/** A person's parts in a league: a role in it, which the admin's override alone isn't. */
export const leagueRole = v.union(v.literal("commissioner"), v.literal("co-commissioner"), v.literal("manager"));
export type LeagueRole = Infer<typeof leagueRole>;

/** This email's parts in the league, given the team it manages there, if any. */
export function rolesIn(league: Doc<"leagues">, email: string, team: Doc<"teams"> | undefined): LeagueRole[] {
  const roles: LeagueRole[] = [];
  if (email === league.commissionerEmail) roles.push("commissioner");
  if (email === league.coCommissionerEmail) roles.push("co-commissioner");
  if (team) roles.push("manager");
  return roles;
}

/** Whether this email is the league's commissioner or the admin: who still sees a league being
 *  deleted and may undo it, whichever of them deleted it (spec/13, Deleting). The co-commissioner
 *  and the managers don't. */
export function seesWhileDeleted(league: Doc<"leagues">, email: string): boolean {
  return email === league.commissionerEmail || isAdmin(email);
}

/** The caller, if the caller is the admin (spec/15, The admin). */
export async function adminOf(ctx: QueryCtx): Promise<string> {
  const email = await callerEmail(ctx);
  if (!isAdmin(email)) refuse(refusals.notAdmin);
  return email;
}

/** The caller and the league, if the caller holds `power` in it; otherwise `refusal`. */
async function callerWith(ctx: QueryCtx, leagueId: Id<"leagues">, power: "runs" | "names", refusal: string) {
  const email = await callerEmail(ctx);
  const league = await getLeague(ctx, leagueId);
  if (!powersIn(league, email)[power]) refuse(refusal);
  return { email, league };
}

/** The caller and the league, if the caller may run it. */
export function runnerOf(ctx: QueryCtx, leagueId: Id<"leagues">) {
  return callerWith(ctx, leagueId, "runs", refusals.notRunner);
}

/** The caller and the league, if the caller may name its commissioner and co-commissioner. */
export function namerOf(ctx: QueryCtx, leagueId: Id<"leagues">) {
  return callerWith(ctx, leagueId, "names", refusals.notNamer);
}

/** The caller and the league, if the caller runs it or a team in it. */
export async function memberOf(ctx: QueryCtx, leagueId: Id<"leagues">) {
  const email = await callerEmail(ctx);
  const league = await getLeague(ctx, leagueId);
  if (!powersIn(league, email).runs && !(await teamOf(ctx, leagueId, email))) refuse(refusals.notInLeague);
  return { email, league };
}

/** The caller and the league, if the caller may delete it (spec/13, Deleting). */
export function deleterOf(ctx: QueryCtx, leagueId: Id<"leagues">) {
  return callerWith(ctx, leagueId, "names", refusals.notDeleter);
}

/** Every team in the league, in the order they were made. A league never holds more than
 *  MOST_TEAMS, so this reads them all. */
export function teamsOf(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Doc<"teams">[]> {
  return ctx.db
    .query("teams")
    .withIndex("by_leagueId_and_number", (q) => q.eq("leagueId", leagueId))
    .take(MOST_TEAMS);
}

/** The team, if it is in the league; otherwise a refusal. */
export async function teamIn(ctx: QueryCtx, leagueId: Id<"leagues">, teamId: Id<"teams">): Promise<Doc<"teams">> {
  const team = await ctx.db.get("teams", teamId);
  if (team === null || team.leagueId !== leagueId) refuse(refusals.noTeam);
  return team;
}

/** The team this email manages in the league, if any: one at most, as putOnTeam keeps it (teams.ts). */
export async function teamOf(ctx: QueryCtx, leagueId: Id<"leagues">, email: string): Promise<Doc<"teams"> | undefined> {
  return (await teamsOf(ctx, leagueId)).find((team) => team.managerEmail === email);
}
