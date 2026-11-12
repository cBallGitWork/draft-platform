import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { MOST_TEAMS } from "../leagues/leagueLimits";
import { bylineOf, fileLetter } from "../mail/letters";
import { shortlistedClearedLetter, shortlistedDroppedLetter, shortlistedReleasedLetter, shortlistRefusals } from "./shortlistWords";
import { clubRecord } from "../schema";
import { takeAllOrThrow } from "../shared/cappedRead";
import { memberOf, refuse, refusals, teamsOf } from "../shared/leagueAccess";
import { clubByCode, clubOf, hasLeft, heldPlayerByCode, playerByCode } from "../shared/players";
import { ownerOf } from "../squads/squadPlace";

// The shortlist (spec/19, The shortlist; #374): a manager's own list of players for the season, in
// Scouting. It is the team's, and private to it: only its manager reads or changes it, so no other
// team, nor the commissioner, can tell who is on it. When a shortlisted player is released, dropped
// or clears waivers, Mail tells each manager whose shortlist holds him (spec/16). It feeds the
// draft queue (../draft/draftLists.ts; #1137).

/** The most players one shortlist holds: room to follow a fifth of the Premier League. A bound for
 *  reading it, as MOST_IN_SQUAD is a squad's. Claude's choice, not yet Craig's. */
export const SHORTLIST_MOST = 100;

/** A player on a manager's own list: the shortlist, or the draft queue or do-not-draft list. */
export const ownListPlayer = v.object({
  code: v.number(),
  name: v.string(),
  fullName: v.string(),
  club: clubRecord,
  /** The team in this league that owns him, or null for a free agent. */
  ownerTeamName: v.union(v.string(), v.null()),
  /** The feed no longer sends him: he has left the Premier League since he was listed. */
  gone: v.boolean(),
});
export type OwnListPlayer = Infer<typeof ownListPlayer>;

/** The caller's team in the league, or the refusal that they run none. Unlike `managerOf`, a
 *  stranger is told they aren't in the league (memberOf), and only a member who runs no team (its
 *  commissioner, say) is told they run none: the refusals the shortlist has always given. */
