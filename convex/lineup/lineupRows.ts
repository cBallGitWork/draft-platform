import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

// A team's lineup rows (schema/lineup.ts), read and written: one row a gameweek at most, and the
// lineup in a gameweek is the newest row from it or before (lineups.ts).

/** The row in force in the gameweek: the latest from it or before. One row a gameweek at most
 *  (`writeRowFor` replaces a second), so the index's last match is it. */
export function rowInForce(ctx: QueryCtx, leagueId: Id<"leagues">, teamId: Id<"teams">, gameweek: number) {
  return ctx.db
    .query("lineups")
    .withIndex("by_leagueId_and_teamId_and_fromGameweek", (q) =>
      q.eq("leagueId", leagueId).eq("teamId", teamId).lte("fromGameweek", gameweek),
    )
    .order("desc")
    .first();
}

/** Every field of a lineup row its writer sets, each one named, so a writer says whether it
 *  keeps, sets or clears each: `undefined` clears it, since a patch removes the field. */
export type RowFields = Pick<Doc<"lineups">, "starters" | "bench"> & {
  [Field in "classic" | "instructions" | "keptOutOfPosition" | "firstLineup"]: Doc<"lineups">[Field] | undefined;
};

/** The one writer of a team's lineup row from `fromGameweek` (#1759): it replaces the row from
 *  that gameweek if `inForce`, the row in force in it, is one, and adds a row otherwise. `fields`
 *  is handed the row it replaces, or null, so a writer can keep what it keeps. */
export async function writeRowFor(
  ctx: MutationCtx,
  leagueId: Id<"leagues">,
  teamId: Id<"teams">,
  fromGameweek: number,
  inForce: Doc<"lineups"> | null,
  fields: (replacing: Doc<"lineups"> | null) => RowFields,
): Promise<void> {
  if (inForce?.fromGameweek === fromGameweek) await ctx.db.patch("lineups", inForce._id, fields(inForce));
  else await ctx.db.insert("lineups", { leagueId, teamId, fromGameweek, ...fields(null) });
}
