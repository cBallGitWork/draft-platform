import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { recordPassedDeadlines } from "../../../convex/gameweeks/deadlineRecorder";
import { leagueAverageWords } from "../../../convex/mail/letterWords";
import { seasonRules } from "../../../convex/rules/rulesHistory";
import { refusals } from "../../../convex/shared/leagueAccess";
import { HOUR_MS } from "../../../convex/shared/time";
import { fixtureEditRefusals, swapSides } from "../../../convex/table/fixtureEdits";
import { scheduleOf } from "../../../convex/table/playedFixtures";
import { LEAGUE_AVERAGE, type Fixture } from "../../../convex/table/roundRobin";
import { changeRules, rulesWith, holdGameweeks, playUpTo } from "../../support/convex/leagueRules.harness";
import { actingAs, addManagers, ADMIN, adminCreatesLeague, COMMISSIONER, MANAGERS, teamName, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { expectRefused } from "../../support/convex/test.harness";

// The commissioner swaps a side between two games in a gameweek not yet begun (spec/09, Fixture
// edits; #1208): every team still plays the same number of games, the league's average swaps like
// a team, every other gameweek stays as drawn, and the whole league gets a letter (spec/16).

const [ANN, BOB, CAT, DAN] = MANAGERS;
/** The gameweek the tests edit, not yet begun. */
const EDITED = 4;
/** How long after the tests start gameweek 1 kicks off: each next gameweek kicks off a week on. */
const KICKS_OFF_IN = 2 * HOUR_MS;

type Side = Id<"teams"> | typeof LEAGUE_AVERAGE;
type Game = Fixture<Id<"teams">>;
type Picked = { moves: Side; against: Side };

let t: TestConvex;
let leagueId: Id<"leagues">;
let firstKickoff: number;

async function leagueOf(emails: string[]): Promise<void> {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t);
  await addManagers(t, leagueId, emails);
  firstKickoff = Date.now() + KICKS_OFF_IN;
  await holdGameweeks(t, { next: 1, kicksOffIn: KICKS_OFF_IN });
}

/** The league's fixtures by gameweek, by team id. */
const schedule = () =>
  t.run(async (ctx) => {
    const league = (await ctx.db.get("leagues", leagueId))!;
    return scheduleOf(ctx, league, (await seasonRules(ctx, leagueId))!);
  });
const gamesIn = async (gameweek: number) => (await schedule()).find((each) => each.gameweek === gameweek)!.fixtures;

const swaps = async (by: string, one: Picked, other: Picked, gameweek = EDITED) =>
  (await actingAs(t, by)).mutation(api.table.fixtureEdits.swap, { leagueId, gameweek, one, other });


/** How many games each side plays in `games`. */
function gamesEach(games: readonly Game[]): Map<Side, number> {
  const count = new Map<Side, number>();
  for (const { team, opponent } of games) for (const side of [team, opponent]) count.set(side, (count.get(side) ?? 0) + 1);
  return count;
}

/** Who plays whom in `games`, whichever side each is listed on. */
const pairsOf = (games: readonly Game[]) => games.map(({ team, opponent }) => [team, opponent].toSorted().join(" v ")).toSorted();

/** The first side of the first game and the second side of the second, picked to swap. */
const firstTwo = ([one, other]: readonly Game[]): [Picked, Picked] => [
  { moves: one.team, against: one.opponent },
  { moves: other.opponent, against: other.team },
];

const lettersAbout = (gameweek: number) =>
  t.run(async (ctx) => (await ctx.db.query("letters").collect()).filter((letter) => letter.subject === `Gameweek ${gameweek}'s fixtures were changed`));

