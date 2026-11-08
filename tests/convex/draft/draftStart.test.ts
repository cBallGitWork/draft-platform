import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { draftOrderRefusals } from "../../../convex/draft/draftOrder";
import { draftStartRefusals } from "../../../convex/draft/draftStart";
import { refusals } from "../../../convex/shared/leagueAccess";
import { DAY_MS, HOUR_MS, MINUTE_MS, SECOND_MS } from "../../../convex/shared/time";
import { SAKA } from "../../support/convex/footballRows.harness";
import { changeRules, HELD_FIRST_RULES, holdGameweeks, rulesWith } from "../../support/convex/leagueRules.harness";
import { elapse, expectRefused } from "../../support/convex/test.harness";
import { actingAs, addManager, addManagers, adminCreatesLeague, COMMISSIONER, MANAGERS, OUTSIDER, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// Starting the draft (spec/04, Starting it; #1089): on the commissioner's date or when he presses
// start, with the teams there, at least 2, in a league with a squad size limit; in the draft order
// he set or drew at random, or the order the teams joined; and no new team joins after (Craig,
// 4 Nov 2026).

let t: TestConvex;
let leagueId: Id<"leagues">;
let teams: Id<"teams">[];
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t, 5);
  teams = await addManagers(t, leagueId, MANAGERS.slice(0, 3));
});

const ROUNDS = HELD_FIRST_RULES.squad.size!.maximum;

const as = (email = COMMISSIONER) => actingAs(t, email);
const read = async (email = COMMISSIONER) => (await as(email)).query(api.draft.draftStart.ofLeague, { leagueId, now: Date.now() });
const start = async (email = COMMISSIONER) => (await as(email)).mutation(api.draft.draftStart.start, { leagueId });
const setStart = async (startsAt: number | null) => (await as()).mutation(api.draft.draftStart.setStart, { leagueId, startsAt });
const draw = async () => (await as()).mutation(api.draft.draftOrder.drawTeamOrder, { leagueId });
const setOrder = async (teamIds: Id<"teams">[]) => (await as()).mutation(api.draft.draftOrder.setTeamOrder, { leagueId, teamIds });
const orderOf = async () => (await read()).order.map(({ teamId }) => teamId);
const status = async () => (await read()).status;
/** The clock moves on `ms`, and every start scheduled by then runs. */
const pass = (ms: number) => elapse(t, ms);
/** A league of its own with one team. */
async function leagueOfOne() {
  const lonely = await adminCreatesLeague(t, 4, "Lonely League");
  await addManager(t, lonely, MANAGERS[4]);
  return lonely;
}
/** The league's latest rules lose their squad size limit. */
const dropSquadSize = () =>
  t.run(async (ctx) => {
    const row = (await ctx.db.query("leagueRules").withIndex("by_leagueId_and_fromGameweek", (q) => q.eq("leagueId", leagueId)).order("desc").first())!;
    await ctx.db.patch("leagueRules", row._id, { rules: { ...row.rules, squad: { ...row.rules.squad, size: null } } });
  });

describe("before it starts", () => {
  test("waits with no date for the commissioner to press start, in the order the teams joined, over the squad's most players", async () => {
    expect(await read()).toEqual({
      status: "waiting",
      startsAt: null,
      rounds: ROUNDS,
      order: [
        { teamId: teams[0], name: "Team 1" },
        { teamId: teams[1], name: "Team 2" },
        { teamId: teams[2], name: "Team 3" },
      ],
    });
  });

  test("is read by every manager in the league, and no one outside it", async () => {
    expect((await read(MANAGERS[0])).status).toBe("waiting");
    await expectRefused(read(OUTSIDER), refusals.notInLeague);
  });

  test("has no rounds in a league with no squad size limit", async () => {
    await dropSquadSize();
    expect((await read()).rounds).toBeNull();
  });
});

