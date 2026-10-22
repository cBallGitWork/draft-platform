import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, type MutationCtx } from "../_generated/server";
import { admitEmail } from "../signIn/allowedEmails";
import {
  adminOf,
  callerEmail,
  getLeague,
  isAdmin,
  namedEmail,
  refuse,
  refusals,
  runnerOf,
  teamIn,
  teamOf,
  teamsOf,
} from "../shared/leagueAccess";
import { recordEvent } from "../mail/letters";
import { TEAM_NAME_MAX } from "./leagueLimits";
import { cancelLiveInvites } from "../joining/liveInvites";

// A league's teams and their managers (#24, spec/13, Teams and Leaving). Each change files an
// event for Mail (#26). One manager runs one team; a team whose manager goes stays, vacated.

/** How a team's name is compared, so "Red Army" and "red army " are one name in a league. */
const nameKey = (name: string) => name.trim().toLowerCase();

/** A new team's name until its manager renames it: "Team 3". */
const teamNumbered = (number: number) => `Team ${number}`;

/** The first "Team N" free in the league, from the new team's own number. */
function startingName(teams: Doc<"teams">[], number: number): string {
  const taken = new Set(teams.map((team) => nameKey(team.name)));
  let free = number;
  while (taken.has(nameKey(teamNumbered(free)))) free += 1;
  return teamNumbered(free);
}

/** Whether this email may join the league (spec/13, Teams), given its `teams`: the vacated team
 *  `vacatedTeamId` it would take, or null for a new team; otherwise a refusal. putOnTeam and an
 *  invite (invites.ts) both check here, so they refuse alike. */
export function checkCanJoin(
  teams: Doc<"teams">[],
  league: Doc<"leagues">,
  email: string,
  vacatedTeamId: Id<"teams"> | undefined,
): Doc<"teams"> | null {
  if (teams.some((team) => team.managerEmail === email)) refuse(refusals.alreadyManager(email));
  if (vacatedTeamId !== undefined) {
    const vacated = teams.find((team) => team._id === vacatedTeamId) ?? refuse(refusals.noTeam);
    if (vacated.managerEmail !== undefined) refuse(refusals.notVacated);
    return vacated;
  }
  if (teams.length >= league.maxTeams) refuse(refusals.full(league.maxTeams));
  return null;
}

/** Makes this email a manager in the league: of the vacated team `vacatedTeamId`, or of a new
 *  team while the league is under its maximum (spec/13, Teams), and lets them sign in. Every
 *  refusal comes before anything is written, so a caller may catch one: invites (#73) do. */
export async function putOnTeam(
  ctx: MutationCtx,
  league: Doc<"leagues">,
  email: string,
  vacatedTeamId: Id<"teams"> | undefined,
): Promise<{ teamId: Id<"teams">; teamName: string }> {
  const teams = await teamsOf(ctx, league._id);
  const vacated = checkCanJoin(teams, league, email, vacatedTeamId);

  let teamId: Id<"teams">;
  let teamName: string;
  if (vacated !== null) {
    await ctx.db.patch("teams", vacated._id, { managerEmail: email });
    ({ _id: teamId, name: teamName } = vacated);
  } else {
    const number = teams.length + 1;
    teamName = startingName(teams, number);
    teamId = await ctx.db.insert("teams", { leagueId: league._id, number, name: teamName, managerEmail: email });
  }
  await admitEmail(ctx, email);
  return { teamId, teamName };
}

/** spec/13, Teams: the admin names a team's manager directly, from the CLI (docs/setup.md); the
 *  league's runners invite people instead: "admin only (not commissioner or co-commissioner)"
 *  (Craig, 22 Oct 2026). */
export const addManager = mutation({
  args: { leagueId: v.id("leagues"), email: v.string(), teamId: v.optional(v.id("teams")) },
  returns: v.id("teams"),
  handler: async (ctx, args) => {
    const by = await adminOf(ctx);
    const league = await getLeague(ctx, args.leagueId);
    const email = namedEmail(args.email);
    const { teamId, teamName } = await putOnTeam(ctx, league, email, args.teamId);
    await recordEvent(ctx, league._id, by, { kind: "managerAdded", email, teamId, teamName });
    return teamId;
  },
});

/** spec/13, Leaving: the admin, the commissioner or the co-commissioner removes a team's manager.
 *  They lose the league at once, and any live invite of theirs to it is cancelled (#133); the team
 *  stays, keeps its name, and can be handed on. */
export const removeManager = mutation({
  args: { leagueId: v.id("leagues"), teamId: v.id("teams") },
  returns: v.null(),
  handler: async (ctx, { leagueId, teamId }) => {
    const { email: by } = await runnerOf(ctx, leagueId);
    const team = await teamIn(ctx, leagueId, teamId);
    if (team.managerEmail === undefined) refuse(refusals.noManager);
    await ctx.db.patch("teams", teamId, { managerEmail: undefined });
    await cancelLiveInvites(ctx, leagueId, team.managerEmail);
    await recordEvent(ctx, leagueId, by, { kind: "managerRemoved", email: team.managerEmail, teamId, teamName: team.name });
    return null;
  },
});

/** spec/13, Leaving: a manager leaves, which works like a removal, their live invites included. */
export const leave = mutation({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { leagueId }) => {
    const email = await callerEmail(ctx);
    await getLeague(ctx, leagueId);
    const team = await teamOf(ctx, leagueId, email);
    if (!team) refuse(refusals.runsNoTeam);
    await ctx.db.patch("teams", team._id, { managerEmail: undefined });
    await cancelLiveInvites(ctx, leagueId, email);
    await recordEvent(ctx, leagueId, email, { kind: "managerLeft", email, teamId: team._id, teamName: team.name });
    return null;
  },
});

/** spec/13, Teams: a team's manager (or the admin) renames it, unique in the league and up to
 *  TEAM_NAME_MAX characters. */
export const rename = mutation({
  args: { teamId: v.id("teams"), name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const by = await callerEmail(ctx);
    const team = (await ctx.db.get("teams", args.teamId)) ?? refuse(refusals.noTeam);
    if (by !== team.managerEmail && !isAdmin(by)) refuse(refusals.notManager);
    await getLeague(ctx, team.leagueId);
    const name = args.name.trim();
    if (!name) refuse(refusals.blankName);
    if ([...name].length > TEAM_NAME_MAX) refuse(refusals.teamNameTooLong);
    if (name === team.name) return null;
    const teams = await teamsOf(ctx, team.leagueId);
    if (teams.some((other) => other._id !== team._id && nameKey(other.name) === nameKey(name))) {
      refuse(refusals.teamNameTaken(name));
    }
    await ctx.db.patch("teams", team._id, { name });
    await recordEvent(ctx, team.leagueId, by, { kind: "teamRenamed", teamId: team._id, from: team.name, to: name });
    return null;
  },
});
