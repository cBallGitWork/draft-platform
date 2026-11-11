import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { positionsNow } from "../positions/playerPositions";
import { position } from "../schema";
import { listedPlayer, listedPlayers, ownTeam, shortlistOf } from "../scouting/shortlist";
import { memberOf, refuse, teamIn } from "../shared/leagueAccess";
import { heldPlayerByCode, playerOrRefuse } from "../shared/players";
import { placeOf } from "../squads/squadPlace";
import { DRAFT_LIST_MOST } from "./draftLimits";

// A manager's draft queue and do-not-draft list (spec/04, The queue and the ranking; #1092). The
// queue is the players he ranks to draft, first choice first, and needn't be complete; auto-pick
// never takes from the do-not-draft list. Both are the team's, not one draft's (Craig, 4 Nov 2026),
// and private to it, as the shortlist is: only its manager reads or changes them, so no other team,
// nor the commissioner, can tell who is on them. No player is on both: adding him to one takes him
// off the other. They can be changed at any time, between picks once the draft has started too,
// and a drafted player stays listed (Craig, 4 Nov 2026); auto-pick skips him (draftPicks.ts; #1094).
// The shortlist feeds the queue, a player at a time or the whole of it (#1137). When a manager goes,
// auto-pick keeps using both while the team has none; a new manager taking it starts with them
// empty and never sees the old ones (S04.15; Craig, 11 Nov 2026, on #1606).

const draftList = v.union(v.literal("queue"), v.literal("doNotDraft"));
type DraftList = "queue" | "doNotDraft";

export const draftListRefusals = {
  playerGone: (name: string) => `${name} has left the Premier League, so he can't be listed for the draft.`,
  full: (list: DraftList) =>
    `${list === "queue" ? "A draft queue" : "A do-not-draft list"} holds at most ${DRAFT_LIST_MOST} players. Take one off first.`,
  notQueued: (name: string) => `${name} isn't in your queue.`,
  noPlace: (count: number) => `Your queue has ${count} players, so that place isn't in it.`,
  notShortlisted: (name: string) => `${name} isn't on your shortlist.`,
  taken: (name: string, teamName: string) => `${name} is already taken, by ${teamName}, so he can't go in your queue.`,
};

const otherList = (list: DraftList): DraftList => (list === "queue" ? "doNotDraft" : "queue");

/** The team's queue and do-not-draft list, or null while its manager has added to neither. */
export function listsOf(ctx: QueryCtx, teamId: Id<"teams">): Promise<Doc<"draftLists"> | null> {
  return ctx.db
    .query("draftLists")
    .withIndex("by_teamId", (q) => q.eq("teamId", teamId))
    .unique();
}

/** Empties the team's queue and do-not-draft list, for a new manager taking it over (S04.15). */
export async function clearDraftLists(ctx: MutationCtx, teamId: Id<"teams">): Promise<void> {
  const lists = await listsOf(ctx, teamId);
  if (lists) await ctx.db.delete("draftLists", lists._id);
}

/** A player on the queue or do-not-draft list: as the shortlist lists him, with his first position
 *  now, for the draft room's chip (#1100), null for none. */
const draftListed = v.object({ ...listedPlayer.fields, position: v.union(position, v.null()) });
export type DraftListed = Infer<typeof draftListed>;

/** The caller's queue, first choice first, and do-not-draft list, by name; or null for someone in
 *  the league who runs no team (a commissioner or the admin only), who has neither. */
export const mine = query({
  args: { leagueId: v.id("leagues") },
  returns: v.union(v.object({ queue: v.array(draftListed), doNotDraft: v.array(draftListed) }), v.null()),
  handler: async (ctx, { leagueId }) => {
    const { team } = await memberOf(ctx, leagueId);
    if (!team) return null;
    const lists = await listsOf(ctx, team._id);
    const positionsOf = await positionsNow(ctx, leagueId);
    const withPositions = async (codes: readonly number[]) =>
      Promise.all((await listedPlayers(ctx, leagueId, codes)).map(async (player) => ({ ...player, position: (await positionsOf(player.code))[0] ?? null })));
    const doNotDraft = await withPositions(lists?.doNotDraft ?? []);
    return {
      queue: await withPositions(lists?.queue ?? []),
      doNotDraft: doNotDraft.sort((one, another) => one.name.localeCompare(another.name)),
    };
  },
});

const playerInLeague = { leagueId: v.id("leagues"), playerCode: v.number() };

/** Puts a player on the caller's own queue, at the bottom, or do-not-draft list, taking him off the
 *  other; one already on it keeps his place. Any player still in the Premier League, whoever owns
 *  him. */
export const add = mutation({
  args: { ...playerInLeague, list: draftList },
  returns: v.null(),
  handler: async (ctx, { leagueId, playerCode, list }) => {
    const team = await ownTeam(ctx, leagueId);
    const player = await playerOrRefuse(ctx, playerCode);
    if (player.droppedAt !== undefined) refuse(draftListRefusals.playerGone(player.name));
    await putOn(ctx, team, list, [playerCode]);
    return null;
  },
});

/** Puts `codes` at the bottom of the team's `list`, in their order, taking each off the other list;
 *  one already on `list` keeps his place. Refuses the lot if they would take it past
 *  DRAFT_LIST_MOST. */
