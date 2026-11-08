import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { clubColoursRecord } from "../schema";
import { takeAllOrThrow } from "../shared/cappedRead";
import { adminOf, refuse, signedInEmail } from "../shared/leagueAccess";
import { currentClubs, findClubByCode } from "../shared/players";
import { CLUB_COLOURS, isColour, type HeldColours } from "./clubColours";

// Each club's colours and shirt pattern, held by club code (#838; spec/15, The admin: "Owns each
// club's colours and shirt pattern on the admin dashboard, for any club at any time, any colour; a
// file gives every club its first"). The football sync seeds a club's row from clubColours.ts the
// first time it holds the club with none; the admin changes it after. A club with no row, such as
// one promoted with none in the file, is drawn white and waits in the dashboard's queue
// (playerPositions.ts `queue`). Clubs that existed before #838 are seeded by the next football
// sync, or at once by running, on each deployment:
//   npx convex run football/clubKits:seedHeldClubs
//   npx convex run --prod football/clubKits:seedHeldClubs

/** The most clubs' colours held: rows are never deleted, so clubs from past seasons stay, with
 *  room. More throws, never a silent cut. */
const HELD_COLOURS_MOST = 200;

/** Why the server refuses the admin's colours. */
export const clubColourRefusals = {
  notAColour: "A colour is six hex digits after a #, such as #E50107.",
  noSuchClub: "No such club is held.",
};

/** Every club's colours held, by code. */
export async function heldColours(ctx: QueryCtx): Promise<HeldColours[]> {
  const rows = await takeAllOrThrow(
    ctx.db.query("clubColours"),
    HELD_COLOURS_MOST,
    `More than ${HELD_COLOURS_MOST} clubs' colours are held, so the list would be cut short`,
  );
  return rows.map(({ code, primary, secondary, pattern }) => ({ code, primary, secondary, pattern }));
}

function rowOf(ctx: QueryCtx, code: number): Promise<Doc<"clubColours"> | null> {
  return ctx.db
    .query("clubColours")
    .withIndex("by_code", (q) => q.eq("code", code))
    .unique();
}

/** Gives each club with no colours held its first from clubColours.ts, where the file has a row;
 *  a club already held, as the admin set it, is left alone. Says how many were seeded. */
export async function seedColours(ctx: MutationCtx, codes: readonly number[]): Promise<number> {
  let seeded = 0;
  for (const code of codes) {
    const seed = CLUB_COLOURS[code];
    if (seed === undefined || (await rowOf(ctx, code)) !== null) continue;
    await ctx.db.insert("clubColours", { code, primary: seed.primary, secondary: seed.secondary, pattern: seed.pattern });
    seeded++;
  }
  return seeded;
}

/** Every club's colours held, for the shirts and club marks on anyone's screen; none for someone
 *  signed out, as the sign-in page draws no club. */
export const all = query({
  args: {},
  returns: v.array(clubColoursRecord.extend({ code: v.number() })),
  handler: async (ctx) => ((await signedInEmail(ctx)) === null ? [] : heldColours(ctx)),
});

/** The admin sets a club's two colours, any colour, and its shirt's pattern, at any time (spec/15). */
export const set = mutation({
  args: { code: v.number(), ...clubColoursRecord.fields },
  returns: v.null(),
  handler: async (ctx, { code, primary, secondary, pattern }) => {
    await adminOf(ctx);
    if (!isColour(primary) || !isColour(secondary)) refuse(clubColourRefusals.notAColour);
    if ((await findClubByCode(ctx, code)) === null) refuse(clubColourRefusals.noSuchClub);
    const held = await rowOf(ctx, code);
    if (held === null) await ctx.db.insert("clubColours", { code, primary, secondary, pattern });
    else await ctx.db.patch("clubColours", held._id, { primary, secondary, pattern });
    return null;
  },
});

/** Seeds every current club with no colours held, as the football sync would (see above). Running
 *  it again does nothing. */
export const seedHeldClubs = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => seedColours(ctx, (await currentClubs(ctx)).map(({ code }) => code)),
});
