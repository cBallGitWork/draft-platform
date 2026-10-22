import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { refusals } from "../../../convex/shared/leagueAccess";
import { gameweekRefusals } from "../../../convex/gameweeks/leagueGameweeks";
import {
  ADMIN,
  actingAs,
  COMMISSIONER,
  CO_COMMISSIONER,
  MANAGERS,
  addManagers,
  adminCreatesLeague,
  eventsIn,
  leagueRow,
  type TestConvex,
} from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { DAY_MS, HOUR_MS, MINUTE_MS, WEEK_MS } from "../../../convex/shared/time";
import { giveDeadlineRule, moveFplDeadline } from "../../support/convex/leagueRules.harness";
import { GAMEWEEKS, isGameweekUsed } from "../../../convex/gameweeks/usedGameweeks";

// The gameweeks a league plays (#74; spec/13, Gameweeks), against #21's gameweeks and matches. Each
// begins at the league's own deadline, never FPL's (#138).

/** The first gameweek still to begin, an hour after the harness's clock starts: 1 to 10 have begun. */
const NEXT = 11;

let t: TestConvex;
let leagueId: Id<"leagues">;
let start: number;
/** A gameweek's deadline under the first rules, 90 minutes before its one match: a week apart,
 *  from the clock's start, however the clock moves. FPL's is held at the same time, as feed data. */
const deadlineOf = (gameweek: number) => start + (gameweek - NEXT) * WEEK_MS + HOUR_MS;
const kickoffOf = (gameweek: number) => deadlineOf(gameweek) + 90 * MINUTE_MS;
beforeEach(async () => {
  t = await signInDeployment();
  start = Date.now();
  fakeResend();
  leagueId = await adminCreatesLeague(t);
});

/** FPL's gameweeks and one match each, as the football layer holds them, but for `missing`. */
async function holdGameweeks(missing: number[] = []) {
  await t.run(async (ctx) => {
    for (let number = 1; number <= GAMEWEEKS; number += 1) {
      if (missing.includes(number)) continue;
      await ctx.db.insert("gameweeks", { number, deadline: deadlineOf(number) });
      await ctx.db.insert("fixtures", { code: number, gameweek: number, homeClubCode: 1, awayClubCode: 2, kickoff: kickoffOf(number) });
    }
  });
}

async function setUsed(email: string, gameweek: number, used: boolean) {
  return (await actingAs(t, email)).mutation(api.gameweeks.leagueGameweeks.setUsed, { leagueId, gameweek, used });
}

const used = async (gameweek: number) => isGameweekUsed((await leagueRow(t, leagueId))!, gameweek);
const unusedGameweeks = async () => (await leagueRow(t, leagueId))!.unusedGameweeks;
const gameweekEvents = async () => (await eventsIn(t, leagueId)).filter((event) => event.kind === "gameweekUsed");

describe("a league's gameweeks", () => {
  test("a new league plays all 38, each shown with the league's own deadline", async () => {
    await holdGameweeks();
    const shown = await (await actingAs(t, COMMISSIONER)).query(api.gameweeks.leagueGameweeks.ofLeague, { leagueId });

    expect(shown).toHaveLength(GAMEWEEKS);
    expect(shown[16]).toEqual({ gameweek: 17, used: true, deadline: deadlineOf(17) });
    expect(shown.every((each) => each.used)).toBe(true);
    expect(await unusedGameweeks()).toBeUndefined();
  });

  test("unticking gameweek 17 before it begins leaves it out, and only it, and is filed for Mail", async () => {
    await holdGameweeks();
    await setUsed(COMMISSIONER, 17, false);

    expect(await used(17)).toBe(false);
    expect(await used(16)).toBe(true);
    expect(await used(18)).toBe(true);
    expect(await gameweekEvents()).toEqual([{ by: COMMISSIONER, kind: "gameweekUsed", gameweek: 17, used: false }]);
    const shown = await (await actingAs(t, COMMISSIONER)).query(api.gameweeks.leagueGameweeks.ofLeague, { leagueId });
    expect(shown.filter((each) => !each.used).map((each) => each.gameweek)).toEqual([17]);
  });

  test("ticking it again plays it again, and is filed", async () => {
    await holdGameweeks();
    await setUsed(COMMISSIONER, 17, false);
    await setUsed(COMMISSIONER, 17, true);

    expect(await used(17)).toBe(true);
    expect(await unusedGameweeks()).toEqual([]);
    expect((await gameweekEvents()).at(-1)).toEqual({ by: COMMISSIONER, kind: "gameweekUsed", gameweek: 17, used: true });
  });

  test("a Christmas break unticked out of order is kept in order", async () => {
    await holdGameweeks();
    for (const gameweek of [19, 17, 18]) await setUsed(COMMISSIONER, gameweek, false);
    expect(await unusedGameweeks()).toEqual([17, 18, 19]);
  });

  test("asking for what the league already has changes nothing and files nothing", async () => {
    await holdGameweeks();
    await setUsed(COMMISSIONER, 17, true);
    expect(await unusedGameweeks()).toBeUndefined();
    expect(await gameweekEvents()).toEqual([]);
  });

  test("the co-commissioner and the admin can tick them too", async () => {
    await holdGameweeks();
    await (await actingAs(t, COMMISSIONER)).mutation(api.leagues.leagues.nameCoCommissioner, { leagueId, email: CO_COMMISSIONER });
    await setUsed(CO_COMMISSIONER, 17, false);
    await setUsed(ADMIN, 38, false);
    expect(await unusedGameweeks()).toEqual([17, 38]);
  });

  test("a manager can neither change nor read them", async () => {
    await holdGameweeks();
    const [ann] = MANAGERS;
    await addManagers(t, leagueId, [ann]);
    await expect(setUsed(ann, 17, false)).rejects.toThrow(refusals.notRunner);
    await expect((await actingAs(t, ann)).query(api.gameweeks.leagueGameweeks.ofLeague, { leagueId })).rejects.toThrow(refusals.notRunner);
  });
});

