import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { TICKER_MOST, TOP_ROWS, WHOLE_TABLE_MOST } from "../../../convex/home/glance";
import { refusals } from "../../../convex/shared/leagueAccess";
import { MINUTE_MS } from "../../../convex/shared/time";
import { changeRules, holdGameweeks, TOTAL_POINTS } from "../../support/convex/leagueRules.harness";
import { expectRefused } from "../../support/convex/test.harness";
import { ADMIN, actingAs, addManagers, adminCreatesLeague, COMMISSIONER, CO_COMMISSIONER, MANAGERS, type TestConvex } from "../../support/convex/leagues.harness";
import { ARSENAL, insertClubs } from "../../support/convex/footballRows.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { squadMoves } from "../../support/convex/lineupSquad.harness";

// League home's first slice (#387; spec/12, League home): this gameweek's head-to-heads, the table
// (whole up to WHOLE_TABLE_MOST teams, else the top TOP_ROWS and the reader's row) with each team's
// form, the latest squad moves from the league's events, and the commissioner's latest letter.

const [ANN, BOB, CAT] = MANAGERS;
const STRANGER = "stranger@example.com";
const SAKA = 1001;
const RICE = 1002;

let t: TestConvex;
let leagueId: Id<"leagues">;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t, 20);
});

const read = async (email = ANN) => (await actingAs(t, email)).query(api.home.leagueHome.ofLeague, { leagueId, now: Date.now() });
const managersNamed = (count: number) => Array.from({ length: count }, (_, i) => `manager${i + 1}@example.com`);

describe("who may read it", () => {
  beforeEach(() => addManagers(t, leagueId, [ANN, BOB]));

  test.each([ANN, COMMISSIONER, ADMIN])("%s, with a part in the league or the admin, may", async (email) => {
    expect((await read(email))?.teams).toBe(2);
  });

  test("anyone else is refused", async () => {
    await expectRefused(read(STRANGER), refusals.notInLeague);
  });

  test("a league made before rules were held has none to show", async () => {
    await t.run(async (ctx) => {
      for (const row of await ctx.db.query("leagueRules").collect()) await ctx.db.delete("leagueRules", row._id);
    });
    expect(await read()).toBeNull();
  });
});

describe("the glance", () => {
  test("before any gameweek has begun, it shows the first's head-to-heads, the same as the table's fixtures", async () => {
    await addManagers(t, leagueId, [ANN, BOB, CAT]);
    const home = (await read())!;
    const fixtures = (await (await actingAs(t, ANN)).query(api.table.leagueTable.ofLeague, { leagueId }))!.gameweeks[0];

    // The table's fixtures also carry their score; the glance's don't.
    const unscored = fixtures.fixtures.map(({ points: _points, ...fixture }) => fixture);
    expect(home.thisGameweek).toEqual({ gameweek: fixtures.gameweek, fixtures: unscored, byes: fixtures.byes });
  });

  test("once gameweeks have begun, it shows the latest begun", async () => {
    await addManagers(t, leagueId, [ANN, BOB]);
    await holdGameweeks(t, { next: 9 });
    expect((await read())?.thisGameweek?.gameweek).toBe(8);
  });

  test(`up to ${WHOLE_TABLE_MOST} teams, the whole table, the reader's row marked, every form empty while nothing is scored`, async () => {
    const managers = managersNamed(WHOLE_TABLE_MOST);
    await addManagers(t, leagueId, managers);
    const home = (await read(managers[WHOLE_TABLE_MOST - 1]))!;

    expect(home.table.map((row) => row.position)).toEqual(Array.from({ length: WHOLE_TABLE_MOST }, (_, i) => i + 1));
    expect(home.table.filter((row) => row.mine).map((row) => row.teamName)).toEqual([`Team ${WHOLE_TABLE_MOST}`]);
    expect(home.table.every((row) => row.form.length === 0 && row.played === 0)).toBe(true);
  });

  test(`past ${WHOLE_TABLE_MOST} teams, the top ${TOP_ROWS} and the reader's row, at its place in the whole table`, async () => {
    const managers = managersNamed(WHOLE_TABLE_MOST + 2);
    await addManagers(t, leagueId, managers);
    const home = (await read(managers.at(-1)))!;

    expect(home.teams).toBe(WHOLE_TABLE_MOST + 2);
    expect(home.table.map((row) => row.position)).toEqual([1, 2, 3, 4, 5, WHOLE_TABLE_MOST + 2]);
    expect(home.table.at(-1)).toMatchObject({ mine: true, teamName: `Team ${WHOLE_TABLE_MOST + 2}` });
  });

  test(`past ${WHOLE_TABLE_MOST} teams, a commissioner running no team sees the top ${TOP_ROWS} alone`, async () => {
    await addManagers(t, leagueId, managersNamed(WHOLE_TABLE_MOST + 1));
    const home = (await read(COMMISSIONER))!;
    expect(home.table).toHaveLength(TOP_ROWS);
    expect(home.table.some((row) => row.mine)).toBe(false);
  });

  test("in total points there are no head-to-heads, and no form", async () => {
    await addManagers(t, leagueId, [ANN, BOB]);
    await changeRules(t, leagueId, TOTAL_POINTS);
    // A change takes effect from the next gameweek; with none begun, that is the first.
    const home = (await read())!;
    expect(home.format).toBe("totalPoints");
    expect(home.thisGameweek).toBeNull();
    expect(home.table.map((row) => row.form)).toEqual([[], []]);
  });
});

