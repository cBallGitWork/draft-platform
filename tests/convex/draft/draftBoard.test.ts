import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { refusals } from "../../../convex/shared/leagueAccess";
import { ARSENAL, CHELSEA, insertClubs, insertPlayers, type HeldPlayer } from "../../support/convex/footballRows.harness";
import { expectRefused } from "../../support/convex/test.harness";
import { actingAs, addManagers, adminCreatesLeague, COMMISSIONER, MANAGERS, OUTSIDER, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// The draft room's reads (spec/04, The draft room; #1098): the board's picks, each with its
// player's club and position, the caller's team and the pick time; and whether the room is in the
// menu, which it leaves once the draft is over (Craig, 4 Nov 2026, on #1098).

let t: TestConvex;
let leagueId: Id<"leagues">;
let teams: Id<"teams">[];
const [ANN, BOB] = MANAGERS;

const SAKA: HeldPlayer = { code: 101, name: "Saka", fullName: "Bukayo Saka", clubCode: ARSENAL.code, positions: ["W"] };
const PALMER: HeldPlayer = { code: 201, name: "Palmer", fullName: "Cole Palmer", clubCode: CHELSEA.code, positions: ["CAM"] };

const as = (email: string) => actingAs(t, email);
const board = async (email: string) => (await as(email)).query(api.draft.draftBoard.ofLeague, { leagueId, now: Date.now() });
const inMenu = async (email: string) => (await as(email)).query(api.draft.draftBoard.inMenu, { leagueId });
const pick = async (email: string, playerCode: number) => (await as(email)).mutation(api.draft.draftPicks.makePick, { leagueId, playerCode });

beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t, 5);
  teams = await addManagers(t, leagueId, [ANN, BOB]);
  await t.run(async (ctx) => {
    await insertClubs(ctx, [ARSENAL, CHELSEA]);
    await insertPlayers(ctx, [SAKA, PALMER]);
    for (const row of await ctx.db.query("leagueRules").withIndex("by_leagueId_and_fromGameweek", (q) => q.eq("leagueId", leagueId)).collect()) {
      await ctx.db.patch("leagueRules", row._id, { rules: { ...row.rules, squad: { size: { minimum: 1, maximum: 1 }, minimumByArea: null, maxPerClub: null } } });
    }
  });
});

describe("the board", () => {
  test("holds no picks before the draft, with the caller's team and the league's pick time", async () => {
    expect(await board(ANN)).toEqual({ picks: [], yourTeamId: teams[0], pickSeconds: 90, yourAutoPick: { on: false, timeouts: 0, limit: 2 }, tradedPicks: [] });
    expect(await board(COMMISSIONER)).toMatchObject({ yourTeamId: null });
  });

  test("holds each pick made, first first, with its player's club and first position", async () => {
    await (await as(COMMISSIONER)).mutation(api.draft.draftStart.start, { leagueId });
    await pick(ANN, SAKA.code);
    await pick(BOB, PALMER.code);

    expect((await board(BOB)).picks).toEqual([
      { pick: 1, teamId: teams[0], auto: false, player: { code: SAKA.code, name: "Saka", clubShortName: "ARS", position: "W" } },
      { pick: 2, teamId: teams[1], auto: false, player: { code: PALMER.code, name: "Palmer", clubShortName: "CHE", position: "CAM" } },
    ]);
  });

  test("is refused to anyone outside the league", async () => {
    await expectRefused(board(OUTSIDER), refusals.notInLeague);
  });
});

describe("the draft room is in the menu", () => {
  test("from the start, through the draft, and leaves it once the last pick is made", async () => {
    expect(await inMenu(ANN)).toBe(true);
    await (await as(COMMISSIONER)).mutation(api.draft.draftStart.start, { leagueId });
    await pick(ANN, SAKA.code);
    expect(await inMenu(ANN)).toBe(true);
    await pick(BOB, PALMER.code);
    expect(await inMenu(ANN)).toBe(false);
  });
});
