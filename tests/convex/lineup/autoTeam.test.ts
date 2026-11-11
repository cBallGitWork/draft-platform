import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { recordPassedDeadlines } from "../../../convex/gameweeks/deadlineRecorder";
import { autoTeamLetters, autoTeamRefusals } from "../../../convex/lineup/autoTeamWords";
import { lineupInGameweek } from "../../../convex/lineup/lineups";
import type { Availability } from "../../../convex/availability/availability";
import { WEEK_MS } from "../../../convex/shared/time";
import { holdGameweeks } from "../../support/convex/leagueRules.harness";
import { ADMIN, COMMISSIONER, MANAGERS, actingAs, addManager, addManagers, adminCreatesLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { FIRST_SUB } from "../../support/convex/lineup.harness";
import { FOUR_FOUR_TWO, holdSquad, passNextDeadline, squadMoves } from "../../support/convex/lineupSquad.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// The auto team (spec/09, The auto team; #1207): at each deadline it keeps the team's last lineup
// and brings the first bench player who fits on for a starter who is out, never one who is only
// doubtful. A person's switch stays on until switched off or the gameweek its manager named; an
// illegal lineup switches it on for its gameweek alone; a team with no manager is on it until
// handed on. Switching it files a letter (spec/16).

const [ANN, BOB] = MANAGERS;
const NEXT = 9;

/** The 4-4-2's midfielders, each of whom the first bench player, a CM, can stand in for. */
const [OUT_MIDFIELDER, DOUBTFUL_MIDFIELDER] = FOUR_FOUR_TWO.starters.filter(({ area }) => area === "midfield").map(({ playerCode }) => playerCode);

let t: TestConvex;
let leagueId: Id<"leagues">;
let annsTeam: Id<"teams">;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  await holdGameweeks(t, { next: NEXT });
  leagueId = await adminCreatesLeague(t);
  [annsTeam] = await addManagers(t, leagueId, [ANN, BOB]);
  await holdSquad(t, leagueId, annsTeam);
  await (await actingAs(t, ANN)).mutation(api.lineup.lineups.save, { leagueId, lineup: { starters: [...FOUR_FOUR_TWO.starters], bench: [...FOUR_FOUR_TWO.bench] } });
});

const setAvailability = (code: number, availability: Availability) =>
  t.run(async (ctx) => {
    const player = (await ctx.db.query("players").withIndex("by_code", (q) => q.eq("code", code)).unique())!;
    await ctx.db.patch("players", player._id, { availability });
  });

const switches = async (by: string, on: boolean, endsAfter?: number) =>
  (await actingAs(t, by)).mutation(api.lineup.autoTeam.set, { leagueId, teamId: annsTeam, on, ...(endsAfter === undefined ? {} : { endsAfter }) });

/** Runs the jobs due now, the auto team's among them, and none set for a later deadline. */
const runDue = async () => {
  vi.advanceTimersByTime(0);
  await t.finishInProgressScheduledFunctions();
};
/** Past gameweek NEXT's deadline, with the auto team run. */
const passDeadline = async () => {
  await passNextDeadline(t);
  await runDue();
};
/** Past the deadline of the gameweek after the last one passed. */
const passWeekOn = async () => {
  vi.advanceTimersByTime(WEEK_MS);
  await t.run((ctx) => recordPassedDeadlines(ctx));
  await runDue();
};

const startersIn = async (gameweek: number) => (await t.run((ctx) => lineupInGameweek(ctx, leagueId, annsTeam, gameweek))).starters.map(({ playerCode }) => playerCode);
const benchIn = async (gameweek: number) => (await t.run((ctx) => lineupInGameweek(ctx, leagueId, annsTeam, gameweek))).bench;
const switchOf = () => t.run(async (ctx) => (await ctx.db.get("teams", annsTeam))!.autoTeam ?? null);
const lettersTo = (email: string) => t.run((ctx) => ctx.db.query("letters").withIndex("by_to_and_at", (q) => q.eq("to", email)).collect());
const subjectsTo = async (email: string) => (await lettersTo(email)).map((letter) => letter.subject);

