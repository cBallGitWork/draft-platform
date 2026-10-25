import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

// The Premier League's clubs and players as the football sync holds them (#21): the reads that
// squads and the admin's positions both make, so each limit and the search have one home. Clubs
// and players are never deleted, only marked dropped, so a read of every row would grow each
// season: each read here is of the current ones, or of one by its code (#142).

/** The most clubs in the Premier League at once: its 20, with room. More throws, never a silent cut. */
export const CURRENT_CLUBS_MOST = 40;

/** The most players at one club at once: a squad of about 30 the feed names, with room. More
 *  throws, never a silent cut. */
export const CLUB_PLAYERS_MOST = 100;

/** The most players a search returns: enough to pick from, few enough to read. */
const FOUND_MOST = 20;

/** The clubs in the Premier League now, the ones the feed has dropped left out. */
export async function currentClubs(ctx: QueryCtx): Promise<Doc<"clubs">[]> {
  const clubs = await ctx.db
    .query("clubs")
    .withIndex("by_droppedAt", (q) => q.eq("droppedAt", undefined))
    .take(CURRENT_CLUBS_MOST + 1);
  if (clubs.length > CURRENT_CLUBS_MOST) throw new Error(`More than ${CURRENT_CLUBS_MOST} clubs are held as current, so the list would be cut short`);
  return clubs;
}

/** The club with `code`, dropped or not. A player's club is always held, so one missing throws. */
export async function clubByCode(ctx: QueryCtx, code: number): Promise<Doc<"clubs">> {
  const club = await ctx.db
    .query("clubs")
    .withIndex("by_code", (q) => q.eq("code", code))
    .unique();
  if (club === null) throw new Error(`No club with code ${code} is held`);
  return club;
}

/** The player with `code`, dropped or not, or null while the football sync holds no such player:
 *  each caller says what a missing one means. */
export function playerByCode(ctx: QueryCtx, code: number): Promise<Doc<"players"> | null> {
  return ctx.db
    .query("players")
    .withIndex("by_code", (q) => q.eq("code", code))
    .unique();
}

/** The players at the club now, the ones the feed has dropped left out. */
export async function currentPlayersAt(ctx: QueryCtx, clubCode: number): Promise<Doc<"players">[]> {
  const players = await ctx.db
    .query("players")
    .withIndex("by_clubCode_and_droppedAt", (q) => q.eq("clubCode", clubCode).eq("droppedAt", undefined))
    .take(CLUB_PLAYERS_MOST + 1);
  if (players.length > CLUB_PLAYERS_MOST) throw new Error(`More than ${CLUB_PLAYERS_MOST} players are held at club ${clubCode}, so they would be cut short`);
  return players;
}

/** Players still in the Premier League whose full name matches `text`, best first. */
export function playersNamed(ctx: QueryCtx, text: string): Promise<Doc<"players">[]> {
  return ctx.db
    .query("players")
    .withSearchIndex("search_fullName", (q) => q.search("fullName", text).eq("droppedAt", undefined))
    .take(FOUND_MOST);
}