describe("pressing start", () => {
  test("starts it now, with the teams there in the order they joined, the first team on the clock", async () => {
    const now = Date.now();
    await start();

    expect(await read()).toEqual({
      status: "live",
      startedAt: now,
      rounds: ROUNDS,
      order: [
        { teamId: teams[0], name: "Team 1" },
        { teamId: teams[1], name: "Team 2" },
        { teamId: teams[2], name: "Team 3" },
      ],
      picksMade: 0,
      onTheClock: { pick: 1, round: 1, teamId: teams[0], name: "Team 1" },
      clock: { startsAt: now, endsAt: now + HELD_FIRST_RULES.draft!.pickSeconds * SECOND_MS },
    });
  });

  test("runs with fewer teams than the league's maximum: 3 of 5", async () => {
    await start();
    expect(await orderOf()).toEqual(teams);
  });

  test("uses the order the commissioner set", async () => {
    await setOrder([teams[2], teams[0], teams[1]]);
    await start();

    expect(await read()).toMatchObject({ order: [{ teamId: teams[2] }, { teamId: teams[0] }, { teamId: teams[1] }], onTheClock: { teamId: teams[2] } });
  });

  test("is refused a second time, and keeps the draft as it started", async () => {
    await start();
    const started = await read();

    await expectRefused(start(), draftStartRefusals.started);
    expect(await read()).toEqual(started);
  });

  test("is refused with fewer than 2 teams", async () => {
    leagueId = await leagueOfOne();
    await expectRefused(start(), draftStartRefusals.tooFewTeams);
    expect(await status()).toBe("waiting");
  });

  test("is refused in a league with no squad size limit", async () => {
    await dropSquadSize();
    await expectRefused(start(), draftStartRefusals.noSquadSize);
  });

  test("is refused while any squad holds a player", async () => {
    await t.run((ctx) => ctx.db.insert("squadPlayers", { leagueId, teamId: teams[1], playerCode: SAKA.code }));
    await expectRefused(start(), draftStartRefusals.squadsNotEmpty);
    await expectRefused(setStart(Date.now() + DAY_MS), draftStartRefusals.squadsNotEmpty);
    expect(await status()).toBe("waiting");
  });

  test("takes its rounds and its squad rules from a change waiting for the next gameweek, as the waiting draft shows them (#1130, S04.1)", async () => {
    await holdGameweeks(t, { next: 5 });
    const waiting = { ...HELD_FIRST_RULES.squad, size: { minimum: 11, maximum: ROUNDS - 1 } };
    expect(await changeRules(t, leagueId, rulesWith({ squad: waiting }))).toBe(5);
    expect(await read()).toMatchObject({ status: "waiting", rounds: ROUNDS - 1 });
    await start();

    expect(await read()).toMatchObject({ status: "live", rounds: ROUNDS - 1 });
    const started = await t.run(async (ctx) => (await ctx.db.query("drafts").withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId)).unique())!.started);
    expect(started?.squad).toEqual(waiting);
  });

  test("is refused to a manager", async () => {
    await expectRefused(start(MANAGERS[0]), refusals.notRunner);
    expect(await status()).toBe("waiting");
  });

  test("cancels a date set, which then starts nothing", async () => {
    // Within the first pick's clock, so only the cancelled start could change anything.
    await setStart(Date.now() + MINUTE_MS);
    await start();
    const started = await read();
    await pass(MINUTE_MS);

    expect(await read()).toEqual(started);
  });
});

