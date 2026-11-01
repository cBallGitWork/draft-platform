import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { FPL_DEADLINE_RULE } from "../../../convex/gameweeks/deadline";
import { GAMEWEEKS } from "../../../convex/gameweeks/usedGameweeks";
import { refusals } from "../../../convex/shared/leagueAccess";
import { unheldPlayerWords } from "../../../convex/shared/players";
import { MINUTE_MS, WEEK_MS } from "../../../convex/shared/time";
import { HELD_FIRST_RULES, KICKS_OFF_IN, holdGameweeks } from "../../support/convex/leagueRules.harness";
import { expectRefused } from "../../support/convex/test.harness";
import { COMMISSIONER, MANAGERS, actingAs, addManagers, adminCreatesLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { UNHELD } from "../../support/convex/footballRows.harness";
import { BENCH_POSITION, FOUR_FOUR_TWO, holdSquad, nameOf, SQUAD, STARTER_POSITIONS } from "../../support/convex/lineupSquad.harness";
import { ratedRoles } from "../../../convex/stars/stars";
import { NO_DATA } from "../../../convex/stars/starsShape";
import type { Position } from "../../../convex/positions/positionTables";

// What My team's Tactics tab is set from (#14): the gameweek a save now is from, its league
// deadline, the league's area limits and presets in it, the squad with each player's positions,
// and the lineup held for it.

const [ANN] = MANAGERS;
/** A player with no counted match yet: "—" for every role his positions play (#11). */
const noStarsYet = (positions: readonly Position[]) => ratedRoles(positions).map(({ area, role }) => ({ area, role, stars: NO_DATA }));
const NEXT = 9;
const CLUB = { code: 1, name: "Arsenal", shortName: "ARS" };

let t: TestConvex;
let leagueId: Id<"leagues">;
let annsTeam: Id<"teams">;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  await holdGameweeks(t, { next: NEXT });
  leagueId = await adminCreatesLeague(t);
  [annsTeam] = await addManagers(t, leagueId, [ANN]);
  // The club holdSquad puts every player at.
  await t.run((ctx) => ctx.db.insert("clubs", CLUB));
  await holdSquad(t, leagueId, annsTeam);
});

const tacticsOf = async (email: string) => (await actingAs(t, email)).query(api.lineup.tactics.ofMyTeam, { leagueId, now: Date.now() });
/** The next gameweek's kickoff, as holdGameweeks sets it, less the first rules' deadline. */
const nextDeadline = () => Date.now() + KICKS_OFF_IN - FPL_DEADLINE_RULE.minutesBeforeFirstKickoff * MINUTE_MS;

describe("the lineup to set", () => {
  test("is the next gameweek's, with its league deadline, the league's limits and presets, and the squad", async () => {
    const deadline = nextDeadline();
    const tactics = await tacticsOf(ANN);

    expect(tactics).toMatchObject({
      kind: "open",
      gameweek: NEXT,
      deadline,
      areaLimits: HELD_FIRST_RULES.areaLimits,
      presets: HELD_FIRST_RULES.presets,
      // Never saved: its first lineup, picked from the squad (spec/05, #637).
      lineup: { fromGameweek: null, starters: FOUR_FOUR_TWO.starters, bench: FOUR_FOUR_TWO.bench },
    });
    if (tactics.kind !== "open") throw new Error("expected an open gameweek");
    expect(tactics.squad).toEqual(
      SQUAD.map((code) => ({ playerCode: code, name: nameOf(code), clubShortName: CLUB.shortName, clubCode: CLUB.code, unheld: false, positions: STARTER_POSITIONS.get(code) ?? [BENCH_POSITION], number: null, stars: noStarsYet(STARTER_POSITIONS.get(code) ?? [BENCH_POSITION]) })),
    );
  });

  test("keeps a squad player the football sync doesn't hold, saying so in place of his name (#323)", async () => {
    await t.run((ctx) => ctx.db.insert("squadPlayers", { leagueId, teamId: annsTeam, playerCode: UNHELD }));
    const tactics = await tacticsOf(ANN);
    if (tactics.kind !== "open") throw new Error("expected an open gameweek");
    expect(tactics.squad.at(-1)).toEqual({ playerCode: UNHELD, name: unheldPlayerWords(UNHELD), clubShortName: null, clubCode: null, unheld: true, positions: [], number: null, stars: [] });
    expect(tactics.squad).toHaveLength(SQUAD.length + 1);
  });

  test("sends each player's stars, which pick the role his first lineup puts him on (#11)", async () => {
    const [keeper] = FOUR_FOUR_TWO.starters;
    const ratings = [
      { area: "goalkeeper" as const, role: "shotStopper", perMatch: 2, stars: 2 },
      { area: "goalkeeper" as const, role: "sweeperKeeper", perMatch: 3, stars: 4.5 },
    ];
    await t.run((ctx) => ctx.db.insert("playerRoleStars", { playerCode: keeper.playerCode, matches: 3, ratings }));

    const tactics = await tacticsOf(ANN);
    if (tactics.kind !== "open") throw new Error("expected an open gameweek");
    expect(tactics.squad.find((member) => member.playerCode === keeper.playerCode)?.stars).toEqual(ratings.map(({ area, role, stars }) => ({ area, role, stars })));
    expect(tactics.lineup.starters[0]).toEqual({ ...keeper, role: "sweeperKeeper" });
  });

  test("holds the lineup the manager saved", async () => {
    const ann = await actingAs(t, ANN);
    await ann.mutation(api.lineup.lineups.save, { leagueId, lineup: { starters: [...FOUR_FOUR_TWO.starters], bench: [...FOUR_FOUR_TWO.bench] } });

    expect(await tacticsOf(ANN)).toMatchObject({ lineup: { fromGameweek: NEXT, starters: FOUR_FOUR_TWO.starters, bench: FOUR_FOUR_TWO.bench } });
  });

  test("moves on to the gameweek after once the deadline passes, counting down to that one's", async () => {
    const deadline = nextDeadline();
    vi.advanceTimersByTime(deadline - Date.now());
    expect(await tacticsOf(ANN)).toMatchObject({ gameweek: NEXT + 1, deadline: deadline + WEEK_MS });
  });

  test("counts down to the league's recorded deadline for its gameweek once one is recorded", async () => {
    const recorded = nextDeadline() - MINUTE_MS;
    vi.advanceTimersByTime(recorded - Date.now() - MINUTE_MS);
    await t.run(async (ctx) => {
      await ctx.db.insert("passedDeadlines", { leagueId, gameweek: NEXT, deadline: recorded, recordedAt: Date.now() });
    });
    // deadlineRecorder.ts writes the row once the deadline passes; here it is ahead of the clock
    // asked, so the gameweek is still open and the recorded time is the one counted down to.
    expect(await tacticsOf(ANN)).toMatchObject({ gameweek: NEXT, deadline: recorded });
  });
});

describe("no lineup to set", () => {
  test("for a league made before rules were held", async () => {
    await t.run(async (ctx) => {
      for (const row of await ctx.db.query("leagueRules").collect()) await ctx.db.delete("leagueRules", row._id);
    });
    expect(await tacticsOf(ANN)).toEqual({ kind: "noRules" });
  });

  test("once every gameweek has begun", async () => {
    vi.advanceTimersByTime((GAMEWEEKS - NEXT + 1) * WEEK_MS);
    expect(await tacticsOf(ANN)).toEqual({ kind: "seasonOver" });
  });

  test("is refused to someone who runs no team in the league", async () => {
    await expectRefused(tacticsOf(COMMISSIONER), refusals.runsNoTeam);
  });
});
