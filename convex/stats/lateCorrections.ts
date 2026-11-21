import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { isWhole, statChanges, type PlayerMatchRecord, type StatChange } from "./matchRecords";

// A locked match's late corrections: what a feed sends for a match after its stats lock, kept as
// rows for the admin's feeds page and never written over the locked record (matchStats.ts).

/** A row for each whole record that differs from the locked one, unless the last row for him
 *  already says the same. A record not whole after the lock is a feed's gap, not a correction. */
export async function recordLateCorrections(
  ctx: MutationCtx,
  records: PlayerMatchRecord[],
  held: Map<number, Doc<"playerMatchStats">>,
  seenAt: number,
): Promise<number> {
  let recorded = 0;
  for (const record of records) {
    if (!isWhole(record)) continue;
    const changes = statChanges(held.get(record.playerCode)?.stats ?? {}, record.stats);
    if (changes.length === 0) continue;
    const { fixtureCode, playerCode } = record;
    const last = await ctx.db
      .query("lateStatCorrections")
      .withIndex("by_fixtureCode_and_playerCode", (q) => q.eq("fixtureCode", fixtureCode).eq("playerCode", playerCode))
      .order("desc")
      .first();
    if (last !== null && sameChanges(last.changes, changes)) continue;
    await ctx.db.insert("lateStatCorrections", { fixtureCode, playerCode, seenAt, changes });
    recorded += 1;
  }
  return recorded;
}

/** The same stats changed to the same values. Field by field: a stored object's keys come back sorted. */
function sameChanges(held: StatChange[], sent: StatChange[]): boolean {
  return (
    held.length === sent.length &&
    held.every((change, index) => {
      const other = sent[index];
      return change.stat === other.stat && change.locked === other.locked && change.sent === other.sent;
    })
  );
}