describe("a start date", () => {
  test("starts the draft when it comes, and not before", async () => {
    const startsAt = Date.now() + DAY_MS;
    await setStart(startsAt);
    expect(await read()).toMatchObject({ status: "waiting", startsAt });

    await pass(DAY_MS - HOUR_MS);
    expect(await status()).toBe("waiting");
    await pass(HOUR_MS);
    expect(await read()).toMatchObject({ status: "live", startedAt: startsAt, order: [{ teamId: teams[0] }, { teamId: teams[1] }, { teamId: teams[2] }] });
  });

  test("changed, starts it at the new date only", async () => {
    await setStart(Date.now() + HOUR_MS);
    const later = Date.now() + DAY_MS;
    await setStart(later);

    await pass(2 * HOUR_MS);
    expect(await read()).toMatchObject({ status: "waiting", startsAt: later });
    await pass(DAY_MS);
    expect(await status()).toBe("live");
  });

  test("cleared, goes back to waiting for the commissioner to press start", async () => {
    await setStart(Date.now() + HOUR_MS);
    await setStart(null);

    await pass(DAY_MS);
    expect(await read()).toMatchObject({ status: "waiting", startsAt: null });
  });

  test("must be in the future", async () => {
    await expectRefused(setStart(Date.now()), draftStartRefusals.notAhead);
    await expectRefused(setStart(Date.now() - HOUR_MS), draftStartRefusals.notAhead);
  });

  test("can't be set until the league has 2 teams", async () => {
    leagueId = await leagueOfOne();
    await expectRefused(setStart(Date.now() + DAY_MS), draftStartRefusals.tooFewTeams);
  });

  test("can't be set in a league with no squad size limit", async () => {
    await dropSquadSize();
    await expectRefused(setStart(Date.now() + DAY_MS), draftStartRefusals.noSquadSize);
  });

  test("can't be set or cleared once the draft has started", async () => {
    await start();
    await expectRefused(setStart(Date.now() + DAY_MS), draftStartRefusals.started);
    await expectRefused(setStart(null), draftStartRefusals.started);
  });

  test("that comes when the league can't start leaves it waiting, its date cleared", async () => {
    await setStart(Date.now() + DAY_MS);
    await dropSquadSize();

    await pass(DAY_MS);
    expect(await read()).toMatchObject({ status: "waiting", startsAt: null });
    await expectRefused(start(), draftStartRefusals.noSquadSize);
  });

  test("set in a league that is then deleted for good starts nothing", async () => {
    await setStart(Date.now() + 2 * DAY_MS);
    await (await as()).mutation(api.leagues.leagueDeletion.deleteLeague, { leagueId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(await t.run((ctx) => ctx.db.query("drafts").collect())).toEqual([]);
  });
});

describe("the order drawn at random", () => {
  test("holds every team once, stays as drawn, and is the order the draft starts in", async () => {
    await draw();
    const drawn = await orderOf();

    expect([...drawn].sort()).toEqual([...teams].sort());
    expect(await orderOf()).toEqual(drawn);
    await start();
    expect(await orderOf()).toEqual(drawn);
  });

  test("puts a team that joins after the draw at the bottom, and isn't drawn again on its own", async () => {
    await draw();
    const drawn = await orderOf();
    const [joined] = await addManagers(t, leagueId, [MANAGERS[3]]);

    expect(await orderOf()).toEqual([...drawn, joined]);
  });

  test("can be drawn again, or moved by hand, as often as the commissioner likes before the start", async () => {
    await draw();
    await draw();
    await setOrder([teams[1], teams[2], teams[0]]);
    expect(await orderOf()).toEqual([teams[1], teams[2], teams[0]]);
    await draw();
    expect([...(await orderOf())].sort()).toEqual([...teams].sort());
  });
});

describe("once it has started", () => {
  beforeEach(() => start());

  test("its order can't be drawn or moved", async () => {
    const order = await orderOf();
    await expectRefused(draw(), draftOrderRefusals.started);
    await expectRefused(setOrder([...teams].reverse()), draftOrderRefusals.started);
    expect(await orderOf()).toEqual(order);
  });

  test("no new team can join", async () => {
    await expectRefused(addManager(t, leagueId, MANAGERS[3]), refusals.draftStarted);
    await expectRefused((await as()).mutation(api.joining.invites.send, { leagueId, email: MANAGERS[3] }), refusals.draftStarted);
  });

  test("a vacated team can still be handed on", async () => {
    await (await as()).mutation(api.leagues.teams.removeManager, { leagueId, teamId: teams[0] });
    expect(await addManager(t, leagueId, MANAGERS[3], teams[0])).toBe(teams[0]);
  });

  test("shows a team renamed since under its new name", async () => {
    await (await as(MANAGERS[1])).mutation(api.leagues.teams.rename, { teamId: teams[1], name: "Kroos Control" });
    expect((await read()).order[1]).toEqual({ teamId: teams[1], name: "Kroos Control" });
  });
});
