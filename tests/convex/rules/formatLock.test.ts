import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { formatLocked } from "../../../convex/rules/formatLock";
import { HOUR_MS } from "../../../convex/shared/time";
import { changeRules, HELD_FIRST_RULES, holdGameweeks, rulesInGameweek, TOTAL_POINTS } from "../../support/convex/leagueRules.harness";
import { expectRefused } from "../../support/convex/test.harness";
import { actingAs, adminCreatesLeague, COMMISSIONER, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// The format is locked once the league's first gameweek has begun (S03.1; Craig, 6 Nov 2026; #275): one
// table with one meaning all season. Before then it changes like any other rule.

let t: TestConvex;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
});

const KICKS_OFF_IN = 2 * HOUR_MS;
const change = (leagueId: Id<"leagues">, rules = TOTAL_POINTS) => changeRules(t, leagueId, rules);
const latest = async (leagueId: Id<"leagues">) => (await actingAs(t, COMMISSIONER)).query(api.rules.leagueRules.latest, { leagueId });
const inGameweek = (leagueId: Id<"leagues">, gameweek: number) => t.run((ctx) => rulesInGameweek(ctx, leagueId, gameweek));
/** Moves the clock past gameweek 1's kickoff, so it has begun. */
const gameweekOneBegins = () => vi.setSystemTime(Date.now() + KICKS_OFF_IN + HOUR_MS);

describe("a format change", () => {
  test("before the league's first gameweek begins is saved, from that gameweek", async () => {
    await holdGameweeks(t, { next: 1, kicksOffIn: KICKS_OFF_IN });
    const leagueId = await adminCreatesLeague(t);

    expect(await change(leagueId)).toBe(1);
    expect(await inGameweek(leagueId, 1)).toEqual(TOTAL_POINTS);
  });

  test("once the league's first gameweek has begun is refused, saying why, and the format stays", async () => {
    await holdGameweeks(t, { next: 1, kicksOffIn: KICKS_OFF_IN });
    const leagueId = await adminCreatesLeague(t);
    gameweekOneBegins();

    await expectRefused(change(leagueId), formatLocked("headToHead"));
    expect((await latest(leagueId))?.rules).toEqual(HELD_FIRST_RULES);
  });

  test("locks total points too, while the rest of the rules still change from the next gameweek", async () => {
    await holdGameweeks(t, { next: 1, kicksOffIn: KICKS_OFF_IN });
    const leagueId = await adminCreatesLeague(t);
    await change(leagueId);
    gameweekOneBegins();

    await expectRefused(change(leagueId, HELD_FIRST_RULES), formatLocked("totalPoints"));
    const tieBreaks = { ...TOTAL_POINTS, tieBreaks: ["headToHead" as const] };
    expect(await change(leagueId, tieBreaks)).toBe(2);
    expect(await inGameweek(leagueId, 2)).toEqual(tieBreaks);
  });

  test("in a league made mid-season is saved until its own first gameweek begins", async () => {
    await holdGameweeks(t, { next: 9, kicksOffIn: KICKS_OFF_IN });
    const leagueId = await adminCreatesLeague(t);

    expect(await change(leagueId)).toBe(9);
  });

  test("in a league scoring from gameweek 3 is saved while gameweek 1, which it doesn't score, has begun", async () => {
    await holdGameweeks(t, { next: 1, kicksOffIn: KICKS_OFF_IN });
    const leagueId = await adminCreatesLeague(t);
    await t.run((ctx) => ctx.db.patch("leagues", leagueId, { scoringStart: 3 }));
    gameweekOneBegins();

    expect(await change(leagueId)).toBe(2);
  });
});
