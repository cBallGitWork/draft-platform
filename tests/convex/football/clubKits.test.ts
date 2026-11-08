import { beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import { CLUB_COLOURS, coloursFrom, UNSET_COLOURS } from "../../../convex/football/clubColours";
import { clubColourRefusals } from "../../../convex/football/clubKits";
import { refusals } from "../../../convex/shared/leagueAccess";
import { ARSENAL, CHELSEA, insertClubs, type Club } from "../../support/convex/footballRows.harness";
import { syncWith } from "../../support/convex/footballSync.harness";
import { ADMIN, MANAGERS, actingAs } from "../../support/convex/leagues.harness";
import { expectRefused, freshConvex } from "../../support/convex/test.harness";
import { recordedFpl } from "../../support/recorded/fpl.payloads";

// Each club's colours, held by club code and the admin's to set (#838; spec/15, The admin): the
// football sync seeds each club's from clubColours.ts, the admin changes them, the shirts read what
// he set, and a club with none waits in the dashboard's queue, drawn white.

/** Promoted, with no row in clubColours.ts. */
const WREXHAM: Club = { code: 999, name: "Wrexham", shortName: "WRX" };
const BLACK_AND_GOLD = { primary: "#000000", secondary: "#FFD700", pattern: "stripes" as const };

const seedOf = (code: number) => {
  const { primary, secondary, pattern } = CLUB_COLOURS[code];
  return { primary, secondary, pattern };
};

beforeEach(() => {
  vi.stubEnv("ADMIN_EMAIL", ADMIN);
});

async function heldClubs(clubs: readonly Club[]) {
  const t = freshConvex();
  await t.run((ctx) => insertClubs(ctx, clubs));
  return t;
}

/** A club's colours as anyone signed in reads them for its shirts and mark. */
async function shirtColours(t: ReturnType<typeof freshConvex>, code: number) {
  return coloursFrom(await (await actingAs(t, MANAGERS[0])).query(api.football.clubKits.all, {}))(code);
}

describe("seeding", () => {
  test("the football sync seeds each club it holds from the file", async () => {
    const t = freshConvex();
    const fpl = recordedFpl();
    await syncWith(t, fpl);
    for (const team of fpl.bootstrap.teams) expect(await shirtColours(t, team.code)).toEqual(seedOf(team.code));
  });

  test("seeding again leaves the admin's colours as he set them, and gives a club with none in the file none", async () => {
    const t = await heldClubs([ARSENAL, CHELSEA, WREXHAM]);
    expect(await t.mutation(internal.football.clubKits.seedHeldClubs, {})).toBe(2);
    await (await actingAs(t, ADMIN)).mutation(api.football.clubKits.set, { code: ARSENAL.code, ...BLACK_AND_GOLD });

    expect(await t.mutation(internal.football.clubKits.seedHeldClubs, {})).toBe(0);
    expect(await shirtColours(t, ARSENAL.code)).toEqual(BLACK_AND_GOLD);
    expect(await shirtColours(t, CHELSEA.code)).toEqual(seedOf(CHELSEA.code));
    expect(await shirtColours(t, WREXHAM.code)).toEqual(UNSET_COLOURS);
  });
});

describe("the admin's colours", () => {
  test("what the admin sets is what the shirts read next, any colour, for a club with none too", async () => {
    const t = await heldClubs([ARSENAL, WREXHAM]);
    await t.mutation(internal.football.clubKits.seedHeldClubs, {});
    const admin = await actingAs(t, ADMIN);
    await admin.mutation(api.football.clubKits.set, { code: ARSENAL.code, ...BLACK_AND_GOLD });
    await admin.mutation(api.football.clubKits.set, { code: WREXHAM.code, primary: "#D71920", secondary: "#FFFFFF", pattern: "plain" });

    expect(await shirtColours(t, ARSENAL.code)).toEqual(BLACK_AND_GOLD);
    expect(await shirtColours(t, WREXHAM.code)).toEqual({ primary: "#D71920", secondary: "#FFFFFF", pattern: "plain" });
  });

  test("only the admin may set them", async () => {
    const t = await heldClubs([ARSENAL]);
    await expectRefused((await actingAs(t, MANAGERS[0])).mutation(api.football.clubKits.set, { code: ARSENAL.code, ...BLACK_AND_GOLD }), refusals.notAdmin);
    expect(await shirtColours(t, ARSENAL.code)).toEqual(UNSET_COLOURS);
  });

  test("a colour that isn't one, or a club not held, is refused", async () => {
    const t = await heldClubs([ARSENAL]);
    const admin = await actingAs(t, ADMIN);
    await expectRefused(admin.mutation(api.football.clubKits.set, { code: ARSENAL.code, ...BLACK_AND_GOLD, primary: "red" }), clubColourRefusals.notAColour);
    await expectRefused(admin.mutation(api.football.clubKits.set, { code: WREXHAM.code, ...BLACK_AND_GOLD }), clubColourRefusals.noSuchClub);
  });

  test("someone signed out reads no colours", async () => {
    const t = await heldClubs([ARSENAL]);
    await t.mutation(internal.football.clubKits.seedHeldClubs, {});
    expect(await t.query(api.football.clubKits.all, {})).toEqual([]);
  });
});

describe("the queue", () => {
  test("lists a held club with no colours as having none, beside the clubs to approve, and drawn white", async () => {
    const t = await heldClubs([ARSENAL, WREXHAM]);
    await t.mutation(internal.football.clubKits.seedHeldClubs, {});

    const { clubs } = await (await actingAs(t, ADMIN)).query(api.positions.playerPositions.queue, {});

    expect(clubs).toEqual([
      { code: ARSENAL.code, name: ARSENAL.name, colours: seedOf(ARSENAL.code) },
      { code: WREXHAM.code, name: WREXHAM.name, colours: null },
    ]);
    expect(await shirtColours(t, WREXHAM.code)).toEqual(UNSET_COLOURS);
  });
});
