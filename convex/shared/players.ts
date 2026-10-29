import type { Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { clubRecord } from "../schema";
import { takeAllOrThrow } from "./cappedRead";
import { readOnce } from "./readOnce";

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
export function currentClubs(ctx: QueryCtx): Promise<Doc<"clubs">[]> {
  return takeAllOrThrow(
    ctx.db.query("clubs").withIndex("by_droppedAt", (q) => q.eq("droppedAt", undefined)),
    CURRENT_CLUBS_MOST,
    `More than ${CURRENT_CLUBS_MOST} clubs are held as current, so the list would be cut short`,
  );
}

/** The club with `code`, dropped or not, or null while the football sync holds no such club: each
 *  caller says what a missing one means. */
export function findClubByCode(ctx: QueryCtx, code: number): Promise<Doc<"clubs"> | null> {
  return ctx.db
    .query("clubs")
    .withIndex("by_code", (q) => q.eq("code", code))
    .unique();
}

/** The club with `code`, dropped or not. A player's club is always held, so one missing throws. */
export async function clubByCode(ctx: QueryCtx, code: number): Promise<Doc<"clubs">> {
  const club = await findClubByCode(ctx, code);
  if (club === null) throw new Error(`No club with code ${code} is held`);
  return club;
}

/** A club as a screen names it. */
export type Club = Infer<typeof clubRecord>;

/** A club's row as a screen names it. */
export function clubOf({ code, name, shortName }: Doc<"clubs">): Club {
  return { code, name, shortName };
}

export type Clubs = (code: number) => Promise<Club>;

/** Clubs by code, each read once. */
export function clubsByCode(ctx: QueryCtx): Clubs {
  return readOnce((code: number) => clubByCode(ctx, code).then(clubOf));
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
export function currentPlayersAt(ctx: QueryCtx, clubCode: number): Promise<Doc<"players">[]> {
  return takeAllOrThrow(
    ctx.db.query("players").withIndex("by_clubCode_and_droppedAt", (q) => q.eq("clubCode", clubCode).eq("droppedAt", undefined)),
    CLUB_PLAYERS_MOST,
    `More than ${CLUB_PLAYERS_MOST} players are held at club ${clubCode}, so they would be cut short`,
  );
}

/** Players still in the Premier League whose full name matches `text`, best first. */
export function playersNamed(ctx: QueryCtx, text: string): Promise<Doc<"players">[]> {
  return ctx.db
    .query("players")
    .withSearchIndex("search_fullName", (q) => q.search("fullName", text).eq("droppedAt", undefined))
    .take(FOUND_MOST);
}
