import { beforeEach, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import { refusals } from "../../../convex/shared/leagueAccess";
import { actingAs, ANN, OUTSIDER } from "../../support/convex/leagues.harness";
import { NEXT, waiverLeague, type WaiverLeague } from "../../support/convex/waivers.harness";
import { expectRefused } from "../../support/convex/test.harness";

// Home's Calendar tab's month of league events (spec/12 S12.24): gameweeks' first kickoffs and
// deadlines, the draft and the waiver runs (Wednesday and Thursday at 18:00 UK time by default).
// The league is made, and its draft starts, on Tuesday 20 October 2026 at 09:00 UTC; gameweek NEXT
// kicks off 6 days on, each other a week apart, with the league's deadline 15 minutes before.

const OCTOBER = { year: 2026, month: 10 };
/** On `day` of October 2026 at `hour`:`minute` UTC. */
const october = (day: number, hour: number, minute = 0) => Date.UTC(2026, 9, day, hour, minute);
const gameweekOn = (gameweek: number, day: number) => [
  { kind: "deadline", at: october(day, 8, 45), gameweek },
  { kind: "firstKickoff", at: october(day, 9), gameweek },
];
const run = (day: number) => ({ kind: "waiverRun", at: october(day, day < 25 ? 17 : 18) });

let w: WaiverLeague;
beforeEach(async () => {
  w = await waiverLeague();
});

const monthOf = async (month = OCTOBER, email = ANN) => (await actingAs(w.t, email)).query(api.home.calendar.ofMonth, { leagueId: w.leagueId, ...month });

test("a month lists each gameweek's deadline and first kickoff, the draft and the waiver runs at 18:00 UK time either side of the clocks going back, in time order (S12.24)", async () => {
  expect(await monthOf()).toEqual([
    ...gameweekOn(NEXT - 3, 5),
    ...gameweekOn(NEXT - 2, 12),
    ...gameweekOn(NEXT - 1, 19),
    { kind: "draft", at: october(20, 9) },
    run(21),
    run(22),
    ...gameweekOn(NEXT, 26),
    run(28),
    run(29),
  ]);
});

test("a gameweek the league doesn't play has no deadline or kickoff on its calendar (S12.24)", async () => {
  await w.t.run((ctx) => ctx.db.patch("leagues", w.leagueId, { unusedGameweeks: [NEXT - 2] }));
  const gameweeks = (await monthOf()).flatMap((event) => ("gameweek" in event ? [event.gameweek] : []));
  expect(new Set(gameweeks)).toEqual(new Set([NEXT - 3, NEXT - 1, NEXT]));
});

test("a month before the league was made holds its gameweeks and no waiver runs (S12.24)", async () => {
  expect(await monthOf({ year: 2026, month: 9 })).toEqual([
    { kind: "deadline", at: Date.UTC(2026, 8, 28, 8, 45), gameweek: NEXT - 4 },
    { kind: "firstKickoff", at: Date.UTC(2026, 8, 28, 9), gameweek: NEXT - 4 },
  ]);
});

test("anyone without a part in the league is refused (S12.24)", async () => {
  await expectRefused(monthOf(OCTOBER, OUTSIDER), refusals.notInLeague);
});
