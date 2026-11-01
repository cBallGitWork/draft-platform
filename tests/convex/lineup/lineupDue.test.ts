import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { FPL_DEADLINE_RULE } from "../../../convex/gameweeks/deadline";
import { LINEUP_DUE_BEFORE_DEADLINE_MS } from "../../../convex/lineup/lineupLimits";
import { refusals } from "../../../convex/shared/leagueAccess";
import { MINUTE_MS, WEEK_MS } from "../../../convex/shared/time";
import { KICKS_OFF_IN, holdGameweeks } from "../../support/convex/leagueRules.harness";
import { expectRefused } from "../../support/convex/test.harness";
import { ADMIN, COMMISSIONER, MANAGERS, actingAs, addManager, addManagers, adminCreatesLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// Continue's lineup step (#526; spec/12, The frame): "from 24 hours before each gameweek's deadline
// until the deadline, Continue takes him to his Tactics tab, ... until he opens Tactics that
// gameweek. A manager with no team in the league has no lineup step" (Craig, 1 Nov 2026).

const [ANN, BOB] = MANAGERS;
const NEXT = 9;

let t: TestConvex;
let leagueId: Id<"leagues">;
let annsTeam: Id<"teams">;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  await holdGameweeks(t, { next: NEXT });
  leagueId = await adminCreatesLeague(t);
  [annsTeam] = await addManagers(t, leagueId, [ANN]);
});

const isDue = async (email: string) => (await actingAs(t, email)).query(api.lineup.lineupDue.isDue, { leagueId, now: Date.now() });
const opensTactics = async (email: string) => (await actingAs(t, email)).mutation(api.lineup.lineupDue.openedTactics, { leagueId });
/** The next gameweek's league deadline, as holdGameweeks sets its kickoff, under the first rules. */
const nextDeadline = () => Date.now() + KICKS_OFF_IN - FPL_DEADLINE_RULE.minutesBeforeFirstKickoff * MINUTE_MS;
const clockTo = (time: number) => vi.advanceTimersByTime(time - Date.now());
/** The gameweek ANN's team last opened Tactics in, null before any (t.run gives undefined back as null). */
const openedIn = () => t.run(async (ctx) => (await ctx.db.get("teams", annsTeam))!.tacticsOpenedInGameweek ?? null);

describe("whether his lineup is due", () => {
  test("not before the 24 hours ahead of the deadline", async () => {
    const deadline = nextDeadline();
    expect(await isDue(ANN)).toBe(false);
    clockTo(deadline - LINEUP_DUE_BEFORE_DEADLINE_MS - MINUTE_MS);
    expect(await isDue(ANN)).toBe(false);
  });

  test("inside them, until he opens Tactics, whatever his lineup", async () => {
    clockTo(nextDeadline() - LINEUP_DUE_BEFORE_DEADLINE_MS);
    expect(await isDue(ANN)).toBe(true);
  });

  test("not once he has opened Tactics that gameweek, on any device", async () => {
    clockTo(nextDeadline() - LINEUP_DUE_BEFORE_DEADLINE_MS);
    await opensTactics(ANN);
    expect(await isDue(ANN)).toBe(false);
  });

  test("opening Tactics earlier in the same gameweek counts too", async () => {
    const deadline = nextDeadline();
    await opensTactics(ANN);
    clockTo(deadline - LINEUP_DUE_BEFORE_DEADLINE_MS);
    expect(await isDue(ANN)).toBe(false);
  });

  test("not after the deadline, and again inside the next gameweek's 24 hours though he opened it the last", async () => {
    const deadline = nextDeadline();
    clockTo(deadline - MINUTE_MS);
    expect(await isDue(ANN)).toBe(true);
    await opensTactics(ANN);
    clockTo(deadline);
    expect(await isDue(ANN)).toBe(false);
    clockTo(deadline + WEEK_MS - LINEUP_DUE_BEFORE_DEADLINE_MS);
    expect(await isDue(ANN)).toBe(true);
  });

  test("never for someone with no team in the league, or signed out", async () => {
    clockTo(nextDeadline() - LINEUP_DUE_BEFORE_DEADLINE_MS);
    expect(await isDue(COMMISSIONER)).toBe(false);
    expect(await isDue(ADMIN)).toBe(false);
    expect(await t.query(api.lineup.lineupDue.isDue, { leagueId, now: Date.now() })).toBe(false);
  });

  test("afresh for a new manager of a vacated team, who has opened nothing", async () => {
    clockTo(nextDeadline() - LINEUP_DUE_BEFORE_DEADLINE_MS);
    await opensTactics(ANN);
    await (await actingAs(t, COMMISSIONER)).mutation(api.leagues.teams.removeManager, { leagueId, teamId: annsTeam });
    await addManager(t, leagueId, BOB, annsTeam);
    expect(await isDue(BOB)).toBe(true);
  });
});

describe("opening Tactics", () => {
  test("keeps the gameweek a save now is from on his team", async () => {
    await opensTactics(ANN);
    expect(await openedIn()).toBe(NEXT);
  });

  test("is refused for someone running no team in the league, and keeps nothing", async () => {
    await expectRefused(opensTactics(COMMISSIONER), refusals.runsNoTeam);
    expect(await openedIn()).toBeNull();
  });
});
