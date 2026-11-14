import { expect, it, vi } from "vitest";

// The dev-only chaos switch (#2138): `&chaos=slow` makes a preview save wait, `&chaos=fail` makes it
// fail, read from the address the app opened at, so each case loads src/shared/preview.ts afresh.

/** What a preview save left: any words will do. */
const OUTCOME = "a test outcome";

/** src/shared/preview.ts as the app loads it when it opens at `search`. */
async function previewOpenedAt(search: string) {
  window.history.replaceState(null, "", `/${search}`);
  vi.resetModules();
  return import("../../../src/shared/preview");
}

it("makes a save as it always has with no chaos asked for, or one it doesn't know", async () => {
  for (const search of ["?preview=manager", "?preview=manager&chaos=sideways"]) {
    const { previewDone, previewSaid, previewSaves, previewSays } = await previewOpenedAt(search);
    expect(await previewSays(OUTCOME)()).toBe(previewSaid(OUTCOME));
    expect(await previewDone()).toBeNull();
    expect(await previewSaves(async (code: number) => code)(7)).toBe(7);
  }
});

it("fails every save, and makes none, under chaos=fail", async () => {
  const { chaosFailedWords, previewDone, previewSaves, previewSays } = await previewOpenedAt("?preview=manager&chaos=fail");
  const made = vi.fn(async () => null);

  expect(await previewSays(OUTCOME)()).toBe(chaosFailedWords);
  expect(await previewDone()).toBe(chaosFailedWords);
  expect(await previewSaves(made)()).toBe(chaosFailedWords);
  expect(made).not.toHaveBeenCalled();
});

it("holds every save for CHAOS_SLOW_MS under chaos=slow, then makes it", async () => {
  const { CHAOS_SLOW_MS, previewDone, previewSaid, previewSays } = await previewOpenedAt("?preview=manager&chaos=slow");
  vi.useFakeTimers();
  const says = previewSays(OUTCOME)();
  const done = previewDone();
  const landed = vi.fn();
  void says.then(landed);

  await vi.advanceTimersByTimeAsync(CHAOS_SLOW_MS - 1);
  expect(landed).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(await says).toBe(previewSaid(OUTCOME));
  expect(await done).toBeNull();
  vi.useRealTimers();
});
