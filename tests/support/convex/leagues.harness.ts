// Leagues' tests' shared setup (#24): sign-in's deployment, people signed in by email, and a
// league made by the admin.

import { vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ADMIN } from "./signIn.harness";
import type { TestConvex } from "./test.harness";

export { ADMIN };
export type { TestConvex };

export const COMMISSIONER = "commish@example.com";
export const CO_COMMISSIONER = "co@example.com";
export const MANAGERS = ["ann@example.com", "bob@example.com", "cat@example.com", "dan@example.com", "eve@example.com"];
/** Someone signed in who has no part in any league. */
export const OUTSIDER = "outsider@example.com";

/** The name adminCreatesLeague gives a league unless told another. */
export const LEAGUE_NAME = "Tim Hortons Pro League";

/** `email` signed in, with a verified account made for it if it has none, as opening a sign-in
 *  link makes. */
export async function actingAs(t: TestConvex, email: string) {
  const userId = await t.run(async (ctx) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();
    return user?._id ?? ctx.db.insert("users", { email, emailVerificationTime: Date.now() });
  });
  // Convex Auth's token names the user and the session, as `getAuthUserId` reads it.
  return t.withIdentity({ subject: `${userId}|session` });
}

/** What the team `teamId` is called now. */
export const teamName = (t: TestConvex, teamId: Id<"teams">) => t.run(async (ctx) => (await ctx.db.get("teams", teamId))!.name);

/** How many teams a league `adminCreatesLeague` makes may hold, unless a test says. */
export const TEST_LEAGUE_TEAMS = 4;

/** The admin makes a league of `maxTeams` run by COMMISSIONER, and its scheduled link is sent.
 *  Only what is due now runs, and the clock stays put: a held season has an alarm pending for its
 *  next deadline (deadlineRecorder.ts), which running every timer would fire. */
export async function adminCreatesLeague(t: TestConvex, maxTeams = TEST_LEAGUE_TEAMS, name = LEAGUE_NAME): Promise<Id<"leagues">> {
  const admin = await actingAs(t, ADMIN);
  const leagueId = await admin.mutation(api.leagues.leagues.create, { name, maxTeams, commissionerEmail: COMMISSIONER });
  await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0));
  return leagueId;
}

/** The admin makes `email` the manager of the vacated team `teamId`, or of a new team: its id. */
export async function addManager(t: TestConvex, leagueId: Id<"leagues">, email: string, teamId?: Id<"teams">): Promise<Id<"teams">> {
  return (await actingAs(t, ADMIN)).mutation(api.leagues.teams.addManager, { leagueId, email, teamId });
}

/** The admin adds each email as a manager: their new teams' ids, in order. */
export async function addManagers(t: TestConvex, leagueId: Id<"leagues">, emails: string[]): Promise<Id<"teams">[]> {
  const teamIds = [];
  for (const email of emails) teamIds.push(await addManager(t, leagueId, email));
  return teamIds;
}

export function teamsIn(t: TestConvex, leagueId: Id<"leagues">) {
  return t.run((ctx) =>
    ctx.db
      .query("teams")
      .withIndex("by_leagueId_and_number", (q) => q.eq("leagueId", leagueId))
      .collect(),
  );
}

/** What the league's events say happened, oldest first, for Mail (#26). */
export async function eventsIn(t: TestConvex, leagueId: Id<"leagues">) {
  const rows = await t.run((ctx) =>
    ctx.db
      .query("leagueEvents")
      .withIndex("by_leagueId_and_at", (q) => q.eq("leagueId", leagueId))
      .collect(),
  );
  return rows.map(({ by, event }) => ({ by, ...event }));
}

/** When the league's last event was filed: the time a refusal naming that event gives. */
export const lastEventAt = (t: TestConvex, leagueId: Id<"leagues">) =>
  t.run(async (ctx) => (await ctx.db.query("leagueEvents").withIndex("by_leagueId_and_at", (q) => q.eq("leagueId", leagueId)).order("desc").first())!.at);

/** Whether a sign-in link may go to this email: whether it is on the allowed list. */
export const onTheList = (t: TestConvex, email: string) =>
  t.run(async (ctx) =>
    (await ctx.db
      .query("allowedEmails")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique()) !== null,
  );

export const leagueRow = (t: TestConvex, leagueId: Id<"leagues">) => t.run((ctx) => ctx.db.get("leagues", leagueId));
