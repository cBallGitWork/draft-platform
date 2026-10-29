import { expect, test } from "vitest";
import { readOnce } from "../../../convex/shared/readOnce";

// Every query that reads the same row for many players (a club, a player, a match's season) reads
// it through readOnce, so each key is read once.

const KEY = 7;
const OTHER_KEY = 8;
const FAILURE = "the read failed";

const counting = () => {
  const reads: number[] = [];
  return {
    reads,
    read: async (key: number) => {
      reads.push(key);
      return key * 10;
    },
  };
};

test("the same key asked for at once is read once, and every caller gets its value", async () => {
  const { reads, read } = counting();
  const once = readOnce(read);
  expect(await Promise.all([once(KEY), once(KEY), once(KEY)])).toEqual([KEY * 10, KEY * 10, KEY * 10]);
  expect(reads).toEqual([KEY]);
});

test("the same key asked for later is not read again", async () => {
  const { reads, read } = counting();
  const once = readOnce(read);
  await once(KEY);
  expect(await once(KEY)).toBe(KEY * 10);
  expect(reads).toEqual([KEY]);
});

test("each key is read on its own", async () => {
  const { reads, read } = counting();
  const once = readOnce(read);
  expect(await Promise.all([once(KEY), once(OTHER_KEY)])).toEqual([KEY * 10, OTHER_KEY * 10]);
  expect(reads).toEqual([KEY, OTHER_KEY]);
});

test("a read that rejects rejects every caller of that key, and is not tried again", async () => {
  let tries = 0;
  const once = readOnce(async (_key: number) => {
    tries += 1;
    throw new Error(FAILURE);
  });
  const callers = [once(KEY), once(KEY)];
  for (const caller of callers) await expect(caller).rejects.toThrow(FAILURE);
  await expect(once(KEY)).rejects.toThrow(FAILURE);
  expect(tries).toBe(1);
});
