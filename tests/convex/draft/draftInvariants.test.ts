import { describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { pickRefusals } from "../../../convex/draft/draftPicks";
import type { Area } from "../../../convex/lineup/pitch";
import type { Position } from "../../../convex/positions/positionTables";
import type { LeagueRules } from "../../../convex/rules/leagueRulesShape";
import { draftSteps, FIRST_PICK_MS, midfielder } from "../../support/convex/draft.harness";
import { ARSENAL, CHELSEA, COVENTRY, insertClubs, insertPlayers, type HeldPlayer } from "../../support/convex/footballRows.harness";
import { changeEveryRules, NO_AREA_MINIMUMS } from "../../support/convex/leagueRules.harness";
import { actingAs, addManagers, adminCreatesLeague, ANN, BOB, CAT, COMMISSIONER, MANAGERS, teamName, type TestConvex } from "../../support/convex/leagues.harness";
import { pickGapPasses } from "../../support/convex/pickWindow.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";
import { everyRow, expectRefused, SLOW_TEST } from "../../support/convex/test.harness";
import { seededRandom } from "../../support/seededRandom";

// The draft's invariants, held under every league's rules (#2127): whatever the teams, rounds and
// squad rules, the picks run the snake over as many rounds as the squad's maximum (S04.18), each
// player goes to one team only (S04.10), a greyed-out pick is refused and leaves the saved data as
// it was, a legal pick is always left, and every finished squad is legal (S04.19). And every reason
// pickRefusals gives is met by a pick that is refused with it, nothing written.

type SquadRules = LeagueRules["squad"];

/** The clubs and positions a generated league's players come from: one area each. */
const CLUBS = [ARSENAL, CHELSEA, COVENTRY];
const POSITION_OF: Partial<Record<Area, Position>> = { goalkeeper: "GK", defence: "CB", midfield: "CM", attack: "ST" };
const AREAS_USED = Object.keys(POSITION_OF) as Area[];

/** One league's rules and teams, drawn from `seed`: 2 to 4 teams, 2 to 4 rounds, a club maximum or
 *  none, and area minimums or none, always ones some squad can meet. */
function leagueFrom(seed: number) {
  const random = seededRandom(seed);
  const teams = random.between(2, 4);
  const rounds = random.between(2, 4);
  // Three clubs, so a club maximum below a third of the squad could never be met.
  const maxPerClub = random.next() < 0.5 ? null : random.between(Math.ceil(rounds / CLUBS.length), rounds);
  let left = rounds;
  const minimumByArea =
    random.next() < 0.3
      ? null
      : Object.fromEntries(
          Object.keys(NO_AREA_MINIMUMS).map((area) => {
            const minimum = AREAS_USED.includes(area as Area) ? random.between(0, Math.min(2, left)) : 0;
            left -= minimum;
            return [area, minimum];
          }),
        ) as Record<Area, number>;
  const squad: SquadRules = { size: { minimum: 1, maximum: rounds }, maxPerClub, minimumByArea };
  // As many of each club's players in each area as there are picks, so none runs out: a team's
  // legal finish never hangs on what the others took.
  const players: HeldPlayer[] = CLUBS.flatMap((club, clubIndex) =>
    AREAS_USED.flatMap((area, areaIndex) =>
      Array.from({ length: teams * rounds }, (_, index) => {
        const code = 1000 * (clubIndex + 1) + 100 * areaIndex + index;
        return { ...midfielder(code, club), positions: [POSITION_OF[area]!] };
      }),
    ),
  );
  return { random, teams, rounds, squad, players };
}

/** A league with `managers` running its teams, these players and squad rules: its draft not started. */
async function leagueWith(managers: readonly string[], players: readonly HeldPlayer[], squad: SquadRules) {
  const t: TestConvex = await signInDeployment();
  fakeResend();
  const leagueId = await adminCreatesLeague(t, managers.length);
  const teams = await addManagers(t, leagueId, [...managers]);
  await t.run(async (ctx) => {
    await insertClubs(ctx, CLUBS);
    await insertPlayers(ctx, players);
  });
  await changeEveryRules(t, leagueId, (rules) => ({ ...rules, squad }));
  // Each signs in now, so a refused call's first sign-in never shows as a row it wrote.
  for (const email of [COMMISSIONER, ...managers]) await actingAs(t, email);
  return { t, leagueId, teams, ...draftSteps(() => ({ t, leagueId })) };
}

/** Each team's squad as the commissioner's Squads screen reads it: its players' codes and the
 *  league's squad limits it breaks. */
const squadsOf = async (t: TestConvex, leagueId: Id<"leagues">) =>
  (await (await actingAs(t, COMMISSIONER)).query(api.squads.squads.squads, { leagueId })).map(({ teamId, players, warnings }) => ({
    teamId,
    codes: players.map(({ code }) => code),
    warnings,
  }));

/** How many greyed-out picks the seeded drafts tried, all refused. */
let greyedTried = 0;

describe.each([1, 2, 3, 4, 5, 6])("a draft under the rules seed %i draws", (seed) => {
  test("runs the snake over the squad's maximum, each player to one team, every greyed pick refused and every squad legal (S04.18, S04.10, S04.19)", SLOW_TEST, async () => {
    const { random, teams: teamCount, rounds, squad, players } = leagueFrom(seed);
    const managers = MANAGERS.slice(0, teamCount);
    const { t, leagueId, teams, read, start, pick } = await leagueWith(managers, players, squad);
    const managerOf = new Map(teams.map((teamId, index) => [teamId, managers[index]]));
    const nameOf = new Map(players.map(({ code, name }) => [code, name]));
    await start();

    const drafted = new Set<number>();
    for (let draft = await read(); draft.status === "live"; draft = await read()) {
      const email = managerOf.get(draft.onTheClock.teamId)!;
      const greyed = new Set((await (await actingAs(t, COMMISSIONER)).query(api.draft.draftPlayers.greyedOnTheClock, { leagueId })).map(({ code }) => code));
      const undrafted = players.map(({ code }) => code).filter((code) => !drafted.has(code));
      const refused = undrafted.filter((code) => greyed.has(code));
      if (refused.length > 0) {
        const code = random.oneOf(refused);
        const before = await everyRow(t);
        await expectRefused(pick(email, code), pickRefusals.breaksSquadRules(nameOf.get(code)!), `pick ${draft.onTheClock.pick}`);
        expect(await everyRow(t)).toEqual(before);
        greyedTried += 1;
      }
      // Greying out always leaves a legal pick (Craig, 4 Nov 2026, on #1090).
      const legal = undrafted.filter((code) => !greyed.has(code));
      expect(legal, `pick ${draft.onTheClock.pick}`).not.toEqual([]);
      const code = random.oneOf(legal);
      await pick(email, code);
      await pickGapPasses(t);
      drafted.add(code);
    }

    expect(await read()).toMatchObject({ status: "over", rounds, picksMade: teamCount * rounds });
    // The order runs one way in odd rounds and back in even ones; with none set, it is the order
    // the teams joined (spec/04, Starting it).
    const snake = Array.from({ length: rounds }, (_, round) => (round % 2 === 0 ? teams : teams.toReversed())).flat();
    const picks = await t.run((ctx) => ctx.db.query("draftPicks").collect());
    expect(picks.toSorted((one, other) => one.pick - other.pick).map(({ teamId }) => teamId)).toEqual(snake);
    const squads = await squadsOf(t, leagueId);
    const held = squads.flatMap(({ codes }) => codes);
    expect(new Set(held).size).toBe(held.length);
    expect(held.toSorted()).toEqual([...drafted].sort());
    expect(squads.map(({ codes, warnings }) => ({ players: codes.length, warnings }))).toEqual(teams.map(() => ({ players: rounds, warnings: [] })));
  });
});

// Vitest runs a file's tests in order, so the seeded drafts above have run: their rules must grey
// some picks out, or they prove nothing about refusing them.
test("the seeded drafts tried greyed-out picks", () => {
  expect(greyedTried).toBeGreaterThan(5);
});

describe("every reason a pick is refused", () => {
  /** Three Arsenal midfielders and three Chelsea keepers. */
  const [M1, M2, M3] = [101, 102, 103];
  const [K1, K2, K3] = [301, 302, 303];
  const PLAYERS: HeldPlayer[] = [
    ...[M1, M2, M3].map((code) => midfielder(code)),
    ...[K1, K2, K3].map((code): HeldPlayer => ({ ...midfielder(code, CHELSEA), positions: ["GK"] })),
  ];
  /** Squads of 2, with no club or area limits. */
  const TWO_A_SIDE: SquadRules = { size: { minimum: 1, maximum: 2 }, maxPerClub: null, minimumByArea: null };

  type League = Awaited<ReturnType<typeof leagueWith>>;
  /** Each reason, with the league's squad rules, the steps that bring it about, and the refused call
   *  and the reason it is refused with, the team names read once the league is made. */
  const cases: Record<keyof typeof pickRefusals, { squad?: SquadRules; setUp: (league: League) => Promise<unknown>; refused: (league: League) => Promise<[() => Promise<unknown>, string]> }> = {
    notStarted: { setUp: async () => {}, refused: async ({ pick }) => [() => pick(ANN, M1), pickRefusals.notStarted] },
    over: {
      setUp: async ({ start, pickAndWait }) => {
        await start();
        for (const [email, code] of [[ANN, M1], [BOB, M2], [CAT, M3], [CAT, K1], [BOB, K2], [ANN, K3]] as const) await pickAndWait(email, code);
      },
      refused: async ({ pick }) => [() => pick(BOB, M1), pickRefusals.over],
    },
    paused: {
      setUp: async ({ start, pause }) => {
        await start();
        await pause();
      },
      refused: async ({ pick }) => [() => pick(ANN, M1), pickRefusals.paused],
    },
    notYourTurn: { setUp: ({ start }) => start(), refused: async ({ pick, t, teams }) => [() => pick(BOB, M1), pickRefusals.notYourTurn(await teamName(t, teams[0]))] },
    alreadyPicked: {
      setUp: ({ start }) => start(),
      refused: async ({ as, leagueId, t, teams }) => [
        async () => (await as(COMMISSIONER)).mutation(api.draft.draftPicks.pickFor, { leagueId, teamId: teams[1], playerCode: M1 }),
        pickRefusals.alreadyPicked(await teamName(t, teams[1])),
      ],
    },
    taken: {
      setUp: async ({ start, pickAndWait }) => {
        await start();
        await pickAndWait(ANN, M1);
      },
      refused: async ({ pick, t, teams }) => [() => pick(BOB, M1), pickRefusals.taken(`Player ${M1}`, await teamName(t, teams[0]))],
    },
    breaksSquadRules: {
      // One player each, a keeper: a midfielder would leave no room for one.
      squad: { size: { minimum: 1, maximum: 1 }, maxPerClub: null, minimumByArea: { ...NO_AREA_MINIMUMS, goalkeeper: 1 } },
      setUp: ({ start }) => start(),
      refused: async ({ pick }) => [() => pick(ANN, M1), pickRefusals.breaksSquadRules(`Player ${M1}`)],
    },
    undoing: {
      setUp: async ({ start, pick }) => {
        await start();
        await pick(ANN, M1);
      },
      refused: async ({ pick }) => [() => pick(BOB, M2), pickRefusals.undoing],
    },
    allPicked: {
      setUp: async ({ start, pick, pickAndWait }) => {
        await start();
        for (const [email, code] of [[ANN, M1], [BOB, M2], [CAT, M3], [CAT, K1], [BOB, K2]] as const) await pickAndWait(email, code);
        await pick(ANN, K3);
      },
      refused: async ({ pick }) => [() => pick(ANN, M1), pickRefusals.allPicked],
    },
    noOwnPick: { setUp: ({ start }) => start(), refused: async ({ as, leagueId }) => [async () => (await as(ANN)).mutation(api.draft.pickWindow.undoMyPick, { leagueId }), pickRefusals.noOwnPick] },
    undoOver: {
      setUp: async ({ start, pickAndWait }) => {
        await start();
        await pickAndWait(ANN, M1);
      },
      refused: async ({ as, leagueId }) => [async () => (await as(ANN)).mutation(api.draft.pickWindow.undoMyPick, { leagueId }), pickRefusals.undoOver],
    },
    // A pick sent for a turn that has passed (S04.20): auto-pick's, the commissioner's or her own.
    tooLateAuto: {
      setUp: async ({ start, pass }) => {
        await start();
        await pass(FIRST_PICK_MS);
      },
      refused: async ({ pick }) => [() => pick(ANN, M2, 1), pickRefusals.tooLateAuto(`Player ${M1}`)],
    },
    tooLateFor: {
      setUp: async ({ start, as, leagueId, t, teams }) => {
        await start();
        await (await as(COMMISSIONER)).mutation(api.draft.draftPicks.pickFor, { leagueId, teamId: teams[0], playerCode: M1 });
        await pickGapPasses(t);
      },
      refused: async ({ pick }) => [() => pick(ANN, M2, 1), pickRefusals.tooLateFor(`Player ${M1}`)],
    },
    tooLateOwn: {
      setUp: async ({ start, pickAndWait }) => {
        await start();
        await pickAndWait(ANN, M1);
      },
      refused: async ({ pick }) => [() => pick(ANN, M2, 1), pickRefusals.tooLateOwn(`Player ${M1}`)],
    },
    notThisPick: { setUp: ({ start }) => start(), refused: async ({ pick }) => [() => pick(ANN, M1, 6), pickRefusals.notThisPick] },
    notOnAutoPick: {
      setUp: ({ start }) => start(),
      refused: async ({ as, leagueId }) => [async () => (await as(ANN)).mutation(api.draft.autoPickSwitch.takeControlBack, { leagueId }), pickRefusals.notOnAutoPick],
    },
    onAutoPick: {
      setUp: async ({ start, as, leagueId }) => {
        await start();
        await (await as(ANN)).mutation(api.draft.autoPickSwitch.turnOn, { leagueId });
      },
      refused: async ({ as, leagueId }) => [async () => (await as(ANN)).mutation(api.draft.autoPickSwitch.turnOn, { leagueId }), pickRefusals.onAutoPick],
    },
  };

  test.each(Object.keys(pickRefusals) as (keyof typeof pickRefusals)[])("%s: refused, and nothing is written", async (reason) => {
    const { squad = TWO_A_SIDE, setUp, refused } = cases[reason];
    const league = await leagueWith([ANN, BOB, CAT], PLAYERS, squad);
    await setUp(league);
    const [call, told] = await refused(league);
    const before = await everyRow(league.t);
    await expectRefused(call(), told);
    expect(await everyRow(league.t)).toEqual(before);
  });
});
