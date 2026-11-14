import { beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import { knownOnJoining } from "../../../convex/positions/positionWarnings";
import { MINUTE_MS } from "../../../convex/shared/time";
import { RUN_TRIES } from "../../../convex/waivers/waiverRunRetries";
import { actingAs, ADMIN, BOB, CAT } from "../../support/convex/leagues.harness";
import { holdPlayers } from "../../support/convex/lineupSquad.harness";
import { fakeResend } from "../../support/convex/signIn.harness";
import { everyJobRuns, silenceConsoleError } from "../../support/convex/test.harness";
import { PALMER, RICE, SAKA, waiverLeague, type WaiverLeague } from "../../support/convex/waivers.harness";

// The joining step as it is, but a test can make it throw part-way through a run.
vi.mock("../../../convex/positions/positionWarnings", async (actual) => {
  const warnings = await actual<typeof import("../../../convex/positions/positionWarnings")>();
  return { ...warnings, knownOnJoining: vi.fn(warnings.knownOnJoining) };
});

// A waiver run that fails (#2193, S08.23): every claim or none, tried again at once, once per run
// time, and still failing after its retries the admin is emailed and managers see "Waivers delayed".

const [EZE, KUDUS, WISSA, LATE] = [9004, 9005, 9006, 9007];
/** Six claims, Bob's three and Cat's three, each of which wins. */
const CLAIMS = [
  [BOB, SAKA],
  [BOB, PALMER],
  [BOB, RICE],
  [CAT, EZE],
  [CAT, KUDUS],
  [CAT, WISSA],
] as const;
const CRASH = "the run crashed";

let w: WaiverLeague;
let at: number;
beforeEach(async () => {
  w = await waiverLeague();
  await holdPlayers(w.t, [EZE, KUDUS, WISSA]);
  await w.onWaivers(CLAIMS.map(([, code]) => code));
  for (const [email, code] of CLAIMS) await w.claim(email, code);
  vi.setSystemTime(Date.now() + MINUTE_MS);
  at = Date.now();
});

/** The joining step throws at the run's fourth claim, once or every time. */
function crashAtTheFourthClaim({ always }: { always: boolean }) {
  const joining = vi.mocked(knownOnJoining);
  const actual = joining.getMockImplementation()!;
  let calls = 0;
  joining.mockImplementation(async (...args) => {
    calls += 1;
    if (calls === 4 || (always && calls % 4 === 0)) throw new Error(CRASH);
    return actual(...args);
  });
  return () => joining.mockImplementation(actual);
}

const runWithRetries = () => w.t.action(internal.waivers.waiverRunRetries.runWithRetries, { leagueId: w.leagueId, at, backFrom: null });
const claimedBy = async () => [...(await w.squadCodes(w.bobsTeam)), ...(await w.squadCodes(w.catsTeam))];
const delayed = async () => (await (await actingAs(w.t, BOB)).query(api.waivers.waiverOrder.ofLeague, { leagueId: w.leagueId, now: Date.now() })).delayed;

test("a run crashing after 3 of 6 claims leaves all 6 undone (S08.23)", async () => {
  silenceConsoleError();
  const restore = crashAtTheFourthClaim({ always: false });
  await expect(w.t.mutation(internal.waivers.waiverRun.run, { leagueId: w.leagueId, at })).rejects.toThrow(CRASH);
  restore();

  expect(await claimedBy()).toEqual([]);
  expect(await w.pending(BOB)).toHaveLength(3);
  expect(await w.pending(CAT)).toHaveLength(3);
  for (const [, code] of CLAIMS) expect(await w.stateOf(code)).toMatchObject({ kind: "onWaivers" });
});

test("a crashed run is tried again at once and makes every claim; a second run for the same time does nothing (S08.23)", async () => {
  silenceConsoleError();
  const sent = fakeResend();
  const restore = crashAtTheFourthClaim({ always: false });
  await runWithRetries();
  restore();

  expect((await claimedBy()).toSorted()).toEqual(CLAIMS.map(([, code]) => code).toSorted());
  expect(await delayed()).toBe(false);

  // A player who comes onto waivers after, and a claim for him, wait for the next run time.
  await w.onWaivers([LATE], at);
  await holdPlayers(w.t, [LATE]);
  await w.claim(CAT, LATE);
  await runWithRetries();
  expect(await w.stateOf(LATE)).toMatchObject({ kind: "onWaivers" });
  await everyJobRuns(w.t);
  expect(sent).toEqual([]);
});

test(`still failing after ${RUN_TRIES} tries, the admin is emailed once and managers see "Waivers delayed" until it runs (S08.23)`, async () => {
  silenceConsoleError();
  const sent = fakeResend();
  const restore = crashAtTheFourthClaim({ always: true });
  await runWithRetries();
  await everyJobRuns(w.t);

  expect(await claimedBy()).toEqual([]);
  expect(await delayed()).toBe(true);
  expect(sent.map(({ to, subject }) => ({ to, subject }))).toEqual([{ to: ADMIN, subject: expect.stringContaining("waivers delayed") }]);

  // Tried again by the cron, still failing: no second email.
  await runWithRetries();
  await everyJobRuns(w.t);
  expect(sent).toHaveLength(1);

  restore();
  await runWithRetries();
  expect(await claimedBy()).toHaveLength(CLAIMS.length);
  expect(await delayed()).toBe(false);
});
