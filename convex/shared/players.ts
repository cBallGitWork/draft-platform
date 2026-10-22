import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

// The Premier League's clubs and players as the football sync holds them (#21): the reads that
// squads and the admin's positions both make, so each limit and the search have one home.

/** The Premier League's clubs, with room for the ones a season's sync keeps after relegation. */
const CLUBS_MOST = 40;

/** The most players a search returns: enough to pick from, few enough to read. */
const FOUND_MOST = 20;

/** Every club held, those the feed has dropped included. */
export function heldClubs(ctx: QueryCtx): Promise<Doc<"clubs">[]> {
  return ctx.db.query("clubs").take(CLUBS_MOST);
}

/** Players still in the Premier League whose full name matches `text`, best first. */
export function playersNamed(ctx: QueryCtx, text: string): Promise<Doc<"players">[]> {
  return ctx.db
    .query("players")
    .withSearchIndex("search_fullName", (q) => q.search("fullName", text).eq("droppedAt", undefined))
    .take(FOUND_MOST);
}
