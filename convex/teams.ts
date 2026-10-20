import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, type QueryCtx } from "./_generated/server";
import { admitEmail } from "./allowedEmails";
import {
  callerEmail,
  isAdmin,
  namedEmail,
  recordEvent,
  refuse,
  refusals,
  runnerOf,
  teamsOf,
} from "./leagueAccess";
import { TEAM_NAME_MAX } from "./leagueLimits";

// A league's teams and their managers (#24, spec/13, Teams and Leaving). Each change files an
// event for Mail (#26). One manager runs one team; a team whose manager goes stays, vacated.

/** How a team's name is compared, so "Red Army" and "red army " are one name in a league. */
const nameKey = (name: string) => name.trim().toLowerCase();

/** The first "Team N" free in the league, from the new team's own number. */
function startingName(teams: Doc<"teams">[], number: number): string {
  const taken = new Set(teams.map((team) => nameKey(team.name)));
  let free = number;
  while (taken.has(nameKey(`Team ${free}`))) free += 1;
  return `Team ${free}`;
}

async function teamIn(ctx: QueryCtx, teamId: Id<"teams">, leagueId: Id<"leagues">): Promise<Doc<"teams">> {
  const team = await ctx.db.get("teams", teamId);
  if (team === null || team.leagueId !== leagueId) refuse(refusals.noTeam);
  return team;
}

/** Makes this email a manager in the league: of the vacated team `teamId`, or of a new team while
 *  the league is under its maximum (spec/13, Teams). The seam invites and join requests (#73)
 *  will call once approved; until then the league's runners call it with an email. */
export const addManager = mutation({
  args: { leagueId: v.id("leagues"), email: v.string(), teamId: v.optional(v.id("teams")) },
  returns: v.id("teams"),
  handler: async (ctx, args) => {
    const { email: by, league } = await runnerOf(ctx, args.leagueId);
    const email = namedEmail(args.email);
    const teams = await teamsOf(ctx, league._id);
    if (teams.some((team) => team.managerEmail === email)) refuse(refusals.alreadyManager(email));

    let teamId: Id<"teams">;
    let teamName: string;
    if (args.teamId !== undefined) {
      const vacated = await teamIn(ctx, args.teamId, league._id);
      if (vacated.managerEmail !== undefined) refuse(refusals.notVacated);
      await ctx.db.patch("teams", vacated._id, { managerEmail: email });
      ({ _id: teamId, name: teamName } = vacated);
    } else {
      if (teams.length >= league.maxTeams) refuse(refusals.full(league.maxTeams));
      const number = teams.length + 1;
      teamName = startingName(teams, number);
      teamId = await ctx.db.insert("teams", { leagueId: league._id, number, name: teamName, managerEmail: email });
    }
    await admitEmail(ctx, email);
    await recordEvent(ctx, league._id, by, { kind: "managerAdded", email, teamId, teamName });
    return teamId;
  },
});

/** spec/13, Leaving: the admin, the commissioner or the co-commissioner removes a team's manager.
 *  They lose the league at once; the team stays, keeps its name, and can be handed on. */
export const removeManager = mutation({
  args: { leagueId: v.id("leagues"), teamId: v.id("teams") },
  returns: v.null(),
  handler: async (ctx, { leagueId, teamId }) => {
    const { email: by } = await runnerOf(ctx, leagueId);
    const team = await teamIn(ctx, teamId, leagueId);
    if (team.managerEmail === undefined) refuse(refusals.noManager);
    await ctx.db.patch("teams", teamId, { managerEmail: undefined });
    await recordEvent(ctx, leagueId, by, { kind: "managerRemoved", email: team.managerEmail, teamId });
    return null;
  },
});

/** spec/13, Leaving: a manager leaves, which works like a removal. */
export const leave = mutation({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { leagueId }) => {
    const email = await callerEmail(ctx);
    const team = (await teamsOf(ctx, leagueId)).find((each) => each.managerEmail === email);
    if (!team) refuse(refusals.runsNoTeam);
    await ctx.db.patch("teams", team._id, { managerEmail: undefined });
    await recordEvent(ctx, leagueId, email, { kind: "managerLeft", email, teamId: team._id });
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
