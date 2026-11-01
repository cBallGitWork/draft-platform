import { beforeEach, describe, expect, test, vi } from "vitest";
import { getFunctionName } from "convex/server";
import { internal } from "../../../convex/_generated/api";
import { waitForTomorrow } from "../../../convex/outbound/emailLimit";
import { COMMISSIONER, LEAGUE_NAME, MANAGERS } from "../../support/convex/leagues.harness";
import { freshConvex, pendingJobs, type TestConvex } from "../../support/convex/test.harness";

// The step every send that finds none of today's emails left shares (#888): invites, approved join
// requests and deletion notices each run themselves again at the start of the next UTC day.

/** Any function the scheduler may run, with its arguments: deletion notices' send, as one of the
 *  three that wait. */
const WAITING = internal.leagues.deletionNotices.send;
const WAITING_ARGS = { leagueName: LEAGUE_NAME, by: COMMISSIONER, emails: MANAGERS };

const AFTERNOON = Date.parse("2026-10-20T15:30:00Z");
const MIDNIGHT = Date.parse("2026-10-20T00:00:00Z");
const NEXT_MIDNIGHT = Date.parse("2026-10-21T00:00:00Z");

let t: TestConvex;
beforeEach(() => {
  vi.useFakeTimers();
  t = freshConvex();
});

/** Waits for tomorrow at `now`; the jobs then waiting, with when each is due. */
async function waitsAt(now: number) {
  vi.setSystemTime(now);
  await t.run((ctx) => waitForTomorrow(ctx.scheduler, WAITING, WAITING_ARGS));
  return (await pendingJobs(t)).map(({ name, args, scheduledTime }) => ({ name, args, scheduledTime }));
}

describe("waitForTomorrow", () => {
  test("runs the function with its arguments at the start of the next UTC day", async () => {
    expect(await waitsAt(AFTERNOON)).toEqual([{ name: getFunctionName(WAITING), args: [WAITING_ARGS], scheduledTime: NEXT_MIDNIGHT }]);
  });

  test("at the very start of a day, waits for the next one, not now", async () => {
    expect((await waitsAt(MIDNIGHT)).map((job) => job.scheduledTime)).toEqual([NEXT_MIDNIGHT]);
  });
});