export async function ownTeam(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Doc<"teams">> {
  return (await memberOf(ctx, leagueId)).team ?? refuse(refusals.runsNoTeam);
}

/** The team's shortlist rows, at most SHORTLIST_MOST; the draft queue it feeds reads it too
 *  (../draft/draftLists.ts). */
export function shortlistOf(ctx: QueryCtx, teamId: Id<"teams">) {
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

/** Each player, by FPL code, as a manager's own list shows him: his club, who in the league owns
 *  him, and whether he has left the Premier League. The shortlist's, and the draft queue's and
 *  do-not-draft list's (../draft/draftLists.ts). */
export async function listedPlayers(ctx: QueryCtx, leagueId: Id<"leagues">, codes: readonly number[]): Promise<OwnListPlayer[]> {
  const owner = await ownerOf(ctx, leagueId);
  return Promise.all(
    codes.map(async (playerCode) => {
      // Players are never deleted (shared/players.ts), and only a held one is ever listed.
      const player = await heldPlayerByCode(ctx, playerCode, `Listed player ${playerCode} isn't held`);
      const club = await clubByCode(ctx, player.clubCode);
      return {
        code: player.code,
        name: player.name,
        fullName: player.fullName,
        club: clubOf(club),
        ownerTeamName: (await owner(playerCode))?.name ?? null,
        gone: hasLeft(player),
      };
    }),
  );
}

/** The caller's shortlist in the league, by name, or null for someone in it who runs no team (a
 *  commissioner or the admin only), who has none. */
export const mine = query({
  args: { leagueId: v.id("leagues") },
  returns: v.union(v.array(ownListPlayer), v.null()),
  handler: async (ctx, { leagueId }) => {
    const { team } = await memberOf(ctx, leagueId);
    if (!team) return null;
    const codes = (await shortlistOf(ctx, team._id)).map(({ playerCode }) => playerCode);
    return (await listedPlayers(ctx, leagueId, codes)).sort((one, other) => one.name.localeCompare(other.name));
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
    if (hasLeft(player)) refuse(shortlistRefusals.playerGone(player.name));
    if ((await entryOf(ctx, team._id, playerCode)) !== null) return null;
    if ((await shortlistOf(ctx, team._id)).length >= SHORTLIST_MOST) refuse(shortlistRefusals.full(SHORTLIST_MOST));
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

/** The shortlist rows' managers, by email, each with the codes of his rows' players; a team with
 *  no manager has no one to tell. */
async function managersHolding(ctx: QueryCtx, leagueId: Id<"leagues">, entries: readonly Doc<"shortlistPlayers">[]): Promise<Map<string, number[]>> {
  const managers = new Map((await teamsOf(ctx, leagueId)).map((team) => [team._id, team.managerEmail]));
  const held = new Map<string, number[]>();
  for (const { teamId, playerCode } of entries) {
    const email = managers.get(teamId);
    if (email !== undefined) held.set(email, [...(held.get(email) ?? []), playerCode]);
  }
  return held;
}

/** Files the letter that `player` left `from`, released or dropped by `by`, to each manager whose
 *  shortlist holds him: the copy to `by` filed read, unless `unread`, as a waiver run's are. */
export async function tellShortlisters(
  ctx: MutationCtx,
  league: Doc<"leagues">,
  player: { code: number; name: string },
  from: { name: string },
  by: string,
  how: { released: true } | { released: false; toWaivers: boolean },
  { unread = false } = {},
): Promise<void> {
  const who = bylineOf(by);
  const letter = how.released
    ? shortlistedReleasedLetter(player.name, from.name, who)
    : shortlistedDroppedLetter({ playerName: player.name, teamName: from.name, toWaivers: how.toWaivers }, who);
  const entries = await shortlistersOf(ctx, league._id, player.code);
  await fileLetter(ctx, league, [...(await managersHolding(ctx, league._id, entries)).keys()], letter, unread ? undefined : by);
}

/** The league's shortlist rows holding player `code`: one a team at most. */
function shortlistersOf(ctx: QueryCtx, leagueId: Id<"leagues">, code: number): Promise<Doc<"shortlistPlayers">[]> {
  return takeAllOrThrow(
    ctx.db.query("shortlistPlayers").withIndex("by_leagueId_and_playerCode", (q) => q.eq("leagueId", leagueId).eq("playerCode", code)),
    MOST_TEAMS,
    `More than ${MOST_TEAMS} shortlists in league ${leagueId} hold player ${code}, one a team at most`,
  );
}

/** Cleared players read one by one up to this many, each a query of at most MOST_TEAMS rows; past
 *  it, one read of the whole league's shortlists, at most MOST_TEAMS * SHORTLIST_MOST rows, so a
 *  run clearing a big pool (up to waiverPlayers.ts's WAIVER_PLAYERS_READ_MOST) stays inside Convex's
 *  queries a transaction (#1568). */
export const CLEARED_READ_ONE_BY_ONE_MOST = SHORTLIST_MOST;

/** Every shortlist row in the league, in player code order. */
function everyShortlisted(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Doc<"shortlistPlayers">[]> {
  return takeAllOrThrow(
    ctx.db.query("shortlistPlayers").withIndex("by_leagueId_and_playerCode", (q) => q.eq("leagueId", leagueId)),
    MOST_TEAMS * SHORTLIST_MOST,
    `More than ${MOST_TEAMS * SHORTLIST_MOST} players are on league ${leagueId}'s shortlists, ${SHORTLIST_MOST} a team at most`,
  );
}

/** Files, after a waiver run, one letter to each manager whose shortlist holds players nobody
 *  claimed at it (`codes`), naming them: each is a free agent now (spec/08). */
export async function tellShortlistersCleared(ctx: MutationCtx, league: Doc<"leagues">, codes: readonly number[]): Promise<void> {
  if (codes.length === 0) return;
  // In code order, as the league-wide read walks the index, so either read files the same letters.
  const unique = new Set(codes);
  const shortlisted =
    unique.size <= CLEARED_READ_ONE_BY_ONE_MOST
      ? (await Promise.all([...unique].sort((one, other) => one - other).map((code) => shortlistersOf(ctx, league._id, code)))).flat()
      : (await everyShortlisted(ctx, league._id)).filter(({ playerCode }) => unique.has(playerCode));
  for (const [email, held] of await managersHolding(ctx, league._id, shortlisted)) {
    const players = await Promise.all(held.map((code) => heldPlayerByCode(ctx, code, `Shortlisted player ${code}, cleared from waivers, isn't held`)));
    const names = players.map(({ name }) => name).sort((one, other) => one.localeCompare(other));
    await fileLetter(ctx, league, [email], shortlistedClearedLetter(names));
  }
}
