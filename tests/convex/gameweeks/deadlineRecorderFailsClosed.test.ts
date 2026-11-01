import { expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { SYNC_FAILED_LOG } from "../../../convex/football/footballSync";
import { recordGameweekStarts } from "../../../convex/gameweeks/gameweekStarts";
import { HOUR_MS } from "../../../convex/shared/time";
import { held, syncWith } from "../../support/convex/footballSync.harness";
import { silenceConsoleError } from "../../support/convex/test.harness";
import {
  deadlineBefore,
  heldOpener,
  markOpenerDropped,
  OPENER,
  openerPostponed,
  t,
  useDeadlineRecorderDeployment,
} from "../../support/convex/deadlineRecorder.harness";

// The start recording as it is, but a test can make it throw.
vi.mock("../../../convex/gameweeks/gameweekStarts", async (actual) => {
  const starts = await actual<typeof import("../../../convex/gameweeks/gameweekStarts")>();
  return { ...starts, recordGameweekStarts: vi.fn(starts.recordGameweekStarts) };
});

// What still fails closed for every league: a throw outside one league's step (deadlineRecorder.ts).
// A league whose own rules are broken is skipped instead (deadlineRecorderSkipsBrokenLeague.test.ts).

useDeadlineRecorderDeployment();

test("it fails closed: a throw while recording a gameweek's start fails the fixtures batch, markDropped and the sync, and no fixture row changes", async () => {
  const error = silenceConsoleError();
  const STARTS_FAILED = "the gameweek starts can't be read";
  // Once for each fixtures write below: an implementation set on the vi.fn would outlast this test.
  const startsThrowOnce = () => vi.mocked(recordGameweekStarts).mockRejectedValueOnce(new Error(STARTS_FAILED));
  vi.setSystemTime(deadlineBefore(OPENER) + HOUR_MS);
  const { fixtures } = await held(t);
  const opener = await heldOpener();

  startsThrowOnce();
  await expect(t.mutation(internal.football.footballSync.upsertFixtures, { rows: [{ ...opener, gameweek: null, kickoff: null }] })).rejects.toThrow(STARTS_FAILED);
  startsThrowOnce();
  await expect(markOpenerDropped()).rejects.toThrow(STARTS_FAILED);
  startsThrowOnce();
  const outcome = await syncWith(t, openerPostponed());

  expect(outcome).toMatchObject({ ok: false, error: expect.stringContaining(STARTS_FAILED) });
  expect(error).toHaveBeenCalledWith(expect.stringContaining(SYNC_FAILED_LOG));
  expect((await held(t)).fixtures).toEqual(fixtures);
});
