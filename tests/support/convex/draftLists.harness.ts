// The draft queue and do-not-draft list tests' shared setup (#1092, #1137): a league with Ann's
// and Bob's teams, three players and one gone, and each list's mutations as one person.

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { MANAGERS, actingAs, addManagers, adminCreatesLeague, type TestConvex } from "./leagues.harness";
import { ARSENAL, CHELSEA, GONE, insertClubs, insertDroppedPlayer } from "./footballRows.harness";
import { fakeResend, signInDeployment } from "./signIn.harness";

export const [ANN, BOB] = MANAGERS;
export const SAKA = { code: 1001, name: "Saka", fullName: "Bukayo Saka", clubCode: ARSENAL.code };
export const PALMER = { code: 1002, name: "Palmer", fullName: "Cole Palmer", clubCode: CHELSEA.code };
export const ODEGAARD = { code: 1003, name: "Ødegaard", fullName: "Martin Ødegaard", clubCode: ARSENAL.code };

/** A league for 4 with Ann's and Bob's teams, in that order, and Saka, Palmer, Ødegaard and Gone. */
export async function listsLeague(): Promise<{ t: TestConvex; leagueId: Id<"leagues">; teams: Id<"teams">[] }> {
  const t = await signInDeployment();
  fakeResend();
  const leagueId = await adminCreatesLeague(t, 4);
  const teams = await addManagers(t, leagueId, [ANN, BOB]);
  await t.run(async (ctx) => {
    await insertClubs(ctx, [ARSENAL, CHELSEA]);
    for (const player of [SAKA, PALMER, ODEGAARD]) await ctx.db.insert("players", player);
    await insertDroppedPlayer(ctx, GONE, Date.now());
  });
  return { t, leagueId, teams };
}

/** `email`'s list mutations and reads in `leagueId`. */
export async function listsAs(t: TestConvex, leagueId: Id<"leagues">, email: string) {
  const person = await actingAs(t, email);
  return {
    queue: (playerCode: number) => person.mutation(api.draft.draftLists.add, { leagueId, playerCode, list: "queue" }),
    rule: (playerCode: number) => person.mutation(api.draft.draftLists.add, { leagueId, playerCode, list: "doNotDraft" }),
    unqueue: (playerCode: number) => person.mutation(api.draft.draftLists.remove, { leagueId, playerCode, list: "queue" }),
    unrule: (playerCode: number) => person.mutation(api.draft.draftLists.remove, { leagueId, playerCode, list: "doNotDraft" }),
    move: (playerCode: number, place: number) => person.mutation(api.draft.draftLists.move, { leagueId, playerCode, place }),
    mine: () => person.query(api.draft.draftLists.mine, { leagueId }),
    shortlist: (playerCode: number) => person.mutation(api.scouting.shortlist.add, { leagueId, playerCode }),
    queueFromShortlist: (playerCode: number) => person.mutation(api.draft.draftLists.addFromShortlist, { leagueId, playerCode }),
    queueShortlist: () => person.mutation(api.draft.draftLists.addShortlist, { leagueId }),
  };
}

/** `email`'s queue and do-not-draft list in `leagueId`, by name; null for one who runs no team. */
export async function namesOn(t: TestConvex, leagueId: Id<"leagues">, email: string) {
  const lists = await (await listsAs(t, leagueId, email)).mine();
  return lists && { queue: lists.queue.map(({ name }) => name), doNotDraft: lists.doNotDraft.map(({ name }) => name) };
}

/** Marks the player with `code` as gone from the Premier League. */
export const playerLeaves = (t: TestConvex, code: number) =>
  t.run(async (ctx) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    await ctx.db.patch("players", player!._id, { droppedAt: Date.now() });
  });

/** Writes `count` players, codes 1 up, named "Player <code>", and returns their codes. */
export async function manyPlayers(t: TestConvex, count: number): Promise<number[]> {
  const codes = Array.from({ length: count }, (_, index) => index + 1);
  await t.run(async (ctx) => {
    for (const code of codes) await ctx.db.insert("players", { code, name: `Player ${code}`, fullName: `Player ${code}`, clubCode: ARSENAL.code });
  });
  return codes;
}
