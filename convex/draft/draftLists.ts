import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { listedPlayer, listedPlayers, ownTeam } from "../scouting/shortlist";
import { memberOf, refuse, refusals } from "../shared/leagueAccess";
import { playerByCode } from "../shared/players";
import { DRAFT_LIST_MOST } from "./draftLimits";

// A manager's draft queue and do-not-draft list (spec/04, The queue and the ranking; #1092). The
// queue is the players he ranks to draft, first choice first, and needn't be complete; auto-pick
// never takes from the do-not-draft list. Both are the team's, not one draft's (Craig, 4 Nov 2026),
// and private to it, as the shortlist is: only its manager reads or changes them, so no other team,
// nor the commissioner, can tell who is on them. No player is on both: adding him to one takes him
// off the other. They can be changed at any time, between picks once the draft has started too,
// and a drafted player stays listed (Craig, 4 Nov 2026); auto-pick, which skips him, isn't built.
// Not built yet: emptying them when a draft ends (no draft ends yet), and the shortlist feeding
// the queue (#1137).

const draftList = v.union(v.literal("queue"), v.literal("doNotDraft"));
type DraftList = "queue" | "doNotDraft";

export const draftListRefusals = {
  playerGone: (name: string) => `${name} has left the Premier League, so he can't be listed for the draft.`,
  full: (list: DraftList) =>
    `${list === "queue" ? "A draft queue" : "A do-not-draft list"} holds at most ${DRAFT_LIST_MOST} players. Take one off first.`,
  notQueued: (name: string) => `${name} isn't in your queue.`,
  noPlace: (count: number) => `Your queue has ${count} players, so that place isn't in it.`,
};

const otherList = (list: DraftList): DraftList => (list === "queue" ? "doNotDraft" : "queue");

function listsOf(ctx: QueryCtx, teamId: Id<"teams">): Promise<Doc<"draftLists"> | null> {
  return ctx.db
    .query("draftLists")
    .withIndex("by_teamId", (q) => q.eq("teamId", teamId))
    .unique();
}

/** The caller's queue, first choice first, and do-not-draft list, by name; or null for someone in
 *  the league who runs no team (a commissioner or the admin only), who has neither. */
export const mine = query({
  args: { leagueId: v.id("leagues") },
  returns: v.union(v.object({ queue: v.array(listedPlayer), doNotDraft: v.array(listedPlayer) }), v.null()),
  handler: async (ctx, { leagueId }) => {
    const { team } = await memberOf(ctx, leagueId);
    if (!team) return null;
    const lists = await listsOf(ctx, team._id);
    const doNotDraft = await listedPlayers(ctx, leagueId, lists?.doNotDraft ?? []);
    return {
      queue: await listedPlayers(ctx, leagueId, lists?.queue ?? []),
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
    const player = (await playerByCode(ctx, playerCode)) ?? refuse(refusals.noPlayer);
    if (player.droppedAt !== undefined) refuse(draftListRefusals.playerGone(player.name));
    const lists = await listsOf(ctx, team._id);
    const held = { queue: lists?.queue ?? [], doNotDraft: lists?.doNotDraft ?? [] };
    if (held[list].includes(playerCode)) return null;
    if (held[list].length >= DRAFT_LIST_MOST) refuse(draftListRefusals.full(list));
    held[list] = [...held[list], playerCode];
    const other = otherList(list);
    held[other] = held[other].filter((code) => code !== playerCode);
    if (lists) await ctx.db.patch("draftLists", lists._id, held);
    else await ctx.db.insert("draftLists", { leagueId, teamId: team._id, ...held });
    return null;
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
      const player = (await playerByCode(ctx, playerCode)) ?? refuse(refusals.noPlayer);
      return refuse(draftListRefusals.notQueued(player.name));
    }
    const count = lists.queue.length;
    if (!Number.isInteger(place) || place < 1 || place > count) refuse(draftListRefusals.noPlace(count));
    const rest = lists.queue.filter((code) => code !== playerCode);
    await ctx.db.patch("draftLists", lists._id, { queue: [...rest.slice(0, place - 1), playerCode, ...rest.slice(place - 1)] });
    return null;
  },
});