describe("the latest claims, drops and trades", () => {
  let teams: Id<"teams">[];
  beforeEach(async () => {
    teams = await addManagers(t, leagueId, [ANN, BOB]);
    await t.run(async (ctx) => {
      await insertClubs(ctx, [ARSENAL]);
      for (const [code, name] of [[SAKA, "Saka"], [RICE, "Rice"]] as const) await ctx.db.insert("players", { code, name, fullName: name, clubCode: ARSENAL.code });
    });
  });

  const commissioner = () => squadMoves(t, leagueId, COMMISSIONER);

  test("lists each squad move, newest first, with the team he left on a move, and no other event", async () => {
    const commish = await commissioner();
    await commish.assign(SAKA, teams[0]);
    vi.advanceTimersByTime(MINUTE_MS);
    await commish.move(SAKA, teams[1]);
    vi.advanceTimersByTime(MINUTE_MS);
    await commish.release(SAKA);

    expect((await read())?.squadMoves.map(({ kind, playerName, teamName, fromTeamName }) => ({ kind, playerName, teamName, fromTeamName }))).toEqual([
      { kind: "playerReleased", playerName: "Saka", teamName: "Team 2", fromTeamName: null },
      { kind: "playerMoved", playerName: "Saka", teamName: "Team 2", fromTeamName: "Team 1" },
      { kind: "playerAssigned", playerName: "Saka", teamName: "Team 1", fromTeamName: null },
    ]);
  });

  test(`lists the latest ${TICKER_MOST} of them, of every kind`, async () => {
    const commish = await commissioner();
    for (let round = 0; round < TICKER_MOST; round += 1) {
      await commish.assign(RICE, teams[0]);
      vi.advanceTimersByTime(MINUTE_MS);
      await commish.release(RICE);
      vi.advanceTimersByTime(MINUTE_MS);
    }
    const moves = (await read())!.squadMoves;
    expect(moves.map((move) => move.kind)).toEqual(["playerReleased", "playerAssigned", "playerReleased", "playerAssigned", "playerReleased"]);
    expect(moves.map((move) => move.at)).toEqual(moves.map((move) => move.at).toSorted((one, other) => other - one));
  });
});

describe("the commissioner's letter", () => {
  beforeEach(() => addManagers(t, leagueId, [ANN]));
  const write = async (email: string, subject: string) =>
    (await actingAs(t, email)).mutation(api.mail.mail.writeToLeague, { leagueId, subject, body: `${subject} body` });

  test("none is pinned before the first", async () => {
    expect((await read())?.pinnedLetter).toBeNull();
  });

  test("the latest is pinned until a newer one, from the commissioner or the co-commissioner", async () => {
    await (await actingAs(t, COMMISSIONER)).mutation(api.leagues.leagues.nameCoCommissioner, { leagueId, email: CO_COMMISSIONER });
    await write(COMMISSIONER, "Draft night");
    expect((await read())?.pinnedLetter).toMatchObject({ from: COMMISSIONER, subject: "Draft night", body: "Draft night body" });

    vi.advanceTimersByTime(MINUTE_MS);
    await write(CO_COMMISSIONER, "Kick-off");
    expect((await read())?.pinnedLetter).toMatchObject({ from: CO_COMMISSIONER, subject: "Kick-off", at: Date.now() });
  });
});
