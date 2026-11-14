import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { LeagueSettings } from "../../../convex/rules/leagueSettingsPart";
import { HELD_FIRST_RULES, holdGameweeks, NEXT, rulesIn, rulesRevision } from "../../support/convex/leagueRules.harness";
import { expectRefused } from "../../support/convex/test.harness";
import { actingAs, adminCreatesLeague, COMMISSIONER, eventsIn, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// The Fixtures tab's league rules (spec/03; #1034): the format (S03.1), the deadline (S03.3), double
// gameweeks and the table's tie-breaks, whose order the commissioner changes (S03.2), saved through League settings as its other rules are. The format's lock
// once the season has begun is formatLock.test.ts's.

let t: TestConvex;
let leagueId: Id<"leagues">;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  await holdGameweeks(t, { next: NEXT });
  leagueId = await adminCreatesLeague(t);
});

const settingsNow = async () => (await (await actingAs(t, COMMISSIONER)).query(api.rules.leagueSettings.settings, { leagueId })).part;
/** The latest settings with `changed` over them, saved. */
async function changeTo(changed: Partial<LeagueSettings>) {
  const settings = { ...(await settingsNow()), ...changed };
  return (await actingAs(t, COMMISSIONER)).mutation(api.rules.leagueSettings.changeSettings, { leagueId, settings, revision: await rulesRevision(t, leagueId) });
}

describe("the Fixtures tab's rules", () => {
  test("read as the league's rules have them", async () => {
    const { format, deadline, doubleGameweek, tieBreaks } = HELD_FIRST_RULES;
    expect(await settingsNow()).toMatchObject({ format, deadline, doubleGameweek, tieBreaks });
  });

  test("save from the next gameweek, with one letter naming each, and read back", async () => {
    const changed = {
      format: "totalPoints",
      deadline: { minutesBeforeFirstKickoff: 90 },
      doubleGameweek: "bestMatch",
      tieBreaks: ["headToHead", "pointsFor"],
    } as const satisfies Partial<LeagueSettings>;
    await changeTo(changed);

    expect(await rulesIn(t, leagueId, NEXT)).toEqual({ ...HELD_FIRST_RULES, ...changed });
    expect(await rulesIn(t, leagueId, NEXT - 1)).toEqual(HELD_FIRST_RULES);
    expect((await eventsIn(t, leagueId)).at(-1)).toMatchObject({ kind: "rulesChanged", changed: ["format", "deadline", "doubleGameweek", "tieBreaks"] });
    expect(await settingsNow()).toMatchObject(changed);
  });

  test.each([
    ["a fractional deadline", { deadline: { minutesBeforeFirstKickoff: 2.5 } }, "The deadline's minutes before the first kickoff must be a whole number, 0 or more, not 2.5."],
    ["a deadline after the first kickoff", { deadline: { minutesBeforeFirstKickoff: -1 } }, "The deadline's minutes before the first kickoff must be a whole number, 0 or more, not -1."],
    ["a tie-break listed twice", { tieBreaks: ["pointsFor", "pointsFor"] }, "The tie-break pointsFor is listed twice."],
  ] satisfies [string, Partial<LeagueSettings>, string][])("refuse %s with the reason, and save nothing", async (_, changed, reason) => {
    await expectRefused(changeTo(changed), reason);
    expect(await rulesIn(t, leagueId, NEXT)).toEqual(HELD_FIRST_RULES);
  });
});