describe("switched on by a person", () => {
  test("an out starter is swapped for the first bench player who fits, and a doubtful one is kept", async () => {
    await switches(ANN, true);
    await setAvailability(OUT_MIDFIELDER, "out");
    await setAvailability(DOUBTFUL_MIDFIELDER, "doubtful");
    await passDeadline();

    const starters = await startersIn(NEXT);
    expect(starters).not.toContain(OUT_MIDFIELDER);
    expect(starters).toContain(FIRST_SUB);
    expect(starters).toContain(DOUBTFUL_MIDFIELDER);
    // He takes the out starter's place on the bench: no one is dropped or added.
    expect(await benchIn(NEXT)).toEqual(FOUR_FOUR_TWO.bench.map((code) => (code === FIRST_SUB ? OUT_MIDFIELDER : code)));
    expect(await switchOf()).toEqual({ by: ANN });
  });

  test("it stays on: a starter out at the next deadline is swapped too", async () => {
    await switches(COMMISSIONER, true);
    await passDeadline();
    await setAvailability(DOUBTFUL_MIDFIELDER, "out");
    await passWeekOn();
    expect(await startersIn(NEXT + 1)).not.toContain(DOUBTFUL_MIDFIELDER);
  });

  test("off, an out starter stays in the lineup", async () => {
    await setAvailability(OUT_MIDFIELDER, "out");
    await passDeadline();
    expect(await startersIn(NEXT)).toEqual(FOUR_FOUR_TWO.starters.map(({ playerCode }) => playerCode));
  });

  test("a holiday ends after its gameweek: on through it, off from the next, with a letter", async () => {
    await switches(ANN, true, NEXT);
    await setAvailability(OUT_MIDFIELDER, "out");
    await passDeadline();
    expect(await startersIn(NEXT)).not.toContain(OUT_MIDFIELDER);
    expect(await switchOf()).toBeNull();
    expect(await subjectsTo(BOB)).toContain(autoTeamLetters.ended(await teamNameOf(), NEXT).subject);

    await setAvailability(DOUBTFUL_MIDFIELDER, "out");
    await passWeekOn();
    expect(await startersIn(NEXT + 1)).toContain(DOUBTFUL_MIDFIELDER);
  });

  test("switching it on and off files a letter to the whole league", async () => {
    await switches(ANN, true, NEXT + 2);
    await switches(COMMISSIONER, false);
    const name = await teamNameOf();
    const subjects = await subjectsTo(BOB);
    expect(subjects).toContain(`${name} is on the auto team`);
    expect(subjects).toContain(`${name} is off the auto team`);
    const on = (await lettersTo(BOB)).find((letter) => letter.subject === `${name} is on the auto team`)!;
    expect(on.body).toContain(`until after gameweek ${NEXT + 2}`);
  });
});

describe("who may switch it", () => {
  test("another manager may not", async () => {
    await expect(switches(BOB, true)).rejects.toThrow(autoTeamRefusals.notYours);
  });

  test("only the team's own manager names a gameweek it ends after", async () => {
    await expect(switches(COMMISSIONER, true, NEXT)).rejects.toThrow(autoTeamRefusals.endsAfterOnlyManager);
  });

  test("the gameweek it ends after is one not yet begun", async () => {
    await expect(switches(ANN, true, NEXT - 1)).rejects.toThrow(autoTeamRefusals.endsAfterOutOfRange(NEXT, 38));
  });

  test("its manager reads it on My team: off, then on until the gameweek named", async () => {
    const read = async () => (await actingAs(t, ANN)).query(api.lineup.autoTeam.ofMyTeam, { leagueId });
    expect(await read()).toEqual({ teamId: annsTeam, on: false, endsAfter: null, lastGameweek: 38 });
    await switches(ANN, true, NEXT + 2);
    expect(await read()).toEqual({ teamId: annsTeam, on: true, endsAfter: NEXT + 2, lastGameweek: 38 });
  });

  test("it can't be switched on twice, nor off while off", async () => {
    await expect(switches(ANN, false)).rejects.toThrow(autoTeamRefusals.alreadyOff);
    await switches(ANN, true);
    await expect(switches(ADMIN, true)).rejects.toThrow(autoTeamRefusals.alreadyOn);
  });
});

