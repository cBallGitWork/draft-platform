import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { draftIsOver } from "../draft/draftRow";
import { fileEvent, recordEvent } from "../mail/letters";
import { tellShortlisters } from "../scouting/shortlist";
import { LEAGUES_READ_MOST, takeAllOrThrow } from "../shared/cappedRead";
import { placeOf } from "../squads/squadPlace";
import type { LeagueDeadlines } from "../gameweeks/deadline";
import { closeOffersHolding } from "../trades/tradeClose";
import { WAIVER_MS } from "./waiverLimits";
import { deadlinePassedSince } from "./waiverLock";

// Who is on waivers in a league (#1197, spec/08 Waivers and free agency): a row in waiverPlayers
// (../schema/waivers.ts) each, only while no team holds him. A drop puts him there for at least 24
// hours; a player new to the Premier League once the league's draft is over, and those nobody
// drafted when the league's draft setting says waivers (spec/04), go there for the next run, as
// does every free agent at a deadline (backOnWaivers.ts, #1478).

/** The player's waiver row in the league, or null while he isn't on waivers. */
export function waiverRowOf(ctx: QueryCtx, leagueId: Id<"leagues">, playerCode: number): Promise<Doc<"waiverPlayers"> | null> {
  return ctx.db
    .query("waiverPlayers")
    .withIndex("by_leagueId_and_playerCode", (q) => q.eq("leagueId", leagueId).eq("playerCode", playerCode))
    .unique();
}

/** The most players on waivers in one league one read takes: Claude's sizing, far above a week's
 *  drops and new Premier League players, and above the whole Premier League for those put back at
 *  a deadline (#1478). Past it a read throws rather than leave some out. */
export const WAIVER_PLAYERS_READ_MOST = 2000;

/** Every player on the league's waivers, read at once. */
export function waiverRowsIn(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Doc<"waiverPlayers">[]> {
  return takeAllOrThrow(
    ctx.db.query("waiverPlayers").withIndex("by_leagueId_and_playerCode", (q) => q.eq("leagueId", leagueId)),
    WAIVER_PLAYERS_READ_MOST,
    `League ${leagueId} has more than ${WAIVER_PLAYERS_READ_MOST} players on waivers, so they can't all be read`,
  );
}

/** Puts the player on the league's waivers, a run taking him from `claimableFrom`, in place of
 *  any time he had there. */
export async function putOnWaivers(ctx: MutationCtx, leagueId: Id<"leagues">, playerCode: number, claimableFrom: number): Promise<void> {
  const held = await waiverRowOf(ctx, leagueId, playerCode);
  if (held === null) await ctx.db.insert("waiverPlayers", { leagueId, playerCode, claimableFrom });
  else await ctx.db.patch("waiverPlayers", held._id, { claimableFrom });
}

/** Takes the player out of his squad for his manager's drop, by itself or for a claim: onto
 *  waivers for WAIVER_MS from `waiversFrom`, unless the churn rule sends him straight back to the
 *  free agents, picked up as one with no deadline passed since (spec/08). A claim's drop counts
 *  from its run's own time, not the moment the run executes, so a late run's drop still makes the
 *  next run (Craig, 11 Nov 2026, #1481). Whether he went on waivers. */
export async function dropFromSquad(
  ctx: MutationCtx,
  place: Doc<"squadPlayers">,
  deadlines: LeagueDeadlines,
  now: number,
  waiversFrom = now,
): Promise<boolean> {
  const churned = place.pickedUpAt !== undefined && !deadlinePassedSince(deadlines, place.pickedUpAt, now);
  await ctx.db.delete("squadPlayers", place._id);
  if (!churned) await putOnWaivers(ctx, place.leagueId, place.playerCode, waiversFrom + WAIVER_MS);
  return !churned;
}

/** How a drop is told: `letter` when the drop is the whole move, so it gets its own Mail letter,
 *  not a pickup's or claim's; `unread` when a run made it for the manager, so the shortlisters'
 *  copy to him is filed unread. */
type DropTold = { deadlines: LeagueDeadlines; now: number; waiversFrom?: number; letter: boolean; unread?: boolean };

/** The team drops the player, by itself, for a pickup or for a claim (spec/08): out of the squad
 *  (`dropFromSquad`), the drop filed, each open offer holding him closed, and each manager whose
 *  shortlist holds him told. Whether he went on waivers. */
export async function dropAndTell(
  ctx: MutationCtx,
  league: Doc<"leagues">,
  team: Doc<"teams">,
  place: Doc<"squadPlayers">,
  player: { code: number; name: string },
  by: string,
  { deadlines, now, waiversFrom = now, letter, unread = false }: DropTold,
): Promise<boolean> {
  const toWaivers = await dropFromSquad(ctx, place, deadlines, now, waiversFrom);
  const event = { kind: "playerDropped", playerCode: player.code, playerName: player.name, teamId: team._id, teamName: team.name, toWaivers } as const;
  if (letter) await recordEvent(ctx, league._id, by, event);
  else await fileEvent(ctx, league._id, by, event);
  await closeOffersHolding(ctx, league._id, team._id, [player.code]);
  await tellShortlisters(ctx, league, player, team, by, { released: false, toWaivers }, { unread });
  return toWaivers;
}

/** Takes the player off the league's waivers as he joins a team, so a row is only ever for a
 *  player no team holds. */
export async function offWaivers(ctx: MutationCtx, leagueId: Id<"leagues">, playerCode: number): Promise<void> {
  const held = await waiverRowOf(ctx, leagueId, playerCode);
  if (held !== null) await ctx.db.delete("waiverPlayers", held._id);
}

/** The leagues whose draft is over: started, with no pick left on the clock. */
async function leaguesDrafted(ctx: QueryCtx): Promise<Id<"leagues">[]> {
  const drafts = await takeAllOrThrow(
    ctx.db.query("drafts"),
    LEAGUES_READ_MOST,
    `More than ${LEAGUES_READ_MOST} drafts are held, so a new Premier League player can't be put on waivers in every league`,
  );
  const over = await Promise.all(drafts.map(({ leagueId }) => draftIsOver(ctx, leagueId)));
  return drafts.filter((_, index) => over[index]).map(({ leagueId }) => leagueId);
}

/** Puts players new to the Premier League on waivers for the next run in every league whose
 *  draft is over (spec/08: "A player new to the Premier League mid-season goes on waivers for the
 *  next run"), one coming back after leaving included, whenever he left (Craig, 11 Nov 2026,
 *  #1489). A league still to draft, or drafting, takes them in its draft. One coming back stays
 *  with a team still holding him, and a later waiver time he already has is kept. */
export async function putNewPlayersOnWaivers(ctx: MutationCtx, playerCodes: readonly number[], now: number): Promise<void> {
  if (playerCodes.length === 0) return;
  for (const leagueId of await leaguesDrafted(ctx)) {
    for (const playerCode of playerCodes) {
      if ((await placeOf(ctx, leagueId, playerCode)) !== null) continue;
      const held = await waiverRowOf(ctx, leagueId, playerCode);
      if (held === null || held.claimableFrom < now) await putOnWaivers(ctx, leagueId, playerCode, now);
    }
  }
}
