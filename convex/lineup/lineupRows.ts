import { v, type Infer } from "convex/values";
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

/** Between a tab's own mark and the rest of a row's `edit`. */
const EDIT_JOIN = ":";

/** Whether the row's `edit` mark is from a save by the Tactics tab `tab` (spec/05 `S05.55`). */
export const isOwnEdit = (edit: string | undefined, tab: string) => tab !== "" && edit !== undefined && edit.startsWith(`${tab}${EDIT_JOIN}`);

/** A Tactics tab's save, as it says what it was made from (spec/05 `S05.55`; #2350): the tab's own
 *  mark, and the row's `edit` mark it last loaded, absent for none. */
export const basedOnShape = v.object({ tab: v.string(), seen: v.optional(v.string()) });
export type BasedOn = Infer<typeof basedOnShape>;

/** Whether a save made from `basedOn` would replace another tab's moves: the row in force was
 *  written since the tab loaded it, by anything but the tab's own saves. */
export const changedSince = (inForce: Doc<"lineups"> | null, { tab, seen }: BasedOn) =>
  inForce?.edit !== seen && !isOwnEdit(inForce?.edit, tab);

/** The one writer of a team's lineup row from `fromGameweek` (#1759): it replaces the row from
 *  that gameweek if `inForce`, the row in force in it, is one, and adds a row otherwise. `fields`
 *  is handed the row it replaces, or null, so a writer can keep what it keeps. Each write marks the
 *  row anew (`edit`), after `tab`, the saving Tactics tab's mark, when a manager's save makes it. */
export async function writeRowFor(
  ctx: MutationCtx,
  leagueId: Id<"leagues">,
  teamId: Id<"teams">,
  fromGameweek: number,
  inForce: Doc<"lineups"> | null,
  fields: (replacing: Doc<"lineups"> | null) => RowFields,
  tab = "",
): Promise<void> {
  // Convex seeds Math.random in each mutation, so the mark is new each write.
  const edit = `${tab}${EDIT_JOIN}${Math.random().toString(36).slice(2)}`;
  if (inForce?.fromGameweek === fromGameweek) await ctx.db.patch("lineups", inForce._id, { ...fields(inForce), edit });
  else await ctx.db.insert("lineups", { leagueId, teamId, fromGameweek, ...fields(null), edit });
}
