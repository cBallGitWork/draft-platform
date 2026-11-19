import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { adminOf, callerEmail, refuse } from "../shared/leagueAccess";
import { takeAllOrThrow } from "../shared/cappedRead";
import { typedName, typedText } from "../shared/typedText";
import { GUIDE_ENTRIES_MOST, GUIDE_SECTIONS_MOST, GUIDE_TEXT_MAX, GUIDE_TITLE_MAX } from "./guideLimits";

// The Guide (spec/23): sections down the left, each with its entries in order. Every signed-in
// manager reads it (S23.4); the admin alone changes it, an entry's text and adding, removing and
// reordering entries and sections (S23.13), and a change shows at once, with no drafts (S23.15).

/** Why a change to the Guide was refused, as the admin is told it. */
export const guideRefusals = {
  title: { blank: "Give it a title.", tooLong: `A title is up to ${GUIDE_TITLE_MAX} characters.` },
  text: { blank: "Write the entry first.", tooLong: `An entry is up to ${GUIDE_TEXT_MAX} characters.` },
  noSection: "That section has been removed.",
  noEntry: "That entry has been removed.",
  sectionsFull: `The Guide holds up to ${GUIDE_SECTIONS_MOST} sections.`,
  sectionFull: `A section holds up to ${GUIDE_ENTRIES_MOST} entries.`,
  /** S23.14: a section goes only once it is empty. */
  notEmpty: "Move or remove this section's entries first.",
  noPlace: "That place isn't in the list.",
} as const;

const guideEntry = v.object({ entryId: v.id("guideEntries"), title: v.string(), text: v.string() });
const guideSection = v.object({ sectionId: v.id("guideSections"), title: v.string(), entries: v.array(guideEntry) });

/** The Guide's sections, in order. */
function sectionsOf(ctx: QueryCtx) {
  return takeAllOrThrow(ctx.db.query("guideSections").withIndex("by_order"), GUIDE_SECTIONS_MOST, guideRefusals.sectionsFull);
}

/** A section's entries, in order. */
function entriesOf(ctx: QueryCtx, sectionId: Id<"guideSections">) {
  return takeAllOrThrow(
    ctx.db.query("guideEntries").withIndex("by_section_and_order", (q) => q.eq("sectionId", sectionId)),
    GUIDE_ENTRIES_MOST,
    guideRefusals.sectionFull,
  );
}

/** The whole Guide, sections and their entries in order, for anyone signed in (S23.4). */
export const list = query({
  args: {},
  returns: v.array(guideSection),
  handler: async (ctx) => {
    await callerEmail(ctx);
    return Promise.all(
      (await sectionsOf(ctx)).map(async (section) => ({
        sectionId: section._id,
        title: section.title,
        entries: (await entriesOf(ctx, section._id)).map((entry) => ({ entryId: entry._id, title: entry.title, text: entry.text })),
      })),
    );
  },
});

/** Numbers `rows` 0, 1, 2 in the order given, writing only those whose place changed. */
async function renumber(ctx: MutationCtx, rows: Doc<"guideSections">[] | Doc<"guideEntries">[]) {
  for (const [order, row] of rows.entries()) {
    if (row.order === order) continue;
    if ("sectionId" in row) await ctx.db.patch("guideEntries", row._id, { order });
    else await ctx.db.patch("guideSections", row._id, { order });
  }
}

/** `rows` with `row` put at `place`, refused when there is no such place. */
function placed<Row>(rows: Row[], row: Row, place: number): Row[] {
  if (!Number.isInteger(place) || place < 0 || place > rows.length) refuse(guideRefusals.noPlace);
  return [...rows.slice(0, place), row, ...rows.slice(place)];
}

/** The section, if the caller is the admin and it is still there. */
async function adminsSection(ctx: MutationCtx, sectionId: Id<"guideSections">) {
  await adminOf(ctx);
  return (await ctx.db.get("guideSections", sectionId)) ?? refuse(guideRefusals.noSection);
}

/** The entry, if the caller is the admin and it is still there. */
async function adminsEntry(ctx: MutationCtx, entryId: Id<"guideEntries">) {
  await adminOf(ctx);
  return (await ctx.db.get("guideEntries", entryId)) ?? refuse(guideRefusals.noEntry);
}

