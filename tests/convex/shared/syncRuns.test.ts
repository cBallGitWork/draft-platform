import { expect, test } from "vitest";
import { BATCH_SIZE, inBatches } from "../../../convex/shared/syncRuns";

// The batched writes' slicing (#1696): every row sent once, in order, no slice past BATCH_SIZE.

test("rows are sliced in order into batches of BATCH_SIZE, the last holding what is left", () => {
  const rows = Array.from({ length: 2 * BATCH_SIZE + 3 }, (_, at) => at);
  const batches = [...inBatches(rows)];
  expect(batches.map((batch) => batch.length)).toEqual([BATCH_SIZE, BATCH_SIZE, 3]);
  expect(batches.flat()).toEqual(rows);
});

test("no rows send no batch", () => {
  expect([...inBatches([])]).toEqual([]);
});
