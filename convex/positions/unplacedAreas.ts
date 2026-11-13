import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { areaShape } from "../lineup/pitchShape";
import { adminOf, refuse } from "../shared/leagueAccess";
import { heldRow, patchRow, positionListFrom } from "./playerPositions";
import { EVERY_LEAGUE, howPositionsCount } from "./positionSettings";

// The area of a player no feed has placed yet (spec/06, New signings `S06.1`): the admin sets it,
// and he counts towards that area's squad minimum until a feed places him; with none set he fills
// none: "admin set that" (Craig, 7 Nov 2026, on #911). areaMinimums.ts's `minimumAreas` counts it.

export const unplacedAreaRefusals = {
  placed: "He already has positions, which count for the squad minimums: an area only counts while he has none.",
} as const;

/** Sets the area whose squad minimum a player with no positions counts towards, or clears it with
 *  null. The admin's alone. Refused for a player who has positions. */
export const setUnplacedArea = mutation({
  args: { code: v.number(), area: v.union(areaShape, v.null()) },
  returns: v.null(),
  handler: async (ctx, { code, area }) => {
    await adminOf(ctx);
    const row = await heldRow(ctx, code);
    if (area !== null && positionListFrom(row, await howPositionsCount(ctx, EVERY_LEAGUE)).length > 0) refuse(unplacedAreaRefusals.placed);
    await patchRow(ctx, row, { unplacedArea: area ?? undefined });
    return null;
  },
});