async function putOn(ctx: MutationCtx, team: Doc<"teams">, list: DraftList, codes: readonly number[]): Promise<void> {
  const lists = await listsOf(ctx, team._id);
  const held = { queue: lists?.queue ?? [], doNotDraft: lists?.doNotDraft ?? [] };
  const adding = codes.filter((code) => !held[list].includes(code));
  if (adding.length === 0) return;
  if (held[list].length + adding.length > DRAFT_LIST_MOST) refuse(draftListRefusals.full(list));
  held[list] = [...held[list], ...adding];
  const other = otherList(list);
  held[other] = held[other].filter((code) => !adding.includes(code));
  if (lists) await ctx.db.patch("draftLists", lists._id, held);
  else await ctx.db.insert("draftLists", { leagueId: team.leagueId, teamId: team._id, ...held });
}

/** The caller's own shortlisted players a draft could still take: still in the Premier League and
 *  on no team in the league (Craig, 4 Nov 2026, on #1137: an already-drafted player never goes in
 *  the queue). By name, as the shortlist shows them. */
async function shortlistedToQueue(ctx: QueryCtx, team: Doc<"teams">): Promise<Doc<"players">[]> {
  const players = await Promise.all(
    (await shortlistOf(ctx, team._id)).map(async ({ playerCode }) =>
      (await placeOf(ctx, team.leagueId, playerCode)) === null
        ? [await heldPlayerByCode(ctx, playerCode, `Shortlisted player ${playerCode} isn't held`)]
        : [],
    ),
  );
  return players
    .flat()
    .filter((player) => player.droppedAt === undefined)
    .sort((one, another) => one.name.localeCompare(another.name));
}

/** Puts one player from the caller's own shortlist at the bottom of his queue, taking him off the
 *  do-not-draft list; one already queued keeps his place. Refused for a player not shortlisted, gone
 *  from the Premier League, or already on a team (Craig, 4 Nov 2026, on #1137). */
export const addFromShortlist = mutation({
  args: playerInLeague,
  returns: v.null(),
  handler: async (ctx, { leagueId, playerCode }) => {
    const team = await ownTeam(ctx, leagueId);
    const player = await playerOrRefuse(ctx, playerCode);
    if (!(await shortlistOf(ctx, team._id)).some((entry) => entry.playerCode === playerCode)) {
      refuse(draftListRefusals.notShortlisted(player.name));
    }
    if (player.droppedAt !== undefined) refuse(draftListRefusals.playerGone(player.name));
    const place = await placeOf(ctx, leagueId, playerCode);
    if (place !== null) refuse(draftListRefusals.taken(player.name, (await teamIn(ctx, leagueId, place.teamId)).name));
    await putOn(ctx, team, "queue", [playerCode]);
    return null;
  },
});

/** "Add my whole shortlist": puts the caller's shortlisted players a draft could still take at the
 *  bottom of his queue, in name order, taking them off the do-not-draft list; those already queued
 *  keep their place. As many as fit under DRAFT_LIST_MOST go in, and the rest, by name, are left
 *  out (Craig, 4 Nov 2026, on #1137). Returns how many went in and how many were left out. */
export const addShortlist = mutation({
  args: { leagueId: v.id("leagues") },
  returns: v.object({ added: v.number(), leftOut: v.number() }),
  handler: async (ctx, { leagueId }) => {
    const team = await ownTeam(ctx, leagueId);
    const queued = new Set((await listsOf(ctx, team._id))?.queue ?? []);
    const adding = (await shortlistedToQueue(ctx, team)).map(({ code }) => code).filter((code) => !queued.has(code));
    const fitting = adding.slice(0, Math.max(0, DRAFT_LIST_MOST - queued.size));
    await putOn(ctx, team, "queue", fitting);
    return { added: fitting.length, leftOut: adding.length - fitting.length };
  },
});

/** Takes a player off the caller's own queue or do-not-draft list; one not on it is already off. */
export const remove = mutation({
  args: { ...playerInLeague, list: draftList },
  returns: v.null(),
  handler: async (ctx, { leagueId, playerCode, list }) => {
    const team = await ownTeam(ctx, leagueId);
    const lists = await listsOf(ctx, team._id);
    if (!lists?.[list].includes(playerCode)) return null;
    await ctx.db.patch("draftLists", lists._id, { [list]: lists[list].filter((code) => code !== playerCode) });
    return null;
  },
});

/** Moves a player in the caller's own queue to `place`, 1 the top, the players between shifting
 *  one place to make room. */
export const move = mutation({
  args: { ...playerInLeague, place: v.number() },
  returns: v.null(),
  handler: async (ctx, { leagueId, playerCode, place }) => {
    const team = await ownTeam(ctx, leagueId);
    const lists = await listsOf(ctx, team._id);
    if (!lists?.queue.includes(playerCode)) {
      const player = await playerOrRefuse(ctx, playerCode);
      return refuse(draftListRefusals.notQueued(player.name));
    }
    const count = lists.queue.length;
    if (!Number.isInteger(place) || place < 1 || place > count) refuse(draftListRefusals.noPlace(count));
    const rest = lists.queue.filter((code) => code !== playerCode);
    await ctx.db.patch("draftLists", lists._id, { queue: [...rest.slice(0, place - 1), playerCode, ...rest.slice(place - 1)] });
    return null;
  },
});
