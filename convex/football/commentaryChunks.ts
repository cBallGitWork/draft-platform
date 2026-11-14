import type { Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { commentaryLine } from "../schema";
import { takeAllOrThrow } from "../shared/cappedRead";

// A match's commentary lines in chunks (#2004): the database I/O cut 15 of #1995. A match stored
// its lines whole on one row, so each read that added a line rewrote every line the match had
// had. The lines are now cut into chunks counted from the oldest, so a new line changes only the
// newest chunk; a reworded or dropped line rewrites only its chunk and those after it, which
// shift. matchCommentary.ts stores and reads through here.

type StoredLine = Infer<typeof commentaryLine>;

/** The most lines a chunk holds. About 2 to 4 KB of lines, so a read adding a line writes that
 *  much rather than the match's whole stream (often 150 lines or more); Claude's choice. */
export const COMMENTARY_LINES_A_CHUNK = 20;

/** The most chunks one match holds: 2,000 lines, ten times a long match's stream. Past it the
 *  read throws rather than leave lines out unsaid (cappedRead.ts). */
export const COMMENTARY_CHUNKS_MOST = 100;

/** The lines, newest first, cut into chunks from the oldest: chunk 0 holds the match's first
 *  `COMMENTARY_LINES_A_CHUNK` lines, the last chunk its newest, each chunk newest first. */
export function chunksOf(lines: readonly StoredLine[]): StoredLine[][] {
  const oldestFirst = lines.toReversed();
  const chunks: StoredLine[][] = [];
  for (let start = 0; start < oldestFirst.length; start += COMMENTARY_LINES_A_CHUNK) {
    chunks.push(oldestFirst.slice(start, start + COMMENTARY_LINES_A_CHUNK).toReversed());
  }
  return chunks;
}

/** The match's lines, newest first, from its chunks in the order held, oldest first. */
export function linesOf(chunks: readonly Pick<Doc<"commentaryChunks">, "lines">[]): StoredLine[] {
  return chunks.toReversed().flatMap((chunk) => chunk.lines);
}

/** What storing `lines` over the `held` chunks writes: only the chunks whose lines change. */
export interface ChunkWrites {
  insert: { chunk: number; lines: StoredLine[] }[];
  patch: { id: Id<"commentaryChunks">; lines: StoredLine[] }[];
  remove: Id<"commentaryChunks">[];
}

/** The writes that turn the `held` chunks into `lines`, newest first: a chunk whose lines are
 *  unchanged is left alone, a new one inserted, and one the lines no longer reach deleted. */
export function chunkWrites(held: readonly Doc<"commentaryChunks">[], lines: readonly StoredLine[]): ChunkWrites {
  const heldByChunk = new Map(held.map((row) => [row.chunk, row]));
  const next = chunksOf(lines);
  const writes: ChunkWrites = { insert: [], patch: [], remove: [] };
  next.forEach((chunkLines, chunk) => {
    const row = heldByChunk.get(chunk);
    if (row === undefined) writes.insert.push({ chunk, lines: chunkLines });
    else if (JSON.stringify(row.lines) !== JSON.stringify(chunkLines)) writes.patch.push({ id: row._id, lines: chunkLines });
  });
  writes.remove = held.filter((row) => row.chunk >= next.length).map((row) => row._id);
  return writes;
}

/** The match's chunks, oldest first. */
export function heldChunks(ctx: QueryCtx, fixtureCode: number): Promise<Doc<"commentaryChunks">[]> {
  return takeAllOrThrow(
    ctx.db.query("commentaryChunks").withIndex("by_fixtureCode_and_chunk", (q) => q.eq("fixtureCode", fixtureCode)),
    COMMENTARY_CHUNKS_MOST,
    `Match ${fixtureCode} holds more than ${COMMENTARY_CHUNKS_MOST} chunks of commentary`,
  );
}

/** Stores `lines` as the match's, over its `held` chunks, writing only what changes. */
export async function writeChunks(ctx: MutationCtx, fixtureCode: number, held: readonly Doc<"commentaryChunks">[], lines: readonly StoredLine[]): Promise<void> {
  const writes = chunkWrites(held, lines);
  for (const { chunk, lines: chunkLines } of writes.insert) await ctx.db.insert("commentaryChunks", { fixtureCode, chunk, lines: chunkLines });
  for (const { id, lines: chunkLines } of writes.patch) await ctx.db.patch("commentaryChunks", id, { lines: chunkLines });
  for (const id of writes.remove) await ctx.db.delete("commentaryChunks", id);
}