describe("an illegal lineup", () => {
  test("switches it on for that gameweek alone: the gap filled, a letter filed, and off again after", async () => {
    // Released before the deadline, a starter leaves his slot empty: ten starters can't stand.
    await (await squadMoves(t, leagueId, COMMISSIONER)).release(OUT_MIDFIELDER);
    await passDeadline();

    const starters = await startersIn(NEXT);
    expect(starters).toHaveLength(11);
    expect(starters).toContain(FIRST_SUB);
    expect(await switchOf()).toBeNull();
    expect(await subjectsTo(ANN)).toContain(autoTeamLetters.fixed(await teamNameOf(), NEXT).subject);

    await setAvailability(DOUBTFUL_MIDFIELDER, "out");
    await passWeekOn();
    expect(await startersIn(NEXT + 1)).toContain(DOUBTFUL_MIDFIELDER);
  });
});

describe("a team with no manager", () => {
  test("is on it until handed on, and handing it on switches it off", async () => {
    await switches(ANN, true);
    await (await actingAs(t, COMMISSIONER)).mutation(api.leagues.teams.removeManager, { leagueId, teamId: annsTeam });
    await expect(switches(COMMISSIONER, false)).rejects.toThrow(autoTeamRefusals.noManager);
    await setAvailability(OUT_MIDFIELDER, "out");
    await passDeadline();
    expect(await startersIn(NEXT)).not.toContain(OUT_MIDFIELDER);

    await addManager(t, leagueId, "new@example.com", annsTeam);
    expect(await switchOf()).toBeNull();
  });

  test("never switched on, it is still on", async () => {
    await (await actingAs(t, ANN)).mutation(api.leagues.teams.leave, { leagueId });
    await setAvailability(OUT_MIDFIELDER, "out");
    await passDeadline();
    expect(await startersIn(NEXT)).not.toContain(OUT_MIDFIELDER);
  });
});

const teamNameOf = () => t.run(async (ctx) => (await ctx.db.get("teams", annsTeam))!.name);

describe("the team's instructions", () => {
  test("carry on into the lineup the auto team saves for a later gameweek: it only touches the lineup", async () => {
    const instructions = { attacking: "shootOnSight", defensive: "pressHigh" };
    await t.run(async (ctx) => {
      const saved = (await ctx.db.query("lineups").withIndex("by_leagueId_and_teamId_and_fromGameweek", (q) => q.eq("leagueId", leagueId).eq("teamId", annsTeam).eq("fromGameweek", NEXT)).unique())!;
      await ctx.db.patch("lineups", saved._id, { instructions });
    });
    await switches(ANN, true);
    await passDeadline();
    await setAvailability(OUT_MIDFIELDER, "out");
    await passWeekOn();

    expect(await startersIn(NEXT + 1)).not.toContain(OUT_MIDFIELDER);
    const rows = await t.run((ctx) => ctx.db.query("lineups").withIndex("by_leagueId_and_teamId_and_fromGameweek", (q) => q.eq("leagueId", leagueId).eq("teamId", annsTeam).gte("fromGameweek", NEXT)).collect());
    expect(rows.map(({ fromGameweek, instructions: kept }) => ({ fromGameweek, kept }))).toEqual([
      { fromGameweek: NEXT, kept: instructions },
      { fromGameweek: NEXT + 1, kept: instructions },
    ]);
  });
});
