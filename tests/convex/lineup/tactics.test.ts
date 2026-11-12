import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { DEFAULT_DEADLINE_RULE } from "../../../convex/gameweeks/deadline";
import { PL_GAMEWEEKS } from "../../support/convex/footballRows.harness";
import { pickFirstLineupAgain } from "../../../convex/lineup/lineups";
import { refusals } from "../../../convex/shared/leagueAccess";
import { unheldPlayerWords } from "../../../convex/shared/players";
import { MINUTE_MS, WEEK_MS } from "../../../convex/shared/time";
import { HELD_FIRST_RULES, KICKS_OFF_IN, holdGameweeks } from "../../support/convex/leagueRules.harness";
import { expectRefused } from "../../support/convex/test.harness";
import { COMMISSIONER, actingAs, addManagers, adminCreatesLeague, type TestConvex, ANN } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { UNHELD } from "../../support/convex/footballRows.harness";
import { BENCH_POSITION, FOUR_FOUR_TWO, holdSquad, nameOf, NEXT, SQUAD, STARTER_POSITIONS } from "../../support/convex/lineupSquad.harness";
import { ratedRoles } from "../../../convex/stars/stars";
import { NO_DATA } from "../../../convex/stars/starsShape";
import type { Position } from "../../../convex/positions/positionTables";
import { movedToFullBack } from "../../support/convex/positionStarts.harness";

// What My team's Tactics tab is set from (#14): the gameweek a save now is from, its league
// deadline, the league's area limits and presets in it, the squad with each player's positions,
// and the lineup held for it.

/** A player with no counted match yet: "—" for every role his positions play (#11). */
const noStarsYet = (positions: readonly Position[]) => ratedRoles(positions).map(({ area, role }) => ({ area, role, stars: NO_DATA }));
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
const nextDeadline = () => Date.now() + KICKS_OFF_IN - DEFAULT_DEADLINE_RULE.minutesBeforeFirstKickoff * MINUTE_MS;

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
      // The lineup it got with its squad: its first, picked from the squad (spec/05, #637, #1040).
      lineup: { fromGameweek: NEXT, starters: FOUR_FOUR_TWO.starters, bench: FOUR_FOUR_TWO.bench },
    });
    if (tactics.kind !== "open") throw new Error("expected an open gameweek");
    expect(tactics.squad).toEqual(
      SQUAD.map((code) => ({ playerCode: code, name: nameOf(code), clubShortName: CLUB.shortName, clubCode: CLUB.code, unheld: false, positions: STARTER_POSITIONS.get(code) ?? [BENCH_POSITION], flagged: [], number: null, stars: noStarsYet(STARTER_POSITIONS.get(code) ?? [BENCH_POSITION]), availability: "available" })),
    );
  });

  test("keeps a squad player the football sync doesn't hold, saying so in place of his name (#323)", async () => {
    await t.run((ctx) => ctx.db.insert("squadPlayers", { leagueId, teamId: annsTeam, playerCode: UNHELD }));
    const tactics = await tacticsOf(ANN);
    if (tactics.kind !== "open") throw new Error("expected an open gameweek");
    expect(tactics.squad.at(-1)).toEqual({ playerCode: UNHELD, name: unheldPlayerWords(UNHELD), clubShortName: null, clubCode: null, unheld: true, positions: [], flagged: [], number: null, stars: [], availability: null });
    expect(tactics.squad).toHaveLength(SQUAD.length + 1);
  });

  test("sends each player's positions flagged by a run elsewhere, with its length, for the mark after his name (#23)", async () => {
    const [benched] = FOUR_FOUR_TWO.bench;
    await t.run(async (ctx) => {
      const row = await ctx.db.query("playerPositions").withIndex("by_code", (q) => q.eq("code", benched)).unique();
      await ctx.db.patch("playerPositions", row!._id, { starts: movedToFullBack(3), approved: ["CB", "FB"], set: [] });
    });
    const tactics = await tacticsOf(ANN);
    if (tactics.kind !== "open") throw new Error("expected an open gameweek");
    expect(tactics.squad.find((member) => member.playerCode === benched)).toMatchObject({ positions: ["CB", "FB"], flagged: [{ position: "CB", startsElsewhere: 3 }] });
  });

  test("sends each player's stars, which pick the role his first lineup puts him on (#11)", async () => {
    const [keeper] = FOUR_FOUR_TWO.starters;
    const ratings = [
      { area: "goalkeeper" as const, role: "shotStopper", perMatch: 2, stars: 2 },
      { area: "goalkeeper" as const, role: "sweeperKeeper", perMatch: 3, stars: 4.5 },
    ];
    // His stars held before his squad's first lineup is picked.
    await t.run(async (ctx) => {
      await ctx.db.insert("playerRoleStars", { playerCode: keeper.playerCode, matches: 3, ratings });
      for (const row of await ctx.db.query("lineups").collect()) await ctx.db.delete("lineups", row._id);
      await pickFirstLineupAgain(ctx, leagueId, annsTeam);
    });

    const tactics = await tacticsOf(ANN);
    if (tactics.kind !== "open") throw new Error("expected an open gameweek");
    expect(tactics.squad.find((member) => member.playerCode === keeper.playerCode)?.stars).toEqual(ratings.map(({ area, role, stars }) => ({ area, role, stars })));
    expect(tactics.lineup.starters[0]).toEqual({ ...keeper, role: "sweeperKeeper" });
  });

  test("sends each player's availability, the admin's over the feed's, which Quick Pick reads (#849)", async () => {
    const [keeper, back] = FOUR_FOUR_TWO.starters;
    await t.run(async (ctx) => {
      const row = await ctx.db.query("players").withIndex("by_code", (q) => q.eq("code", keeper.playerCode)).unique();
      await ctx.db.patch("players", row!._id, { availability: "doubtful" });
      await ctx.db.insert("availabilitySettings", { code: back.playerCode, availability: "out" });
    });
    const tactics = await tacticsOf(ANN);
    if (tactics.kind !== "open") throw new Error("expected an open gameweek");
    const availabilityOf = (code: number) => tactics.squad.find((member) => member.playerCode === code)?.availability;
    expect([availabilityOf(keeper.playerCode), availabilityOf(back.playerCode)]).toEqual(["doubtful", "out"]);
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
  test("once every gameweek has begun", async () => {
    vi.advanceTimersByTime((PL_GAMEWEEKS - NEXT + 1) * WEEK_MS);
    expect(await tacticsOf(ANN)).toEqual({ kind: "seasonOver" });
  });

  test("is refused to someone who runs no team in the league", async () => {
    await expectRefused(tacticsOf(COMMISSIONER), refusals.runsNoTeam);
  });
});
