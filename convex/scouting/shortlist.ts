import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { MOST_TEAMS } from "../leagues/leagueLimits";
import { bylineOf, fileLetter } from "../mail/letters";
import { shortlistedReleasedLetter } from "../mail/letterWords";
import { clubRecord } from "../schema";
import { takeAllOrThrow } from "../shared/cappedRead";
import { memberOf, refuse, refusals, teamsOf } from "../shared/leagueAccess";
import { clubByCode, clubOf, heldPlayerByCode, playerByCode } from "../shared/players";
import { ownerOf } from "../squads/squadPlace";

// The shortlist (spec/19, The shortlist; #374): a manager's own list of players for the season, in
// Scouting. It is the team's, and private to it: only its manager reads or changes it, so no other
// team, nor the commissioner, can tell who is on it. When a shortlisted player is released, Mail
// tells each manager whose shortlist holds him (spec/16). Not built yet: the letter when one clears
// waivers (waivers aren't built, spec/08) and feeding the draft queue (the draft room, spec/04).

/** The most players one shortlist holds: room to follow a fifth of the Premier League. A bound for
 *  reading it, as MOST_IN_SQUAD is a squad's. Claude's choice, not yet Craig's. */
export const SHORTLIST_MOST = 100;

export const shortlistRefusals = {
  playerGone: (name: string) => `${name} has left the Premier League, so he can't be shortlisted.`,
  full: `A shortlist holds at most ${SHORTLIST_MOST} players. Take one off first.`,
};

const shortlistedPlayer = v.object({
  code: v.number(),
  name: v.string(),
  fullName: v.string(),
  club: clubRecord,
  /** The team in this league that owns him, or null for a free agent. */
  ownerTeamName: v.union(v.string(), v.null()),
  /** The feed no longer sends him: he has left the Premier League since he was shortlisted. */
  gone: v.boolean(),
});
export type ShortlistedPlayer = Infer<typeof shortlistedPlayer>;

/** The caller's team in the league, or the refusal that they run none. Unlike `managerOf`, a
 *  stranger is told they aren't in the league (memberOf), and only a member who runs no team (its
 *  commissioner, say) is told they run none: the refusals the shortlist has always given. */
async function ownTeam(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Doc<"teams">> {
  return (await memberOf(ctx, leagueId)).team ?? refuse(refusals.runsNoTeam);
}

function shortlistOf(ctx: QueryCtx, teamId: Id<"teams">) {
  return takeAllOrThrow(
    ctx.db.query("shortlistPlayers").withIndex("by_teamId_and_playerCode", (q) => q.eq("teamId", teamId)),
    SHORTLIST_MOST,
    `More than ${SHORTLIST_MOST} players are on team ${teamId}'s shortlist, so it would be cut short`,
  );
}

function entryOf(ctx: QueryCtx, teamId: Id<"teams">, playerCode: number) {
  return ctx.db
    .query("shortlistPlayers")
    .withIndex("by_teamId_and_playerCode", (q) => q.eq("teamId", teamId).eq("playerCode", playerCode))
    .unique();
}

/** The caller's shortlist in the league, by name, or null for someone in it who runs no team (a
 *  commissioner or the admin only), who has none. */
export const mine = query({
  args: { leagueId: v.id("leagues") },
  returns: v.union(v.array(shortlistedPlayer), v.null()),
  handler: async (ctx, { leagueId }) => {
    const { team } = await memberOf(ctx, leagueId);
    if (!team) return null;
    const owner = await ownerOf(ctx, leagueId);
    const players = await Promise.all(
      (await shortlistOf(ctx, team._id)).map(async ({ playerCode }) => {
        // Players are never deleted (shared/players.ts), and only a held one is ever shortlisted.
        const player = await heldPlayerByCode(ctx, playerCode, `Shortlisted player ${playerCode} isn't held`);
        const club = await clubByCode(ctx, player.clubCode);
        return {
          code: player.code,
          name: player.name,
          fullName: player.fullName,
          club: clubOf(club),
          ownerTeamName: (await owner(playerCode))?.name ?? null,
          gone: player.droppedAt !== undefined,
        };
      }),
    );
    return players.sort((one, other) => one.name.localeCompare(other.name));
  },
});

const playerInLeague = { leagueId: v.id("leagues"), playerCode: v.number() };

/** Puts a player on the caller's own shortlist; one already on it stays, once. Any player still in
 *  the Premier League, whoever owns him. */
export const add = mutation({
  args: playerInLeague,
  returns: v.null(),
  handler: async (ctx, { leagueId, playerCode }) => {
    const team = await ownTeam(ctx, leagueId);
    const player = (await playerByCode(ctx, playerCode)) ?? refuse(refusals.noPlayer);
    if (player.droppedAt !== undefined) refuse(shortlistRefusals.playerGone(player.name));
    if ((await entryOf(ctx, team._id, playerCode)) !== null) return null;
    if ((await shortlistOf(ctx, team._id)).length >= SHORTLIST_MOST) refuse(shortlistRefusals.full);
    await ctx.db.insert("shortlistPlayers", { leagueId, teamId: team._id, playerCode });
    return null;
  },
});

/** Takes a player off the caller's own shortlist; one not on it is already off. */
export const remove = mutation({
  args: playerInLeague,
  returns: v.null(),
  handler: async (ctx, { leagueId, playerCode }) => {
    const team = await ownTeam(ctx, leagueId);
    const entry = await entryOf(ctx, team._id, playerCode);
    if (entry !== null) await ctx.db.delete("shortlistPlayers", entry._id);
    return null;
  },
});

/** Files the letter that `player` was released from `from` by `by` to each manager whose shortlist
 *  holds him; a team with no manager has no one to tell. */
export async function tellShortlisters(
  ctx: MutationCtx,
  league: Doc<"leagues">,
  player: Doc<"players">,
  from: Doc<"teams">,
  by: string,
): Promise<void> {
  const entries = await takeAllOrThrow(
    ctx.db.query("shortlistPlayers").withIndex("by_leagueId_and_playerCode", (q) => q.eq("leagueId", league._id).eq("playerCode", player.code)),
    MOST_TEAMS,
    `More than ${MOST_TEAMS} shortlists in league ${league._id} hold player ${player.code}, one a team at most`,
  );
  const shortlisting = new Set(entries.map((entry) => entry.teamId));
  const to = (await teamsOf(ctx, league._id)).filter((team) => shortlisting.has(team._id)).map((team) => team.managerEmail);
  const letter = shortlistedReleasedLetter(player.name, from.name, bylineOf(by));
  await fileLetter(ctx, league, to.filter((email) => email !== undefined), letter, by);
}
