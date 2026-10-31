import { expect, test, vi } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { SYNC_FAILED_LOG } from "../../../convex/football/footballSync";
import { recordGameweekStarts } from "../../../convex/gameweeks/gameweekStarts";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import { HOUR_MS } from "../../../convex/shared/time";
import { adminCreatesLeague } from "../../support/convex/leagues.harness";
import { held, syncWith } from "../../support/convex/footballSync.harness";
import { fakeResend } from "../../support/convex/signIn.harness";
import { silenceConsoleError } from "../../support/convex/test.harness";
import {
  deadlineBefore,
  GAMEWEEK,
  heldOpener,
  markOpenerDropped,
  OPENER,
  openerPostponed,
  passedRows,
  shownDeadline,
  t,
  useDeadlineRecorderDeployment,
} from "../../support/convex/deadlineRecorder.harness";

// The start recording as it is, but a test can make it throw.
vi.mock("../../../convex/gameweeks/gameweekStarts", async (actual) => {
  const starts = await actual<typeof import("../../../convex/gameweeks/gameweekStarts")>();
  return { ...starts, recordGameweekStarts: vi.fn(starts.recordGameweekStarts) };
});

useDeadlineRecorderDeployment();

test("it fails closed: a league whose deadlines can't be worked out fails the sync, logged and filed, and no kickoff moves", async () => {
  const error = silenceConsoleError();
  fakeResend();
  const broken = await adminCreatesLeague(t, 4, "Broken");
  // Only a row written by hand can be unsound: a commissioner's change is checked.
  await t.run(async (ctx) => {
    await ctx.db.insert("leagueRules", { leagueId: broken, fromGameweek: 1, rules: { ...FIRST_RULES, deadline: { minutesBeforeFirstKickoff: -1 } } });
  });
  vi.setSystemTime(deadlineBefore(OPENER) + HOUR_MS);

  const outcome = await syncWith(t, openerPostponed());

  expect(outcome).toMatchObject({ ok: false, error: expect.stringContaining(`League ${broken} (Broken)`) });
  expect(error).toHaveBeenCalledWith(expect.stringContaining(SYNC_FAILED_LOG));
  const kickoffs = await t.run(async (ctx) => (await ctx.db.query("fixtures").collect()).map((fixture) => fixture.kickoff));
  expect(kickoffs).toContain(OPENER);
  expect((await passedRows()).filter((row) => row.gameweek === GAMEWEEK)).toEqual([]);
  expect(await shownDeadline(GAMEWEEK)).toBe(deadlineBefore(OPENER));
});

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