describe("four teams", () => {
  beforeEach(() => leagueOf([ANN, BOB, CAT, DAN]));

  test("a swap in an open gameweek moves the two sides, and every team still plays once", async () => {
    const before = await gamesIn(EDITED);
    const [one, other] = firstTwo(before);
    await swaps(COMMISSIONER, one, other);

    const after = await gamesIn(EDITED);
    expect(after[0]).toEqual({ team: other.moves, opponent: one.against });
    expect(after[1]).toEqual({ team: before[0].team, opponent: before[1].team });
    expect([...gamesEach(after).values()]).toEqual([1, 1, 1, 1]);
  });

  test("every other gameweek stays as drawn", async () => {
    const before = await schedule();
    await swaps(COMMISSIONER, ...firstTwo(await gamesIn(EDITED)));
    const after = await schedule();
    expect(after.filter(({ gameweek }) => gameweek !== EDITED)).toEqual(before.filter(({ gameweek }) => gameweek !== EDITED));
    expect(after.find(({ gameweek }) => gameweek === EDITED)).not.toEqual(before.find(({ gameweek }) => gameweek === EDITED));
  });

  test("a second edit builds on the first: swapping the same two sides back undoes it", async () => {
    const before = await gamesIn(EDITED);
    const [one, other] = firstTwo(before);
    await swaps(COMMISSIONER, one, other);
    await swaps(COMMISSIONER, { moves: other.moves, against: one.against }, { moves: one.moves, against: other.against });
    expect(pairsOf(await gamesIn(EDITED))).toEqual(pairsOf(before));
  });

  test("files one letter to the whole league naming the swap", async () => {
    const before = await gamesIn(EDITED);
    await swaps(COMMISSIONER, ...firstTwo(before));
    const letters = await lettersAbout(EDITED);
    expect(letters.map((letter) => letter.to).toSorted()).toEqual([ANN, BOB, CAT, DAN, COMMISSIONER].toSorted());
    const [moved, other] = [await teamName(t, before[0].team), await teamName(t, before[1].opponent as Id<"teams">)];
    expect(letters[0].body).toContain(`swapped ${moved} and ${other} in gameweek ${EDITED}`);
  });

  test("the gameweek begins as edited, and stays so", async () => {
    await swaps(COMMISSIONER, ...firstTwo(await gamesIn(EDITED)));
    const edited = await gamesIn(EDITED);
    playUpTo(firstKickoff,EDITED);
    await t.run((ctx) => recordPassedDeadlines(ctx));
    expect(await gamesIn(EDITED)).toEqual(edited);
  });

  test("is refused once its deadline has passed", async () => {
    playUpTo(firstKickoff,EDITED);
    const swap = firstTwo(await gamesIn(EDITED));
    await expectRefused(swaps(COMMISSIONER, ...swap), fixtureEditRefusals.begun(EDITED));
    await t.run((ctx) => recordPassedDeadlines(ctx));
    await expectRefused(swaps(COMMISSIONER, ...swap), fixtureEditRefusals.begun(EDITED));
  });

  test("a rule change that redraws the gameweek replaces the edit", async () => {
    await swaps(COMMISSIONER, ...firstTwo(await gamesIn(EDITED)));
    await changeRules(t, leagueId, rulesWith({ gamesPerGameweek: 2 }));
    const games = await gamesIn(EDITED);
    expect(games).toHaveLength(4);
    expect([...gamesEach(games).values()]).toEqual([2, 2, 2, 2]);
  });

  test("the admin can make the same edit; a manager can't", async () => {
    const swap = firstTwo(await gamesIn(EDITED));
    await expectRefused(swaps(ANN, ...swap), refusals.notRunner);
    await swaps(ADMIN, ...swap);
    expect((await lettersAbout(EDITED))[0].body).toMatch(/^The admin swapped/);
  });

  test("refuses a game not in the gameweek, and two picks from one game", async () => {
    const [first, second] = await gamesIn(EDITED);
    const notAGame = { moves: first.team, against: second.team };
    await expectRefused(swaps(COMMISSIONER, notAGame, firstTwo([first, second])[1]), fixtureEditRefusals.noGame(EDITED));
    const [one] = firstTwo([first, second]);
    await expectRefused(swaps(COMMISSIONER, one, { moves: first.opponent, against: first.team }), fixtureEditRefusals.sameGame);
  });
});

describe("three teams, the odd one out playing the league's average", () => {
  beforeEach(() => leagueOf([ANN, BOB, CAT]));

  test("the average swaps like a team", async () => {
    const before = await gamesIn(EDITED);
    const withAverage = before.find((game) => game.opponent === LEAGUE_AVERAGE)!;
    const between = before.find((game) => game.opponent !== LEAGUE_AVERAGE)!;
    await swaps(COMMISSIONER, { moves: LEAGUE_AVERAGE, against: withAverage.team }, { moves: between.team, against: between.opponent });

    const after = await gamesIn(EDITED);
    expect(after).toContainEqual({ team: between.opponent, opponent: LEAGUE_AVERAGE });
    expect(after).toContainEqual({ team: between.team, opponent: withAverage.team });
    expect([...gamesEach(after).values()]).toEqual([1, 1, 1, 1]);
    expect((await lettersAbout(EDITED))[0].body).toContain(`swapped ${leagueAverageWords} and ${await teamName(t, between.team)}`);
  });
});

describe("swapSides", () => {
  const [a, b, c, d] = ["a", "b", "c", "d"] as Id<"teams">[];

  test("refuses a swap that has a side play itself", () => {
    // a plays both games, so moving b to a's other game would pair a with a.
    const games: Game[] = [{ team: a, opponent: b }, { team: a, opponent: c }];
    expect(swapSides(games, { moves: b, against: a }, { moves: c, against: a })).toEqual({ games: [{ team: c, opponent: a }, { team: b, opponent: a }], at: [0, 1] });
    expect(swapSides(games, { moves: a, against: b }, { moves: c, against: a })).toEqual({ refused: "playsItself" });
  });

  test("puts the team first when the average moves into a game", () => {
    const games: Game[] = [{ team: a, opponent: LEAGUE_AVERAGE }, { team: c, opponent: d }];
    expect(swapSides(games, { moves: a, against: LEAGUE_AVERAGE }, { moves: c, against: d })).toEqual({
      games: [{ team: c, opponent: LEAGUE_AVERAGE }, { team: a, opponent: d }],
      at: [0, 1],
    });
  });
});
