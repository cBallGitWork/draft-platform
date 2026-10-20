import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { statValue } from "./matchRecords";
import {
  FULL_TIME_READ,
  heldMatch,
  syncAt,
  withBelloumiGoalRemoved,
  withFplBlocksEmpty,
  withHullEverton,
  withPlRead,
  withPlReadEmpty,
} from "./matchStats.harness";
import { FULL_STATS, recordedGw6, type Gw6Payloads } from "./recorded/gw6.payloads";
import { HOUR_MS, MINUTE_MS } from "./time";

// What a match read again before the lock writes over what it held.

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test("a re-read of the same match writes nothing new, and keeps when it reached full time and completed", async () => {
  const t = await withHullEverton();
  await syncAt(t, FULL_TIME_READ, recordedGw6());

  const run = await syncAt(t, FULL_TIME_READ + 10 * MINUTE_MS, recordedGw6());

  expect(run.outcome).toMatchObject({ matches: [{ state: "complete", inserted: 0, updated: 0 }] });
  expect((await heldMatch(t)).status).toMatchObject({ fullTimeAt: FULL_TIME_READ, completeAt: FULL_TIME_READ });
});

test("a correction inside the window updates the record, and a stat taken away goes back to 0", async () => {
  const t = await withHullEverton();
  await syncAt(t, FULL_TIME_READ, recordedGw6());

  const run = await syncAt(t, FULL_TIME_READ + HOUR_MS / 2, withBelloumiGoalRemoved(recordedGw6()));

  expect(run.outcome).toMatchObject({ matches: [{ state: "complete", inserted: 0, updated: 1 }] });
  const belloumi = (await heldMatch(t)).records.get(FULL_STATS.belloumi.code)!;
  expect(statValue(belloumi, "goals_scored")).toBe(0);
  expect(belloumi.stats).not.toHaveProperty("goals_openplay");
  expect(statValue(belloumi, "goals_openplay")).toBe(0);
});

/** Gameweek 6 with Coyle not yet counted by the Premier League, so the match stays provisional
 *  across both reads and only the one man's record can change. */
const provisional = () => withPlReadEmpty(recordedGw6(), FULL_STATS.coyle.pl);
const { mcBurnie, phillips } = FULL_STATS;

test.each([
  [
    "whether he played",
    phillips.code,
    // FPL has not sent the unused keeper; then Opta has him on for 5 minutes, which only says he played.
    (payloads: Gw6Payloads) => withFplBlocksEmpty(payloads, phillips.code),
    (payloads: Gw6Payloads) => withPlRead(withFplBlocksEmpty(payloads, phillips.code), phillips.pl, { formation_place: 0, mins_played: 5 }),
    { played: true },
  ],
  [
    "whether the Premier League has sent him",
    mcBurnie.code,
    // Opta's first word on the striker is his minutes, which FPL's count already holds.
    (payloads: Gw6Payloads) => withPlReadEmpty(payloads, mcBurnie.pl),
    (payloads: Gw6Payloads) => withPlRead(payloads, mcBurnie.pl, { mins_played: 90 }),
    { arrived: { fpl: true, pl: true } },
  ],
] as const)("a record whose only change is %s is written", async (_what, playerCode, before, after, changed) => {
  const t = await withHullEverton();
  await syncAt(t, FULL_TIME_READ, before(provisional()));
  const held = (await heldMatch(t)).records.get(playerCode)!;

  const run = await syncAt(t, FULL_TIME_READ + 10 * MINUTE_MS, after(provisional()));

  expect(run.outcome).toMatchObject({ matches: [{ state: "provisional", inserted: 0, updated: 1 }] });
  const row = (await heldMatch(t)).records.get(playerCode)!;
  expect(row.stats).toEqual(held.stats);
  expect(held).not.toMatchObject(changed);
  expect(row).toMatchObject(changed);
});
