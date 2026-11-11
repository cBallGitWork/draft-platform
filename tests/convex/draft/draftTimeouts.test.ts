import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PICK_GAP_MS } from "../../../convex/draft/draftClock";
import { SECOND_MS } from "../../../convex/shared/time";
import { ARSENAL, CHELSEA, insertClubs, insertPlayers, type HeldPlayer } from "../../support/convex/footballRows.harness";
import { changeEveryRules, HELD_FIRST_RULES } from "../../support/convex/leagueRules.harness";
import { actingAs, addManagers, adminCreatesLeague, COMMISSIONER, MANAGERS, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { elapse } from "../../support/convex/test.harness";

// The timeout count (spec/04, Auto-pick; #1136): each clock that runs out on a team with a manager
// is one of its timeouts, across the whole draft; at the league's number it goes on auto-pick, its
// first pick there waiting the full clock and each after made at once; with "never" the clock runs
// for every pick.

let t: TestConvex;
let leagueId: Id<"leagues">;
let teams: Id<"teams">[];

const player = (code: number, club = ARSENAL): HeldPlayer => ({ code, name: `Player ${code}`, fullName: `Player ${code}`, clubCode: club.code, positions: ["CM"] });
const PLAYERS = [101, 102, 103, 104].map((code) => player(code)).concat([201, 202, 203, 204].map((code) => player(code, CHELSEA)));
const PICK_SECONDS = 30;
const PICK_MS = PICK_SECONDS * SECOND_MS;
const [ANN, BOB] = MANAGERS;
const ROUNDS = 4;

/** The league's squad holds `ROUNDS` players, and its manager gets `timeouts` before auto-pick. */
const setRules = (timeouts: number | null) =>
  changeEveryRules(t, leagueId, (rules) => ({
    ...rules,
    squad: { size: { minimum: 1, maximum: ROUNDS }, minimumByArea: null, maxPerClub: null },
    draft: { ...HELD_FIRST_RULES.draft!, pickSeconds: PICK_SECONDS, timeoutsBeforeAutoPick: timeouts },
  }));

const as = (email: string) => actingAs(t, email);
const start = async () => (await as(COMMISSIONER)).mutation(api.draft.draftStart.start, { leagueId });
const picked = () => t.run(async (ctx) => (await ctx.db.query("draftPicks").collect()).map(({ pick, teamId, at }) => ({ pick, teamId, at })));
const timeouts = () => t.run(async (ctx) => (await ctx.db.query("drafts").unique())?.timeouts);
/** Bob picks the first player nobody holds. */
async function bobPicks() {
  const taken = new Set(await t.run(async (ctx) => (await ctx.db.query("draftPicks").collect()).map(({ playerCode }) => playerCode)));
  const code = PLAYERS.find(({ code }) => !taken.has(code))!.code;
  await (await as(BOB)).mutation(api.draft.draftPicks.makePick, { leagueId, playerCode: code });
}
/** The clock moves on `ms`, and every pick scheduled by then is made. */
const pass = (ms: number) => elapse(t, ms);
/** The next clock starts after the gap and runs out. */
const timeOut = () => pass(PICK_GAP_MS + PICK_MS);

beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t, 5);
  teams = await addManagers(t, leagueId, [ANN, BOB]);
  await t.run(async (ctx) => {
    await insertClubs(ctx, [ARSENAL, CHELSEA]);
    await insertPlayers(ctx, PLAYERS);
  });
});

// Two teams snake: Ann has picks 1, 4, 5 and 8; Bob 2, 3, 6 and 7.
describe("each timeout", () => {
  test("counts for the team whose clock ran out, not for a manager who picks himself", async () => {
    await setRules(2);
    await start();
    await pass(PICK_MS);
    expect(await timeouts()).toEqual([{ teamId: teams[0], count: 1 }]);

    await bobPicks();
    await bobPicks();
    expect(await timeouts()).toEqual([{ teamId: teams[0], count: 1 }]);
  });

  test("counts across the whole draft, not only in a row", async () => {
    await setRules(3);
    await start();
    await pass(PICK_MS);
    await bobPicks();
    await bobPicks();
    await timeOut();

    expect(await timeouts()).toEqual([{ teamId: teams[0], count: 2 }]);
  });

  test("isn't counted for a team with no manager", async () => {
    await setRules(1);
    await t.run((ctx) => ctx.db.patch("teams", teams[0], { managerEmail: undefined }));
    await start();
    await pass(0);

    expect(await picked()).toHaveLength(1);
    expect(await t.run((ctx) => ctx.db.query("drafts").unique())).not.toHaveProperty("timeouts");
  });
});

describe("the league's limit", () => {
  test("puts the team on auto-pick: its first pick there waits the full clock, each after is made at once", async () => {
    await setRules(2);
    await start();
    await pass(PICK_MS);
    await bobPicks();
    await bobPicks();
    await timeOut();
    expect(await timeouts()).toEqual([{ teamId: teams[0], count: 2, autoPick: "fullClock" }]);

    await pass(PICK_GAP_MS + PICK_MS - 1);
    expect(await picked()).toHaveLength(4);
    await pass(1);
    expect(await picked()).toHaveLength(5);
    expect(await timeouts()).toEqual([{ teamId: teams[0], count: 3, autoPick: "atOnce" }]);

    await bobPicks();
    await bobPicks();
    const at = Date.now();
    await pass(PICK_GAP_MS);
    expect((await picked()).at(-1)).toEqual({ pick: 8, teamId: teams[0], at: at + PICK_GAP_MS });
    // A pick made at once is no timeout: his clock never ran out (#1460).
    expect(await timeouts()).toEqual([{ teamId: teams[0], count: 3, autoPick: "atOnce" }]);
  });

  test("of 1 puts the team on auto-pick at its first timeout", async () => {
    await setRules(1);
    await start();
    await pass(PICK_MS);

    expect(await timeouts()).toEqual([{ teamId: teams[0], count: 1, autoPick: "fullClock" }]);
  });
});

describe("never", () => {
  test("keeps the clock for every pick, however many run out", async () => {
    await setRules(null);
    await start();
    await pass(PICK_MS);
    await bobPicks();
    await bobPicks();
    await timeOut();
    await pass(PICK_GAP_MS + PICK_MS - 1);
    expect(await picked()).toHaveLength(4);

    await pass(1);
    expect(await picked()).toHaveLength(5);
    expect(await timeouts()).toEqual([{ teamId: teams[0], count: 3 }]);
  });
});
