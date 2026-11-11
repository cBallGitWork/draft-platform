// The positions sync on its timer (#1194; Craig, 5 Nov 2026): daily at 06:00 UK time, and a run
// with matches still to read carries on straight away.

import { expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { CRON_TRIGGER, PING_URL_ENV } from "../../../convex/heartbeats/heartbeat";
import { MATCHES_PER_RUN } from "../../../convex/positions/positionsSync";
import { FIRST_COPY, heldStarts, pastTheCap, syncPositionsWith } from "../../support/convex/positionsSync.harness";
import { PLAYER, recordedPositions, SHEET } from "../../support/recorded/positions.payloads";
import { freshConvex, pendingJobs, silenceConsoleError } from "../../support/convex/test.harness";

const RUN = internal.positions.positionsSync.run;
const BEAT = internal.heartbeats.heartbeat.beat;

// A new deployment's first 300 matches are read the same morning, not over three days.
test("the cron's run with matches left starts the next at once, and the next reads the rest", async () => {
  vi.useFakeTimers();
  const t = freshConvex();

  const { outcome } = await syncPositionsWith(t, pastTheCap(), undefined, undefined, CRON_TRIGGER);

  expect(outcome).toMatchObject({ ok: true, matchesLeft: 2 });
  expect((await pendingJobs(t, RUN)).map((job) => job.args)).toEqual([[{ trigger: CRON_TRIGGER }]]);
  await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(0));
  const [latest] = await t.query(internal.positions.positionsSync.latest, {});
  expect(latest).toMatchObject({ trigger: CRON_TRIGGER, outcome: { ok: true, matchesRead: 2, matchesLeft: 0 } });
  expect((await heldStarts(t, PLAYER.thiaw)).map((start) => start.fixtureCode)).toContain(FIRST_COPY);
}, 30_000);

test("the cron's run that could file none of the matches it read waits for the next day, as the next would read the same", async () => {
  vi.useFakeTimers();
  const t = freshConvex();
  const logged = silenceConsoleError();
  const refused = recordedPositions().sheets.find((sheet) => sheet.id === SHEET.cityCoventryRefused)!;

  const { outcome } = await syncPositionsWith(t, pastTheCap(refused), undefined, undefined, CRON_TRIGGER);

  expect(outcome).toMatchObject({ ok: true, matchesRead: MATCHES_PER_RUN, matchesLeft: 2 });
  expect(logged).toHaveBeenCalled();
  expect(await pendingJobs(t, RUN)).toEqual([]);
}, 30_000);

// The daily sync's heartbeat (#1554): pinged once the cron's last run is done, so a cron that
// stops firing is a missed beat in Healthchecks.
test("only the cron's last run schedules the heartbeat, and a run by hand none", async () => {
  vi.useFakeTimers();
  vi.stubEnv(PING_URL_ENV, "https://hc-ping.com/ping-key");
  const t = freshConvex();

  await syncPositionsWith(t, pastTheCap(), undefined, undefined, CRON_TRIGGER);
  expect(await pendingJobs(t, BEAT)).toEqual([]);
  await syncPositionsWith(t, pastTheCap(), undefined, undefined, CRON_TRIGGER);
  expect((await pendingJobs(t, BEAT)).map((job) => job.args)).toEqual([[{ check: "positionsSync" }]]);

  const byHand = freshConvex();
  await syncPositionsWith(byHand, pastTheCap());
  expect(await pendingJobs(byHand, BEAT)).toEqual([]);
}, 30_000);

// 06:00 UK time whatever the clocks: 06:00 UTC in winter, 05:00 UTC in summer.
test.each([
  ["a winter 06:00 UTC", 1, "2026-11-10T06:00:00Z"],
  ["a winter 05:00 UTC", 0, "2026-11-10T05:00:00Z"],
  ["a summer 05:00 UTC", 1, "2027-07-10T05:00:00Z"],
  ["a summer 06:00 UTC", 0, "2027-07-10T06:00:00Z"],
])("the daily cron at %s starts %i runs", async (_, runs, at) => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.parse(at));
  const t = freshConvex();

  await t.mutation(internal.positions.positionsSync.daily, {});

  const pending = await pendingJobs(t, RUN);
  expect(pending.map((job) => job.args)).toEqual(Array.from({ length: runs }, () => [{ trigger: CRON_TRIGGER }]));
});