describe("once a gameweek has begun", () => {
  test("it can't be unticked or ticked, and nothing is filed", async () => {
    await holdGameweeks();
    await expect(setUsed(COMMISSIONER, NEXT - 1, false)).rejects.toThrow(gameweekRefusals.begun(NEXT - 1));

    await setUsed(COMMISSIONER, NEXT, false);
    vi.setSystemTime(deadlineOf(NEXT));
    await expect(setUsed(COMMISSIONER, NEXT, true)).rejects.toThrow(gameweekRefusals.begun(NEXT));
    expect(await unusedGameweeks()).toEqual([NEXT]);
    expect(await gameweekEvents()).toHaveLength(1);
  });

  test("it begins at its deadline, not before", async () => {
    await holdGameweeks();
    vi.setSystemTime(deadlineOf(NEXT) - 1);
    await setUsed(COMMISSIONER, NEXT, false);
    vi.setSystemTime(deadlineOf(NEXT));
    await expect(setUsed(COMMISSIONER, NEXT, true)).rejects.toThrow(gameweekRefusals.begun(NEXT));
  });
});

describe("the league's own deadline decides, never FPL's (Craig: \"ours, we arent fpl so stop copying them\")", () => {
  const shownDeadline = async (gameweek: number) =>
    (await (await actingAs(t, COMMISSIONER)).query(api.gameweeks.leagueGameweeks.ofLeague, { leagueId }))[gameweek - 1].deadline;

  test("a league deadline earlier than FPL's: the gameweek has begun while FPL's is still ahead", async () => {
    await holdGameweeks();
    await giveDeadlineRule(t, leagueId, 180);

    expect(await shownDeadline(NEXT)).toBe(kickoffOf(NEXT) - 3 * HOUR_MS);
    expect(Date.now()).toBeLessThan(deadlineOf(NEXT));
    await expect(setUsed(COMMISSIONER, NEXT, false)).rejects.toThrow(gameweekRefusals.begun(NEXT));
  });

  test("a league deadline later than FPL's: the gameweek can be changed after FPL's, until the league's", async () => {
    await holdGameweeks();
    await giveDeadlineRule(t, leagueId, 0);

    expect(await shownDeadline(NEXT)).toBe(kickoffOf(NEXT));
    vi.setSystemTime(deadlineOf(NEXT));
    await setUsed(COMMISSIONER, NEXT, false);
    vi.setSystemTime(kickoffOf(NEXT));
    await expect(setUsed(COMMISSIONER, NEXT, true)).rejects.toThrow(gameweekRefusals.begun(NEXT));
  });

  test("a league deadline equal to FPL's begins at that one time", async () => {
    await holdGameweeks();
    await giveDeadlineRule(t, leagueId, 90);

    expect(await shownDeadline(NEXT)).toBe(deadlineOf(NEXT));
    vi.setSystemTime(deadlineOf(NEXT) - 1);
    await setUsed(COMMISSIONER, NEXT, false);
    vi.setSystemTime(deadlineOf(NEXT));
    await expect(setUsed(COMMISSIONER, NEXT, true)).rejects.toThrow(gameweekRefusals.begun(NEXT));
  });

  test("FPL's deadline moving changes nothing", async () => {
    await holdGameweeks();
    await moveFplDeadline(t, NEXT, start - DAY_MS);
    await moveFplDeadline(t, NEXT + 1, start + DAY_MS);

    expect(await shownDeadline(NEXT)).toBe(deadlineOf(NEXT));
    await setUsed(COMMISSIONER, NEXT, false);
    expect(await used(NEXT)).toBe(false);
  });

  test("each gameweek's deadline is under the rule in force in it", async () => {
    await holdGameweeks();
    await giveDeadlineRule(t, leagueId, 180, 20);

    expect(await shownDeadline(19)).toBe(deadlineOf(19));
    expect(await shownDeadline(20)).toBe(kickoffOf(20) - 3 * HOUR_MS);
  });
});

describe("what can't be ticked", () => {
  test.each([0, GAMEWEEKS + 1, 1.5])("gameweek %s isn't one of the season's", async (gameweek) => {
    await holdGameweeks();
    await expect(setUsed(COMMISSIONER, gameweek, false)).rejects.toThrow(gameweekRefusals.notAGameweek(gameweek));
  });

  test("a gameweek whose deadline the app doesn't have is refused, saying why, and shown with none", async () => {
    await holdGameweeks([30]);
    await expect(setUsed(COMMISSIONER, 30, false)).rejects.toThrow(gameweekRefusals.noDeadline(30));
    const shown = await (await actingAs(t, COMMISSIONER)).query(api.gameweeks.leagueGameweeks.ofLeague, { leagueId });
    expect(shown[29]).toEqual({ gameweek: 30, used: true, deadline: null });
  });
});
