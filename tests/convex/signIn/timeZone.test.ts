import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { refusals } from "../../../convex/shared/leagueAccess";
import { LONDON_ZONE, momentIn, screenMoment } from "../../../convex/shared/moments";
import { notAZone, zoneOf } from "../../../convex/signIn/timeZone";
import { ANN, BOB, deletes, leagueWithPeople } from "../../support/convex/leagueDeletion.harness";
import { COMMISSIONER, actingAs, leagueRow, type TestConvex } from "../../support/convex/leagues.harness";
import { expectRefused } from "../../support/convex/test.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// Each person's own time zone (#442, Craig 26 Oct 2026): their browser names it each time the app
// opens, and what is written for them tells time in it; London's until it is known.

const SYDNEY = "Australia/Sydney";
const NEW_YORK = "America/New_York";
/** Wednesday 21 October 2026, 10:00 in London (BST). */
const AT = Date.UTC(2026, 9, 21, 9, 0);

let t: TestConvex;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
});

const zoneHeld = (email: string) => t.run(async (ctx) => (await zoneOf(ctx, email)) ?? null);
const records = async (email: string, zone: string) => (await actingAs(t, email)).mutation(api.signIn.timeZone.recordZone, { zone });

describe("telling a moment", () => {
  test("in the reader's zone, named, and London's while theirs isn't known", () => {
    expect(momentIn(AT, undefined)).toBe("Wednesday 21 October at 10:00 BST");
    expect(momentIn(AT, LONDON_ZONE)).toBe(momentIn(AT, undefined));
    expect(momentIn(AT, SYDNEY)).toMatch(/^Wednesday 21 October at 20:00 /);
    expect(momentIn(AT, NEW_YORK)).toMatch(/^Wednesday 21 October at 05:00 /);
  });

  describe("on a screen, in the browser's own zone", () => {
    const tz = process.env.TZ;
    afterEach(() => {
      process.env.TZ = tz;
    });
    test("a browser in Sydney reads Sydney's time", () => {
      process.env.TZ = SYDNEY;
      expect(screenMoment(AT)).toBe(momentIn(AT, SYDNEY));
    });
  });
});

describe("keeping a person's zone", () => {
  test("their browser names it, and naming another, as a traveller's does, replaces it", async () => {
    expect(await zoneHeld(ANN)).toBeNull();
    await records(ANN, SYDNEY);
    expect(await zoneHeld(ANN)).toBe(SYDNEY);
    await records(ANN, NEW_YORK);
    expect(await zoneHeld(ANN)).toBe(NEW_YORK);
    expect(await t.run((ctx) => ctx.db.query("timeZones").collect())).toHaveLength(1);
  });

  test("a name that isn't a zone is refused, and the one held stays", async () => {
    await records(ANN, SYDNEY);
    await expectRefused(records(ANN, "Mars/Olympus_Mons"), notAZone("Mars/Olympus_Mons"));
    expect(await zoneHeld(ANN)).toBe(SYDNEY);
  });

  test("no one signed out keeps one", async () => {
    await expectRefused(t.mutation(api.signIn.timeZone.recordZone, { zone: SYDNEY }), refusals.signedOut);
  });
});

describe("Mail's letters", () => {
  test("each reader's copy tells when the league goes in their own zone, London's for one not yet known", async () => {
    const leagueId: Id<"leagues"> = await leagueWithPeople(t);
    await records(ANN, SYDNEY);
    await deletes(t, COMMISSIONER, leagueId);
    const deletesAt = (await leagueRow(t, leagueId))!.deletion!.deletesAt;
    const deletionLetterTo = (email: string) =>
      t.run(async (ctx) =>
        (await ctx.db.query("letters").withIndex("by_to_and_at", (q) => q.eq("to", email)).collect()).find((letter) =>
          letter.body.includes("deleted the league"),
        ),
      );

    expect((await deletionLetterTo(ANN))?.body).toContain(momentIn(deletesAt, SYDNEY));
    expect((await deletionLetterTo(BOB))?.body).toContain(momentIn(deletesAt, LONDON_ZONE));
    expect(momentIn(deletesAt, SYDNEY)).not.toBe(momentIn(deletesAt, LONDON_ZONE));
  });
});
