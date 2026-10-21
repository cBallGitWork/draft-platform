import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

// The reads a commissioner's squad screens (squads.ts) and the admin's positions (playerPositions.ts)
// both make, so the two search and list alike.

/** The most players a search returns: enough to pick from, few enough to read. */
const FOUND_MOST = 20;
/** The Premier League's clubs, with room for the ones a season's sync keeps after relegation. */
const CLUBS_MOST = 40;

/** Players whose full name matches `text`, never those who have left the Premier League. */
export function playersNamed(ctx: QueryCtx, text: string): Promise<Doc<"players">[]> {
  return ctx.db
    .query("players")
    .withSearchIndex("search_fullName", (q) => q.search("fullName", text).eq("droppedAt", undefined))
    .take(FOUND_MOST);
}

/** Every club the platform holds, dropped ones included. */
export function allClubs(ctx: QueryCtx): Promise<Doc<"clubs">[]> {
  return ctx.db.query("clubs").take(CLUBS_MOST);
}
