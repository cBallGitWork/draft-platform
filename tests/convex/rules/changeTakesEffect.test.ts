import { beforeEach, describe, expect, test } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { GAMEWEEKS } from "../../../convex/gameweeks/usedGameweeks";
import { changeRules, HELD_FIRST_RULES, holdGameweeks, holdGameweeksPastTheSeason, moveFplDeadline, rulesInGameweek, rulesRevision, rulesWith, TOTAL_POINTS } from "../../support/convex/leagueRules.harness";
import { HOUR_MS } from "../../../convex/shared/time";
import { actingAs, adminCreatesLeague, COMMISSIONER, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// Which gameweek a commissioner's change takes effect from when it moves the deadline (#25): the
// next not begun under the old deadline nor the new. A gameweek begins at the league's own
// deadline, never FPL's (Craig, 22 Oct 2026: "ours, we arent fpl so stop copying them"; #138).
// holdGameweeks holds FPL's 90 minutes before each kickoff, as feed data.

let t: TestConvex;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
});

const change = (leagueId: Id<"leagues">, rules = TOTAL_POINTS) => changeRules(t, leagueId, rules);
const latest = async (leagueId: Id<"leagues">) => (await actingAs(t, COMMISSIONER)).query(api.rules.leagueRules.latest, { leagueId });
const inGameweek = (leagueId: Id<"leagues">, gameweek: number) => t.run((ctx) => rulesInGameweek(ctx, leagueId, gameweek));
/** A deadline three hours before the first kickoff, so an hour and a half earlier than FPL's. */
const THREE_HOURS_BEFORE = rulesWith({ deadline: { minutesBeforeFirstKickoff: 180 } });
/** A deadline at the first kickoff, so an hour and a half later than FPL's. */
const AT_KICKOFF = rulesWith({ deadline: { minutesBeforeFirstKickoff: 0 } });

describe("a commissioner's change of deadline", () => {
  test("to an earlier deadline that has already passed for gameweek 9 waits for gameweek 10", async () => {
    await holdGameweeks(t, { next: 9, kicksOffIn: 2 * HOUR_MS });
    const leagueId = await adminCreatesLeague(t);

    expect(await change(leagueId, THREE_HOURS_BEFORE)).toBe(10);
    expect(await inGameweek(leagueId, 9)).toEqual(HELD_FIRST_RULES);
  });

  test("to a later deadline waits for gameweek 10 if gameweek 9 has begun under the old one", async () => {
    await holdGameweeks(t, { next: 9, kicksOffIn: 2 * HOUR_MS });
    await t.mutation(internal.rules.leagueRules.setDefaults, { rules: THREE_HOURS_BEFORE });
    const leagueId = await adminCreatesLeague(t);

    expect(await change(leagueId, AT_KICKOFF)).toBe(10);
    expect((await inGameweek(leagueId, 9)).deadline.minutesBeforeFirstKickoff).toBe(180);
  });

  test("under a deadline later than FPL's, made after FPL's but before the league's, applies from gameweek 9", async () => {
    await holdGameweeks(t, { next: 9, kicksOffIn: HOUR_MS });
    await t.mutation(internal.rules.leagueRules.setDefaults, { rules: AT_KICKOFF });
    const leagueId = await adminCreatesLeague(t);

    expect(await change(leagueId, { ...AT_KICKOFF, format: "totalPoints" })).toBe(9);
  });

  test("ignores FPL's deadline moving: gameweek 9 is still to begin when FPL's has passed", async () => {
    await holdGameweeks(t, { next: 9 });
    await moveFplDeadline(t, 9, Date.now() - HOUR_MS);
    const leagueId = await adminCreatesLeague(t);

    expect(await change(leagueId)).toBe(9);
  });

  test("made while another waits for gameweek 10 waits for it too, so the waiting one can't override it", async () => {
    await holdGameweeks(t, { next: 9, kicksOffIn: 2 * HOUR_MS });
    const leagueId = await adminCreatesLeague(t);
    await change(leagueId, THREE_HOURS_BEFORE);

    expect(await change(leagueId, structuredClone(HELD_FIRST_RULES))).toBe(10);
    expect(await inGameweek(leagueId, 9)).toEqual(HELD_FIRST_RULES);
    expect(await inGameweek(leagueId, 10)).toEqual(HELD_FIRST_RULES);
    expect(await latest(leagueId)).toEqual({ fromGameweek: 10, rules: HELD_FIRST_RULES, revision: await rulesRevision(t, leagueId) });
  });
});

test("League settings says a change waits for gameweek 10 once one already waits for it", async () => {
  await holdGameweeks(t, { next: 9, kicksOffIn: 2 * HOUR_MS });
  const leagueId = await adminCreatesLeague(t);
  await change(leagueId, THREE_HOURS_BEFORE);

  const editor = await (await actingAs(t, COMMISSIONER)).query(api.rules.leagueSettings.settings, { leagueId, now: Date.now() });
  expect(editor?.changesFrom).toBe(10);
});

test(`with ${GAMEWEEKS + 1} gameweeks held, League settings and a change still name the next gameweek not begun (#872)`, async () => {
  await holdGameweeks(t, { next: 9 });
  await holdGameweeksPastTheSeason(t, 1);
  const leagueId = await adminCreatesLeague(t);

  const editor = await (await actingAs(t, COMMISSIONER)).query(api.rules.leagueSettings.settings, { leagueId, now: Date.now() });
  expect(editor?.changesFrom).toBe(9);
  expect(await change(leagueId)).toBe(9);
});
