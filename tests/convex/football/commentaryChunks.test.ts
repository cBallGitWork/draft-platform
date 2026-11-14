import { expect, test } from "vitest";
import { internal } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { chunksOf, chunkWrites, COMMENTARY_LINES_A_CHUNK, linesOf } from "../../../convex/football/commentaryChunks";
import { heldOf } from "../../../convex/football/matchCommentary";
import { storedLine } from "../../support/convex/matchPage.harness";
import { freshConvex } from "../../support/convex/test.harness";

// A match's commentary in chunks (#2004, the database I/O cut 15 of #1995): a read that adds a
// line writes only the newest chunk, where one row of every line was rewritten whole, and what a
// screen reads back is the same lines (S10.4). The store's own rules are in matchCommentary.test.ts.

const CHUNKED_MATCH = 1;

/** `count` lines, newest first, the newest numbered `count`. */
const linesUpTo = (count: number, wording = (n: number) => `${n}' line`) =>
  Array.from({ length: count }, (_, at) => storedLine(count - at, wording(count - at), count - at, "attempt saved"));

/** The chunks `lines` are stored as, as held rows. */
const heldRows = (lines: ReturnType<typeof linesUpTo>): Doc<"commentaryChunks">[] =>
  chunksOf(lines).map((chunkLines, chunk) => ({
    _id: `chunk${chunk}` as Id<"commentaryChunks">,
    _creationTime: 0,
    fixtureCode: CHUNKED_MATCH,
    chunk,
    lines: chunkLines,
  }));

const store = (t: ReturnType<typeof freshConvex>, lines: ReturnType<typeof linesUpTo> | null, delayed: string | null = null) =>
  t.mutation(internal.football.matchCommentary.store, { fixtureCode: CHUNKED_MATCH, readAt: 0, lines, delayed });

test("chunks count from the oldest line, so reading them back gives the lines newest first", () => {
  const lines = linesUpTo(2 * COMMENTARY_LINES_A_CHUNK + 5);

  const chunks = chunksOf(lines);

  expect(chunks.map((chunk) => chunk.length)).toEqual([COMMENTARY_LINES_A_CHUNK, COMMENTARY_LINES_A_CHUNK, 5]);
  expect(chunks[0]?.at(-1)?.text).toBe("1' line");
  expect(linesOf(heldRows(lines))).toEqual(lines);
});

test("a read adding a line writes one chunk, not every line the match has had", () => {
  const held = linesUpTo(3 * COMMENTARY_LINES_A_CHUNK - 1);

  const writes = chunkWrites(heldRows(held), linesUpTo(3 * COMMENTARY_LINES_A_CHUNK));

  // One row of 60 lines was rewritten whole; now one chunk of 20 is.
  expect(writes).toEqual({ insert: [], patch: [{ id: "chunk2", lines: linesUpTo(3 * COMMENTARY_LINES_A_CHUNK).slice(0, COMMENTARY_LINES_A_CHUNK) }], remove: [] });
});

test("a line past a full chunk starts a new one, and the full chunks are not written", () => {
  const writes = chunkWrites(heldRows(linesUpTo(2 * COMMENTARY_LINES_A_CHUNK)), linesUpTo(2 * COMMENTARY_LINES_A_CHUNK + 1));

  expect(writes).toEqual({ insert: [{ chunk: 2, lines: linesUpTo(2 * COMMENTARY_LINES_A_CHUNK + 1).slice(0, 1) }], patch: [], remove: [] });
});

test("the same lines write nothing; a reworded line writes only its chunk; fewer lines delete the chunks they no longer reach", () => {
  const held = heldRows(linesUpTo(2 * COMMENTARY_LINES_A_CHUNK + 5));

  expect(chunkWrites(held, linesUpTo(2 * COMMENTARY_LINES_A_CHUNK + 5))).toEqual({ insert: [], patch: [], remove: [] });
  const reworded = chunkWrites(held, linesUpTo(2 * COMMENTARY_LINES_A_CHUNK + 5, (n) => (n === 3 ? "3' reworded" : `${n}' line`)));
  expect(reworded.patch.map(({ id }) => id)).toEqual(["chunk0"]);
  expect(chunkWrites(held, linesUpTo(COMMENTARY_LINES_A_CHUNK)).remove).toEqual(["chunk1", "chunk2"]);
});

test("the store keeps the match's lines in chunks and its delay on its row, and a screen reads them back whole", async () => {
  const t = freshConvex();
  const lines = linesUpTo(2 * COMMENTARY_LINES_A_CHUNK + 1);

  await store(t, lines);
  await store(t, lines, "the stream answered 503");

  expect(await t.run((ctx) => heldOf(ctx, CHUNKED_MATCH))).toMatchObject({ lines, delayed: { reason: "the stream answered 503" } });
  expect(await t.run((ctx) => ctx.db.query("commentaryChunks").collect())).toHaveLength(3);
  expect(await t.run((ctx) => ctx.db.query("matchCommentary").unique())).not.toHaveProperty("lines");
});

test("a match stored whole before chunks reads the same, and moves to chunks on its next store", async () => {
  const t = freshConvex();
  const lines = linesUpTo(COMMENTARY_LINES_A_CHUNK + 1);
  await t.run((ctx) => ctx.db.insert("matchCommentary", { fixtureCode: CHUNKED_MATCH, lines, delayed: null }));

  expect(await t.run((ctx) => heldOf(ctx, CHUNKED_MATCH))).toEqual({ lines, delayed: null });

  await store(t, null);

  expect(await t.run((ctx) => heldOf(ctx, CHUNKED_MATCH))).toEqual({ lines, delayed: null });
  expect(await t.run((ctx) => ctx.db.query("commentaryChunks").collect())).toHaveLength(2);
  expect(await t.run((ctx) => ctx.db.query("matchCommentary").unique())).not.toHaveProperty("lines");
});

test("the one-off move puts every finished match's lines in chunks, and running it again does nothing", async () => {
  const t = freshConvex();
  const lines = linesUpTo(COMMENTARY_LINES_A_CHUNK + 1);
  await t.run((ctx) => ctx.db.insert("matchCommentary", { fixtureCode: CHUNKED_MATCH, lines, delayed: null }));

  expect(await t.mutation(internal.football.commentaryChunksMove.moveToChunks, {})).toBe(1);
  expect(await t.mutation(internal.football.commentaryChunksMove.moveToChunks, {})).toBe(0);

  expect(await t.run((ctx) => heldOf(ctx, CHUNKED_MATCH))).toEqual({ lines, delayed: null });
  expect(await t.run((ctx) => ctx.db.query("commentaryChunks").collect())).toHaveLength(2);
});