/** The admin adds a section at the foot of the list. */
export const addSection = mutation({
  args: { title: v.string() },
  returns: v.id("guideSections"),
  handler: async (ctx, args) => {
    await adminOf(ctx);
    const title = typedName(args.title, GUIDE_TITLE_MAX, guideRefusals.title);
    const sections = await sectionsOf(ctx);
    if (sections.length >= GUIDE_SECTIONS_MOST) refuse(guideRefusals.sectionsFull);
    return ctx.db.insert("guideSections", { title, order: sections.length });
  },
});

/** The admin renames a section. */
export const renameSection = mutation({
  args: { sectionId: v.id("guideSections"), title: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await adminsSection(ctx, args.sectionId);
    await ctx.db.patch("guideSections", args.sectionId, { title: typedName(args.title, GUIDE_TITLE_MAX, guideRefusals.title) });
    return null;
  },
});

/** The admin removes a section, only once it holds no entries (S23.14). */
export const removeSection = mutation({
  args: { sectionId: v.id("guideSections") },
  returns: v.null(),
  handler: async (ctx, { sectionId }) => {
    await adminsSection(ctx, sectionId);
    if ((await entriesOf(ctx, sectionId)).length > 0) refuse(guideRefusals.notEmpty);
    await ctx.db.delete("guideSections", sectionId);
    await renumber(ctx, await sectionsOf(ctx));
    return null;
  },
});

/** The admin moves a section to `place` down the left, 0 first. */
export const moveSection = mutation({
  args: { sectionId: v.id("guideSections"), place: v.number() },
  returns: v.null(),
  handler: async (ctx, { sectionId, place }) => {
    const section = await adminsSection(ctx, sectionId);
    const others = (await sectionsOf(ctx)).filter((row) => row._id !== sectionId);
    await renumber(ctx, placed(others, section, place));
    return null;
  },
});

/** The admin adds an entry at the foot of a section. */
export const addEntry = mutation({
  args: { sectionId: v.id("guideSections"), title: v.string(), text: v.string() },
  returns: v.id("guideEntries"),
  handler: async (ctx, args) => {
    await adminsSection(ctx, args.sectionId);
    const title = typedName(args.title, GUIDE_TITLE_MAX, guideRefusals.title);
    const text = typedText(args.text, GUIDE_TEXT_MAX, guideRefusals.text);
    const entries = await entriesOf(ctx, args.sectionId);
    if (entries.length >= GUIDE_ENTRIES_MOST) refuse(guideRefusals.sectionFull);
    return ctx.db.insert("guideEntries", { sectionId: args.sectionId, title, text, order: entries.length });
  },
});

/** The admin rewrites an entry's title and text; managers read it at once (S23.15). */
export const editEntry = mutation({
  args: { entryId: v.id("guideEntries"), title: v.string(), text: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await adminsEntry(ctx, args.entryId);
    await ctx.db.patch("guideEntries", args.entryId, {
      title: typedName(args.title, GUIDE_TITLE_MAX, guideRefusals.title),
      text: typedText(args.text, GUIDE_TEXT_MAX, guideRefusals.text),
    });
    return null;
  },
});

/** The admin removes an entry for good. */
export const removeEntry = mutation({
  args: { entryId: v.id("guideEntries") },
  returns: v.null(),
  handler: async (ctx, { entryId }) => {
    const entry = await adminsEntry(ctx, entryId);
    await ctx.db.delete("guideEntries", entryId);
    await renumber(ctx, await entriesOf(ctx, entry.sectionId));
    return null;
  },
});

/** The admin moves an entry to `place` in a section, 0 first: its own, or another. */
export const moveEntry = mutation({
  args: { entryId: v.id("guideEntries"), sectionId: v.id("guideSections"), place: v.number() },
  returns: v.null(),
  handler: async (ctx, { entryId, sectionId, place }) => {
    const entry = await adminsEntry(ctx, entryId);
    if ((await ctx.db.get("guideSections", sectionId)) === null) refuse(guideRefusals.noSection);
    const others = (await entriesOf(ctx, sectionId)).filter((row) => row._id !== entryId);
    if (entry.sectionId !== sectionId) {
      if (others.length >= GUIDE_ENTRIES_MOST) refuse(guideRefusals.sectionFull);
      await ctx.db.patch("guideEntries", entryId, { sectionId });
    }
    await renumber(ctx, placed(others, entry, place));
    // The section it left closes up.
    if (entry.sectionId !== sectionId) await renumber(ctx, await entriesOf(ctx, entry.sectionId));
    return null;
  },
});
